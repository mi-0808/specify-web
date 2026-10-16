"use client"

import Link from "next/link"
import { useEffect, useId, useRef, useState, type ReactNode } from "react"

// ボタンを押すと下に開く吹き出し。外側のクリックか Esc で閉じる
export function Popover({
  trigger,
  triggerLabel,
  triggerClassName,
  panelLabel,
  tone = "surface",
  align = "right",
  children,
}: {
  trigger: ReactNode
  triggerLabel?: string
  triggerClassName: string
  panelLabel: string
  tone?: "surface" | "inverse"
  align?: "left" | "right"
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const panelId = useId()

  useEffect(() => {
    if (!open) return
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("keydown", close)
    document.addEventListener("pointerdown", close)
    return () => {
      document.removeEventListener("keydown", close)
      document.removeEventListener("pointerdown", close)
    }
  }, [open])

  const toneClass =
    tone === "inverse"
      ? "bg-inverse-surface text-inverse-on-surface"
      : "border border-outline-variant bg-surface-container-lowest text-on-surface"

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={triggerLabel}
        onClick={() => setOpen((o) => !o)}
        className={triggerClassName}
      >
        {trigger}
      </button>
      {open && (
        <div
          id={panelId}
          role="dialog"
          aria-label={panelLabel}
          className={`absolute top-full z-20 mt-2 w-72 rounded-xl p-4 text-[0.875rem] leading-[1.6] shadow-lg ${toneClass} ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          {children}
        </div>
      )}
    </div>
  )
}

// 未ログインの人に会員登録を案内する中身（tone="inverse" の吹き出しに入れる）
export function SignupLinks({ message, next }: { message: string; next: string }) {
  const q = encodeURIComponent(next)
  return (
    <>
      <p>{message}</p>
      <div className="mt-3 flex items-center gap-4">
        <Link
          href={`/login?signup=1&next=${q}`}
          className="focus-ring inline-flex min-h-11 items-center rounded-full bg-inverse-primary px-4 font-semibold text-on-primary-container"
        >
          新規登録
        </Link>
        <Link href={`/login?next=${q}`} className="focus-ring inline-flex min-h-11 items-center rounded underline underline-offset-4">
          ログイン
        </Link>
      </div>
    </>
  )
}
