// src/lib/api.ts
import type { AnalysisResult } from './types'

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000'

const CACHE_TTL_MS = 60 * 60 * 1000         // 1 hour
const CACHE_TTL_DANGER_MS = 24 * 60 * 60 * 1000 // 24 hours for อันตราย/น่าสงสัย

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

export async function analyzeText(query: string, imageUrl?: string, forceRefresh = false): Promise<AnalysisResult> {
  const hash = await sha256(imageUrl ? `${query}\n${imageUrl}` : query)
  const key = cacheKey(hash)

  if (!forceRefresh) {
    const cached = await readCache(key)
    if (cached) return cached
  } else {
    await deleteCache(key)
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 10_000)

  try {
    const res = await fetch(`${API_BASE_URL}/api/analyze/text`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, ...(imageUrl ? { imageUrl } : {}) }),
      signal: controller.signal,
    })
    clearTimeout(timeoutId)

    if (!res.ok) throw new Error('server_error')

    const result: AnalysisResult = await res.json()
    await writeCache(key, result)
    return result
  } catch (err) {
    clearTimeout(timeoutId)
    const name = (err as Error).name
    const msg = (err as Error).message
    if (name === 'AbortError') throw new Error('timeout')
    if (msg === 'server_error') throw new Error('server_error')
    throw new Error('network')
  }
}
