// src/content/index.ts
// Badge injection — checks globalEnabled + per-site toggle before injecting.
// All code wrapped in try/catch to prevent leaking errors to the host page.

const BADGE_CLASS = 'sbs-badge'

const SITE_KEY_MAP: Record<string, keyof { facebook: boolean; twitter: boolean; lineToday: boolean }> = {
  'facebook.com': 'facebook',
  'x.com': 'twitter',
  'twitter.com': 'twitter',
  'today.line.me': 'lineToday',
}

const MOCK_BADGES = [
  { verdict: 'น่าสงสัย',   score: 32, color: '#EA580C', bg: '#FFF7ED', emoji: '🟠' },
  { verdict: 'อันตราย',     score: 8,  color: '#DC2626', bg: '#FEF2F2', emoji: '🔴' },
  { verdict: 'ยืนยันแล้ว', score: 92, color: '#059669', bg: '#F0FDF4', emoji: '✅' },
  { verdict: 'ไม่แน่ใจ',   score: 51, color: '#CA8A04', bg: '#FEFCE8', emoji: '🟡' },
]

function getRandomBadge() {
  return MOCK_BADGES[Math.floor(Math.random() * MOCK_BADGES.length)]
}

function currentSiteKey() {
  const host = location.hostname.replace(/^www\./, '')
  return SITE_KEY_MAP[host] ?? null
}

function createBadge(resultId: string): HTMLElement {
  const data = getRandomBadge()
  const el = document.createElement('div')
  el.className = BADGE_CLASS
  el.style.cssText = `
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 8px;
    border-radius: 20px;
    font-size: 11px;
    font-weight: 600;
    font-family: 'IBM Plex Sans Thai', sans-serif;
    color: ${data.color};
    background: ${data.bg};
    border: 1px solid ${data.color}40;
    cursor: pointer;
    margin-top: 4px;
    user-select: none;
    transition: opacity 0.2s;
  `
  el.title = 'ชัวร์ก่อนแชร์ — คลิกเพื่อดูผล'
  el.innerHTML = `${data.emoji} ${data.verdict} (${data.score}%)`

  el.addEventListener('click', e => {
    try {
      e.stopPropagation()
      chrome.runtime.sendMessage({ type: 'OPEN_POPUP_WITH_RESULT', resultId })
    } catch { /* ignore */ }
  })

  return el
}

function injectBadges() {
  // X/Twitter
  document.querySelectorAll<HTMLElement>('[data-testid="tweetText"]').forEach(el => {
    if (el.querySelector(`.${BADGE_CLASS}`)) return
    const more = el.querySelector<HTMLElement>('[data-testid="tweet-text-show-more-link"]')
    if (more) { more.click(); return }
    el.appendChild(createBadge(`mock-${el.dataset.testid}-${Date.now()}`))
  })

  // Facebook
  document.querySelectorAll<HTMLElement>('[data-ad-preview="message"], [class*="userContent"]').forEach(el => {
    if (el.querySelector(`.${BADGE_CLASS}`)) return
    for (const c of el.querySelectorAll<HTMLElement>('[role="button"], span, div')) {
      if (c.childElementCount === 0 && c.innerText.trim() === 'ดูเพิ่มเติม') {
        c.click()
        return
      }
    }
    el.appendChild(createBadge(`mock-fb-${Date.now()}`))
  })

  // LINE Today
  document.querySelectorAll<HTMLElement>('article p').forEach(el => {
    if (el.querySelector(`.${BADGE_CLASS}`)) return
    if (el.innerText.trim().length < 30) return
    el.appendChild(createBadge(`mock-line-${Date.now()}`))
  })
}

function removeAllBadges() {
  document.querySelectorAll(`.${BADGE_CLASS}`).forEach(el => el.remove())
}

let observer: MutationObserver | null = null

function startObserver() {
  if (observer) return
  observer = new MutationObserver(() => {
    try { injectBadges() } catch { /* ignore */ }
  })
  observer.observe(document.body, { childList: true, subtree: true })
}

function stopObserver() {
  observer?.disconnect()
  observer = null
}

// Bootstrap: read settings, then init
try {
  chrome.storage.local.get('sbs_settings', result => {
    try {
      const settings = result['sbs_settings']
      const siteKey = currentSiteKey()
      const globalEnabled: boolean = settings?.enabled ?? true
      const siteEnabled: boolean = siteKey ? (settings?.sites?.[siteKey] ?? true) : false

      if (globalEnabled && siteEnabled) {
        injectBadges()
        startObserver()
      }

      // React to toggle changes without reloading the tab
      chrome.storage.onChanged.addListener((changes) => {
        try {
          if (!changes['sbs_settings']) return
          const newSettings = changes['sbs_settings'].newValue
          const nowGlobal: boolean = newSettings?.enabled ?? true
          const nowSite: boolean = siteKey ? (newSettings?.sites?.[siteKey] ?? true) : false

          if (nowGlobal && nowSite) {
            injectBadges()
            startObserver()
          } else {
            removeAllBadges()
            stopObserver()
          }
        } catch { /* ignore */ }
      })
    } catch { /* ignore */ }
  })
} catch { /* ignore */ }

// ─── Pick Mode ───────────────────────────────────────────────────────────────

const PICK_STYLE_ID = 'sbs-pick-mode-styles'
const PICK_TOOLBAR_ID = 'sbs-pick-toolbar'
const PICK_HOVER_CLASS = 'sbs-pick-hover'

let isPickMode = false
let hoverTarget: HTMLElement | null = null

const ELIGIBLE_TAGS = new Set(['p', 'article', 'section', 'blockquote', 'div'])
const SITE_SELECTORS = [
  '[data-testid="tweetText"]',
  '[data-ad-preview="message"]',
  'article p',
]

function isEligibleElement(el: HTMLElement): boolean {
  const tag = el.tagName.toLowerCase()
  if (!ELIGIBLE_TAGS.has(tag)) return false
  return (el.innerText?.trim().length ?? 0) >= 30
}

function findPickTarget(el: EventTarget | null): HTMLElement | null {
  if (!(el instanceof HTMLElement)) return null
  if (el.closest(`#${PICK_TOOLBAR_ID}`)) return null
  // Check site-specific selectors first
  for (const sel of SITE_SELECTORS) {
    const match = (el as HTMLElement).closest(sel)
    if (match) return match as HTMLElement
  }
  // Walk up DOM max 6 levels
  let current: HTMLElement | null = el
  let depth = 0
  while (current && depth < 6) {
    if (isEligibleElement(current)) return current
    current = current.parentElement
    depth++
  }
  return null
}

function injectPickStyles() {
  if (document.getElementById(PICK_STYLE_ID)) return
  const style = document.createElement('style')
  style.id = PICK_STYLE_ID
  style.textContent = `
    body { cursor: crosshair !important; }
    .${PICK_HOVER_CLASS} {
      outline: 2px solid #1E40AF !important;
      background-color: rgba(30, 64, 175, 0.08) !important;
    }
    #${PICK_TOOLBAR_ID}, #${PICK_TOOLBAR_ID}:hover {
      background: #1E40AF !important;
    }
    #sbs-pick-cancel, #sbs-pick-cancel:hover {
      background: #DC2626 !important;
    }
  `
  document.head.appendChild(style)
}

function removePickStyles() {
  document.getElementById(PICK_STYLE_ID)?.remove()
}

function injectToolbar() {
  if (document.getElementById(PICK_TOOLBAR_ID)) return
  const toolbar = document.createElement('div')
  toolbar.id = PICK_TOOLBAR_ID
  toolbar.style.cssText = `
    position: fixed;
    top: 12px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 2147483647;
    display: flex;
    align-items: center;
    gap: 10px;
    background: #1E40AF;
    color: white;
    padding: 8px 16px;
    border-radius: 24px;
    font-family: 'IBM Plex Sans Thai', sans-serif;
    font-size: 13px;
    font-weight: 500;
    box-shadow: 0 4px 16px rgba(30,64,175,0.4);
    pointer-events: auto;
  `
  toolbar.innerHTML = `
    <span>🔍 โหมดเลือกข้อความ — คลิกที่ข้อความที่ต้องการตรวจสอบ</span>
    <button id="sbs-pick-cancel" style="
      background: #DC2626;
      color: white;
      border: none;
      padding: 4px 10px;
      border-radius: 12px;
      font-size: 12px;
      cursor: pointer;
      font-family: inherit;
    ">ยกเลิก</button>
  `
  document.body.appendChild(toolbar)
  document.getElementById('sbs-pick-cancel')?.addEventListener('click', deactivatePickMode)
}

function removeToolbar() {
  document.getElementById(PICK_TOOLBAR_ID)?.remove()
}

function onMouseOver(e: MouseEvent) {
  try {
    const target = findPickTarget(e.target)
    if (hoverTarget && hoverTarget !== target) {
      hoverTarget.classList.remove(PICK_HOVER_CLASS)
    }
    if (target) {
      target.classList.add(PICK_HOVER_CLASS)
      hoverTarget = target
    }
  } catch { /* ignore */ }
}

function onMouseOut(e: MouseEvent) {
  try {
    const target = findPickTarget(e.target)
    target?.classList.remove(PICK_HOVER_CLASS)
  } catch { /* ignore */ }
}

async function expandTruncatedContent(target: HTMLElement): Promise<void> {
  // Twitter: click show-more link if tweet is truncated
  const twitterMore = target.querySelector<HTMLElement>('[data-testid="tweet-text-show-more-link"]')
  if (twitterMore) {
    twitterMore.click()
    await new Promise(r => setTimeout(r, 400))
    return
  }

  // Facebook: find "ดูเพิ่มเติม" button within or near the target
  const container = target.closest<HTMLElement>('[data-ad-preview="message"]') ?? target
  const candidates = container.querySelectorAll<HTMLElement>('[role="button"], span, div')
  for (const el of candidates) {
    if (el.childElementCount === 0 && el.innerText.trim() === 'ดูเพิ่มเติม') {
      el.click()
      await new Promise(r => setTimeout(r, 400))
      return
    }
  }
}

async function onPickClick(e: MouseEvent) {
  try {
    const target = findPickTarget(e.target)
    if (!target) return
    e.preventDefault()
    e.stopPropagation()

    await expandTruncatedContent(target)

    let text = target.innerText.trim()
    text = text.replace(/\n{2,}/g, '\n').slice(0, 5000)

    deactivatePickMode()
    chrome.runtime.sendMessage({ type: 'PICKED_TEXT', text })
  } catch { /* ignore */ }
}

function onKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    try { deactivatePickMode() } catch { /* ignore */ }
  }
}

function deactivatePickMode() {
  if (!isPickMode) return
  isPickMode = false
  hoverTarget?.classList.remove(PICK_HOVER_CLASS)
  hoverTarget = null
  removePickStyles()
  removeToolbar()
  document.removeEventListener('mouseover', onMouseOver)
  document.removeEventListener('mouseout', onMouseOut)
  document.removeEventListener('click', onPickClick, true)
  document.removeEventListener('keydown', onKeyDown)
}

function activatePickMode() {
  if (isPickMode) return
  isPickMode = true
  injectPickStyles()
  injectToolbar()
  document.addEventListener('mouseover', onMouseOver)
  document.addEventListener('mouseout', onMouseOut)
  document.addEventListener('click', onPickClick, true)
  document.addEventListener('keydown', onKeyDown)
}

// Listen for ACTIVATE_PICK_MODE from popup
try {
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    try {
      if (msg.type === 'ACTIVATE_PICK_MODE') {
        activatePickMode()
        sendResponse({ ok: true })
      }
    } catch { /* ignore */ }
  })
} catch { /* ignore */ }
