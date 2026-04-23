# ชัวร์ก่อนแชร์ — Chrome Extension

Fact-check news and social media posts before sharing. Detects misinformation on Facebook, X/Twitter, and LINE Today.

## Stack

- Manifest V3 · React 18 · TypeScript · Vite + CRXJS · TailwindCSS

## Features

- **Popup** — paste or type any text/URL to analyze against `localhost:3000`
- **Pick mode** — click any text block on the page to analyze it directly
- **Badge injection** — auto-injects verdict badges on Facebook, X, and LINE Today posts
- **History** — last 50 checks with verdict and timestamp
- **Cache** — results cached locally (1 h general, 24 h for flagged content)

## Development

```bash
npm install
npm run build
```

Load the extension in Chrome:

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** → select `dist/`

Requires the backend running at `http://localhost:3000`.

## Project Structure

```
src/
├── background/    # Service worker — cache, message routing
├── content/       # Badge injection + element picker
├── popup/         # React UI (Home, Result, Settings, History)
└── lib/           # API client, storage helpers, types
```

## Permissions

| Permission | Purpose |
|---|---|
| `storage` | Cache, history, settings |
| `activeTab` | Pick mode message passing |
| `scripting` | Programmatic content script injection |
| Host permissions | Badge injection on supported sites |
