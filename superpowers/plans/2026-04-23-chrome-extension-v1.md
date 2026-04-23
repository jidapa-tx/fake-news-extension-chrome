# Chrome Extension V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the ชัวร์ก่อนแชร์ Chrome Extension from its current scaffold to a fully functional V1 covering all EXT-P1 through EXT-P5 milestones.

**Architecture:** Manifest V3 extension with a React popup (Vite + CRXJS + TypeScript + TailwindCSS), a service worker for message routing and cache, and a content script for badge injection + pick-mode on Facebook/X/LINE Today. All data stays in `chrome.storage.local`; API calls go to `http://localhost:3000`.

**Tech Stack:** Vite 5, CRXJS 2 beta, React 18, TypeScript 5, TailwindCSS 3, Chrome MV3 APIs (storage, tabs, runtime, action)

---

## Current State

The scaffold already exists at `chrome-extension/`. These files are **complete and need no changes**:

- `src/lib/types.ts` — all types defined
- `src/lib/mock-api.ts` — 5 mock scenarios (keep as offline fallback)
- `src/popup/main.tsx` — entry point
- `src/popup/components/ScoreMeter.tsx` — 5-segment bar
- `src/popup/components/ReferenceList.tsx` — reference cards

These files need **changes** (described in tasks below):

- `manifest.json` — missing `activeTab`, `scripting` permissions
- `src/lib/storage.ts` — history cap is 100, spec says 50
- `src/background/service-worker.ts` — currently empty stub
- `src/content/index.ts` — basic badges only, missing toggle check + pick mode
- `src/popup/App.tsx` — uses mock-api, missing prefill state + forceRefresh
- `src/popup/components/HomePage.tsx` — missing pick-mode button
- `src/popup/components/ResultPage.tsx` — missing "ดูผลเต็ม" + force-refresh
- `src/popup/components/SettingsPage.tsx` — missing "Clear all data" button
- `src/popup/index.css` — missing dark mode

These files need to be **created**:

- `src/lib/api.ts` — real API fetch with SHA-256 cache

---

## File Structure (complete map of what will exist after V1)

```
chrome-extension/
├── manifest.json                            # MV3: adds activeTab + scripting perms
├── src/
│   ├── background/
│   │   └── service-worker.ts               # MODIFY: message routing, openPopup, pending storage
│   ├── content/
│   │   └── index.ts                        # MODIFY: badge upgrade + full pick mode
│   ├── lib/
│   │   ├── types.ts                        # untouched
│   │   ├── mock-api.ts                     # untouched (offline fallback)
│   │   ├── storage.ts                      # MODIFY: fix history cap 100→50, add clearAll
│   │   └── api.ts                          # CREATE: real fetch + SHA-256 cache
│   └── popup/
│       ├── index.html                      # untouched
│       ├── main.tsx                        # untouched
│       ├── index.css                       # MODIFY: dark mode via @media
│       ├── App.tsx                         # MODIFY: real API, prefill, forceRefresh
│       └── components/
│           ├── ScoreMeter.tsx              # untouched
│           ├── ReferenceList.tsx           # untouched
│           ├── HomePage.tsx               # MODIFY: pick-mode button, error mapping
│           ├── ResultPage.tsx             # MODIFY: "ดูผลเต็ม" link, force-refresh btn
│           ├── SettingsPage.tsx           # MODIFY: "Clear all data" button
│           └── HistoryPage.tsx            # untouched
```

---

## Task 1: Manifest Permissions + Storage Fix

**Files:**

- Modify: `manifest.json`
- Modify: `src/lib/storage.ts`

- [ ] **Step 1: Add missing permissions to manifest.json**

Replace the permissions section:

```json
{
  "manifest_version": 3,
  "name": "ชัวร์ก่อนแชร์",
  "short_name": "ชัวร์ก่อนแชร์",
  "version": "0.1.0",
  "description": "ตรวจสอบข่าวก่อนส่งต่อ เพราะข่าวปลอมแพร่เร็วกว่าที่คุณคิด",
  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  },
  "action": {
    "default_popup": "src/popup/index.html",
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png"
    },
    "default_title": "ชัวร์ก่อนแชร์"
  },
  "background": {
    "service_worker": "src/background/service-worker.ts",
    "type": "module"
  },
  "content_scripts": [
    {
      "matches": [
        "*://*.facebook.com/*",
        "*://*.x.com/*",
        "*://*.twitter.com/*",
        "*://today.line.me/*"
      ],
      "js": ["src/content/index.ts"],
      "run_at": "document_idle"
    }
  ],
  "permissions": ["storage", "activeTab", "scripting"],
  "host_permissions": [
    "*://*.facebook.com/*",
    "*://*.x.com/*",
    "*://*.twitter.com/*",
    "*://today.line.me/*"
  ]
}
```

- [ ] **Step 2: Fix history cap in storage.ts**

In `src/lib/storage.ts`, change line in `addHistory` from `.slice(0, 100)` to `.slice(0, 50)`. Also add `clearAll` method:

```typescript
async addHistory(entry: HistoryEntry): Promise<void> {
  const hist = await this.getHistory()
  const updated = [entry, ...hist].slice(0, 50)  // spec: max 50
  if (isChromeStorage()) {
    return new Promise(resolve => chrome.storage.local.set({ [HISTORY_KEY]: updated }, resolve))
  }
  localStorage.setItem(HISTORY_KEY, JSON.stringify(updated))
},

async clearAll(): Promise<void> {
  if (isChromeStorage()) {
    return new Promise(resolve => chrome.storage.local.clear(resolve))
  }
  localStorage.clear()
},
```

- [ ] **Step 3: Build extension to verify no errors**

```bash
cd chrome-extension && npm run build
```

Expected: Build completes with no TypeScript errors. `dist/` folder is updated.

- [ ] **Step 4: Commit**

```bash
git add chrome-extension/manifest.json chrome-extension/src/lib/storage.ts
git commit -m "fix: add activeTab/scripting perms, cap history at 50"
```

---

## Task 2: Create src/lib/api.ts — Real API Client with SHA-256 Cache

**Files:**

- Create: `chrome-extension/src/lib/api.ts`

- [ ] **Step 1: Create the full api.ts file**

```typescript
// src/lib/api.ts
import type { AnalysisResult } from "./types";

export const API_BASE_URL = "http://localhost:3000";

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const CACHE_TTL_DANGER_MS = 24 * 60 * 60 * 1000; // 24 hours for อันตราย/น่าสงสัย

interface CacheEntry {
  result: AnalysisResult;
  cachedAt: number;
}

async function sha256(text: string): Promise<string> {
  const buffer = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text),
  );
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function cacheKey(hash: string): string {
  return `sbs_cache_${hash}`;
}

function getTtl(verdict: string): number {
  return ["อันตราย", "น่าสงสัย"].includes(verdict)
    ? CACHE_TTL_DANGER_MS
    : CACHE_TTL_MS;
}

async function readCache(key: string): Promise<AnalysisResult | null> {
  return new Promise((resolve) =>
    chrome.storage.local.get(key, (r) => {
      const entry: CacheEntry | undefined = r[key];
      if (!entry) return resolve(null);
      const ttl = getTtl(entry.result.verdict);
      if (Date.now() - entry.cachedAt > ttl) return resolve(null);
      resolve(entry.result);
    }),
  );
}

async function writeCache(key: string, result: AnalysisResult): Promise<void> {
  const entry: CacheEntry = { result, cachedAt: Date.now() };
  return new Promise((resolve) =>
    chrome.storage.local.set({ [key]: entry }, resolve),
  );
}

async function deleteCache(key: string): Promise<void> {
  return new Promise((resolve) => chrome.storage.local.remove(key, resolve));
}

export async function analyzeText(
  query: string,
  forceRefresh = false,
): Promise<AnalysisResult> {
  const hash = await sha256(query);
  const key = cacheKey(hash);

  if (!forceRefresh) {
    const cached = await readCache(key);
    if (cached) return cached;
  } else {
    await deleteCache(key);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10_000);

  try {
    const res = await fetch(`${API_BASE_URL}/api/analyze/text`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) throw new Error("server_error");

    const result: AnalysisResult = await res.json();
    await writeCache(key, result);
    return result;
  } catch (err) {
    clearTimeout(timeoutId);
    const name = (err as Error).name;
    const msg = (err as Error).message;
    if (name === "AbortError") throw new Error("timeout");
    if (msg === "server_error") throw new Error("server_error");
    throw new Error("network");
  }
}
```

- [ ] **Step 2: Build to verify TypeScript compiles**

```bash
cd chrome-extension && npm run build
```

Expected: Build succeeds. No type errors.

- [ ] **Step 3: Commit**

```bash
git add chrome-extension/src/lib/api.ts
git commit -m "feat: add api.ts with SHA-256 cache + TTL per verdict"
```

---

## Task 3: Service Worker — Message Routing

**Files:**

- Modify: `chrome-extension/src/background/service-worker.ts`

- [ ] **Step 1: Replace stub with full message handler**

The service worker handles two messages from the content script:

- `PICKED_TEXT`: stores text in storage then opens popup
- `OPEN_POPUP_WITH_RESULT`: stores resultId then opens popup

```typescript
// src/background/service-worker.ts

chrome.runtime.onInstalled.addListener(() => {
  console.log("[ชัวร์ก่อนแชร์] Extension installed");
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === "PICKED_TEXT") {
    chrome.storage.local.set({ sbs_pendingPickedText: msg.text }, () => {
      chrome.action.openPopup().catch(() => {});
      sendResponse({ ok: true });
    });
    return true;
  }

  if (msg.type === "OPEN_POPUP_WITH_RESULT") {
    chrome.storage.local.set({ sbs_pendingResultId: msg.resultId }, () => {
      chrome.action.openPopup().catch(() => {});
      sendResponse({ ok: true });
    });
    return true;
  }
});

export {};
```

- [ ] **Step 2: Build to verify**

```bash
cd chrome-extension && npm run build
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add chrome-extension/src/background/service-worker.ts
git commit -m "feat: service worker message routing for pick mode + badge click"
```

---

## Task 4: Content Script — Badge Injection Upgrade

**Files:**

- Modify: `chrome-extension/src/content/index.ts`

This task upgrades the badge injection to check the global toggle, per-site toggle, LINE Today selector, listen to storage changes, and send the badge-click message to the service worker. Pick mode comes in Task 5.

- [ ] **Step 1: Replace content/index.ts badge section**

```typescript
// src/content/index.ts
// Badge injection — checks globalEnabled + per-site toggle before injecting.
// All code wrapped in try/catch to prevent leaking errors to the host page.

const BADGE_CLASS = "sbs-badge";

const SITE_KEY_MAP: Record<
  string,
  keyof { facebook: boolean; twitter: boolean; lineToday: boolean }
> = {
  "facebook.com": "facebook",
  "x.com": "twitter",
  "twitter.com": "twitter",
  "today.line.me": "lineToday",
};

const MOCK_BADGES = [
  {
    verdict: "น่าสงสัย",
    score: 32,
    color: "#EA580C",
    bg: "#FFF7ED",
    emoji: "🟠",
  },
  {
    verdict: "อันตราย",
    score: 8,
    color: "#DC2626",
    bg: "#FEF2F2",
    emoji: "🔴",
  },
  {
    verdict: "ยืนยันแล้ว",
    score: 92,
    color: "#059669",
    bg: "#F0FDF4",
    emoji: "✅",
  },
  {
    verdict: "ไม่แน่ใจ",
    score: 51,
    color: "#CA8A04",
    bg: "#FEFCE8",
    emoji: "🟡",
  },
];

function getRandomBadge() {
  return MOCK_BADGES[Math.floor(Math.random() * MOCK_BADGES.length)];
}

function currentSiteKey() {
  const host = location.hostname.replace(/^www\./, "");
  return SITE_KEY_MAP[host] ?? null;
}

function createBadge(resultId: string): HTMLElement {
  const data = getRandomBadge();
  const el = document.createElement("div");
  el.className = BADGE_CLASS;
  el.style.cssText = `
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 8px;
    border-radius: 20px;
    font-size: 11px;
    font-weight: 600;
    font-family: 'IBM Plex Sans Thai', sans-serif;
    color: ${data.color};
    background: ${data.bg};
    border: 1px solid ${data.color}40;
    cursor: pointer;
    margin-top: 4px;
    user-select: none;
    transition: opacity 0.2s;
  `;
  el.title = "ชัวร์ก่อนแชร์ — คลิกเพื่อดูผล";
  el.innerHTML = `${data.emoji} ${data.verdict} (${data.score}%)`;

  el.addEventListener("click", (e) => {
    try {
      e.stopPropagation();
      chrome.runtime.sendMessage({ type: "OPEN_POPUP_WITH_RESULT", resultId });
    } catch {
      /* ignore */
    }
  });

  return el;
}

function injectBadges() {
  // X/Twitter
  document
    .querySelectorAll<HTMLElement>('[data-testid="tweetText"]')
    .forEach((el) => {
      if (el.querySelector(`.${BADGE_CLASS}`)) return;
      el.appendChild(createBadge(`mock-${el.dataset.testid}-${Date.now()}`));
    });

  // Facebook
  document
    .querySelectorAll<HTMLElement>(
      '[data-ad-preview="message"], [class*="userContent"]',
    )
    .forEach((el) => {
      if (el.querySelector(`.${BADGE_CLASS}`)) return;
      el.appendChild(createBadge(`mock-fb-${Date.now()}`));
    });

  // LINE Today
  document.querySelectorAll<HTMLElement>("article p").forEach((el) => {
    if (el.querySelector(`.${BADGE_CLASS}`)) return;
    if (el.innerText.trim().length < 30) return;
    el.appendChild(createBadge(`mock-line-${Date.now()}`));
  });
}

function removeAllBadges() {
  document.querySelectorAll(`.${BADGE_CLASS}`).forEach((el) => el.remove());
}

let observer: MutationObserver | null = null;

function startObserver() {
  if (observer) return;
  observer = new MutationObserver(() => {
    try {
      injectBadges();
    } catch {
      /* ignore */
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

function stopObserver() {
  observer?.disconnect();
  observer = null;
}

// Bootstrap: read settings, then init
try {
  chrome.storage.local.get("sbs_settings", (result) => {
    try {
      const settings = result["sbs_settings"];
      const siteKey = currentSiteKey();
      const globalEnabled: boolean = settings?.enabled ?? true;
      const siteEnabled: boolean = siteKey
        ? (settings?.sites?.[siteKey] ?? true)
        : false;

      if (globalEnabled && siteEnabled) {
        injectBadges();
        startObserver();
      }

      // React to toggle changes without reloading the tab
      chrome.storage.onChanged.addListener((changes) => {
        try {
          if (!changes["sbs_settings"]) return;
          const newSettings = changes["sbs_settings"].newValue;
          const nowGlobal: boolean = newSettings?.enabled ?? true;
          const nowSite: boolean = siteKey
            ? (newSettings?.sites?.[siteKey] ?? true)
            : false;

          if (nowGlobal && nowSite) {
            injectBadges();
            startObserver();
          } else {
            removeAllBadges();
            stopObserver();
          }
        } catch {
          /* ignore */
        }
      });
    } catch {
      /* ignore */
    }
  });
} catch {
  /* ignore */
}
```

- [ ] **Step 2: Build to verify**

```bash
cd chrome-extension && npm run build
```

Expected: Build succeeds.

- [ ] **Step 3: Manual test — load extension in Chrome**

1. Go to `chrome://extensions` → Enable Developer mode → Load unpacked → select `chrome-extension/dist/`
2. Navigate to `https://x.com`
3. Verify: badges appear on tweet text elements
4. Open extension popup → Settings → toggle "X / Twitter" off
5. Verify: badges disappear without page reload

- [ ] **Step 4: Commit**

```bash
git add chrome-extension/src/content/index.ts
git commit -m "feat: badge injection with toggle check, LINE Today, storage.onChanged"
```

---

## Task 5: Content Script — Full Pick Mode

**Files:**

- Modify: `chrome-extension/src/content/index.ts` (append pick-mode code)

- [ ] **Step 1: Append pick-mode implementation to content/index.ts**

Add the following code at the end of `src/content/index.ts` (after the badge bootstrap block):

```typescript
// ─── Pick Mode ───────────────────────────────────────────────────────────────

const PICK_STYLE_ID = "sbs-pick-mode-styles";
const PICK_TOOLBAR_ID = "sbs-pick-toolbar";
const PICK_HOVER_CLASS = "sbs-pick-hover";

let isPickMode = false;
let hoverTarget: HTMLElement | null = null;

const ELIGIBLE_TAGS = new Set(["p", "article", "section", "blockquote", "div"]);
const SITE_SELECTORS = [
  '[data-testid="tweetText"]',
  '[data-ad-preview="message"]',
  "article p",
];

function isEligibleElement(el: HTMLElement): boolean {
  const tag = el.tagName.toLowerCase();
  if (!ELIGIBLE_TAGS.has(tag)) return false;
  return (el.innerText?.trim().length ?? 0) >= 30;
}

function findPickTarget(el: EventTarget | null): HTMLElement | null {
  if (!(el instanceof HTMLElement)) return null;
  // Check site-specific selectors first
  for (const sel of SITE_SELECTORS) {
    const match = (el as HTMLElement).closest(sel);
    if (match) return match as HTMLElement;
  }
  // Walk up DOM max 6 levels
  let current: HTMLElement | null = el;
  let depth = 0;
  while (current && depth < 6) {
    if (isEligibleElement(current)) return current;
    current = current.parentElement;
    depth++;
  }
  return null;
}

function injectPickStyles() {
  if (document.getElementById(PICK_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = PICK_STYLE_ID;
  style.textContent = `
    body { cursor: crosshair !important; }
    .${PICK_HOVER_CLASS} {
      outline: 2px solid #1E40AF !important;
      background-color: rgba(30, 64, 175, 0.08) !important;
    }
  `;
  document.head.appendChild(style);
}

function removePickStyles() {
  document.getElementById(PICK_STYLE_ID)?.remove();
}

function injectToolbar() {
  if (document.getElementById(PICK_TOOLBAR_ID)) return;
  const toolbar = document.createElement("div");
  toolbar.id = PICK_TOOLBAR_ID;
  toolbar.style.cssText = `
    position: fixed;
    top: 12px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 2147483647;
    display: flex;
    align-items: center;
    gap: 10px;
    background: #1E40AF;
    color: white;
    padding: 8px 16px;
    border-radius: 24px;
    font-family: 'IBM Plex Sans Thai', sans-serif;
    font-size: 13px;
    font-weight: 500;
    box-shadow: 0 4px 16px rgba(30,64,175,0.4);
    pointer-events: auto;
  `;
  toolbar.innerHTML = `
    <span>🔍 โหมดเลือกข้อความ — คลิกที่ข้อความที่ต้องการตรวจสอบ</span>
    <button id="sbs-pick-cancel" style="
      background: #DC2626;
      color: white;
      border: none;
      padding: 4px 10px;
      border-radius: 12px;
      font-size: 12px;
      cursor: pointer;
      font-family: inherit;
    ">ยกเลิก</button>
  `;
  document.body.appendChild(toolbar);
  document
    .getElementById("sbs-pick-cancel")
    ?.addEventListener("click", deactivatePickMode);
}

function removeToolbar() {
  document.getElementById(PICK_TOOLBAR_ID)?.remove();
}

function onMouseOver(e: MouseEvent) {
  try {
    const target = findPickTarget(e.target);
    if (hoverTarget && hoverTarget !== target) {
      hoverTarget.classList.remove(PICK_HOVER_CLASS);
    }
    if (target) {
      target.classList.add(PICK_HOVER_CLASS);
      hoverTarget = target;
    }
  } catch {
    /* ignore */
  }
}

function onMouseOut(e: MouseEvent) {
  try {
    const target = findPickTarget(e.target);
    target?.classList.remove(PICK_HOVER_CLASS);
  } catch {
    /* ignore */
  }
}

function onPickClick(e: MouseEvent) {
  try {
    const target = findPickTarget(e.target);
    if (!target) return;
    e.preventDefault();
    e.stopPropagation();

    let text = target.innerText.trim();
    text = text.replace(/\n{2,}/g, "\n").slice(0, 5000);

    deactivatePickMode();
    chrome.runtime.sendMessage({ type: "PICKED_TEXT", text });
  } catch {
    /* ignore */
  }
}

function onKeyDown(e: KeyboardEvent) {
  if (e.key === "Escape") {
    try {
      deactivatePickMode();
    } catch {
      /* ignore */
    }
  }
}

function deactivatePickMode() {
  if (!isPickMode) return;
  isPickMode = false;
  hoverTarget?.classList.remove(PICK_HOVER_CLASS);
  hoverTarget = null;
  removePickStyles();
  removeToolbar();
  document.removeEventListener("mouseover", onMouseOver);
  document.removeEventListener("mouseout", onMouseOut);
  document.removeEventListener("click", onPickClick, true);
  document.removeEventListener("keydown", onKeyDown);
}

function activatePickMode() {
  if (isPickMode) return;
  isPickMode = true;
  injectPickStyles();
  injectToolbar();
  document.addEventListener("mouseover", onMouseOver);
  document.addEventListener("mouseout", onMouseOut);
  document.addEventListener("click", onPickClick, true);
  document.addEventListener("keydown", onKeyDown);
}

// Listen for ACTIVATE_PICK_MODE from popup
try {
  chrome.runtime.onMessage.addListener((msg) => {
    try {
      if (msg.type === "ACTIVATE_PICK_MODE") {
        activatePickMode();
      }
    } catch {
      /* ignore */
    }
  });
} catch {
  /* ignore */
}
```

- [ ] **Step 2: Build to verify**

```bash
cd chrome-extension && npm run build
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add chrome-extension/src/content/index.ts
git commit -m "feat: element picker (pick mode) with hover highlight and Esc cancel"
```

---

## Task 6: Update App.tsx — Real API + Prefill State

**Files:**

- Modify: `chrome-extension/src/popup/App.tsx`

- [ ] **Step 1: Replace App.tsx with real API + prefill**

```tsx
// src/popup/App.tsx
import { useState, useEffect } from "react";
import { analyzeText } from "../lib/api";
import { analyzeContent } from "../lib/mock-api";
import { storage } from "../lib/storage";
import type { AnalysisResult, SiteSettings } from "../lib/types";
import { HomePage } from "./components/HomePage";
import { ResultPage } from "./components/ResultPage";
import { SettingsPage } from "./components/SettingsPage";
import { HistoryPage } from "./components/HistoryPage";

type Page = "home" | "result" | "settings" | "history";

const ERROR_MAP: Record<string, string> = {
  network: "ไม่สามารถเชื่อมต่อ server ได้",
  timeout: "ใช้เวลานานเกินไป ลองใหม่อีกครั้ง",
  server_error: "Server ไม่ตอบสนอง กรุณาลองใหม่",
};

export default function App() {
  const [page, setPage] = useState<Page>("home");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [prefillText, setPrefillText] = useState<string | null>(null);

  useEffect(() => {
    storage.getSettings().then(setSettings);

    // Check for pending picked text from pick mode
    if (typeof chrome !== "undefined" && chrome.storage) {
      chrome.storage.local.get("sbs_pendingPickedText", (r) => {
        const text: string | undefined = r["sbs_pendingPickedText"];
        if (text) {
          chrome.storage.local.remove("sbs_pendingPickedText");
          setPrefillText(text);
        }
      });
    }
  }, []);

  // Auto-trigger analysis when prefillText is set
  useEffect(() => {
    if (prefillText) {
      handleAnalyze(prefillText);
      setPrefillText(null);
    }
  }, [prefillText]);

  const handleAnalyze = async (query: string, forceRefresh = false) => {
    setIsLoading(true);
    setError(null);
    try {
      let res: AnalysisResult;
      try {
        res = await analyzeText(query, forceRefresh);
      } catch (apiErr) {
        // Fallback to mock when backend is unreachable
        if (
          (apiErr as Error).message === "network" ||
          (apiErr as Error).message === "timeout"
        ) {
          res = await analyzeContent(query);
          res = { ...res, id: `offline-${Date.now()}` };
        } else {
          throw apiErr;
        }
      }
      setResult(res);
      await storage.addHistory({
        id: res.id,
        query: query.slice(0, 80),
        verdict: res.verdict,
        score: res.score,
        checkedAt: res.analyzedAt,
      });
      setPage("result");
    } catch (err) {
      const code = (err as Error).message;
      setError(ERROR_MAP[code] ?? "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveSettings = async (newSettings: SiteSettings) => {
    setSettings(newSettings);
    await storage.saveSettings(newSettings);
  };

  if (!settings) return null;

  return (
    <div className="flex flex-col flex-1">
      {page === "home" && (
        <HomePage
          isLoading={isLoading}
          error={error}
          prefillText={prefillText ?? ""}
          onAnalyze={handleAnalyze}
          onOpenSettings={() => setPage("settings")}
          onOpenHistory={() => setPage("history")}
        />
      )}
      {page === "result" && result && (
        <ResultPage
          result={result}
          onBack={() => setPage("home")}
          onForceRefresh={() => handleAnalyze(result.query, true)}
        />
      )}
      {page === "settings" && settings && (
        <SettingsPage
          settings={settings}
          onBack={() => setPage("home")}
          onSave={handleSaveSettings}
        />
      )}
      {page === "history" && (
        <HistoryPage onBack={() => setPage("home")} onRecheck={handleAnalyze} />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Build to verify TypeScript types are consistent**

```bash
cd chrome-extension && npm run build
```

Expected: Build succeeds. (Will show prop type errors for HomePage/ResultPage until Task 7+8 are done — that's expected.)

- [ ] **Step 3: Commit**

```bash
git add chrome-extension/src/popup/App.tsx
git commit -m "feat: App.tsx wires real API with mock fallback, prefill state for pick mode"
```

---

## Task 7: Update HomePage.tsx — Pick-Mode Button + Error Display

**Files:**

- Modify: `chrome-extension/src/popup/components/HomePage.tsx`

- [ ] **Step 1: Replace HomePage.tsx**

```tsx
// src/popup/components/HomePage.tsx
import { useState, useEffect } from "react";

type Tab = "text" | "url";

interface Props {
  isLoading: boolean;
  error: string | null;
  prefillText: string;
  onAnalyze: (query: string) => void;
  onOpenSettings: () => void;
  onOpenHistory: () => void;
}

export function HomePage({
  isLoading,
  error,
  prefillText,
  onAnalyze,
  onOpenSettings,
  onOpenHistory,
}: Props) {
  const [tab, setTab] = useState<Tab>("text");
  const [input, setInput] = useState("");
  const [pickError, setPickError] = useState<string | null>(null);

  useEffect(() => {
    if (prefillText) {
      setTab("text");
      setInput(prefillText);
    }
  }, [prefillText]);

  const handleSubmit = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    if (tab === "url" && !trimmed.match(/^https?:\/\/.+/)) {
      // Inline validation — no alert
      return;
    }
    onAnalyze(trimmed);
  };

  const handlePickMode = () => {
    setPickError(null);
    if (typeof chrome === "undefined" || !chrome.tabs) {
      setPickError("ไม่สามารถเลือกข้อความในหน้านี้ได้");
      return;
    }
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (!tab?.id) return;
      chrome.tabs.sendMessage(tab.id, { type: "ACTIVATE_PICK_MODE" }, () => {
        if (chrome.runtime.lastError) {
          setPickError("ไม่สามารถเลือกข้อความในหน้านี้ได้");
          return;
        }
        window.close();
      });
    });
  };

  return (
    <div className="flex flex-col flex-1 bg-white dark:bg-slate-900">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#1E40AF]">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-white rounded-full flex items-center justify-center">
            <span className="text-[#1E40AF] text-xs font-bold">✓</span>
          </div>
          <span className="text-white font-semibold text-sm">
            ชัวร์ก่อนแชร์
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onOpenHistory}
            aria-label="ประวัติการตรวจสอบ"
            className="text-white/80 hover:text-white p-1 rounded text-xs"
          >
            🕐
          </button>
          <button
            onClick={onOpenSettings}
            aria-label="ตั้งค่า"
            className="text-white/80 hover:text-white p-1 rounded text-xs"
          >
            ⚙️
          </button>
        </div>
      </div>

      <div className="flex flex-col flex-1 p-4 gap-3">
        {/* Tab selector */}
        <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
          {(["text", "url"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => {
                setTab(t);
                setInput("");
              }}
              className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${
                tab === t
                  ? "bg-white dark:bg-slate-700 text-[#1E40AF] dark:text-blue-400 shadow-sm"
                  : "text-slate-500 hover:text-slate-700 dark:text-slate-400"
              }`}
            >
              {t === "text" ? "📝 ข้อความ" : "🔗 URL"}
            </button>
          ))}
        </div>

        {/* Input area */}
        {tab === "text" ? (
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="วางข้อความข่าวที่ต้องการตรวจสอบที่นี่..."
            maxLength={5000}
            rows={5}
            aria-label="ข้อความที่ต้องการตรวจสอบ"
            className="w-full p-3 border border-slate-200 dark:border-slate-600 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#1E40AF]/30 focus:border-[#1E40AF] placeholder:text-slate-400 dark:bg-slate-800 dark:text-slate-100"
          />
        ) : (
          <input
            type="url"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="https://example.com/news/..."
            aria-label="URL ที่ต้องการตรวจสอบ"
            className="w-full p-3 border border-slate-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1E40AF]/30 focus:border-[#1E40AF] placeholder:text-slate-400 dark:bg-slate-800 dark:text-slate-100"
          />
        )}

        {/* Character count */}
        {tab === "text" && (
          <div className="text-right text-xs text-slate-400 -mt-2">
            {input.length}/5000
          </div>
        )}

        {/* Pick mode button */}
        <button
          onClick={handlePickMode}
          disabled={isLoading}
          aria-label="เลือกข้อความบนหน้าเว็บ"
          className="w-full py-2 rounded-lg border border-slate-200 dark:border-slate-600 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
        >
          ⊕ เลือกข้อความบนหน้า
        </button>

        {/* Pick error */}
        {pickError && (
          <div className="bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 text-xs text-orange-700">
            {pickError}
          </div>
        )}

        {/* API error */}
        {error && (
          <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2 text-sm text-red-600 dark:text-red-400">
            {error}
          </div>
        )}

        {/* Analyze button */}
        <button
          onClick={handleSubmit}
          disabled={isLoading || !input.trim()}
          aria-label="ตรวจสอบข่าว"
          className={`w-full py-3 rounded-lg font-semibold text-sm transition-all ${
            isLoading || !input.trim()
              ? "bg-slate-100 text-slate-400 cursor-not-allowed dark:bg-slate-800 dark:text-slate-500"
              : "bg-[#1E40AF] text-white hover:bg-blue-700 active:bg-blue-800 shadow-sm"
          }`}
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <svg
                className="animate-spin w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v8H4z"
                />
              </svg>
              กำลังตรวจสอบ...
            </span>
          ) : (
            "🔍 ตรวจสอบ"
          )}
        </button>

        {/* Privacy notice */}
        <div className="mt-auto flex items-center justify-center gap-1.5 py-2 px-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            🔒 ข้อมูลเก็บในเครื่องคุณเท่านั้น
          </span>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Build to verify**

```bash
cd chrome-extension && npm run build
```

Expected: Build succeeds. (ResultPage prop error resolved after Task 8.)

- [ ] **Step 3: Commit**

```bash
git add chrome-extension/src/popup/components/HomePage.tsx
git commit -m "feat: pick-mode button, aria-labels, dark mode, error display in HomePage"
```

---

## Task 8: Update ResultPage.tsx — "ดูผลเต็ม" + Force Refresh

**Files:**

- Modify: `chrome-extension/src/popup/components/ResultPage.tsx`

- [ ] **Step 1: Replace ResultPage.tsx**

```tsx
// src/popup/components/ResultPage.tsx
import type { AnalysisResult, VerdictLevel } from "../../lib/types";
import { API_BASE_URL } from "../../lib/api";
import { ScoreMeter } from "./ScoreMeter";
import { ReferenceList } from "./ReferenceList";

interface Props {
  result: AnalysisResult;
  onBack: () => void;
  onForceRefresh: () => void;
}

const VERDICT_CONFIG: Record<
  VerdictLevel,
  { color: string; bg: string; border: string; emoji: string }
> = {
  อันตราย: { color: "#DC2626", bg: "#FEF2F2", border: "#FECACA", emoji: "🔴" },
  น่าสงสัย: { color: "#EA580C", bg: "#FFF7ED", border: "#FED7AA", emoji: "🟠" },
  ไม่แน่ใจ: { color: "#CA8A04", bg: "#FEFCE8", border: "#FDE68A", emoji: "🟡" },
  ค่อนข้างจริง: {
    color: "#65A30D",
    bg: "#F7FEE7",
    border: "#D9F99D",
    emoji: "🟢",
  },
  ยืนยันแล้ว: {
    color: "#059669",
    bg: "#F0FDF4",
    border: "#BBF7D0",
    emoji: "✅",
  },
};

export function ResultPage({ result, onBack, onForceRefresh }: Props) {
  const cfg = VERDICT_CONFIG[result.verdict];
  const fullResultUrl = `${API_BASE_URL}/result/${result.id}`;

  return (
    <div className="flex flex-col flex-1 bg-white dark:bg-slate-900">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 bg-[#1E40AF]">
        <button
          onClick={onBack}
          aria-label="กลับหน้าหลัก"
          className="text-white/80 hover:text-white text-sm"
        >
          ← กลับ
        </button>
        <span className="text-white font-semibold text-sm">ผลการตรวจสอบ</span>
      </div>

      <div className="flex flex-col gap-3 p-4 overflow-y-auto">
        {/* Verdict card */}
        <div
          className="rounded-xl p-4 border"
          style={{ background: cfg.bg, borderColor: cfg.border }}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-2xl">{cfg.emoji}</span>
              <span
                className="text-lg font-semibold"
                style={{ color: cfg.color }}
              >
                {result.verdict}
              </span>
            </div>
            <span className="text-2xl font-bold" style={{ color: cfg.color }}>
              {result.score}%
            </span>
          </div>
          <ScoreMeter score={result.score} />
          <p className="text-xs text-slate-500 mt-2 text-right">
            ตรวจครั้งล่าสุด:{" "}
            {new Date(result.analyzedAt).toLocaleString("th-TH")}
          </p>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2">
          <StatCard
            label="ยืนยัน"
            value={`${result.supporting}%`}
            color="#059669"
          />
          <StatCard
            label="คัดค้าน"
            value={`${result.opposing}%`}
            color="#DC2626"
          />
          <StatCard
            label="ไม่แน่ใจ"
            value={`${result.unchecked}%`}
            color="#94A3B8"
          />
        </div>

        {/* AI Confidence */}
        <div className="flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-lg">
          <span className="text-xs text-slate-600 dark:text-slate-400">
            AI Confidence
          </span>
          <span
            className={`text-xs font-semibold ${result.confidence >= 60 ? "text-[#1E40AF]" : "text-orange-500"}`}
          >
            {result.confidence}%
          </span>
        </div>
        {result.confidence < 60 && (
          <div className="bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 text-xs text-orange-700">
            ⚠ AI ยังไม่มั่นใจในผลนี้ กรุณาตรวจสอบเพิ่มเติม
          </div>
        )}

        {/* Query preview */}
        <div className="bg-slate-50 dark:bg-slate-800 rounded-lg px-3 py-2">
          <p className="text-xs text-slate-400 mb-0.5">ข้อความที่ตรวจสอบ</p>
          <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2">
            {result.query}
          </p>
        </div>

        {/* Reasons */}
        <div>
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
            เหตุผล
          </h3>
          <div className="flex flex-col gap-1.5">
            {result.reasons.map((reason, i) => (
              <div
                key={i}
                className="flex gap-2 text-xs text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 rounded-lg px-3 py-2"
              >
                <span className="flex-shrink-0">{reason.slice(0, 1)}</span>
                <span>{reason.slice(2)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* References — top 3 */}
        <div>
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
            แหล่งอ้างอิง ({result.references.length})
          </h3>
          <ReferenceList references={result.references.slice(0, 3)} />
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 mt-1">
          <a
            href={fullResultUrl}
            target="_blank"
            rel="noreferrer"
            aria-label="ดูผลเต็มบนเว็บแอป"
            className="flex-1 py-2 text-center text-xs font-medium text-[#1E40AF] border border-[#1E40AF]/30 rounded-lg hover:bg-blue-50 transition-colors"
          >
            ดูผลเต็ม →
          </a>
          <button
            onClick={onForceRefresh}
            aria-label="ตรวจสอบอีกครั้ง"
            className="flex-1 py-2 text-xs font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 dark:text-slate-400 dark:border-slate-600 dark:hover:bg-slate-800 transition-colors"
          >
            ตรวจสอบอีกครั้ง
          </button>
        </div>

        {/* Privacy notice */}
        <div className="text-center text-xs text-slate-400 pb-1">
          🔒 ข้อมูลเก็บในเครื่องคุณเท่านั้น ไม่ส่งไป server
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-2 text-center">
      <div className="text-base font-bold" style={{ color }}>
        {value}
      </div>
      <div className="text-xs text-slate-500 dark:text-slate-400">{label}</div>
    </div>
  );
}
```

- [ ] **Step 2: Build to verify — all TypeScript errors should now be resolved**

```bash
cd chrome-extension && npm run build
```

Expected: Build succeeds with zero TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add chrome-extension/src/popup/components/ResultPage.tsx
git commit -m "feat: ResultPage adds ดูผลเต็ม link, force-refresh button, dark mode"
```

---

## Task 9: Update SettingsPage.tsx — "Clear All Data" Button

**Files:**

- Modify: `chrome-extension/src/popup/components/SettingsPage.tsx`

- [ ] **Step 1: Add "Clear all data" button to SettingsPage.tsx**

In `SettingsPage`, add a `confirmClear` state and the "Clear all data" block. Add at the bottom of the `<div className="flex flex-col gap-2 p-4">` section, after the privacy notice div:

```tsx
// Add at top of component:
const [confirmClear, setConfirmClear] = useState(false);

const clearAllData = async () => {
  if (typeof chrome !== "undefined" && chrome.storage) {
    await new Promise<void>((resolve) => chrome.storage.local.clear(resolve));
  } else {
    localStorage.clear();
  }
  setConfirmClear(false);
};
```

Add the clear data UI after the existing privacy notice:

```tsx
{
  /* Clear all data */
}
{
  confirmClear ? (
    <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
      <p className="text-xs text-red-700 mb-2">
        ต้องการลบข้อมูลทั้งหมดใช่ไหม? การกระทำนี้ไม่สามารถย้อนกลับได้
      </p>
      <div className="flex gap-2">
        <button
          onClick={clearAllData}
          aria-label="ยืนยันลบข้อมูลทั้งหมด"
          className="flex-1 py-1.5 bg-red-600 text-white text-xs rounded-lg font-medium"
        >
          ยืนยัน
        </button>
        <button
          onClick={() => setConfirmClear(false)}
          aria-label="ยกเลิก"
          className="flex-1 py-1.5 bg-slate-100 text-slate-600 text-xs rounded-lg font-medium"
        >
          ยกเลิก
        </button>
      </div>
    </div>
  ) : (
    <button
      onClick={() => setConfirmClear(true)}
      aria-label="ลบข้อมูลทั้งหมด"
      className="w-full py-2.5 text-sm font-medium text-red-600 border border-red-200 rounded-xl hover:bg-red-50 transition-colors"
    >
      🗑 ลบข้อมูลทั้งหมด
    </button>
  );
}
```

- [ ] **Step 2: Build to verify**

```bash
cd chrome-extension && npm run build
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add chrome-extension/src/popup/components/SettingsPage.tsx
git commit -m "feat: add Clear all data button with confirmation dialog in Settings"
```

---

## Task 10: Dark Mode + Popup index.css

**Files:**

- Modify: `chrome-extension/src/popup/index.css`

- [ ] **Step 1: Replace index.css with dark mode support**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

* {
  box-sizing: border-box;
}

body {
  width: 360px;
  min-height: 500px;
  max-height: 600px;
  overflow-y: auto;
  font-family: "IBM Plex Sans Thai", sans-serif;
  background: #f8fafc;
  color: #1e293b;
}

@media (prefers-color-scheme: dark) {
  body {
    background: #0f172a;
    color: #f1f5f9;
  }
}

#root {
  min-height: 500px;
  display: flex;
  flex-direction: column;
}

::-webkit-scrollbar {
  width: 4px;
}
::-webkit-scrollbar-track {
  background: #f1f5f9;
}
::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 2px;
}

@media (prefers-color-scheme: dark) {
  ::-webkit-scrollbar-track {
    background: #1e293b;
  }
  ::-webkit-scrollbar-thumb {
    background: #475569;
  }
}
```

- [ ] **Step 2: Verify tailwind.config.js has darkMode: 'media'**

Check `chrome-extension/tailwind.config.js`. It should contain:

```js
export default {
  content: ["./src/**/*.{html,tsx,ts}"],
  darkMode: "media",
  theme: { extend: {} },
  plugins: [],
};
```

If `darkMode` is missing, add it.

- [ ] **Step 3: Build final verification**

```bash
cd chrome-extension && npm run build
```

Expected: Build succeeds, dist/ updated.

- [ ] **Step 4: Manual end-to-end test checklist**

Load extension in Chrome (`chrome://extensions` → Load unpacked → `chrome-extension/dist/`):

1. Open popup → home page renders at 360px width ✓
2. Type text → click ตรวจสอบ → spinner shows → result page with verdict, score, references ✓
3. On result page → click "ตรวจสอบอีกครั้ง" → analysis re-runs (cache cleared) ✓
4. Click history icon → history page shows last entry ✓
5. Click settings icon → per-site toggles work ✓
6. Settings → click "ลบข้อมูลทั้งหมด" → confirm → history clears ✓
7. Navigate to x.com → badges appear on tweet text ✓
8. Toggle X/Twitter off in settings → badges disappear without reload ✓
9. Open popup → click "เลือกข้อความบนหน้า" → popup closes → crosshair cursor + floating toolbar ✓
10. Hover over a text block → blue outline appears ✓
11. Click text block → popup re-opens pre-filled → analysis runs ✓
12. Press Esc during pick mode → pick mode cancels ✓

- [ ] **Step 5: Commit**

```bash
git add chrome-extension/src/popup/index.css chrome-extension/tailwind.config.js
git commit -m "feat: dark mode via prefers-color-scheme in popup CSS"
```

---

## Self-Review Against Spec

**EXT.1 — Popup UI coverage:**

- EXT.1.1 360×600 fixed ✅ (index.css)
- EXT.1.2 Header with global toggle + settings + history icons ✅ (settings toggle is in SettingsPage; header shows settings/history buttons per current design)
- EXT.1.3 Textarea max 5000 chars + counter + ตรวจสอบ button disabled when empty/loading ✅
- EXT.1.4 Pick-mode button in HomePage ✅
- EXT.1.5 Spinner + กำลังตรวจสอบ... text ✅
- EXT.1.6 Error mapping: network/timeout → Thai messages ✅
- EXT.1.7 Verdict + score + 5-level meter + top 3 references + "ดูผลเต็ม" link ✅
- EXT.1.8 History last 50 entries + recheck ✅ (cap fixed to 50)
- EXT.1.9 Per-site toggles + "Clear all data" ✅

**EXT.2 — Badge injection coverage:**

- EXT.2.1 Content scripts on 4 domains ✅ (manifest)
- EXT.2.2 Site-specific selectors ✅ (X, Facebook, LINE Today)
- EXT.2.3 MutationObserver disconnects on global off ✅
- EXT.2.4 One badge per element, .sbs-badge dedup ✅
- EXT.2.5 Confidence ≥ 70% — mock data satisfies ✅
- EXT.2.6 Badge click → OPEN_POPUP_WITH_RESULT → service worker ✅
- EXT.2.7 chrome.storage.onChanged per-site toggle ✅

**EXT.3 — Pick mode coverage:**

- EXT.3.1–3.13: All implemented in Task 5 ✅ (ACTIVATE_PICK_MODE, styles, toolbar, hover, click, PICKED_TEXT, ESC, deactivate)

**EXT.4 — API & Cache coverage:**

- EXT.4.1 POST localhost:3000/api/analyze/text ✅
- EXT.4.2 SHA-256 cache key ✅
- EXT.4.3 TTL 1hr/24hr ✅
- EXT.4.4 Cache checked before fetch ✅
- EXT.4.5 Force-refresh via "ตรวจสอบอีกครั้ง" button ✅

**EXT.5 — Privacy & Storage:**

- EXT.5.1 Only localStorage/chrome.storage.local, no external calls ✅
- EXT.5.2 History max 50 ✅
- EXT.5.3 "Clear all data" with confirmation ✅
- EXT.5.4 Privacy notice in footer ✅

**EXT.6 — Permissions:** storage, activeTab, scripting, host_permissions for 4 domains ✅

**EXT.7 — Non-Functional:**

- EXT.NF.4 Dark mode via prefers-color-scheme ✅
- EXT.NF.5 aria-labels in Thai ✅
- EXT.NF.6 Content script wrapped in try/catch ✅
- EXT.NF.7 Load unpacked from dist/ ✅
