import { useState, useEffect } from "react";
import { storage } from "../../lib/storage";
import type { HistoryEntry, VerdictLevel } from "../../lib/types";

interface Props {
  onBack: () => void;
  onView: (query: string) => void;
  onRecheck: (query: string, imageUrl?: string, forceRefresh?: boolean) => void;
}

const VERDICT_COLOR: Record<VerdictLevel, string> = {
  อันตราย: "#DC2626",
  น่าสงสัย: "#EA580C",
  ไม่แน่ใจ: "#CA8A04",
  ค่อนข้างจริง: "#65A30D",
  ยืนยันแล้ว: "#059669",
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "เมื่อกี้";
  if (mins < 60) return `${mins} นาทีที่แล้ว`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} ชม.ที่แล้ว`;
  return `${Math.floor(hrs / 24)} วันที่แล้ว`;
}

export function HistoryPage({ onBack, onView, onRecheck }: Props) {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    storage.getHistory().then(setHistory);
  }, []);

  const clearAll = async () => {
    await storage.clearHistory();
    setHistory([]);
    setShowConfirm(false);
  };

  return (
    <div className="flex flex-col flex-1 bg-white dark:bg-slate-900">
      <div className="flex items-center justify-between px-4 py-3 bg-[#1E40AF]">
        <div className="flex items-center gap-2">
          <button
            onClick={onBack}
            aria-label="กลับหน้าหลัก"
            className="text-white/80 hover:text-white text-sm"
          >
            ← กลับ
          </button>
          <span className="text-white font-semibold text-sm">
            ประวัติการตรวจสอบ
          </span>
        </div>
        {history.length > 0 && (
          <button
            onClick={() => setShowConfirm(true)}
            aria-label="ลบประวัติทั้งหมด"
            className="text-white/70 hover:text-white text-xs"
          >
            ลบทั้งหมด
          </button>
        )}
      </div>

      {showConfirm && (
        <div className="mx-4 mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-xs text-red-700 mb-2">
            ต้องการลบประวัติทั้งหมดใช่ไหม?
          </p>
          <div className="flex gap-2">
            <button
              onClick={clearAll}
              className="flex-1 py-1.5 bg-red-600 text-white text-xs rounded-lg font-medium"
            >
              ยืนยัน
            </button>
            <button
              onClick={() => setShowConfirm(false)}
              className="flex-1 py-1.5 bg-slate-100 text-slate-600 text-xs rounded-lg font-medium"
            >
              ยกเลิก
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col flex-1 overflow-y-auto p-4 gap-2">
        {history.length === 0 ? (
          <div className="flex flex-col items-center justify-center flex-1 text-slate-400 dark:text-slate-500 gap-2 py-12">
            <span className="text-3xl">📋</span>
            <p className="text-sm">ยังไม่มีประวัติการตรวจสอบ</p>
          </div>
        ) : (
          history.map((entry) => (
            <div
              key={entry.id}
              onClick={() => onView(entry.query)}
              role="button"
              aria-label={`ดูผลการตรวจสอบ: ${entry.query}`}
              className="border border-slate-100 dark:border-slate-700 rounded-xl p-3 hover:border-slate-200 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors dark:bg-slate-800 cursor-pointer"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs text-slate-700 dark:text-slate-300 flex-1 line-clamp-2">
                  {entry.query}
                </p>
                <span
                  className="text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
                  style={{
                    color: VERDICT_COLOR[entry.verdict],
                    background: `${VERDICT_COLOR[entry.verdict]}18`,
                  }}
                >
                  {entry.verdict}
                </span>
              </div>
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-slate-400">
                  {timeAgo(entry.checkedAt)}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRecheck(entry.query, undefined, true);
                  }}
                  className="text-xs text-[#1E40AF] hover:underline"
                >
                  ตรวจอีกครั้ง
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="px-4 pb-3 text-center text-xs text-slate-300 dark:text-slate-500">
        🔒 ข้อมูลเก็บในเครื่องคุณเท่านั้น ไม่ส่งไป server
      </div>
    </div>
  );
}
