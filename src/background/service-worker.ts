import { analyzeText } from '../lib/api'

chrome.runtime.onInstalled.addListener(() => {
  console.log('[ชัวร์ก่อนแชร์] Extension installed')
})

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'PICKED_TEXT') {
    const data: Record<string, string> = { sbs_pendingPickedText: msg.text }
    if (msg.imageUrl) data['sbs_pendingPickedImageUrl'] = msg.imageUrl
    chrome.storage.local.set(data, () => {
      chrome.action.setBadgeText({ text: '✓' })
      chrome.action.setBadgeBackgroundColor({ color: '#059669' })
      chrome.action.openPopup().catch(() => {})
      sendResponse({ ok: true })
    })
    return true
  }

  if (msg.type === 'OPEN_POPUP_WITH_RESULT') {
    chrome.storage.local.set({ sbs_pendingResultId: msg.resultId }, () => {
      chrome.action.openPopup().catch(() => {})
      sendResponse({ ok: true })
    })
    return true
  }

  if (msg.type === 'ANALYZE_BADGE') {
    analyzeText(msg.text)
      .then(result => sendResponse({ ok: true, result }))
      .catch(() => sendResponse({ ok: false }))
    return true
  }
})

export {}
