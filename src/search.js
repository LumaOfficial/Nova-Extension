// Nova Search — a private search front end.
// Design rules: no cookies, no localStorage, no third-party requests, no remote
// images or fonts, and the query is never written to the URL or the request log.
import { searchKnowledge, knowledgeSize } from './knowledge.js';

const SOURCES = {
  wikipedia: 'en.wikipedia.org',
  instant: 'api.duckduckgo.com'
};
const ALLOWED_HOSTS = new Set(Object.values(SOURCES));

const TRACKING_PARAMS = new Set([
  'fbclid','gclid','dclid','msclkid','yclid','twclid','igshid','igsh','mc_cid','mc_eid',
  'mkt_tok','_hsenc','_hsmi','hsctatracking','vero_id','vero_conv','oly_anon_id','oly_enc_id',
  'wickedid','sc_cid','trk','trkCampaign','campaignid','adgroupid','adid','srsltid','gbraid','wbraid',
  'ref','referrer','source','src','si','spm','scm','at_medium','at_campaign','at_custom1','at_custom2'
]);
const BANGS = { '!n':'offline', '!nova':'offline', '!offline':'offline', '!w':'wiki', '!wiki':'wiki', '!i':'instant', '!answer':'instant' };

const $ = (id) => document.getElementById(id);

const state = {
  query: '',
  mode: 'all',
  loading: false,
  log: [],
  stripped: 0,
  history: [],
  startedAt: 0
};

// Snapshot before any of this page's code runs, so the ledger can prove that
// Nova Search itself writes nothing. Anything already on the browser is not ours.
const baseline = (() => {
  const keys = (store) => {
    try { return new Set(Object.keys(store)); } catch { return new Set(); }
  };
  let cookies = 0;
  try { cookies = document.cookie ? document.cookie.split(';').filter(Boolean).length : 0; } catch {}
  return { cookies, local: keys(window.localStorage), session: keys(window.sessionStorage) };
})();

/* ------------------------------------------------------------------ *
 * Tracking-parameter scrubber
 * ------------------------------------------------------------------ */
function decodeOnce(value) {
  try { return decodeURIComponent(value); } catch { return value; }
}

function scrubUrl(raw) {
  let url = String(raw || '').trim();
  if (!url) return { url, removed: 0 };

  // Unwrap common redirectors before cleaning the real destination.
  try {
    const outer = new URL(url);
    const inner = outer.searchParams.get('uddg') || outer.searchParams.get('u') || outer.searchParams.get('url');
    if (inner && /(^|\.)(duckduckgo|google|bing)\.com$/.test(outer.hostname)) url = decodeOnce(inner);
  } catch { /* keep the original string */ }

  try {
    const parsed = new URL(url);
    let removed = 0;
    for (const key of [...parsed.searchParams.keys()]) {
      const normalized = key.toLowerCase();
      if (normalized.startsWith('utm_') || TRACKING_PARAMS.has(normalized)) {
        parsed.searchParams.delete(key);
        removed += 1;
      }
    }
    if (/^:~:text=/.test(parsed.hash.slice(1))) parsed.hash = '';
    return { url: parsed.toString(), removed };
  } catch {
    return { url, removed: 0 };
  }
}

/* ------------------------------------------------------------------ *
 * Guarded networking + ledger
 * ------------------------------------------------------------------ */
async function privateJson(url, label) {
  const target = new URL(url);
  if (!ALLOWED_HOSTS.has(target.hostname)) throw new Error(`Blocked by shield: ${target.hostname}`);

  const started = performance.now();
  const response = await fetch(target.href, {
    method: 'GET',
    credentials: 'omit',
    cache: 'no-store',
    referrerPolicy: 'no-referrer',
    headers: { Accept: 'application/json' }
  });
  state.log.push({
    host: target.hostname,
    // The query string is intentionally left out of the record.
    path: target.pathname + (target.search ? '?…' : ''),
    label,
    status: response.status,
    ms: Math.round(performance.now() - started)
  });
  renderLedger();
  if (!response.ok) throw new Error(`${label} answered ${response.status}`);
  return response.json();
}

/* ------------------------------------------------------------------ *
 * Sources
 * ------------------------------------------------------------------ */
function plainText(html) {
  const text = String(html || '');
  if (!text.includes('<')) return text;
  return new DOMParser().parseFromString(text, 'text/html').body.textContent || '';
}

async function wikipediaResults(query) {
  const data = await privateJson(
    `https://en.wikipedia.org/w/rest.php/v1/search/page?q=${encodeURIComponent(query)}&limit=8`,
    'Wikipedia'
  );
  return (data.pages || []).map((page) => {
    const cleaned = scrubUrl(`https://en.wikipedia.org/wiki/${encodeURIComponent(page.key || page.title)}`);
    state.stripped += cleaned.removed;
    const snippet = plainText(page.excerpt || page.description || '').replace(/\s+/g, ' ').trim();
    return { title: page.title, url: cleaned.url, snippet, host: 'en.wikipedia.org', stripped: cleaned.removed };
  });
}

async function instantAnswer(query) {
  const data = await privateJson(
    `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1&t=nova-search`,
    'DuckDuckGo Instant Answers'
  );
  const body = plainText(data.AbstractText || data.Answer || data.Definition || '').trim();
  const link = scrubUrl(data.AbstractURL || data.DefinitionURL || '');
  state.stripped += link.removed;
  const topics = (data.RelatedTopics || [])
    .flatMap((item) => (item.Topics ? item.Topics : [item]))
    .filter((item) => item.FirstURL && item.Text)
    .slice(0, 4)
    .map((item) => {
      const cleaned = scrubUrl(item.FirstURL);
      state.stripped += cleaned.removed;
      return { title: plainText(item.Text), url: cleaned.url };
    });

  if (!body && !topics.length) return null;
  return {
    heading: plainText(data.Heading || '').trim(),
    body,
    url: body ? link.url : '',
    source: plainText(data.AbstractSource || data.DefinitionSource || '').trim(),
    topics
  };
}

function localNotes(query) {
  return searchKnowledge(query, 4).map((lesson) => ({
    title: lesson.title,
    text: String(lesson.text || '').slice(0, 420)
  }));
}

/* ------------------------------------------------------------------ *
 * Rendering
 * ------------------------------------------------------------------ */
function renderLedger() {
  const cookiesNow = (() => {
    try { return document.cookie ? document.cookie.split(';').filter(Boolean).length : 0; } catch { return 0; }
  })();
  const cookiesSet = Math.max(0, cookiesNow - baseline.cookies);
  $('nsStatCookies').textContent = String(cookiesSet);
  $('nsStatCookies').className = cookiesSet ? '' : 'good';

  const newKeys = (store, before) => {
    try { return Object.keys(store).filter((key) => !before.has(key)).length; } catch { return 0; }
  };
  const stored = newKeys(window.localStorage || {}, baseline.local) + newKeys(window.sessionStorage || {}, baseline.session);
  $('nsStatStorage').textContent = String(stored);
  $('nsStatStorage').className = stored ? '' : 'good';

  const note = $('nsLedgerPre');
  const preexisting = baseline.cookies || baseline.local.size || baseline.session.size;
  note.hidden = !preexisting;
  if (preexisting) {
    note.textContent = `This browser already had ${preexisting} item${preexisting === 1 ? '' : 's'} for this address before the page loaded. Nova Search did not create, read or change ${preexisting === 1 ? 'it' : 'them'}.`;
  }
  $('nsStatRequests').textContent = String(state.log.length);
  $('nsStatDomains').textContent = String(new Set(state.log.map((entry) => entry.host)).size);
  $('nsStatStripped').textContent = String(state.stripped);

  const log = $('nsLog');
  log.replaceChildren();
  if (!state.log.length) {
    const empty = document.createElement('li');
    empty.className = 'ns-log-empty';
    empty.textContent = 'Nothing has left your device yet.';
    log.append(empty);
    return;
  }
  for (const entry of state.log) {
    const row = document.createElement('li');
    const host = document.createElement('span');
    host.className = 'ns-log-host';
    host.textContent = entry.host;
    const path = document.createElement('span');
    path.className = 'ns-log-path';
    path.textContent = entry.path;
    const status = document.createElement('span');
    status.className = 'ns-log-status';
    status.textContent = String(entry.status);
    const ms = document.createElement('span');
    ms.className = 'ns-log-ms';
    ms.textContent = `${entry.ms} ms`;
    row.append(host, path, status, ms);
    log.append(row);
  }
}

function setBusy(busy) {
  state.loading = busy;
  $('nsResults').setAttribute('aria-busy', String(busy));
  $('nsResultsFoot').hidden = true;
}

function showStatus(text, loading = false) {
  const status = $('nsStatus');
  status.hidden = !text;
  status.textContent = text;
  status.className = loading ? 'ns-status loading' : 'ns-status';
}

function renderAnswer(answer) {
  const box = $('nsAnswer');
  box.replaceChildren();
  if (!answer) {
    box.hidden = true;
    return;
  }
  box.hidden = false;
  const kicker = document.createElement('p');
  kicker.className = 'ns-kicker';
  kicker.textContent = answer.source ? `Instant answer · ${answer.source}` : 'Instant answer';
  box.append(kicker);

  const heading = document.createElement('h3');
  heading.textContent = answer.heading || 'Quick answer';
  box.append(heading);

  if (answer.body) {
    const body = document.createElement('p');
    body.textContent = answer.body;
    box.append(body);
  }
  if (answer.url) {
    const link = document.createElement('a');
    link.className = 'ns-answer-link';
    link.href = answer.url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = 'Read the full source →';
    box.append(link);
  }
  if (answer.topics.length) {
    const list = document.createElement('ul');
    list.className = 'ns-topics';
    for (const topic of answer.topics) {
      const item = document.createElement('li');
      const anchor = document.createElement('a');
      anchor.href = topic.url;
      anchor.target = '_blank';
      anchor.rel = 'noopener noreferrer';
      anchor.textContent = topic.title;
      item.append(anchor);
      list.append(item);
    }
    box.append(list);
  }
}

function renderLocal(notes) {
  const box = $('nsLocal');
  box.replaceChildren();
  if (!notes.length) {
    box.hidden = true;
    return;
  }
  box.hidden = false;
  const kicker = document.createElement('p');
  kicker.className = 'ns-kicker';
  kicker.textContent = 'Offline · bundled with Nova · no network';
  const title = document.createElement('h3');
  title.textContent = 'From the local library';
  const list = document.createElement('ul');
  for (const note of notes) {
    const item = document.createElement('li');
    const strong = document.createElement('strong');
    strong.textContent = note.title;
    const copy = document.createElement('span');
    copy.textContent = note.text;
    item.append(strong, copy);
    list.append(item);
  }
  box.append(kicker, title, list);
}

function renderResults(items) {
  const list = $('nsList');
  list.replaceChildren();
  for (const item of items) {
    const row = document.createElement('li');
    row.className = 'ns-result';

    const top = document.createElement('div');
    top.className = 'ns-result-top';
    const domain = document.createElement('span');
    domain.className = 'ns-domain';
    domain.textContent = item.host;
    top.append(domain);
    if (item.stripped) {
      const flag = document.createElement('span');
      flag.className = 'ns-flag';
      flag.textContent = `${item.stripped} tracker${item.stripped === 1 ? '' : 's'} stripped`;
      top.append(flag);
    }

    const heading = document.createElement('h3');
    const anchor = document.createElement('a');
    anchor.href = item.url;
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
    anchor.textContent = item.title;
    heading.append(anchor);

    row.append(top, heading);
    if (item.snippet) {
      const snippet = document.createElement('p');
      snippet.className = 'ns-snippet';
      snippet.textContent = item.snippet;
      row.append(snippet);
    }
    list.append(row);
  }
}

function renderHistory() {
  const wrap = $('nsHistory');
  const chips = $('nsHistoryChips');
  chips.replaceChildren();
  wrap.hidden = state.history.length === 0;
  for (const query of state.history.slice(-6)) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.dataset.query = query;
    chip.textContent = query;
    chips.append(chip);
  }
}

function renderExamples() {
  const examples = $('nsExamples');
  if (examples.childElementCount) return;
  for (const example of ['What is a privacy budget?', 'How do tracker blockers work?', 'Photosynthesis', 'IPv6']) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.dataset.query = example;
    chip.textContent = example;
    examples.append(chip);
  }
}

/* ------------------------------------------------------------------ *
 * Search orchestration
 * ------------------------------------------------------------------ */
function parseBangs(raw) {
  let query = raw.trim();
  let mode = state.mode;
  const first = query.split(/\s+/)[0]?.toLowerCase();
  if (BANGS[first]) {
    mode = BANGS[first];
    query = query.slice(first.length).trim();
  }
  return { query, mode };
}

async function runSearch(raw) {
  const parsed = parseBangs(raw);
  const query = parsed.query.slice(0, 300);
  if (!query) {
    showStatus('Type something to search.');
    return;
  }
  const mode = parsed.mode;

  state.query = query;
  state.startedAt = performance.now();
  state.stripped = 0;
  state.log = [];
  renderLedger();
  $('nsEmpty').hidden = true;
  renderAnswer(null);
  renderLocal([]);
  renderResults([]);
  setBusy(true);

  const offline = mode === 'offline';
  showStatus(offline ? `Searching the offline library for “${query}”…` : `Searching for “${query}” — no cookie, no referrer, no stored history…`, true);

  const notes = (mode === 'all' || offline) ? localNotes(query) : [];
  const jobs = [];
  let wiki = [];
  if (mode === 'all' || mode === 'wiki') jobs.push(wikipediaResults(query).then((items) => { wiki = items; }));
  let answer = null;
  if (mode === 'all' || mode === 'instant') jobs.push(instantAnswer(query).then((value) => { answer = value; }));

  const failures = [];
  await Promise.all(jobs.map((job) => job.catch((error) => failures.push(error.message))));

  setBusy(false);
  renderLocal(notes);
  renderAnswer(answer);
  renderResults(wiki);

  const total = wiki.length + notes.length + (answer ? 1 : 0);
  if (!total) {
    showStatus(failures.length ? `No results. ${failures[0]}` : `Nothing found for “${query}”. Try different words, or !offline to search the bundled notes.`);
  } else {
    const parts = [];
    if (wiki.length) parts.push(`${wiki.length} web result${wiki.length === 1 ? '' : 's'}`);
    if (answer) parts.push('1 instant answer');
    if (notes.length) parts.push(`${notes.length} offline note${notes.length === 1 ? '' : 's'}`);
    showStatus(`${parts.join(' · ')} — answered in ${Math.round(performance.now() - state.startedAt)} ms`);
    if (failures.length) {
      const foot = $('nsResultsFoot');
      foot.hidden = false;
      foot.textContent = `One source was unavailable (${failures[0]}). Nothing else was contacted.`;
    }
  }

  if (!state.history.includes(query)) {
    state.history.push(query);
    if (state.history.length > 20) state.history.shift();
    renderHistory();
  }
  renderLedger();
}

function setMode(mode) {
  state.mode = mode;
  for (const chip of document.querySelectorAll('.ns-chip')) {
    chip.setAttribute('aria-pressed', String(chip.dataset.mode === mode));
  }
}

function toast(message) {
  const el = $('nsToast');
  el.textContent = message;
  el.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { el.hidden = true; }, 2600);
}

function burnSession() {
  state.log = [];
  state.history = [];
  state.stripped = 0;
  state.query = '';
  $('nsQuery').value = '';
  $('nsList').replaceChildren();
  renderAnswer(null);
  renderLocal([]);
  showStatus('');
  $('nsEmpty').hidden = false;
  $('nsResultsFoot').hidden = true;
  renderHistory();
  renderLedger();
  toast('Session erased — memory only, nothing was ever stored');
  $('nsQuery').focus();
}

/* ------------------------------------------------------------------ *
 * Wiring
 * ------------------------------------------------------------------ */
$('nsForm').addEventListener('submit', (event) => {
  event.preventDefault();
  runSearch($('nsQuery').value);
});

for (const chip of document.querySelectorAll('.ns-chip')) {
  chip.addEventListener('click', () => {
    setMode(chip.dataset.mode);
    if (state.query) runSearch(state.query);
    else $('nsQuery').focus();
  });
}

$('nsExamples').addEventListener('click', (event) => {
  const button = event.target.closest('button[data-query]');
  if (!button) return;
  $('nsQuery').value = button.dataset.query;
  runSearch(button.dataset.query);
});

$('nsHistoryChips').addEventListener('click', (event) => {
  const button = event.target.closest('button[data-query]');
  if (!button) return;
  $('nsQuery').value = button.dataset.query;
  runSearch(button.dataset.query);
});

$('nsBurn').addEventListener('click', burnSession);

$('nsLedgerToggle').addEventListener('click', (event) => {
  const body = $('nsLedgerBody');
  const open = body.hidden;
  body.hidden = !open;
  event.currentTarget.setAttribute('aria-expanded', String(open));
  event.currentTarget.textContent = open ? 'Hide request log' : 'Show request log';
});

document.addEventListener('keydown', (event) => {
  const typing = /^(INPUT|TEXTAREA)$/.test(document.activeElement?.tagName || '');
  const paletteKey = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k';
  if (paletteKey || (event.key === '/' && !typing)) {
    event.preventDefault();
    $('nsQuery').focus();
    $('nsQuery').select();
  }
  if (event.key === 'Escape' && typing) {
    $('nsQuery').value = '';
    $('nsQuery').blur();
  }
});

// A deep link may carry ?q=, but the query is never written back to the URL.
const initial = new URLSearchParams(location.search).get('q');
if (initial) {
  $('nsQuery').value = initial;
  runSearch(initial);
}

$('nsStatNotes').textContent = String(knowledgeSize());
renderExamples();
renderLedger();
