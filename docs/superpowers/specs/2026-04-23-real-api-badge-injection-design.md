# Real API Badge Injection Design

## Overview

Replace mock badge injection in `content/index.ts` with real API calls routed through the background service worker. Add configurable per-page badge limit (default 3) with a spinner state while waiting for the AI response.

## Architecture

### Message Flow

```
content script → chrome.runtime.sendMessage({ type: 'ANALYZE_BADGE', text })
background SW  → analyzeText(text) → API
background SW  → sendResponse({ ok: true, result }) | { ok: false, error }
content script → update badge DOM
```

Background SW handles the API call to avoid CORS issues and avoid needing API URL in `host_permissions`. Results are NOT added to history (auto-badge-scan should not pollute history).

## Changes by File

### `src/lib/types.ts`
Add `badgeLimit: number` to `SiteSettings`.

### `src/lib/storage.ts`
Update `DEFAULT_SETTINGS` to include `badgeLimit: 3`.

### `src/background/service-worker.ts`
Add `ANALYZE_BADGE` message handler. Import `analyzeText` from `lib/api`. Return `{ ok: true, result }` or `{ ok: false, error: string }`.

### `src/content/index.ts`
- Module-level `badgedCount: number` (resets per page load/tab session)
- Before injecting: check `badgedCount < settings.badgeLimit`
- Inject **spinner badge** immediately (non-blocking), increment `badgedCount`
- Send `ANALYZE_BADGE` message to SW
- On success: replace badge innerHTML with real verdict
- On error: replace badge with `⚠ ตรวจไม่ได้` (gray, does not decrement count)
- Add `@keyframes sbs-spin` to injected styles

### `src/popup/components/SettingsPage.tsx`
Add "จำนวนสูงสุดต่อหน้า" row with stepper `-` / `+` buttons (range 1–20). Saves immediately on change via `onSave`.

## Badge States

| State    | Visual                                     |
|----------|--------------------------------------------|
| Loading  | ⏳ spinning border circle + "กำลังตรวจสอบ..." |
| Success  | verdict emoji + verdict text + score%      |
| Error    | ⚠ ตรวจไม่ได้ (gray)                          |

## Constraints

- `badgeLimit` applies per page load (tab session). Infinite scroll does not reset the counter.
- `badgedCount` tracks injected badges, not resolved badges. Error state does NOT free a slot.
- Background SW uses existing `analyzeText` caching — repeated posts on the same page reuse the cache.
- No manifest changes required.
