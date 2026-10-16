"use client"

import Link from "next/link"
import { useState } from "react"

type Chip = { key: string; label: string; href: string; active: boolean }

// 押した瞬間に選択の色を切り替える（サーバーの返事を待つと、押してから色が変わるまでラグが出る）
export function FilterChips({ chips }: { chips: Chip[] }) {
  const [tapped, setTapped] = useState<Chip | null>(null)
  const [prev, setPrev] = useState(chips)
  if (prev !== chips) {
    // 新しいページが届いたら、サーバーの選択状態に戻す
    setPrev(chips)
    setTapped(null)
  }

  return chips.map((c) => {
    // 選択中のチップをもう一度押すと解除
    const active = tapped ? c.key === tapped.key && !tapped.active : c.active
    return (
      <li key={c.key}>
        <Link
          href={c.href}
          onClick={() => setTapped(c)}
          aria-current={active ? "page" : undefined}
          className={`focus-ring inline-flex min-h-11 items-center whitespace-nowrap rounded-full px-4 text-[0.9375rem] font-medium ${
            active
              ? "bg-secondary-container text-on-secondary-container"
              : "border border-outline-variant bg-surface-container-lowest text-on-surface hover:bg-surface-container-low"
          }`}
        >
          {c.label}
        </Link>
      </li>
    )
  })
}
