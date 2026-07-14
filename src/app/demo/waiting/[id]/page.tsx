"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import type { Database } from "@/types/database"

type SuggestionRow = Database["public"]["Tables"]["suggestions"]["Row"]

type SuggestionMarker = {
  id: string
  image_type: "room" | "storage"
  x: number
  y: number
  comment: string
  sort_order: number
}

export default function DemoWaitingPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const supabase = createClient()
  const [suggestion, setSuggestion] = useState<SuggestionRow | null>(null)
  const [markers, setMarkers] = useState<SuggestionMarker[]>([])
  const [errorMessage, setErrorMessage] = useState("")

  useEffect(() => {
    let cancelled = false

    async function poll() {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = supabase as any
      const { data, error } = await db
        .from("suggestions")
        .select("*")
        .eq("id", params.id)
        .single()

      if (cancelled) return
      if (error || !data) { setErrorMessage("提案の取得に失敗しました。"); return }

      setSuggestion(data as SuggestionRow)

      if (data.status === "done") {
        const { data: markerData } = await db
          .from("suggestion_markers")
          .select("*")
          .eq("suggestion_id", params.id)
          .order("sort_order")
        if (!cancelled && markerData) setMarkers(markerData as SuggestionMarker[])
      }
    }

    poll()
    const intervalId = window.setInterval(poll, 5000)
    return () => { cancelled = true; window.clearInterval(intervalId) }
  }, [params.id, supabase])

  if (suggestion?.status === "done") {
    const roomMarkers = markers.filter((m) => m.image_type === "room")
    const storageMarkers = markers.filter((m) => m.image_type === "storage")
    const allMarkers = [...roomMarkers, ...storageMarkers].sort((a, b) => a.sort_order - b.sort_order)

    return (
      <main className="min-h-screen bg-[#FBF5EE] text-[#2F2823]">
        <div className="bg-[#D96B2D] py-1.5 text-center text-xs font-medium text-white">
          収納の改善案が届きました
        </div>
        <div className="mx-auto max-w-2xl space-y-5 px-4 py-6">
          <div className="space-y-2">
            <p className="inline-flex rounded-full bg-[#3DAF85]/15 px-3 py-1 text-xs font-semibold text-[#2D7C62]">
              改善案ができました
            </p>
            <h1 className="text-3xl font-bold tracking-tight">こちらが提案です</h1>
          </div>

          {/* 写真 + マーカー */}
          {(["room", "storage"] as const).map((imageType) => {
            const url = imageType === "room" ? suggestion.room_image_url : suggestion.storage_image_url
            const imgMarkers = imageType === "room" ? roomMarkers : storageMarkers
            const label = imageType === "room" ? "部屋全体" : "収納スペース"
            const offset = imageType === "room" ? 0 : roomMarkers.length
            if (!url) return null
            return (
              <div key={imageType}>
                <p className="mb-1 text-xs font-semibold text-[#9B806C]">{label}</p>
                <div className="relative rounded-lg overflow-hidden border border-[#E8D8C7] bg-white">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt={label} className="w-full object-cover" />
                  {imgMarkers.map((m, i) => (
                    <div
                      key={m.id}
                      className="absolute flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-[#D96B2D] text-xs font-bold text-white shadow-lg ring-2 ring-white"
                      style={{ left: `${m.x * 100}%`, top: `${m.y * 100}%` }}
                    >
                      {offset + i + 1}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}

          {/* マーカーコメント一覧 */}
          {allMarkers.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm font-semibold text-[#2F2823]">指摘・改善提案</p>
              {allMarkers.map((m, i) => (
                <div key={m.id} className="flex gap-3 rounded-lg border border-[#E8D8C7] bg-white/70 p-4">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#D96B2D] text-xs font-bold text-white">
                    {i + 1}
                  </span>
                  <p className="text-sm leading-6 text-[#2F2823]">{m.comment}</p>
                </div>
              ))}
            </div>
          )}

          {/* 旧来の result_image_url フォールバック */}
          {suggestion.result_image_url && allMarkers.length === 0 && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={suggestion.result_image_url}
              alt="収納の改善案"
              className="w-full rounded-lg border border-[#E8D8C7] bg-white object-cover"
            />
          )}

          {suggestion.reasoning && (
            <div className="rounded-lg border border-[#E8D8C7] bg-white/70 p-4 text-sm leading-6 text-[#2F2823]">
              {suggestion.reasoning}
            </div>
          )}

          <div className="space-y-3">
            <button
              onClick={() => router.push("/demo")}
              className="w-full rounded-lg border border-[#E1CDB9] bg-white/60 py-3 font-medium text-[#6E5A4B] transition-colors hover:bg-white"
            >
              もう一度撮る
            </button>
            <button
              onClick={() => router.push("/dashboard")}
              className="w-full rounded-lg bg-[#D96B2D] py-3 font-semibold text-white shadow-sm transition-colors hover:bg-[#C85A20]"
            >
              保存する
            </button>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="flex min-h-screen flex-col bg-[#FBF5EE] text-[#2F2823]">
      <div className="bg-[#D96B2D] py-1.5 text-center text-xs font-medium text-white">
        収納の改善案を準備中
      </div>
      <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <div className="mb-7 grid w-24 grid-cols-3 overflow-hidden rounded-lg border border-[#E8D8C7] bg-white">
          <div className="h-20 animate-pulse bg-[#D96B2D]" />
          <div className="h-20 animate-pulse bg-[#F5C842] [animation-delay:200ms]" />
          <div className="h-20 animate-pulse bg-[#3DAF85] [animation-delay:400ms]" />
        </div>
        <h1 className="mb-2 text-2xl font-bold tracking-tight">収納の改善案を準備しています...</h1>
        <p className="text-sm text-[#6E5A4B]">届くまで少し時間がかかります。このまま待っていてください。</p>
        {errorMessage && <p className="mt-4 text-sm text-red-600">{errorMessage}</p>}
      </div>
    </main>
  )
}
