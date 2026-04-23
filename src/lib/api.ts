import type { AnalysisResult, VerdictLevel, StanceType, SourceType } from './types'

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000'

const CACHE_TTL_MS = 60 * 60 * 1000
const CACHE_TTL_DANGER_MS = 24 * 60 * 60 * 1000

interface CacheEntry {
  result: AnalysisResult
  cachedAt: number
}

async function sha256(text: string): Promise<string> {
  const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join('')
}

function cacheKey(hash: string): string {
  return `sbs_cache_${hash}`
}

function getTtl(verdict: string): number {
  return ['อันตราย', 'น่าสงสัย'].includes(verdict) ? CACHE_TTL_DANGER_MS : CACHE_TTL_MS
}

async function readCache(key: string): Promise<AnalysisResult | null> {
  return new Promise(resolve =>
    chrome.storage.local.get(key, r => {
      const entry: CacheEntry | undefined = r[key]
      if (!entry) return resolve(null)
      const ttl = getTtl(entry.result.verdict)
      if (Date.now() - entry.cachedAt > ttl) return resolve(null)
      resolve(entry.result)
    })
  )
}

async function writeCache(key: string, result: AnalysisResult): Promise<void> {
  const entry: CacheEntry = { result, cachedAt: Date.now() }
  return new Promise(resolve => chrome.storage.local.set({ [key]: entry }, resolve))
}

async function deleteCache(key: string): Promise<void> {
  return new Promise(resolve => chrome.storage.local.remove(key, resolve))
}

const VERDICT_MAP: Record<string, VerdictLevel> = {
  DANGEROUS:   'อันตราย',
  SUSPICIOUS:  'น่าสงสัย',
  UNCERTAIN:   'ไม่แน่ใจ',
  LIKELY_TRUE: 'ค่อนข้างจริง',
  VERIFIED:    'ยืนยันแล้ว',
}

const STANCE_MAP: Record<string, StanceType> = {
  SUPPORTING: 'ยืนยัน',
  OPPOSING:   'คัดค้าน',
  NEUTRAL:    'เป็นกลาง',
}

function deriveStats(score: number): { supporting: number; opposing: number; unchecked: number } {
  const supporting = Math.round(score * 0.9)
  const opposing = Math.round((100 - score) * 0.9)
  return { supporting, opposing, unchecked: 100 - supporting - opposing }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapTextResponse(raw: any, query: string): AnalysisResult {
  const verdict = VERDICT_MAP[raw.verdict] ?? 'ไม่แน่ใจ'
  return {
    id: raw.analysisId,
    query,
    verdict,
    score: raw.score,
    confidence: raw.confidence,
    ...deriveStats(raw.score),
    reasons: raw.reasoning ?? [],
    references: (raw.references ?? []).map((r: any) => ({
      id: r.id,
      sourceName: r.sourceName,
      url: r.url,
      stance: STANCE_MAP[r.stance] ?? 'เป็นกลาง',
      excerpt: r.excerpt,
      date: r.publishedAt ? r.publishedAt.slice(0, 10) : '',
      credibility: r.credibility,
      type: (r.sourceType ?? 'UNKNOWN') as SourceType,
    })),
    analyzedAt: raw.cachedAt ?? new Date().toISOString(),
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapImageResponse(raw: any, query: string, imageUrl: string): AnalysisResult {
  const verdict = VERDICT_MAP[raw.verdict] ?? 'ไม่แน่ใจ'
  return {
    id: raw.analysisId,
    query,
    imageUrl,
    verdict,
    score: raw.score,
    confidence: raw.confidence,
    ...deriveStats(raw.score),
    reasons: raw.reasoning ?? [],
    references: [],
    analyzedAt: new Date().toISOString(),
  }
}

function isUrl(text: string): boolean {
  try { new URL(text); return true } catch { return false }
}

export async function analyzeText(query: string, imageUrl?: string, forceRefresh = false): Promise<AnalysisResult> {
  const hash = await sha256(imageUrl ? `${query}\n${imageUrl}` : query)
  const key = cacheKey(hash)

  if (!forceRefresh) {
    const cached = await readCache(key)
    if (cached) return cached
  } else {
    await deleteCache(key)
  }

  let result: AnalysisResult

  if (imageUrl) {
    const base64: string = await new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ type: 'FETCH_IMAGE', url: imageUrl }, (r) => {
        if (chrome.runtime.lastError || r?.error) return reject(new Error('network'))
        resolve(r.base64 as string)
      })
    })
    const byteStr = atob(base64.split(',')[1])
    const mimeMatch = base64.match(/data:([^;]+)/)
    const mime = mimeMatch?.[1] ?? 'image/jpeg'
    const arr = new Uint8Array(byteStr.length)
    for (let i = 0; i < byteStr.length; i++) arr[i] = byteStr.charCodeAt(i)
    const blob = new Blob([arr], { type: mime })
    const filename = imageUrl.split('/').pop()?.split('?')[0] ?? 'image.jpg'
    const file = new File([blob], filename, { type: mime })
    const form = new FormData()
    form.append('image', file)
    if (query) form.append('caption', query)
    const apiRes = await fetch(`${API_BASE_URL}/api/analyze/image`, {
      method: 'POST',
      body: form,
    })
    if (!apiRes.ok) throw new Error('server_error')
    result = mapImageResponse(await apiRes.json(), query, imageUrl)
  } else {
    const queryType = isUrl(query) ? 'url' : 'text'
    const apiRes = await fetch(`${API_BASE_URL}/api/analyze/text`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, queryType }),
    })
    if (!apiRes.ok) throw new Error('server_error')
    result = mapTextResponse(await apiRes.json(), query)
  }

  await writeCache(key, result)
  return result
}

export async function analyzeImage(
  file: File,
  caption?: string,
  forceRefresh = false
): Promise<AnalysisResult> {
  const hash = await sha256(`${file.name}\n${file.size}\n${file.lastModified}\n${caption ?? ''}`)
  const key = cacheKey(hash)

  if (!forceRefresh) {
    const cached = await readCache(key)
    if (cached) return cached
  } else {
    await deleteCache(key)
  }

  const form = new FormData()
  form.append('image', file)
  if (caption) form.append('caption', caption)

  const apiRes = await fetch(`${API_BASE_URL}/api/analyze/image`, {
    method: 'POST',
    body: form,
  })
  if (!apiRes.ok) throw new Error('server_error')

  const objectUrl = URL.createObjectURL(file)
  const result = mapImageResponse(await apiRes.json(), caption ?? file.name, objectUrl)
  await writeCache(key, result)
  return result
}
