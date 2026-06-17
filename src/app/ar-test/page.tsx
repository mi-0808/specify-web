"use client"

import dynamic from "next/dynamic"

const ARTestScene = dynamic(() => import("@/components/ar/ARTestScene"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center w-screen h-screen bg-black text-white text-sm">
      読み込み中...
    </div>
  ),
})

export default function ARTestPage() {
  return (
    <main className="w-screen h-screen overflow-hidden">
      <ARTestScene />
    </main>
  )
}
