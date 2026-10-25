"use client"

import Link from "next/link"
import { useLayoutEffect, useRef, useState, type ReactNode } from "react"
import { LinkSpinner } from "./LinkSpinner"

type Chip = { key: string; label: string; href: string; active: boolean }

const MAX_ROWS = 3

// 並んだ <li> の行の数（上端の位置が同じものを1行と数える）
function rowTops(ul: HTMLUListElement) {
  return [...new Set([...ul.querySelectorAll<HTMLElement>(":scope > li")].map((li) => li.offsetTop))].sort((a, b) => a - b)
}

// 押した瞬間に選択の色を切り替える（サーバーの返事を待つと、押してから色が変わるまでラグが出る）
// スマホは3行まで出して、残りは「もっと見る」で開く。パソコンは全部折り返して並べる
export function FilterChips({ chips, trailing }: { chips: Chip[]; trailing?: ReactNode }) {
  const [tapped, setTapped] = useState<Chip | null>(null)
  const [prev, setPrev] = useState(chips)
  const [expanded, setExpanded] = useState(false)
  const [limit, setLimit] = useState<number | null>(null) // 閉じているときに出すチップの数。null は全部
  const ref = useRef<HTMLUListElement>(null)
  if (prev !== chips) {
    // 新しいページが届いたら、サーバーの選択状態に戻す
    setPrev(chips)
    setTapped(null)
    setLimit(null)
  }

  // 1回目は全部並べて4行目の頭を探し、2回目以降は「もっと見る」が3行目に収まるまで1つずつ減らす
  useLayoutEffect(() => {
    const ul = ref.current
    if (!ul || expanded || window.matchMedia("(min-width: 768px)").matches) return
    const rows = rowTops(ul)
    if (rows.length <= MAX_ROWS) return
    if (limit === null) {
      const lis = [...ul.querySelectorAll<HTMLElement>(":scope > li")]
      const cut = Math.min(lis.findIndex((li) => li.offsetTop >= rows[MAX_ROWS]), chips.length)
      const active = chips.findIndex((c) => c.active)
      // 選択中のチップが隠れてしまうなら、最初から開いておく
      if (active >= cut - 1) setExpanded(true)
      else setLimit(cut - 1)
    } else if (limit > 1) {
      setLimit(limit - 1)
    }
  }, [chips, expanded, limit])

  // 画面の幅が変わったら測り直す（iPhone はスクロールでアドレスバーが縮むたびに resize が来るので、幅だけ見る）
  useLayoutEffect(() => {
    let width = window.innerWidth
    const onResize = () => {
      if (window.innerWidth === width) return
      width = window.innerWidth
      setLimit(null)
    }
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [])

  const collapsed = !expanded && limit !== null
  const shown = collapsed ? chips.slice(0, limit) : chips

  return (
    // 測り終わるまでは CSS で3行分の高さに切っておく（読み込み直後に全部が一瞬見えないように）
    <ul ref={ref} className={`flex flex-wrap gap-2 ${expanded ? "" : "max-h-[7rem] overflow-hidden md:max-h-none"}`}>
      {shown.map((c) => {
        // 選択中のチップをもう一度押すと解除（「すべて」は押しても選択のまま）
        const active = tapped ? c.key === tapped.key && (!tapped.active || tapped.key === "all") : c.active
        return (
          <li key={c.key}>
            <Link
              href={c.href}
              onClick={() => setTapped(c)}
              aria-current={active ? "page" : undefined}
              className={`focus-ring inline-flex min-h-8 items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-[0.8125rem] font-medium md:min-h-11 md:px-4 md:text-[0.9375rem] ${
                active
                  ? "bg-secondary-container text-on-secondary-container"
                  : "border border-outline-variant bg-surface-container-lowest text-on-surface hover:bg-surface-container-low"
              }`}
            >
              {c.label}
              <LinkSpinner />
            </Link>
          </li>
        )
      })}
      {!collapsed && trailing && <li>{trailing}</li>}
      {(collapsed || expanded) && (
        <li>
          <button
            type="button"
            onClick={() => {
              setExpanded(!expanded)
              setLimit(null)
            }}
            aria-expanded={expanded}
            className="focus-ring inline-flex min-h-8 items-center whitespace-nowrap rounded-full px-2 text-[0.8125rem] font-medium text-primary md:hidden"
          >
            {expanded ? "閉じる ▴" : "もっと見る ▾"}
          </button>
        </li>
      )}
    </ul>
  )
}
