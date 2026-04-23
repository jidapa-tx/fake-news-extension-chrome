# Real API Badge Injection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace mock badge injection with real API calls routed through the background service worker, limit to a configurable number of badges per page, and show a CSS spinner while the AI is processing.

**Architecture:** Content script injects a spinner badge immediately, then sends `ANALYZE_BADGE` message to the background service worker which calls `analyzeText()`. The SW sends back the result or error, and the content script updates the badge DOM in-place. Badge limit is stored in `SiteSettings.badgeLimit` and editable from the Settings popup page.

**Tech Stack:** TypeScript, Chrome Extension MV3, Vite + crxjs plugin, React (popup only), Tailwind CSS (popup only)

---

## File Map

| File | Change |
|------|--------|
| `src/lib/types.ts` | Add `badgeLimit: number` to `SiteSettings` |
| `src/lib/storage.ts` | Add `badgeLimit: 3` to `DEFAULT_SETTINGS` |
| `src/background/service-worker.ts` | Import `analyzeText`, add `ANALYZE_BADGE` message handler |
| `src/content/index.ts` | Remove mock, add spinner, real API via SW, per-page limit |
| `src/popup/components/SettingsPage.tsx` | Add badge limit stepper UI |

---

### Task 1: Extend SiteSettings type and storage defaults

**Files:**
- Modify: `src/lib/types.ts`
- Modify: `src/lib/storage.ts`

- [ ] **Step 1: Add `badgeLimit` to `SiteSettings` in `src/lib/types.ts`**

Replace the `SiteSettings` interface:

```ts
export interface SiteSettings {
  enabled: boolean
  badgeLimit: number
  sites: {
    facebook: boolean
    twitter: boolean
    lineToday: boolean
  }
}
```

- [ ] **Step 2: Add `badgeLimit` to `DEFAULT_SETTINGS` in `src/lib/storage.ts`**

Replace the `DEFAULT_SETTINGS` constant:

```ts
const DEFAULT_SETTINGS: SiteSettings = {
  enabled: true,
  badgeLimit: 3,
  sites: { facebook: false, twitter: false, lineToday: false },
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/supharoek.kongprapane/Coding/training/HackathonSocialImpact/chrome-extension
npx tsc --noEmit
```

Expected: no errors (or only pre-existing errors unrelated to these files).

- [ ] **Step 4: Commit**

```bash
git add src/lib/types.ts src/lib/storage.ts
git commit -m "feat: add badgeLimit to SiteSettings (default 3)"
```

---

### Task 2: Add ANALYZE_BADGE handler to background service worker

**Files:**
- Modify: `src/background/service-worker.ts`

- [ ] **Step 1: Rewrite `src/background/service-worker.ts` with the new handler**

```ts
import { analyzeText } from '../lib/api'

chrome.runtime.onInstalled.addListener(() => {
  console.log('[ชัวร์ก่อนแชร์] Extension installed')
})

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'PICKED_TEXT') {
    const data: Record<string, string> = { sbs_pendingPickedText: msg.text }
    if (msg.imageUrl) data['sbs_pendingPickedImageUrl'] = msg.imageUrl
    chrome.storage.local.set(data, () => {
      chrome.action.setBadgeText({ text: '✓' })
      chrome.action.setBadgeBackgroundColor({ color: '#059669' })
      chrome.action.openPopup().catch(() => {})
      sendResponse({ ok: true })
    })
    return true
  }

  if (msg.type === 'OPEN_POPUP_WITH_RESULT') {
    chrome.storage.local.set({ sbs_pendingResultId: msg.resultId }, () => {
      chrome.action.openPopup().catch(() => {})
      sendResponse({ ok: true })
    })
    return true
  }

  if (msg.type === 'ANALYZE_BADGE') {
    analyzeText(msg.text)
      .then(result => sendResponse({ ok: true, result }))
      .catch(() => sendResponse({ ok: false }))
    return true
  }
})

export {}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors related to `service-worker.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/background/service-worker.ts
git commit -m "feat: add ANALYZE_BADGE handler to background SW"
```

---

### Task 3: Rewrite content script badge injection

**Files:**
- Modify: `src/content/index.ts`

This task replaces the mock badge system entirely. The pick-mode code at the bottom of the file is **unchanged** — only the badge injection section at the top changes.

- [ ] **Step 1: Replace the badge injection section in `src/content/index.ts`**

Replace everything from line 1 up to (but not including) `function removeAllBadges()` with:

```ts
// src/content/index.ts
// Badge injection — checks globalEnabled + per-site toggle before injecting.
// All code wrapped in try/catch to prevent leaking errors to the host page.

const BADGE_CLASS = 'sbs-badge'
const BADGE_STYLE_ID = 'sbs-badge-styles'

const SITE_KEY_MAP: Record<string, keyof { facebook: boolean; twitter: boolean; lineToday: boolean }> = {
  'facebook.com': 'facebook',
  'x.com': 'twitter',
  'twitter.com': 'twitter',
  'today.line.me': 'lineToday',
}

const VERDICT_STYLE: Record<string, { color: string; bg: string; emoji: string }> = {
  'อันตราย':       { color: '#DC2626', bg: '#FEF2F2', emoji: '🔴' },
  'น่าสงสัย':     { color: '#EA580C', bg: '#FFF7ED', emoji: '🟠' },
  'ไม่แน่ใจ':     { color: '#CA8A04', bg: '#FEFCE8', emoji: '🟡' },
  'ค่อนข้างจริง':  { color: '#16A34A', bg: '#F0FDF4', emoji: '🟢' },
  'ยืนยันแล้ว':   { color: '#059669', bg: '#F0FDF4', emoji: '✅' },
}

const BASE_BADGE_CSS = `
  display:inline-flex;align-items:center;gap:4px;padding:2px 8px;
  border-radius:20px;font-size:11px;font-weight:600;
  font-family:'IBM Plex Sans Thai',sans-serif;
  cursor:pointer;margin-top:4px;user-select:none;transition:opacity 0.2s;
`

let badgedCount = 0
let cachedBadgeLimit = 3

function injectBadgeStyles() {
  if (document.getElementById(BADGE_STYLE_ID)) return
  const style = document.createElement('style')
  style.id = BADGE_STYLE_ID
  style.textContent = `@keyframes sbs-spin { to { transform: rotate(360deg) } }`
  document.head.appendChild(style)
}

function createSpinnerBadge(): HTMLElement {
  const el = document.createElement('div')
  el.className = BADGE_CLASS
  el.style.cssText = BASE_BADGE_CSS + `color:#64748B;background:#F8FAFC;border:1px solid #CBD5E1;`
  el.title = 'ชัวร์ก่อนแชร์ — กำลังตรวจสอบ'
  el.innerHTML = `<span style="width:10px;height:10px;border:2px solid #CBD5E1;border-top-color:#1E40AF;border-radius:50%;animation:sbs-spin 0.8s linear infinite;display:inline-block;flex-shrink:0"></span> กำลังตรวจสอบ...`
  return el
}

function updateBadgeResult(el: HTMLElement, verdict: string, score: number, resultId: string) {
  const s = VERDICT_STYLE[verdict] ?? VERDICT_STYLE['ไม่แน่ใจ']
  el.style.cssText = BASE_BADGE_CSS + `color:${s.color};background:${s.bg};border:1px solid ${s.color}40;`
  el.title = 'ชัวร์ก่อนแชร์ — คลิกเพื่อดูผล'
  el.innerHTML = `${s.emoji} ${verdict} (${score}%)`
  el.addEventListener('click', e => {
    try { e.stopPropagation(); chrome.runtime.sendMessage({ type: 'OPEN_POPUP_WITH_RESULT', resultId }) }
    catch { /* ignore */ }
  })
}

function updateBadgeError(el: HTMLElement) {
  el.style.cssText = BASE_BADGE_CSS + `color:#94A3B8;background:#F8FAFC;border:1px solid #E2E8F0;`
  el.title = 'ชัวร์ก่อนแชร์ — ตรวจสอบไม่ได้'
  el.innerHTML = `⚠ ตรวจไม่ได้`
}

function requestAnalysis(el: HTMLElement, text: string) {
  try {
    chrome.runtime.sendMessage({ type: 'ANALYZE_BADGE', text }, response => {
      try {
        if (chrome.runtime.lastError || !response) { updateBadgeError(el); return }
        if (response.ok) updateBadgeResult(el, response.result.verdict, response.result.score, response.result.id)
        else updateBadgeError(el)
      } catch { updateBadgeError(el) }
    })
  } catch { updateBadgeError(el) }
}

function currentSiteKey() {
  const host = location.hostname.replace(/^www\./, '')
  return SITE_KEY_MAP[host] ?? null
}

function injectBadge(el: HTMLElement, text: string) {
  if (badgedCount >= cachedBadgeLimit) return
  if (el.querySelector(`.${BADGE_CLASS}`)) return
  injectBadgeStyles()
  const badge = createSpinnerBadge()
  el.appendChild(badge)
  badgedCount++
  requestAnalysis(badge, text.slice(0, 5000))
}

function injectBadges() {
  if (badgedCount >= cachedBadgeLimit) return

  // X/Twitter
  document.querySelectorAll<HTMLElement>('[data-testid="tweetText"]').forEach(el => {
    if (badgedCount >= cachedBadgeLimit) return
    if (el.querySelector(`.${BADGE_CLASS}`)) return
    const more = el.querySelector<HTMLElement>('[data-testid="tweet-text-show-more-link"]')
    if (more) { more.click(); return }
    const text = el.innerText?.trim()
    if (!text || text.length < 30) return
    injectBadge(el, text)
  })

  // Facebook
  document.querySelectorAll<HTMLElement>('[data-ad-preview="message"], [class*="userContent"]').forEach(el => {
    if (badgedCount >= cachedBadgeLimit) return
    if (el.querySelector(`.${BADGE_CLASS}`)) return
    for (const c of el.querySelectorAll<HTMLElement>('[role="button"], span, div')) {
      if (c.childElementCount === 0 && c.innerText.trim() === 'ดูเพิ่มเติม') { c.click(); return }
    }
    const text = el.innerText?.trim()
    if (!text || text.length < 30) return
    injectBadge(el, text)
  })

  // LINE Today
  document.querySelectorAll<HTMLElement>('article p').forEach(el => {
    if (badgedCount >= cachedBadgeLimit) return
    if (el.querySelector(`.${BADGE_CLASS}`)) return
    const text = el.innerText?.trim()
    if (!text || text.length < 30) return
    injectBadge(el, text)
  })
}
```

- [ ] **Step 2: Replace `removeAllBadges` to also reset the counter**

```ts
function removeAllBadges() {
  document.querySelectorAll(`.${BADGE_CLASS}`).forEach(el => el.remove())
  badgedCount = 0
}
```

- [ ] **Step 3: Update the bootstrap block to read `badgeLimit` from settings**

Replace the entire bootstrap `try { chrome.storage.local.get('sbs_settings', ...) }` block with:

```ts
try {
  chrome.storage.local.get('sbs_settings', result => {
    try {
      const settings = result['sbs_settings']
      const siteKey = currentSiteKey()
      const globalEnabled: boolean = settings?.enabled ?? true
      const siteEnabled: boolean = siteKey ? (settings?.sites?.[siteKey] ?? true) : false
      cachedBadgeLimit = settings?.badgeLimit ?? 3

      if (globalEnabled && siteEnabled) {
        injectBadges()
        startObserver()
      }

      chrome.storage.onChanged.addListener((changes) => {
        try {
          if (!changes['sbs_settings']) return
          const newSettings = changes['sbs_settings'].newValue
          const nowGlobal: boolean = newSettings?.enabled ?? true
          const nowSite: boolean = siteKey ? (newSettings?.sites?.[siteKey] ?? true) : false
          cachedBadgeLimit = newSettings?.badgeLimit ?? 3

          if (nowGlobal && nowSite) {
            injectBadges()
            startObserver()
          } else {
            removeAllBadges()
            stopObserver()
          }
        } catch { /* ignore */ }
      })
    } catch { /* ignore */ }
  })
} catch { /* ignore */ }
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors in `content/index.ts`.

- [ ] **Step 5: Commit**

```bash
git add src/content/index.ts
git commit -m "feat: replace mock badge with real API via SW, spinner, per-page limit"
```

---

### Task 4: Add badge limit stepper to SettingsPage

**Files:**
- Modify: `src/popup/components/SettingsPage.tsx`

- [ ] **Step 1: Add `updateBadgeLimit` handler and stepper UI to `SettingsPage`**

Inside `SettingsPage`, add the handler after `toggleGlobal`:

```tsx
const updateBadgeLimit = (limit: number) => {
  const clamped = Math.min(20, Math.max(1, limit))
  setLocal(prev => {
    const updated = { ...prev, badgeLimit: clamped }
    onSave(updated)
    return updated
  })
}
```

Initialize `local` with a `badgeLimit` fallback (for users with existing stored settings that predate this field):

```tsx
const [local, setLocal] = useState<SiteSettings>({ badgeLimit: 3, ...settings })
```

Add this row between the global toggle block and the `<p>ตรวจสอบอัตโนมัติบน</p>` label:

```tsx
{/* Badge limit stepper */}
<div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
  <div>
    <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">จำนวนสูงสุดต่อหน้า</p>
    <p className="text-xs text-slate-400 dark:text-slate-500">Badge ที่ตรวจอัตโนมัติต่อ 1 หน้า</p>
  </div>
  <div className="flex items-center gap-2">
    <button
      onClick={() => updateBadgeLimit((local.badgeLimit ?? 3) - 1)}
      disabled={!local.enabled || (local.badgeLimit ?? 3) <= 1}
      aria-label="ลดจำนวน"
      className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-sm font-bold disabled:opacity-40 hover:bg-slate-300 dark:hover:bg-slate-600"
    >−</button>
    <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 w-4 text-center">
      {local.badgeLimit ?? 3}
    </span>
    <button
      onClick={() => updateBadgeLimit((local.badgeLimit ?? 3) + 1)}
      disabled={!local.enabled || (local.badgeLimit ?? 3) >= 20}
      aria-label="เพิ่มจำนวน"
      className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-sm font-bold disabled:opacity-40 hover:bg-slate-300 dark:hover:bg-slate-600"
    >+</button>
  </div>
</div>
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors in `SettingsPage.tsx`.

- [ ] **Step 3: Build the extension**

```bash
npm run build
```

Expected: build completes with no errors.

- [ ] **Step 4: Commit**

```bash
git add src/popup/components/SettingsPage.tsx
git commit -m "feat: add badge limit stepper to settings page"
```

---

### Task 5: Manual verification

- [ ] **Step 1: Build and load the extension in Chrome**

```bash
npm run build
```

Load `dist/` folder in `chrome://extensions` (Developer mode → Load unpacked).

- [ ] **Step 2: Verify spinner appears on Twitter/X**

1. Open `x.com` with the extension enabled for Twitter.
2. Should see blue spinner badges on tweets: `⏳ กำลังตรวจสอบ...`
3. Wait ~2-5s — badge should replace with real verdict (e.g. `🟡 ไม่แน่ใจ (51%)`).
4. Max 3 badges should appear (no more after 3).

- [ ] **Step 3: Verify error state**

1. Stop the API server (`localhost:3000`).
2. Reload the page — spinner badges should appear, then change to `⚠ ตรวจไม่ได้`.

- [ ] **Step 4: Verify badge limit config**

1. Open the extension popup → Settings.
2. Should see "จำนวนสูงสุดต่อหน้า" stepper showing `3`.
3. Change to `1` → reload the page → confirm only 1 badge appears.
4. Change to `5` → reload → confirm up to 5 badges appear.

- [ ] **Step 5: Commit design doc**

```bash
git add docs/
git commit -m "docs: add real-api-badge-injection spec and plan"
```
