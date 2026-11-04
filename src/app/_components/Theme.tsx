"use client"

import { useSyncExternalStore } from "react"

// テーマはライトとダークの2つ。選ぶまでは端末の設定に合わせる。選んだらこのブラウザの localStorage にだけ保存し、色は layout.tsx の window.applyTheme が塗り替える
declare global {
  interface Window { applyTheme?: () => void }
}

// <html data-theme> の書き換え（タップ・端末側の切り替え）を見張る
function subscribe(cb: () => void) {
  const observer = new MutationObserver(cb)
  observer.observe(document.documentElement, { attributeFilter: ["data-theme"] })
  return () => observer.disconnect()
}

const isDark = () => document.documentElement.dataset.theme === "dark"

// マイページの1行。iPhone の設定と同じスイッチで、行のどこを押してもダークモードが入れ替わる
export function ThemeRow() {
  const dark = useSyncExternalStore(subscribe, isDark, () => false)

  function toggle() {
    try {
      localStorage.setItem("theme", dark ? "light" : "dark")
    } catch {}
    window.applyTheme?.()
  }

  return (
    <button type="button" role="switch" aria-checked={dark} onClick={toggle} className="focus-ring flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface-container-low">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-on-surface-variant text-surface">
        <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
          <path d="M20.5 14.5A8.5 8.5 0 1 1 9.5 3.5a6.5 6.5 0 0 0 11 11z" />
        </svg>
      </span>
      <span className="flex-1">ダークモード</span>
      <span aria-hidden="true" className={`relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors ${dark ? "bg-primary" : "bg-surface-container-highest"}`}>
        <span className={`absolute top-0.5 size-[27px] rounded-full bg-white shadow transition-[left] ${dark ? "left-[22px]" : "left-0.5"}`} />
      </span>
    </button>
  )
}
