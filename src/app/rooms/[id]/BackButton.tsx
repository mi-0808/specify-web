"use client"

import { useRouter } from "next/navigation"

// 左上の戻るボタン。共有リンクなどで直接開いて戻り先がないときは、さがすへ
export function BackButton() {
  const router = useRouter()
  return (
    <button
      type="button"
      aria-label="戻る"
      onClick={() => (history.length > 1 ? router.back() : router.push("/"))}
      className="focus-ring -ml-2.5 inline-flex size-11 items-center justify-center rounded-full text-on-surface hover:bg-surface-container-high"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" className="size-6" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M15 5l-7 7 7 7" />
      </svg>
    </button>
  )
}
