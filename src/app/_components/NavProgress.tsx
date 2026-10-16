"use client"

import { usePathname, useSearchParams } from "next/navigation"
import { useEffect, useState } from "react"

// 画面上部の細い読み込みバー。リンクを押した瞬間に伸び始め、次の画面が届いたら伸び切って消える
export function NavProgress() {
  const url = usePathname() + "?" + useSearchParams()
  const [state, setState] = useState<"idle" | "go" | "done">("idle")
  const [prev, setPrev] = useState(url)
  if (prev !== url) {
    setPrev(url)
    if (state === "go") setState("done")
  }

  useEffect(() => {
    // Link が preventDefault する前に拾うため、capture で聞く
    const onClick = (e: MouseEvent) => {
      if (e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const a = (e.target as Element).closest("a")
      if (!a || a.target || a.origin !== location.origin) return
      if (a.pathname + a.search === location.pathname + location.search) return
      setState("go")
    }
    document.addEventListener("click", onClick, true)
    return () => document.removeEventListener("click", onClick, true)
  }, [])

  useEffect(() => {
    if (state !== "done") return
    const t = setTimeout(() => setState("idle"), 400)
    return () => clearTimeout(t)
  }, [state])

  return <div aria-hidden="true" className={`nav-progress ${state}`} />
}
