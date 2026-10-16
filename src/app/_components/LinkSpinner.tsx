"use client"

import { useLinkStatus } from "next/link"

// Link の中に置くと、押してから次の画面が届くまで小さなくるくるを出す
export function LinkSpinner({ className = "" }: { className?: string }) {
  const { pending } = useLinkStatus()
  if (!pending) return null
  return <span aria-hidden="true" className={`spinner ${className}`} />
}
