"use client"

import { useFormStatus } from "react-dom"

// 「保存」「買った」の切り替えボタン。押されている状態は aria-pressed で伝える
export function ToggleButton({ on, label, onLabel }: { on: boolean; label: string; onLabel: string }) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      aria-pressed={on}
      className={`focus-ring min-h-11 rounded-full px-4 text-sm font-medium transition-colors ${
        on
          ? "bg-secondary-container text-on-secondary-container"
          : "border border-outline bg-surface-container-lowest text-primary hover:bg-surface-container-low"
      }`}
    >
      {pending ? "保存中…" : on ? onLabel : label}
    </button>
  )
}
