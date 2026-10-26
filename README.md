# Nova — Browser Sidekick + Study Buddy

Nova is an independent Chrome Manifest V3 extension. It combines private browser actions with a small offline study helper covering common school questions across many subjects.

## How the study helper works

Nova has **not been trained as a machine-learning model**. Its school helper is a collection of hand-written explanations, pattern matching, and a small arithmetic parser included in `src/knowledge.js`. It answers common greetings, arithmetic expressions, and questions across math, language arts, science, geography, history, civics, computers, economics, health, the arts, and study skills. The arithmetic parser handles basic operations and parentheses without using `eval`. If Nova has no matching lesson, it says so rather than making up an answer. There is no API key, provider account, cloud model call, or paid inference requirement.

The lessons are intentionally concise—not a complete curriculum or a replacement for a teacher. The library can be expanded by editing `src/knowledge.js`. Chrome’s optional built-in on-device language model may help answer some other questions when the browser exposes it; availability varies, and Nova’s fixed lessons work without it.

## Try asking

- “Hi Nova”

- “What is 7 times 8?” or “What is 24 + 19?”

- “What is photosynthesis?” / “Explain the water cycle”

- “What is a fraction?” / “What is a prime number?”

- “What is a noun?” / “What is a synonym?” / “What is a metaphor?”

- “Who was Abraham Lincoln?” / “What are the three branches of government?”

- “Fix grammar: they is going to the park”

- “What can you teach?”

Quick example chips in the panel send a sample question with one tap.

## Browser actions

Nova also understands a small set of direct commands: `Summarize this page`, `Find privacy`, `Scroll down`, `Scroll up`, `Click “Read more”`, `Fill “Email” with “name@example.com”`, `Open example.com`, `Search the web for …`, `Go back`, and `Reload`. Clicks and field fills require confirmation. Nova never submits forms, buys items, deletes data, or runs hidden multi-step actions.

## Install

1. Unzip `nova-extension-1.6.0.zip`.

1. Open `chrome://extensions` in Chrome and enable **Developer mode**.

1. Select **Load unpacked** and choose the extracted folder containing `manifest.json`.

1. Open a regular webpage and click Nova’s toolbar button.

## Privacy and limits

Nova requests only `activeTab`, `scripting`, and `sidePanel`. Page content and questions stay on-device in Nova’s supported features. It has a finite collection of curated answers and simple grammar patterns, so it may not understand unfamiliar wording, advanced math, or complex grammar. It is not a general-purpose trained AI model. The optional built-in Chrome model depends on Chrome/device support.

## Easter egg and development

Tap Nova’s star at the top five times. No build, dependencies, API keys, provider accounts, or backend are needed. After editing, click **Reload** at `chrome://extensions`.
 
