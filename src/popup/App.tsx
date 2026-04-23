// src/popup/App.tsx
import { useState, useEffect } from 'react'
import { analyzeText, analyzeImage } from '../lib/api'
import { analyzeContent } from '../lib/mock-api'
import { storage } from '../lib/storage'
import type { AnalysisResult, SiteSettings } from '../lib/types'
import { HomePage } from './components/HomePage'
import { ResultPage } from './components/ResultPage'
import { SettingsPage } from './components/SettingsPage'
import { HistoryPage } from './components/HistoryPage'

type Page = 'home' | 'result' | 'settings' | 'history'

const ERROR_MAP: Record<string, string> = {
  network: 'ไม่สามารถเชื่อมต่อ server ได้',
  timeout: 'ใช้เวลานานเกินไป ลองใหม่อีกครั้ง',
  server_error: 'Server ไม่ตอบสนอง กรุณาลองใหม่',
}

export default function App() {
  const [page, setPage] = useState<Page>('home')
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [settings, setSettings] = useState<SiteSettings | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [prefillText, setPrefillText] = useState<string | null>(null)
  const [prefillImageUrl, setPrefillImageUrl] = useState<string | null>(null)

  useEffect(() => {
    storage.getSettings().then(setSettings)

    // Check for pending picked text from pick mode
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.get(['sbs_pendingPickedText', 'sbs_pendingPickedImageUrl', 'sbs_pendingResultId'], r => {
        const text: string | undefined = r['sbs_pendingPickedText']
        const imgUrl: string | undefined = r['sbs_pendingPickedImageUrl']
        if (text || imgUrl) {
          const keys = ['sbs_pendingPickedText', 'sbs_pendingPickedImageUrl'].filter(k => r[k])
          chrome.storage.local.remove(keys)
          chrome.action.setBadgeText({ text: '' })
          if (imgUrl) setPrefillImageUrl(imgUrl)
          if (text) setPrefillText(text)
        }
        if (r['sbs_pendingResultId']) {
          chrome.storage.local.remove('sbs_pendingResultId')
        }
      })
    }
  }, [])

  // Auto-trigger analysis when prefillText or prefillImageUrl is set
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (prefillText || prefillImageUrl) {
      handleAnalyze(prefillText ?? '[รูปภาพ]', prefillImageUrl ?? undefined)
      setPrefillText(null)
      setPrefillImageUrl(null)
    }
  }, [prefillText, prefillImageUrl])

  const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true'

  const handleAnalyze = async (query: string, imageUrl?: string, forceRefresh = false) => {
    setIsLoading(true)
    setError(null)
    try {
      const res: AnalysisResult = USE_MOCK
        ? await analyzeContent(query, imageUrl)
        : await analyzeText(query, imageUrl, forceRefresh)
      setResult(res)
      await storage.addHistory({
        id: res.id,
        query: query.slice(0, 80),
        verdict: res.verdict,
        score: res.score,
        checkedAt: res.analyzedAt,
      })
      setPage('result')
    } catch (err) {
      const code = (err as Error).message
      setError(ERROR_MAP[code] ?? 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง')
    } finally {
      setIsLoading(false)
    }
  }

  const handleAnalyzeImage = async (file: File, caption?: string, forceRefresh = false) => {
    setIsLoading(true)
    setError(null)
    try {
      const res: AnalysisResult = USE_MOCK
        ? await analyzeContent(caption ?? file.name)
        : await analyzeImage(file, caption, forceRefresh)
      setResult(res)
      await storage.addHistory({
        id: res.id,
        query: (caption ?? file.name).slice(0, 80),
        verdict: res.verdict,
        score: res.score,
        checkedAt: res.analyzedAt,
      })
      setPage('result')
    } catch (err) {
      const code = (err as Error).message
      setError(ERROR_MAP[code] ?? 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSaveSettings = async (newSettings: SiteSettings) => {
    setSettings(newSettings)
    await storage.saveSettings(newSettings)
  }

  if (!settings) return null

  return (
    <div className="flex flex-col flex-1">
      {page === 'home' && (
        <HomePage
          isLoading={isLoading}
          error={error}
          prefillText={prefillText ?? ''}
          onAnalyze={handleAnalyze}
          onAnalyzeImage={handleAnalyzeImage}
          onOpenSettings={() => setPage('settings')}
          onOpenHistory={() => setPage('history')}
        />
      )}
      {page === 'result' && result && (
        <ResultPage
          result={result}
          onBack={() => setPage('home')}
          onForceRefresh={() => handleAnalyze(result.query, result.imageUrl, true)}
        />
      )}
      {page === 'settings' && settings && (
        <SettingsPage
          settings={settings}
          onBack={() => setPage('home')}
          onSave={handleSaveSettings}
        />
      )}
      {page === 'history' && (
        <HistoryPage onBack={() => setPage('home')} onRecheck={handleAnalyze} />
      )}
    </div>
  )
}
