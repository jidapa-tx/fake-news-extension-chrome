# Image Tab Feature Design

**Date:** 2026-04-23  
**Status:** Approved

## Overview

Add a third input tab `🖼️ รูปภาพ` to `HomePage` alongside the existing `📝 ข้อความ` and `🔗 URL` tabs. Users can provide an image via click-to-browse, drag & drop, or clipboard paste. The image is sent directly to `/api/analyze/image` as a `File` — no URL-to-base64 round-trip needed.

## UI Changes (`HomePage.tsx`)

### Tab type
```ts
type Tab = "text" | "url" | "image"
```

### Drop zone states
- **Empty** — dashed border box, centered icon + label "คลิก / ลาก / วางรูปที่นี่", clicking opens file picker (`<input type="file" accept="image/*" hidden>`)
- **Drag over** — border becomes solid blue (`#1E40AF`), background tint
- **Image selected** — thumbnail preview (max-h-48, object-contain), ✕ button top-right to clear

### Caption field
Optional `<textarea rows={2}>` below drop zone with placeholder "คำบรรยายหรือบริบท (ไม่บังคับ)". Maps to `caption` param.

### Submit button
Enabled when `selectedFile != null`. Calls `onAnalyzeImage(selectedFile, caption)`.

### Events
- `onDragOver` / `onDrop` on drop zone div
- `onPaste` on `document` while tab === "image" (extract `DataTransfer.files[0]` or `DataTransfer.items` for image type)
- Switching away from image tab clears `selectedFile` and `caption`

## API Changes (`api.ts`)

New exported function:
```ts
export async function analyzeImage(
  file: File,
  caption?: string,
  forceRefresh = false
): Promise<AnalysisResult>
```

- **Cache key:** `sha256(file.name + file.size + file.lastModified + (caption ?? ""))`
- **Cache TTL:** same as existing `getTtl` logic
- **Request:** `FormData` with `image: file` and optional `caption: caption`
- **Endpoint:** `POST /api/analyze/image`
- **Response mapping:** existing `mapImageResponse(raw, caption ?? file.name, objectURL)` — use `URL.createObjectURL(file)` as the `imageUrl` stored in the result for display in `ResultPage`
- **Error handling:** throws `new Error('server_error')` on non-OK response, same as existing path

## App.tsx Changes

Add `onAnalyzeImage` prop to `HomePage`:
```ts
onAnalyzeImage: (file: File, caption?: string, forceRefresh?: boolean) => void
```

In `App.tsx`, the handler calls `analyzeImage(file, caption, forceRefresh)` and follows the same loading/error/result flow as the existing `handleAnalyze`.

Keep existing `onAnalyze(query, imageUrl?, forceRefresh?)` unchanged to avoid breaking text/URL flows.

## Out of Scope

- Multiple image upload
- Image URL input field in the image tab (covered by pick mode / URL tab)
- Server-side changes (backend already supports `/api/analyze/image`)
