import { useState } from 'react'
import type { SiteSettings } from '../../lib/types'

interface Props {
  settings: SiteSettings
  onBack: () => void
  onSave: (settings: SiteSettings) => void
}

export function SettingsPage({ settings, onBack, onSave }: Props) {
  const [local, setLocal] = useState<SiteSettings>({ ...settings, badgeLimit: settings.badgeLimit ?? 3 })
  const [confirmClear, setConfirmClear] = useState(false)

  const clearAllData = async () => {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      await new Promise<void>(resolve => chrome.storage.local.clear(resolve))
    } else {
      localStorage.clear()
    }
    setConfirmClear(false)
    window.location.reload()
  }

  const toggle = (key: keyof SiteSettings['sites']) => {
    setLocal(prev => {
      const updated = { ...prev, sites: { ...prev.sites, [key]: !prev.sites[key] } }
      onSave(updated)
      return updated
    })
  }

  const toggleGlobal = () => {
    setLocal(prev => {
      const updated = { ...prev, enabled: !prev.enabled }
      onSave(updated)
      return updated
    })
  }

  const updateBadgeLimit = (limit: number) => {
    const clamped = Math.min(20, Math.max(1, limit))
    setLocal(prev => {
      const updated = { ...prev, badgeLimit: clamped }
      onSave(updated)
      return updated
    })
  }

  return (
    <div className="flex flex-col flex-1 bg-white dark:bg-slate-900">
      <div className="flex items-center gap-2 px-4 py-3 bg-[#1E40AF]">
        <button onClick={onBack} className="text-white/80 hover:text-white text-sm">
          ← กลับ
        </button>
        <span className="text-white font-semibold text-sm">ตั้งค่า</span>
      </div>

      <div className="flex flex-col gap-2 p-4">
        {/* Global toggle */}
        <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
          <div>
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">เปิดใช้งานส่วนขยาย</p>
            <p className="text-xs text-slate-400 dark:text-slate-500">เปิด/ปิดการตรวจสอบอัตโนมัติทั้งหมด</p>
          </div>
          <Toggle checked={local.enabled} onChange={toggleGlobal} />
        </div>

        {/* Badge limit stepper */}
        <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
          <div>
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">จำนวนสูงสุดต่อหน้า</p>
            <p className="text-xs text-slate-400 dark:text-slate-500">Badge ที่ตรวจอัตโนมัติต่อ 1 หน้า</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => updateBadgeLimit((local.badgeLimit ?? 3) - 1)}
              disabled={!local.enabled || (local.badgeLimit ?? 3) <= 1}
              aria-label="ลดจำนวน"
              className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-sm font-bold disabled:opacity-40 hover:bg-slate-300 dark:hover:bg-slate-600"
            >−</button>
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 w-4 text-center">
              {local.badgeLimit ?? 3}
            </span>
            <button
              onClick={() => updateBadgeLimit((local.badgeLimit ?? 3) + 1)}
              disabled={!local.enabled || (local.badgeLimit ?? 3) >= 20}
              aria-label="เพิ่มจำนวน"
              className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-sm font-bold disabled:opacity-40 hover:bg-slate-300 dark:hover:bg-slate-600"
            >+</button>
          </div>
        </div>

        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 px-1 mt-1">ตรวจสอบอัตโนมัติบน</p>

        <SiteRow
          label="Facebook"
          domain="facebook.com"
          emoji="📘"
          checked={local.sites.facebook}
          disabled={!local.enabled}
          onChange={() => toggle('facebook')}
        />
        <SiteRow
          label="X / Twitter"
          domain="x.com, twitter.com"
          emoji="🐦"
          checked={local.sites.twitter}
          disabled={!local.enabled}
          onChange={() => toggle('twitter')}
        />
        <SiteRow
          label="LINE Today"
          domain="today.line.me"
          emoji="💚"
          checked={local.sites.lineToday}
          disabled={!local.enabled}
          onChange={() => toggle('lineToday')}
        />

        <div className="mt-4 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl text-xs text-slate-400 dark:text-slate-500 text-center">
          🔒 การตั้งค่าทั้งหมดเก็บในเครื่องคุณ
        </div>

        {/* Clear all data */}
        {confirmClear ? (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
            <p className="text-xs text-red-700 mb-2">ต้องการลบข้อมูลทั้งหมดใช่ไหม? การกระทำนี้ไม่สามารถย้อนกลับได้</p>
            <div className="flex gap-2">
              <button
                onClick={clearAllData}
                aria-label="ยืนยันลบข้อมูลทั้งหมด"
                className="flex-1 py-1.5 bg-red-600 text-white text-xs rounded-lg font-medium"
              >
                ยืนยัน
              </button>
              <button
                onClick={() => setConfirmClear(false)}
                aria-label="ยกเลิก"
                className="flex-1 py-1.5 bg-slate-100 text-slate-600 text-xs rounded-lg font-medium"
              >
                ยกเลิก
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setConfirmClear(true)}
            aria-label="ลบข้อมูลทั้งหมด"
            className="w-full py-2.5 text-sm font-medium text-red-600 border border-red-200 rounded-xl hover:bg-red-50 transition-colors"
          >
            🗑 ลบข้อมูลทั้งหมด
          </button>
        )}
      </div>
    </div>
  )
}

function SiteRow({
  label, domain, emoji, checked, disabled, onChange,
}: {
  label: string; domain: string; emoji: string
  checked: boolean; disabled: boolean; onChange: () => void
}) {
  return (
    <div className={`flex items-center justify-between p-3 border border-slate-100 dark:border-slate-700 rounded-xl ${disabled ? 'opacity-50' : ''}`}>
      <div className="flex items-center gap-2">
        <span>{emoji}</span>
        <div>
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{label}</p>
          <p className="text-xs text-slate-400 dark:text-slate-500">{domain}</p>
        </div>
      </div>
      <Toggle checked={checked && !disabled} onChange={onChange} disabled={disabled} />
    </div>
  )
}

function Toggle({ checked, onChange, disabled = false }: { checked: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onChange}
      disabled={disabled}
      className={`relative w-10 h-6 rounded-full transition-colors ${
        checked ? 'bg-[#1E40AF]' : 'bg-slate-200'
      } ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <div
        className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${
          checked ? 'left-5' : 'left-1'
        }`}
      />
    </button>
  )
}
