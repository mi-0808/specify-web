"use client"

import { useEffect, useRef, useState } from "react"

// iPhone アプリのような大きな見出し。スクロールして見出しが隠れたら、上にすりガラスの小さな見出しを出す（スマホだけ）
// alsoDesktop: パソコンでも同じ見出しを出す（さがすは、パソコンでは今の見出しのままにするので false）
// brand: 見出しの上に小さくアプリ名を出す（スマホは上のヘッダーがないので）
export function LargeTitle({
  title,
  subtitle,
  alsoDesktop = false,
  brand = false,
}: {
  title: string
  subtitle?: string
  alsoDesktop?: boolean
  brand?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [compact, setCompact] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(([entry]) => setCompact(!entry.isIntersecting), { rootMargin: "-8px 0px 0px 0px" })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <>
      <div ref={ref} className={`space-y-1 pt-[env(safe-area-inset-top)] ${alsoDesktop ? "" : "md:hidden"}`}>
        {/* brand は見出しと同じ行の右に置いて、タイムラインを上に寄せる */}
        <div className="flex items-center justify-between">
          <h1 className="text-[2.125rem] font-bold leading-[1.2] tracking-tight md:text-[1.75rem]">{title}</h1>
          {brand && <p className="flex items-center gap-1.5 text-[0.8125rem] font-bold tracking-tight"><img src="/icon.svg" alt="" className="size-5" />Specify</p>}
        </div>
        {subtitle && <p className="text-[0.9375rem] leading-[1.6] text-on-surface-variant">{subtitle}</p>}
      </div>
      <div
        aria-hidden="true"
        className={`glass fixed inset-x-0 top-0 z-30 border-b border-outline-variant/60 pt-[env(safe-area-inset-top)] transition-opacity duration-200 md:hidden ${
          compact ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        <p className="py-3 text-center text-[1.0625rem] font-semibold">{title}</p>
      </div>
    </>
  )
}
