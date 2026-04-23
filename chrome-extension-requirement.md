## Chrome Extension Requirement — ชัวร์ก่อนแชร์

> Derived from [initial-requirement.md](./initial-requirement.md) FR.8. This document is the authoritative spec for the Chrome Extension.

---

### Overview

The Chrome Extension is a Manifest V3 extension built with Vite + CRXJS + React + TypeScript + TailwindCSS. It shares the same brand and design tokens as the web app. The extension runs entirely against the same local backend (`http://localhost:3000`) and must work when the backend is reachable; offline it degrades gracefully with a clear error state.

---

### Architecture

```
chrome-extension/
├── manifest.json                 # MV3 manifest
├── src/
│   ├── background/
│   │   └── service-worker.ts     # cache, message routing, badge icon updates
│   ├── content/
│   │   └── index.ts              # badge injection + element picker (pick mode)
│   ├── popup/
│   │   ├── index.html
│   │   ├── main.tsx
│   │   ├── App.tsx               # page router: home | result | settings | history
│   │   └── components/
│   │       ├── HomePage.tsx
│   │       ├── ResultPage.tsx
│   │       ├── SettingsPage.tsx
│   │       └── HistoryPage.tsx
│   └── lib/
│       ├── types.ts
│       ├── storage.ts            # chrome.storage.local wrappers
│       └── api.ts                # fetch wrappers → localhost:3000
```

**Message flow**

```
Popup ──[chrome.tabs.sendMessage]──► Content Script
                                          │ activates pick mode
                                          │ user clicks element
Content Script ──[chrome.runtime.sendMessage]──► Service Worker
                                                      │ (optional: pre-fetch)
Content Script ──[chrome.runtime.sendMessage]──► Popup (via port)
                                                      │ fills input & triggers analysis
```

---

### EXT.1 — Popup UI

| ID | Requirement | Acceptance Criteria |
|----|-------------|---------------------|
| EXT.1.1 | Popup opens at fixed 360 × 600 px. | No horizontal scroll. Layout uses flex-col, overflow-y auto inside content area. |
| EXT.1.2 | Header shows product name, global on/off toggle, settings icon, history icon. | Toggle persists in `chrome.storage.local` key `globalEnabled`. When off, content scripts stop injecting badges. |
| EXT.1.3 | Home page has text/URL input (textarea, max 5000 chars), char counter, and primary "ตรวจสอบ" button. | Button disabled when input is empty or loading. |
| EXT.1.4 | "เลือกข้อความบนหน้า" button (pick-mode trigger) appears below the input area with a crosshair icon. | Clicking it sends `{ type: 'ACTIVATE_PICK_MODE' }` to the active tab's content script. Popup window closes automatically so the user can interact with the page. |
| EXT.1.5 | Loading state shows spinner + "กำลังตรวจสอบ..." text, disables all inputs. | Spinner uses CSS animation, no external lib. |
| EXT.1.6 | Error state renders inline Thai message below input. Never shows raw error text. | Standard errors mapped: network → "ไม่สามารถเชื่อมต่อ server ได้", timeout → "ใช้เวลานานเกินไป ลองใหม่อีกครั้ง". |
| EXT.1.7 | Result page shows: verdict badge, score 0–100, 5-level meter, top 3 references, "ดูผลเต็ม" link to web app. | "ดูผลเต็ม" opens `http://localhost:3000/result/{analysisId}` in a new tab. |
| EXT.1.8 | History page lists last 50 checks with verdict badge, truncated query, relative timestamp. Tapping an entry re-runs analysis. | History stored in `chrome.storage.local` key `history`. |
| EXT.1.9 | Settings page has per-site toggle for each supported site and a "Clear all data" button. | Toggles persist per domain. "Clear all data" removes all keys with confirmation dialog. |

---

### EXT.2 — Badge Injection (Content Script — Auto Mode)

| ID | Requirement | Acceptance Criteria |
|----|-------------|---------------------|
| EXT.2.1 | Content script runs on `facebook.com`, `x.com`, `twitter.com`, `today.line.me` at `document_idle`. | Declared in `manifest.json` `content_scripts`. |
| EXT.2.2 | Script identifies post containers using site-specific selectors. | X/Twitter: `[data-testid="tweetText"]`. Facebook: `[data-ad-preview="message"]`, `[class*="userContent"]`. LINE Today: `article p`. |
| EXT.2.3 | A MutationObserver watches `document.body` (childList + subtree) to catch dynamically loaded posts. | Observer is disconnected when global toggle is off. |
| EXT.2.4 | Each post gets one badge injected as a child element. Duplicate injection is prevented by checking for `.sbs-badge` class. | Badge is `display: inline-flex`, styled with verdict color, emoji, score. |
| EXT.2.5 | Badges are only shown when analysis confidence ≥ 70%. Below threshold, no badge is injected. | For MVP: mock data always sets confidence ≥ 70 for badge to appear. |
| EXT.2.6 | Clicking a badge opens the extension popup pre-loaded with the full result for that post. | Badge click sends `{ type: 'OPEN_POPUP_WITH_RESULT', resultId }` to service worker which calls `chrome.action.openPopup()`. |
| EXT.2.7 | Per-site toggle in Settings disables injection on that domain without reloading the tab. | Content script listens to `chrome.storage.onChanged` and removes all `.sbs-badge` elements + disconnects observer when toggled off. |

---

### EXT.3 — Element Picker (Pick Mode)

This feature lets the user click any visible text block on a page — exactly like the browser's DevTools element inspector — and send that content directly to analysis.

#### User Flow

1. User opens extension popup.
2. User clicks **"เลือกข้อความบนหน้า"** button.
3. Popup closes. Active tab enters pick mode.
4. User hovers over text blocks — each eligible element gets a blue highlight overlay.
5. User clicks an element. Pick mode deactivates. Popup re-opens pre-filled with extracted text and analysis runs automatically.
6. User can cancel at any time by pressing `Esc` or clicking the floating cancel toolbar.

#### Requirements

| ID | Requirement | Acceptance Criteria |
|----|-------------|---------------------|
| EXT.3.1 | Popup sends `{ type: 'ACTIVATE_PICK_MODE' }` to the active tab's content script and closes itself. | Uses `chrome.tabs.sendMessage`. Popup calls `window.close()` after sending. |
| EXT.3.2 | Content script receives the message and injects a `<style id="sbs-pick-mode-styles">` tag with pick-mode CSS. | Style tag is removed on deactivation. Only one pick-mode style tag exists at a time. |
| EXT.3.3 | Cursor changes to `crosshair` on the entire `document.body` while in pick mode. | Applied via injected style: `body { cursor: crosshair !important; }`. |
| EXT.3.4 | A floating toolbar appears fixed at top-center: `"🔍 โหมดเลือกข้อความ — คลิกที่ข้อความที่ต้องการตรวจสอบ"` + red **"ยกเลิก"** button. | Toolbar `z-index: 2147483647`. Never overlaps its own highlight. Styled with product brand colors. |
| EXT.3.5 | Eligible elements for highlighting: `<p>`, `<article>`, `<section>`, `<blockquote>`, `<div>` containing visible `innerText` of ≥ 30 characters, and site-specific post containers (X tweet article, Facebook post div, LINE Today article). | Eligibility check runs in `mouseover` handler before applying highlight. |
| EXT.3.6 | Hover highlight: `outline: 2px solid #1E40AF` + `background-color: rgba(30, 64, 175, 0.08)`. Applied via a shared CSS class `sbs-pick-hover`. | Class is added on `mouseover`, removed on `mouseout`. Only one element highlighted at a time. |
| EXT.3.7 | Nested element hits: when cursor is inside a deeply nested element, walk up the DOM with `closest()` to find the nearest eligible ancestor. | Prevents highlighting tiny `<span>` or `<a>` tags inside a post. Max walk-up depth: 6 levels. |
| EXT.3.8 | On click of a highlighted element: (1) extract `innerText`, (2) strip leading/trailing whitespace, (3) collapse multiple newlines to single, (4) truncate to 5000 characters, (5) deactivate pick mode, (6) send `{ type: 'PICKED_TEXT', text }` to service worker. | `event.preventDefault()` and `event.stopPropagation()` called to prevent page navigation or other click handlers. |
| EXT.3.9 | Service worker receives `PICKED_TEXT` and calls `chrome.action.openPopup()`, then sends the text to the popup via a port message `{ type: 'PREFILL_AND_ANALYZE', text }`. | Popup listens on `chrome.runtime.onConnect` for port `"pickup"`. |
| EXT.3.10 | Popup re-opens with text pre-filled and analysis auto-triggered (no second click needed). | `handleAnalyze(text)` is called inside `useEffect` when `prefillText` state is set. |
| EXT.3.11 | Deactivation removes: hover listeners, injected style tag, floating toolbar, all `.sbs-pick-hover` classes, cursor override. | A single `deactivatePickMode()` function handles full teardown. |
| EXT.3.12 | Pressing `Esc` anywhere on the page exits pick mode without selecting. | `keydown` listener on `document` checks `event.key === 'Escape'`. Listener is removed on deactivation. |
| EXT.3.13 | If the active tab does not have the content script injected (e.g., `chrome://` pages, PDF), popup shows: `"ไม่สามารถเลือกข้อความในหน้านี้ได้"`. | `chrome.tabs.sendMessage` error is caught in popup; no crash. |

---

### EXT.4 — API & Cache

| ID | Requirement | Acceptance Criteria |
|----|-------------|---------------------|
| EXT.4.1 | All analysis calls go to `http://localhost:3000/api/analyze/text` (POST, JSON body `{ query }`). | Configured via a single `API_BASE_URL` constant in `src/lib/api.ts`. |
| EXT.4.2 | Results are cached in `chrome.storage.local` keyed by `sha256(query)`. | Cache entry shape: `{ result: AnalysisResult, cachedAt: number }`. |
| EXT.4.3 | Cache TTL: 1 hour for general results. 24 hours for results with verdict `อันตราย` or `น่าสงสัย`. | TTL checked on read; stale entries ignored and re-fetched. |
| EXT.4.4 | Cache is checked before making a network call. Cache hit returns in < 50 ms. | Service worker reads cache synchronously before dispatching fetch. |
| EXT.4.5 | User can force-refresh by clicking "ตรวจสอบอีกครั้ง" which deletes the cache entry before re-fetching. | Cache key is deleted from `chrome.storage.local` before the fetch call. |

---

### EXT.5 — Privacy & Storage

| ID | Requirement | Acceptance Criteria |
|----|-------------|---------------------|
| EXT.5.1 | All persistent data lives in `chrome.storage.local`. Nothing is sent to any external server beyond `localhost:3000`. | No calls to analytics, telemetry, or third-party endpoints. |
| EXT.5.2 | History stores max 50 entries; oldest auto-removed when limit exceeded. | Write to history checks length before inserting; pops oldest if ≥ 50. |
| EXT.5.3 | "Clear all data" in Settings removes every key from `chrome.storage.local`. | `chrome.storage.local.clear()` called after user confirms dialog. |
| EXT.5.4 | A privacy notice is shown in the popup footer: `"🔒 ข้อมูลเก็บในเครื่องคุณเท่านั้น"`. | Static text, always visible in footer on home and result pages. |

---

### EXT.6 — Permissions (manifest.json)

| Permission | Reason |
|------------|--------|
| `storage` | `chrome.storage.local` for cache, history, settings |
| `activeTab` | Send messages to current tab for pick mode |
| `scripting` | Programmatic content script injection (fallback if declarative injection fails) |
| Host: `*://*.facebook.com/*` `*://*.x.com/*` `*://*.twitter.com/*` `*://today.line.me/*` | Badge injection via content scripts |

---

### EXT.7 — Non-Functional

| ID | Category | Requirement |
|----|----------|-------------|
| EXT.NF.1 | Performance | Popup first render ≤ 200 ms. Analysis result renders ≤ 3 s (network-bound). |
| EXT.NF.2 | Bundle size | Total extension dist ≤ 500 KB (excluding icons). Code-split popup and content script. |
| EXT.NF.3 | Compatibility | Chrome 114+ (MV3 stable). No Firefox support required for MVP. |
| EXT.NF.4 | Dark mode | Popup respects `prefers-color-scheme`. TailwindCSS `dark:` variants used throughout. |
| EXT.NF.5 | Accessibility | All interactive elements have `aria-label` in Thai. Popup navigable by keyboard Tab + Enter. |
| EXT.NF.6 | Error isolation | Content script errors must not throw to the page's console. Wrap all injected code in try/catch. |
| EXT.NF.7 | Dev loading | Extension loads via `chrome://extensions` → Load unpacked → `dist/`. Documented in README. |

---

### Milestones (Extension-specific)

| Phase | Scope | Done When |
|-------|-------|-----------|
| EXT-P1 | Popup UI scaffolding | Home, Result, Settings, History pages render with mock data |
| EXT-P2 | Real API integration | `localhost:3000` calls work, cache implemented |
| EXT-P3 | Badge injection | Badges appear on X posts with mock data |
| EXT-P4 | Element picker | Pick mode fully functional on all supported sites |
| EXT-P5 | Polish | Dark mode, a11y labels, error states, README section |
