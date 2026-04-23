interface Props {
  score: number
}

const LEVELS = [
  { label: 'อันตราย',     color: '#DC2626', range: [0, 20] },
  { label: 'น่าสงสัย',   color: '#EA580C', range: [21, 40] },
  { label: 'ไม่แน่ใจ',   color: '#CA8A04', range: [41, 60] },
  { label: 'ค่อนข้างจริง', color: '#65A30D', range: [61, 80] },
  { label: 'ยืนยันแล้ว', color: '#059669', range: [81, 100] },
]

export function ScoreMeter({ score }: Props) {
  const activeIndex = LEVELS.findIndex(l => score >= l.range[0] && score <= l.range[1])

  return (
    <div className="flex gap-1 mt-1">
      {LEVELS.map((level, i) => (
        <div
          key={level.label}
          className="flex-1 h-2 rounded-full transition-all"
          style={{
            background: level.color,
            opacity: i === activeIndex ? 1 : 0.2,
            transform: i === activeIndex ? 'scaleY(1.5)' : 'none',
          }}
          title={level.label}
        />
      ))}
    </div>
  )
}
