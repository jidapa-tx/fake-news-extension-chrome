// src/popup/components/ResultPage.tsx
import type { AnalysisResult, VerdictLevel } from '../../lib/types'
import { API_BASE_URL } from '../../lib/api'
import { ScoreMeter } from './ScoreMeter'
import { ReferenceList } from './ReferenceList'

interface Props {
  result: AnalysisResult
  onBack: () => void
  onForceRefresh: () => void
}

const VERDICT_CONFIG: Record<VerdictLevel, { color: string; bg: string; border: string; emoji: string }> = {
  'อันตราย':       { color: '#DC2626', bg: '#FEF2F2', border: '#FECACA', emoji: '🔴' },
  'น่าสงสัย':     { color: '#EA580C', bg: '#FFF7ED', border: '#FED7AA', emoji: '🟠' },
  'ไม่แน่ใจ':     { color: '#CA8A04', bg: '#FEFCE8', border: '#FDE68A', emoji: '🟡' },
  'ค่อนข้างจริง': { color: '#65A30D', bg: '#F7FEE7', border: '#D9F99D', emoji: '🟢' },
  'ยืนยันแล้ว':   { color: '#059669', bg: '#F0FDF4', border: '#BBF7D0', emoji: '✅' },
}

export function ResultPage({ result, onBack, onForceRefresh }: Props) {
  const cfg = VERDICT_CONFIG[result.verdict]
  const fullResultUrl = `${API_BASE_URL}/result/${result.id}`

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
              <span className="text-lg font-semibold" style={{ color: cfg.color }}>
                {result.verdict}
              </span>
            </div>
            <span className="text-2xl font-bold" style={{ color: cfg.color }}>
              {result.score}%
            </span>
          </div>
          <ScoreMeter score={result.score} />
          <p className="text-xs text-slate-500 mt-2 text-right">
            ตรวจครั้งล่าสุด: {new Date(result.analyzedAt).toLocaleString('th-TH')}
          </p>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2">
          <StatCard label="ยืนยัน"  value={`${result.supporting}%`} color="#059669" />
          <StatCard label="คัดค้าน" value={`${result.opposing}%`}   color="#DC2626" />
          <StatCard label="ไม่แน่ใจ" value={`${result.unchecked}%`}  color="#94A3B8" />
        </div>

        {/* AI Confidence */}
        <div className="flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-lg">
          <span className="text-xs text-slate-600 dark:text-slate-400">AI Confidence</span>
          <span className={`text-xs font-semibold ${result.confidence >= 60 ? 'text-[#1E40AF]' : 'text-orange-500'}`}>
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
          {result.imageUrl && (
            <img
              src={result.imageUrl}
              alt="รูปภาพที่ตรวจสอบ"
              className="w-full max-h-28 object-cover rounded mb-1"
            />
          )}
          <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2">{result.query}</p>
        </div>

        {/* Reasons */}
        <div>
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">เหตุผล</h3>
          <div className="flex flex-col gap-1.5">
            {result.reasons.map((reason, i) => (
              <div key={i} className="flex gap-2 text-xs text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 rounded-lg px-3 py-2">
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
          🔒 ข้อมูลเก็บในเครื่องคุณเท่านั้น
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-2 text-center">
      <div className="text-base font-bold" style={{ color }}>{value}</div>
      <div className="text-xs text-slate-500 dark:text-slate-400">{label}</div>
    </div>
  )
}
