export type VerdictLevel = 'อันตราย' | 'น่าสงสัย' | 'ไม่แน่ใจ' | 'ค่อนข้างจริง' | 'ยืนยันแล้ว'
export type StanceType = 'ยืนยัน' | 'คัดค้าน' | 'เป็นกลาง'
export type SourceType = 'TRUSTED_MEDIA' | 'FACT_CHECKER' | 'ACADEMIC' | 'GOV' | 'UNKNOWN'

export interface Reference {
  id: string
  sourceName: string
  url: string
  stance: StanceType
  excerpt: string
  date: string
  credibility: number
  type: SourceType
}

export interface AnalysisResult {
  id: string
  query: string
  imageUrl?: string
  verdict: VerdictLevel
  score: number
  confidence: number
  supporting: number
  opposing: number
  unchecked: number
  reasons: string[]
  references: Reference[]
  analyzedAt: string
}

export interface SiteSettings {
  enabled: boolean
  sites: {
    facebook: boolean
    twitter: boolean
    lineToday: boolean
  }
}

export interface HistoryEntry {
  id: string
  query: string
  verdict: VerdictLevel
  score: number
  checkedAt: string
}
