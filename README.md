# Nova — Browser Sidekick + Study Buddy

Nova is an independent Chrome Manifest V3 extension. It pairs private browser tools with a local reasoning engine: 186 curated study notes, a real calculator, unit and date converters, quizzes with XP and streaks, text utilities, a phrasebook and a command palette.

**Version 2.0.0** — build the package from `nova-extension-2.0.0.zip`.

## What is new in 2.0

- **Nova Brain** (`src/brain.js`) — a local engine that routes each question to a real skill instead of guessing: arithmetic, percentages and discounts, ratios, statistics, number theory, geometry, interest, dates, unit conversion, text work, code notes, quizzes and the curated library. Every answer names the skill that produced it.
- **186 lessons + 121 glossary terms** (`src/library.js`) plus the original notes. Maths, physics, chemistry, biology, earth science, astronomy, computer science, English, history, civics, geography, economics, business, health, learning science, art, music and media literacy.
- **Learn Lab** — scored multiple-choice decks generated from the notes and glossary, a daily challenge, XP levels, streaks, accuracy and badges.
- **Text Lab** — word and character counts, reading time, case conversion, slug, line sorting, de-duplication and a 40-phrase phrasebook in five languages.
- **Command palette** — `Ctrl+K` (`⌘K` on macOS) opens every view, prompt, persona, quiz topic and chat action in one searchable list.
- **Personas** — Tutor, Coach, Coder, Editor, Socratic and Buddy change how answers are shaped. Click the persona pill in the composer to cycle.
- **Voice input** — dictate a message where the browser supports speech recognition.
- **Follow-up chips** — every offline answer offers the next useful question with one tap.

## How the study helper works

Nova has **not been trained as a machine-learning model**. The local engine is hand-written: deterministic parsers, exact conversion factors, date arithmetic, and pattern-matched notes. It answers arithmetic, percentages, conversions, statistics, geometry, dates, text questions, code references and anything in its library. When it does not recognise a question it says so instead of inventing an answer, and it never fabricates a citation.

Chrome's optional built-in on-device model handles open-ended questions when the browser exposes it; availability varies and the offline engine works without it. There is no API key, provider account, cloud call or paid inference.

## Try asking

- “What is 7 times 8?” · “15% off 45” · “18% tip on 82.50”
- “Convert 5 km to miles” · “100 f to c” · “2 gb in mb”
- “Average of 4, 8, 15, 16, 23, 42” · “Is 97 prime?” · “Factors of 84”
- “Area of a circle radius 5” · “Compound interest 1000 at 5% for 10 years”
- “Days between 2026-01-01 and 2026-12-25” · “What day is 2027-05-04?”
- “Explain photosynthesis” · “What is an eigenvector?” · “Quiz me on biology”
- “Make flashcards about the water cycle” · “Study plan for chemistry in 5 days”
- “How do you say thank you in Japanese” · “Uppercase this text”
- “Tell me a joke” · “Give me a fun fact” · “Flip a coin”

## Browser actions

`Summarize this page`, `Find privacy`, `Scroll down`, `Click “Read more”`, `Fill “Email” with “name@example.com”`, `Open example.com`, `Search the web for …`, `Go back`, `Reload`. Clicks and field fills require confirmation. Nova never submits forms, buys items, deletes data, or runs hidden multi-step actions.

## Install

1. Unzip `nova-extension-2.0.0.zip`.
2. Open `chrome://extensions` in Chrome and enable **Developer mode**.
3. Select **Load unpacked** and choose the extracted folder containing `manifest.json`.
4. Open a regular webpage and click Nova's toolbar button (or press `Ctrl+Shift+Y`).

## Privacy and limits

Nova requests `activeTab`, `scripting`, `sidePanel` and `storage`. Page content is read only when you ask for it. Questions, quiz scores and streaks stay on the device. It is not a general-purpose trained model: its answers come from the curated notes and the deterministic skills above, so unfamiliar wording, advanced proofs and open-ended writing may go beyond it. Chrome's built-in model depends on Chrome/device support.

## Easter egg and development

Tap Nova's star at the top five times. No build step, dependencies, API keys, provider accounts or backend are needed. After editing, click **Reload** at `chrome://extensions`.
