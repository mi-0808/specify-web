"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

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
  return (
    <nav aria-label="メインメニュー" className="glass fixed inset-x-0 bottom-0 z-40 border-t border-outline-variant/60 pb-[env(safe-area-inset-bottom)] md:hidden">
      {/* 3等分にして、文字の長さでボタンの位置がずれないようにする */}
      <ul className="mx-auto grid max-w-md grid-cols-3">
        {TABS.map((t) => {
          const active = t.match(pathname)
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                aria-current={active ? "page" : undefined}
                className={`focus-ring flex flex-col items-center gap-0.5 rounded-xl pt-1.5 pb-1 text-[0.6875rem] font-medium ${
                  active ? "text-primary" : "text-on-surface-variant"
                }`}
              >
                {/* 選択中はアイコンの後ろに淡いオレンジのピルを敷く */}
                <span className={`flex h-8 w-14 items-center justify-center rounded-full ${active ? "bg-primary-container text-on-primary-container" : ""}`}>
                  <svg viewBox="0 0 24 24" aria-hidden="true" className="size-[1.375rem]" fill={active && t.icon === "bookmark" ? "currentColor" : "none"} stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    {ICONS[t.icon]}
                  </svg>
                </span>
                {t.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
