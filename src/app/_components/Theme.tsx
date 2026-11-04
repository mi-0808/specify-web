"use client"

import { useSyncExternalStore } from "react"

// テーマはライトとダークの2つ。選ぶまでは端末の設定に合わせる。選んだらこのブラウザの localStorage にだけ保存し、色は layout.tsx の window.applyTheme が塗り替える
type Theme = "light" | "dark"

declare global {
  interface Window { applyTheme?: () => void }
}

// <html data-theme> の書き換え（タップ・端末側の切り替え）を見張る
function subscribe(cb: () => void) {
  const observer = new MutationObserver(cb)
  observer.observe(document.documentElement, { attributeFilter: ["data-theme"] })
  return () => observer.disconnect()
}

const getTheme = () => document.documentElement.dataset.theme as Theme

// マイページの1行。タップするたびにライトとダークが入れ替わる
export function ThemeRow() {
  const theme = useSyncExternalStore(subscribe, getTheme, () => undefined)

  function toggle() {
    try {
      localStorage.setItem("theme", theme === "dark" ? "light" : "dark")
    } catch {}
    window.applyTheme?.()
  }

  return (
    <button type="button" onClick={toggle} className="focus-ring flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface-container-low">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-on-surface-variant text-surface">
        <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
          <path d="M20.5 14.5A8.5 8.5 0 1 1 9.5 3.5a6.5 6.5 0 0 0 11 11z" />
        </svg>
      </span>
      <span className="flex-1">テーマ</span>
      <span className="text-on-surface-variant">{theme && (theme === "dark" ? "ダーク" : "ライト")}</span>
    </button>
  )
}
