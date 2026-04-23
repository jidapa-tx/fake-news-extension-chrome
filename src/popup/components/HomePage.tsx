// src/popup/components/HomePage.tsx
import { useState, useEffect, useRef } from "react";
import { Logo } from "./Logo";

// Self-contained pick mode — injected into any tab via scripting.executeScript.
// Must have zero external dependencies (no imports, no outer closures).
function sbsPickModeScript(): boolean {
  if ((window as any).__sbsPickActive) return true;
  (window as any).__sbsPickActive = true;

  const STYLE_ID = "sbs-pick-style";
  const BAR_ID = "sbs-pick-bar";
  const HOVER_CLS = "sbs-pick-hover";
  let hovered: HTMLElement | null = null;

  function isEligible(el: HTMLElement): boolean {
    const tag = el.tagName.toLowerCase();
    if (tag === "img" || tag === "figure" || tag === "picture") return true;
    if (
      ![
        "p",
        "div",
        "article",
        "section",
        "blockquote",
        "li",
        "h1",
        "h2",
        "h3",
      ].includes(tag)
    )
      return false;
    return (el.innerText?.trim().length ?? 0) >= 20;
  }

  function findTarget(t: EventTarget | null): HTMLElement | null {
    if (!(t instanceof HTMLElement)) return null;
    if (t.closest(`#${BAR_ID}`)) return null;
    if (t.tagName.toLowerCase() === "img") return t;
    let cur: HTMLElement | null = t;
    for (let i = 0; i < 8 && cur; i++) {
      if (isEligible(cur)) return cur;
      cur = cur.parentElement;
    }
    return null;
  }

  function deactivate(): void {
    (window as any).__sbsPickActive = false;
    hovered?.classList.remove(HOVER_CLS);
    hovered = null;
    document.getElementById(STYLE_ID)?.remove();
    document.getElementById(BAR_ID)?.remove();
    document.removeEventListener("mouseover", onOver);
    document.removeEventListener("mouseout", onOut);
    document.removeEventListener("click", onPick, true);
    document.removeEventListener("keydown", onKey);
  }

  function onOver(e: MouseEvent): void {
    const t = findTarget(e.target);
    if (hovered && hovered !== t) hovered.classList.remove(HOVER_CLS);
    if (t) {
      t.classList.add(HOVER_CLS);
      hovered = t;
    }
  }

  function onOut(e: MouseEvent): void {
    findTarget(e.target)?.classList.remove(HOVER_CLS);
  }

  async function onPick(e: MouseEvent): Promise<void> {
    const t = findTarget(e.target);
    if (!t) return;
    e.preventDefault();
    e.stopPropagation();

    // Expand truncated content before extracting text
    const twitterMore = t.querySelector<HTMLElement>(
      '[data-testid="tweet-text-show-more-link"]',
    );
    if (twitterMore) {
      twitterMore.click();
      await new Promise((r) => setTimeout(r, 400));
    } else {
      const container =
        (t.closest('[data-ad-preview="message"]') as HTMLElement) ?? t;
      for (const el of container.querySelectorAll<HTMLElement>(
        '[role="button"], span, div',
      )) {
        if (
          el.childElementCount === 0 &&
          el.innerText.trim() === "ดูเพิ่มเติม"
        ) {
          el.click();
          await new Promise((r) => setTimeout(r, 400));
          break;
        }
      }
    }

    // Extract image URL if element is or contains an <img>
    let imageUrl: string | undefined;
    const imgEl: HTMLImageElement | null =
      t.tagName.toLowerCase() === "img"
        ? (t as HTMLImageElement)
        : t.querySelector("img");
    if (imgEl) {
      const src = imgEl.currentSrc || imgEl.src;
      if (src && !src.startsWith("data:") && !src.startsWith("blob:"))
        imageUrl = src;
    }

    // Text: alt text for pure images, innerText for everything else
    const rawText =
      t.tagName.toLowerCase() === "img"
        ? (t as HTMLImageElement).alt?.trim() || ""
        : t.innerText?.trim() || "";
    const text = rawText.replace(/\n{2,}/g, "\n").slice(0, 5000) || "[รูปภาพ]";

    deactivate();
    chrome.runtime.sendMessage({
      type: "PICKED_TEXT",
      text,
      ...(imageUrl ? { imageUrl } : {}),
    });

    // Show on-page toast since popup can't auto-reopen reliably in MV3
    const toast = document.createElement("div");
    toast.setAttribute(
      "style",
      "position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:2147483647;background:#059669;color:#fff;padding:10px 20px;border-radius:24px;font-family:system-ui,sans-serif;font-size:13px;font-weight:500;box-shadow:0 4px 16px rgba(0,0,0,.2);pointer-events:none;transition:opacity 0.4s",
    );
    toast.textContent = "✓ คัดเลือกข้อความแล้ว — กดไอคอนส่วนขยายเพื่อตรวจสอบ";
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = "0";
      setTimeout(() => toast.remove(), 400);
    }, 3000);
  }

  function onKey(e: KeyboardEvent): void {
    if (e.key === "Escape") deactivate();
  }

  if (!document.getElementById(STYLE_ID)) {
    const s = document.createElement("style");
    s.id = STYLE_ID;
    s.textContent = `body{cursor:crosshair!important}.${HOVER_CLS}{outline:2px solid #1E40AF!important;background:rgba(30,64,175,.08)!important}#${BAR_ID},#${BAR_ID}:hover{background:#1E40AF!important}#${BAR_ID} button,#${BAR_ID} button:hover{background:#DC2626!important}`;
    document.head.appendChild(s);
  }

  if (!document.getElementById(BAR_ID)) {
    const bar = document.createElement("div");
    bar.id = BAR_ID;
    bar.setAttribute(
      "style",
      "position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:2147483647;display:flex;align-items:center;gap:8px;background:#1E40AF;color:#fff;padding:8px 16px;border-radius:24px;font-family:system-ui,sans-serif;font-size:13px;font-weight:500;box-shadow:0 4px 16px rgba(30,64,175,.4);pointer-events:auto",
    );
    const label = document.createElement("span");
    label.textContent = "🔍 คลิกที่ข้อความที่ต้องการตรวจสอบ";
    const cancel = document.createElement("button");
    cancel.textContent = "ยกเลิก";
    cancel.setAttribute(
      "style",
      "background:#DC2626;color:#fff;border:none;padding:4px 10px;border-radius:12px;font-size:12px;cursor:pointer;font-family:inherit",
    );
    cancel.addEventListener("click", deactivate);
    bar.appendChild(label);
    bar.appendChild(cancel);
    document.body.appendChild(bar);
  }

  document.addEventListener("mouseover", onOver);
  document.addEventListener("mouseout", onOut);
  document.addEventListener("click", onPick, true);
  document.addEventListener("keydown", onKey);
  return true;
}

type Tab = "text" | "url" | "image";

interface Props {
  isLoading: boolean;
  error: string | null;
  prefillText: string;
  onAnalyze: (query: string, imageUrl?: string, forceRefresh?: boolean) => void;
  onAnalyzeImage: (
    file: File,
    caption?: string,
    forceRefresh?: boolean,
  ) => void;
  onOpenSettings: () => void;
  onOpenHistory: () => void;
}

export function HomePage({
  isLoading,
  error,
  prefillText,
  onAnalyze,
  onAnalyzeImage,
  onOpenSettings,
  onOpenHistory,
}: Props) {
  const [tab, setTab] = useState<Tab>("text");
  const [input, setInput] = useState("");
  const [pendingImageUrl, setPendingImageUrl] = useState<string | null>(null);
  const [pickError, setPickError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [caption, setCaption] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (prefillText) {
      setTab("text");
      setInput(prefillText);
    }
  }, [prefillText]);

  useEffect(() => {
    if (tab !== "image") return;
    const handler = (e: ClipboardEvent) => {
      const item = Array.from(e.clipboardData?.items ?? []).find((i) =>
        i.type.startsWith("image/"),
      );
      if (item) {
        const f = item.getAsFile();
        if (f) setSelectedFile(f);
      }
    };
    document.addEventListener("paste", handler);
    return () => document.removeEventListener("paste", handler);
  }, [tab]);

  const handleSubmit = () => {
    if (tab === "image") {
      if (!selectedFile) return;
      onAnalyzeImage(selectedFile, caption || undefined);
      return;
    }
    const trimmed = input.trim();
    if (!trimmed && !pendingImageUrl) return;
    if (tab === "url" && !trimmed.match(/^https?:\/\/.+/)) return;
    onAnalyze(trimmed || "[รูปภาพ]", pendingImageUrl ?? undefined);
  };

  const handlePickMode = () => {
    setPickError(null);
    if (typeof chrome === "undefined" || !chrome.tabs || !chrome.scripting) {
      setPickError("ไม่สามารถเลือกข้อความในหน้านี้ได้");
      return;
    }
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const activeTab = tabs[0];
      if (!activeTab?.id) {
        setPickError("ไม่สามารถเลือกข้อความในหน้านี้ได้");
        return;
      }
      chrome.scripting.executeScript(
        {
          target: { tabId: activeTab.id },
          world: "ISOLATED",
          func: sbsPickModeScript,
        },
        (results) => {
          if (chrome.runtime.lastError || !results?.[0]?.result) {
            setPickError("ไม่สามารถเลือกข้อความในหน้านี้ได้");
            return;
          }
          window.close();
        },
      );
    });
  };

  return (
    <div className="flex flex-col flex-1 bg-white dark:bg-slate-900">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-blue-800">
        <div className="flex items-center gap-2">
          <Logo size={36} />
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
          {(["text", "url", "image"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => {
                setTab(t);
                setInput("");
                if (t !== "image") {
                  setSelectedFile(null);
                  setCaption("");
                }
              }}
              className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${
                tab === t
                  ? "bg-white dark:bg-slate-700 text-[#1E40AF] dark:text-blue-400 shadow-sm"
                  : "text-slate-500 hover:text-slate-700 dark:text-slate-400"
              }`}
            >
              {t === "text"
                ? "📝 ข้อความ"
                : t === "url"
                  ? "🔗 URL"
                  : "🖼️ รูปภาพ"}
            </button>
          ))}
        </div>

        {/* Image thumbnail from pick mode */}
        {pendingImageUrl && (
          <div className="relative rounded-lg overflow-hidden border border-slate-200 dark:border-slate-600">
            <img
              src={pendingImageUrl}
              alt="รูปภาพที่เลือก"
              className="w-full max-h-32 object-cover"
            />
            <button
              onClick={() => setPendingImageUrl(null)}
              aria-label="ลบรูปภาพ"
              className="absolute top-1 right-1 bg-black/50 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs leading-none hover:bg-black/70"
            >
              ✕
            </button>
          </div>
        )}

        {/* Input area */}
        {tab === "text" && (
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="วางข้อความข่าวที่ต้องการตรวจสอบที่นี่..."
            maxLength={5000}
            rows={5}
            aria-label="ข้อความที่ต้องการตรวจสอบ"
            className="w-full p-3 border border-slate-200 dark:border-slate-600 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#1E40AF]/30 focus:border-[#1E40AF] placeholder:text-slate-400 dark:bg-slate-800 dark:text-slate-100"
          />
        )}

        {tab === "url" && (
          <input
            type="url"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="https://example.com/news/..."
            aria-label="URL ที่ต้องการตรวจสอบ"
            className="w-full p-3 border border-slate-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1E40AF]/30 focus:border-[#1E40AF] placeholder:text-slate-400 dark:bg-slate-800 dark:text-slate-100"
          />
        )}

        {tab === "image" && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) setSelectedFile(f);
                e.target.value = "";
              }}
            />
            {selectedFile ? (
              <div className="relative rounded-lg overflow-hidden border border-slate-200 dark:border-slate-600">
                <img
                  src={URL.createObjectURL(selectedFile)}
                  alt="รูปภาพที่เลือก"
                  className="w-full max-h-48 object-contain"
                />
                <button
                  onClick={() => setSelectedFile(null)}
                  aria-label="ลบรูปภาพ"
                  className="absolute top-1 right-1 bg-black/50 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs leading-none hover:bg-black/70"
                >
                  ✕
                </button>
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragOver(true);
                }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragOver(false);
                  const f = e.dataTransfer.files[0];
                  if (f?.type.startsWith("image/")) setSelectedFile(f);
                }}
                className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed cursor-pointer min-h-[120px] transition-colors ${
                  isDragOver
                    ? "border-[#1E40AF] bg-blue-50 dark:bg-blue-950"
                    : "border-slate-300 dark:border-slate-600 hover:border-[#1E40AF] hover:bg-slate-50 dark:hover:bg-slate-800"
                }`}
              >
                <span className="text-2xl">📷</span>
                <span className="text-sm text-slate-500 dark:text-slate-400 text-center px-4">
                  คลิกหรือลากไฟล์รูปภาพมาวางที่นี่
                </span>
                <span className="text-xs text-slate-400 dark:text-slate-500 text-center px-4">
                  รองรับ JPG, PNG, WEBP — ขนาดสูงสุด 10 MB
                </span>
              </div>
            )}
          </>
        )}

        {/* Character count */}
        {tab === "text" && (
          <div className="text-right text-xs text-slate-400 -mt-2">
            {input.length}/5000
          </div>
        )}

        {/* Pick mode button + error */}
        {tab !== "image" && (
          <>
            <button
              onClick={handlePickMode}
              disabled={isLoading}
              aria-label="เลือกข้อความบนหน้าเว็บ"
              className="w-full py-2 rounded-lg border border-slate-200 dark:border-slate-600 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
            >
              ⊕ เลือกข้อความบนหน้า
            </button>
            {pickError && (
              <div className="bg-orange-50 dark:bg-orange-950 border border-orange-200 dark:border-orange-800 rounded-lg px-3 py-2 text-xs text-orange-700 dark:text-orange-400">
                {pickError}
              </div>
            )}
          </>
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
          disabled={
            isLoading ||
            (tab === "image"
              ? !selectedFile
              : !input.trim() && !pendingImageUrl)
          }
          aria-label="ตรวจสอบข่าว"
          className={`w-full py-3 rounded-lg font-semibold text-sm transition-all ${
            isLoading ||
            (tab === "image"
              ? !selectedFile
              : !input.trim() && !pendingImageUrl)
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
            🔒 ข้อมูลเก็บในเครื่องคุณเท่านั้น ไม่ส่งไป server
          </span>
        </div>
      </div>
    </div>
  );
}
