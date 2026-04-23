import type { Reference, SourceType, StanceType } from '../../lib/types'

interface Props {
  references: Reference[]
}

const SOURCE_TYPE_BADGE: Record<SourceType, { label: string; color: string }> = {
  TRUSTED_MEDIA: { label: 'สื่อ',        color: '#1E40AF' },
  FACT_CHECKER:  { label: 'Fact Check',  color: '#059669' },
  ACADEMIC:      { label: 'วิชาการ',     color: '#7C3AED' },
  GOV:           { label: 'หน่วยงาน',    color: '#475569' },
}

const STANCE_CONFIG: Record<StanceType, { label: string; color: string; bg: string }> = {
  'ยืนยัน': { label: 'ยืนยัน',  color: '#059669', bg: '#F0FDF4' },
  'คัดค้าน': { label: 'คัดค้าน', color: '#DC2626', bg: '#FEF2F2' },
  'เป็นกลาง': { label: 'เป็นกลาง', color: '#64748B', bg: '#F8FAFC' },
}

export function ReferenceList({ references }: Props) {
  return (
    <div className="flex flex-col gap-2">
      {references.map(ref => {
        const stance = STANCE_CONFIG[ref.stance]
        const srcType = SOURCE_TYPE_BADGE[ref.type]
        return (
          <a
            key={ref.id}
            href={ref.url}
            target="_blank"
            rel="noreferrer"
            className="block border border-slate-100 rounded-lg p-3 hover:border-[#1E40AF]/30 hover:bg-blue-50/30 transition-colors no-underline"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-slate-700">{ref.sourceName}</span>
              <div className="flex gap-1 items-center">
                <span
                  className="text-xs px-1.5 py-0.5 rounded-full font-medium"
                  style={{ color: srcType.color, background: `${srcType.color}18` }}
                >
                  {srcType.label}
                </span>
                <span
                  className="text-xs px-1.5 py-0.5 rounded-full font-medium"
                  style={{ color: stance.color, background: stance.bg }}
                >
                  {stance.label}
                </span>
              </div>
            </div>
            <p className="text-xs text-slate-500 line-clamp-2">{ref.excerpt}</p>
            <p className="text-xs text-slate-300 mt-1">{ref.date}</p>
          </a>
        )
      })}
    </div>
  )
}
