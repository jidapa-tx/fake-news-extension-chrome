# Chrome Extension E2E Testing Design

**Date:** 2026-04-23  
**Project:** ชัวร์ก่อนแชร์ Chrome Extension  
**Scope:** Playwright E2E test suite with mock backend server

---

## Context

The extension has no tests. Three feature areas need coverage: popup UI (EXT.1), badge injection on social sites (EXT.2), and element picker / pick mode (EXT.3). The goal is an automated E2E suite using Playwright with a real Chromium instance loading the built extension — the same way a real user would.

The extension calls `http://localhost:3000` for analysis. Tests spin up a lightweight Node.js HTTP mock server in `globalSetup` so the real `api.ts` fetch + SHA-256 cache path is exercised (not just the mock-api fallback).

---

## Tech Stack

| Tool                               | Purpose                                          |
| ---------------------------------- | ------------------------------------------------ |
| `@playwright/test`                 | Test runner + Chrome extension support           |
| `chromium.launchPersistentContext` | Load extension via `--load-extension` flag       |
| Node.js `http.createServer`        | Mock backend at `localhost:3000` (no extra deps) |
| Built extension (`dist/`)          | Tests run against the Vite build output          |

---

## Directory Structure

```
chrome-extension/
├── tests/
│   ├── fixtures/
│   │   ├── analysis-result.ts      # AnalysisResult fixture factory
│   │   └── mock-server.ts          # globalSetup/Teardown HTTP server
│   ├── helpers/
│   │   └── extension.ts            # launchPersistentContext + popup URL helper
│   ├── popup.spec.ts               # EXT.1: popup pages
│   ├── badge-injection.spec.ts     # EXT.2: badge injection
│   └── pick-mode.spec.ts           # EXT.3: element picker
├── playwright.config.ts
```

---

## Key Config: `playwright.config.ts`

```ts
import { defineConfig } from "@playwright/test";
import path from "path";

const EXTENSION_PATH = path.resolve(__dirname, "dist");

export default defineConfig({
  testDir: "./tests",
  // globalSetup returns its own teardown function (Playwright ≥ 1.10)
  globalSetup: "./tests/fixtures/mock-server.ts",
  use: {
    // Extension requires a persistent context — standard browser fixture won't work
    browserName: "chromium",
  },
  projects: [
    {
      name: "chrome-extension",
      use: {
        // Extension is loaded via launchPersistentContext in helpers/extension.ts
        // Each test file creates its own context
      },
    },
  ],
});
```

---

## Extension Loader Helper: `helpers/extension.ts`

```ts
import { chromium, BrowserContext } from "@playwright/test";
import path from "path";

const EXTENSION_PATH = path.resolve(__dirname, "../../dist");

export async function launchWithExtension(): Promise<{
  context: BrowserContext;
  extensionId: string;
}> {
  const context = await chromium.launchPersistentContext("", {
    headless: false, // Extensions require non-headless (use headless: 'new' in CI)
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
    ],
  });

  // Retrieve extension ID from service worker
  let [background] = context.serviceWorkers();
  if (!background) background = await context.waitForEvent("serviceworker");
  const extensionId = background.url().split("/")[2];

  return { context, extensionId };
}

export function popupUrl(extensionId: string): string {
  return `chrome-extension://${extensionId}/src/popup/index.html`;
}
```

---

## Mock Server: `fixtures/mock-server.ts`

The server supports a `?mode=<error|timeout>` query param so individual tests can simulate failure without stopping the server.

```ts
import http from "http";
import type { IncomingMessage, ServerResponse } from "http";

export const FIXTURE = {
  id: "test-001",
  query: "test query",
  verdict: "ค่อนข้างจริง",
  score: 75,
  confidence: 85,
  supporting: 3,
  opposing: 1,
  unchecked: 1,
  reasons: ["เนื้อหาตรงกับแหล่งข้อมูลที่เชื่อถือได้"],
  references: [],
  analyzedAt: new Date().toISOString(),
};

function handleRequest(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url ?? "/", "http://localhost:3000");
  if (url.pathname === "/api/analyze/text" && req.method === "POST") {
    const mode = url.searchParams.get("mode");
    if (mode === "error") {
      res.writeHead(500);
      res.end("Internal Server Error");
    } else if (mode === "timeout") {
      // Never respond — triggers AbortController timeout in api.ts
    } else {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(FIXTURE));
    }
  } else {
    res.writeHead(404);
    res.end();
  }
}

// Playwright calls globalSetup; returning a function makes it the teardown.
export default async function globalSetup(): Promise<() => Promise<void>> {
  const server = http.createServer(handleRequest);
  await new Promise<void>((r) => server.listen(3000, r));
  return () => new Promise<void>((r) => server.close(() => r()));
}
```

> **Note:** `api.ts` hardcodes `API_BASE_URL = 'http://localhost:3000'`. Tests must build the extension with this value intact (default dev value). To simulate errors, tests navigate the popup to a URL with `?mode=error` by modifying the query the popup sends — or the extension's `API_BASE_URL` can be made env-configurable in a follow-up.

---

## Test Scenarios

### `popup.spec.ts` — EXT.1 Popup UI

| #   | Scenario                    | Key Assertions                                                                           |
| --- | --------------------------- | ---------------------------------------------------------------------------------------- |
| 1.1 | Home page renders correctly | Textarea present, button disabled when empty                                             |
| 1.2 | Analysis happy path         | Type text → click ตรวจสอบ → spinner → result page with verdict badge                     |
| 1.3 | Force refresh               | Result page → refresh button → new fetch (mock server logs second hit)                   |
| 1.4 | Network error               | Mock server never responds (mode=timeout) → AbortController fires → Thai timeout message |
| 1.5 | Server error (500)          | Mock server returns 500 → Thai server_error message appears                              |
| 1.6 | Settings toggles persist    | Toggle facebook off → reload popup → toggle remains off                                  |
| 1.7 | Clear all data              | Settings → "ล้างข้อมูลทั้งหมด" → confirm → storage empty                                 |
| 1.8 | History entry added         | Run analysis → History page → entry visible with verdict badge                           |
| 1.9 | History re-check            | Click history entry → analysis runs again                                                |

### `badge-injection.spec.ts` — EXT.2 Badge Injection

Badge tests navigate to local HTML fixture files served by `page.setContent()` or a `file://` URL. Fixtures live in `tests/fixtures/html/twitter-mock.html` (contains `[data-testid="tweetText"]`) and `tests/fixtures/html/facebook-mock.html`.

| #   | Scenario                         | Key Assertions                                                                    |
| --- | -------------------------------- | --------------------------------------------------------------------------------- |
| 2.1 | Badge injects on mock tweet page | `page.setContent()` with tweet DOM → `.sbs-badge` appears within 2s               |
| 2.2 | No duplicate badges              | MutationObserver fires multiple times → still only one badge per post             |
| 2.3 | Per-site toggle removes badges   | Toggle twitter off in Settings → all `.sbs-badge` elements removed without reload |
| 2.4 | Badge click opens popup          | Click `.sbs-badge` → popup opens → result page shown                              |

### `pick-mode.spec.ts` — EXT.3 Element Picker

| #   | Scenario                        | Key Assertions                                                            |
| --- | ------------------------------- | ------------------------------------------------------------------------- |
| 3.1 | Pick mode activates             | Click "เลือกข้อความบนหน้า" in popup → popup closes, page enters pick mode |
| 3.2 | Hover highlights element        | Mouse over eligible text block → blue highlight overlay appears           |
| 3.3 | Click element triggers analysis | Click highlighted element → popup reopens pre-filled → analysis auto-runs |
| 3.4 | Esc cancels pick mode           | Press Esc → pick mode deactivates, no popup opens                         |
| 3.5 | Cancel toolbar works            | Click floating cancel button → same as Esc                                |

---

## Running Tests

```bash
# Build extension first (required)
cd chrome-extension
npm run build

# Run all E2E tests
npx playwright test

# Run specific spec
npx playwright test popup.spec.ts

# Run with UI (headed mode for debugging)
npx playwright test --headed

# View report
npx playwright show-report
```

---

## Verification Checklist

- [ ] `npm run build` produces `dist/` with valid manifest
- [ ] `globalSetup` mock server starts on port 3000
- [ ] `launchWithExtension()` resolves `extensionId` from service worker URL
- [ ] Popup URL (`chrome-extension://<id>/src/popup/index.html`) loads in page
- [ ] All 3 spec files run without errors
- [ ] Badge injection tests work against local HTML fixtures (not real social sites)
- [ ] Pick mode tests confirm `sbs_pendingPickedText` in `chrome.storage.local`
