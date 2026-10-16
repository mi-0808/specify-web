"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"

const ICONS = {
  search: <path d="M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Zm5.3-2.2L21 21" />,
  bookmark: <path d="M6.5 3.5h11a1 1 0 0 1 1 1v16l-6.5-4.2-6.5 4.2v-16a1 1 0 0 1 1-1z" />,
  user: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="10" r="3" />
      <path d="M6.2 18.4a6.8 6.8 0 0 1 11.6 0" />
    </>
  ),
}

const TABS = [
  { href: "/", label: "さがす", icon: "search", match: (p: string) => p === "/" || p.startsWith("/rooms") || p === "/add" },
  { href: "/saved", label: "保存", icon: "bookmark", match: (p: string) => p.startsWith("/saved") },
  { href: "/me", label: "マイページ", icon: "user", match: (p: string) => p.startsWith("/me") || p.startsWith("/login") },
] as const

// スマホだけ、画面の下にすりガラスのタブバーを出す（パソコンは上のヘッダーのまま）
export function TabBar() {
  const pathname = usePathname()
  // 押したタブを覚えておき、ページの読み込みを待たずに選択表示を移す（URL が変わったら usePathname に戻る）
  const [tapped, setTapped] = useState<{ href: string; from: string } | null>(null)
  const pending = tapped?.from === pathname ? tapped.href : null
  return (
    <nav aria-label="メインメニュー" className="glass fixed inset-x-0 bottom-0 z-40 border-t border-outline-variant/60 pb-[env(safe-area-inset-bottom)] md:hidden">
      <ul className="mx-auto flex max-w-md justify-around">
        {TABS.map((t) => {
          const current = t.match(pathname)
          const active = pending ? t.href === pending : current
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                aria-current={current ? "page" : undefined}
                onClick={() => setTapped({ href: t.href, from: pathname })}
                className={`focus-ring flex touch-manipulation select-none min-h-14 min-w-16 flex-col items-center justify-center gap-0.5 rounded-xl px-3 pt-1.5 text-[0.6875rem] font-medium ${
                  active ? "tab-lit text-primary" : "text-on-surface-variant"
                }`}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true" className="size-6" fill={active && t.icon === "bookmark" ? "currentColor" : "none"} stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                  {ICONS[t.icon]}
                </svg>
                {t.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
