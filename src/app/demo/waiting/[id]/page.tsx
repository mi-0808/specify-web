"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import type { Database } from "@/types/database"

type SuggestionRow = Database["public"]["Tables"]["suggestions"]["Row"]

type SuggestionMarker = Database["public"]["Tables"]["suggestion_markers"]["Row"]

/** `/api/analyze` が storage_options に保存する形（対象物・移動先・理由）。 */
type StorageOption = { target?: string; location?: string; reason?: string }

function toStorageOptions(value: unknown): StorageOption[] {
  return Array.isArray(value)
    ? value.filter((v): v is StorageOption => typeof v === "object" && v !== null)
    : []
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
    let intervalId = 0

    async function poll() {
      const { data, error } = await supabase
        .from("suggestions")
        .select("*")
        .eq("id", params.id)
        .single()

      if (cancelled) return
      if (error || !data) { setErrorMessage("提案の取得に失敗しました。"); return }

      setSuggestion(data)

      // 完了・失敗が確定したらポーリングを止める
      if (data.status === "done" || data.status === "failed") {
        window.clearInterval(intervalId)
      }

      if (data.status === "done") {
        const { data: markerData } = await supabase
          .from("suggestion_markers")
          .select("*")
          .eq("suggestion_id", params.id)
          .order("sort_order")
        if (!cancelled && markerData) setMarkers(markerData)
      }
    }

    poll()
    intervalId = window.setInterval(poll, 5000)
    return () => { cancelled = true; window.clearInterval(intervalId) }
  }, [params.id, supabase])

  if (suggestion?.status === "failed") {
    return (
      <main aria-live="polite" className="flex min-h-dvh flex-col bg-[#FBF5EE] text-[#2F2823]">
        <div className="bg-[#B8501A] py-1.5 text-center text-xs font-medium text-white">
          収納の改善案
        </div>
        <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
          <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-[#D96B2D]/15 text-3xl">
            🙏
          </div>
          <h1 className="mb-2 text-2xl font-bold tracking-tight">提案の作成に失敗しました</h1>
          <p className="mb-8 max-w-sm text-sm leading-6 text-[#6E5A4B]">
            写真がうまく読み取れなかったようです。明るい場所で撮り直すと成功しやすくなります。
          </p>
          <div className="w-full max-w-sm space-y-3">
            <button
              onClick={() => router.push("/demo")}
              className="w-full rounded-lg bg-[#B8501A] py-3 font-semibold text-white shadow-sm transition-colors hover:bg-[#9E4414]"
            >
              もう一度撮る
            </button>
            <button
              onClick={() => router.push("/")}
              className="w-full py-3 text-sm text-[#6E5A4B]"
            >
              トップに戻る
            </button>
          </div>
        </div>
      </main>
    )
  }

  if (suggestion?.status === "done") {
    const roomMarkers = markers.filter((m) => m.image_type === "room")
    const storageMarkers = markers.filter((m) => m.image_type === "storage")
    const allMarkers = [...roomMarkers, ...storageMarkers].sort((a, b) => a.sort_order - b.sort_order)
    const options = toStorageOptions(suggestion.storage_options)

    return (
      <main aria-live="polite" className="min-h-dvh bg-[#FBF5EE] text-[#2F2823]">
        <div className="bg-[#B8501A] py-1.5 text-center text-xs font-medium text-white">
          収納の改善案が届きました
        </div>
        <div className="mx-auto max-w-2xl space-y-5 px-4 py-6">
          <div className="space-y-2">
            <p className="inline-flex rounded-full bg-[#3DAF85]/15 px-3 py-1 text-xs font-semibold text-[#2D7C62]">
              改善案ができました
            </p>
            <h1 className="text-3xl font-bold tracking-tight">こちらが提案です</h1>
          </div>

          {/* 写真 + マーカー。マーカーが無ければ読む対象ではないので2列サムネにして本文を上げる */}
          <div className={allMarkers.length === 0 ? "grid grid-cols-2 gap-3" : "space-y-5"}>
          {(["room", "storage"] as const).map((imageType) => {
            const url = imageType === "room" ? suggestion.room_image_url : suggestion.storage_image_url
            const imgMarkers = imageType === "room" ? roomMarkers : storageMarkers
            const label = imageType === "room" ? "部屋全体" : "収納スペース"
            const offset = imageType === "room" ? 0 : roomMarkers.length
            if (!url) return null
            return (
              <div key={imageType}>
                <p className="mb-1 text-xs font-semibold text-[#6E5A4B]">{label}</p>
                <div className="relative rounded-lg overflow-hidden border border-[#E8D8C7] bg-white">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt={label} className={allMarkers.length === 0 ? "aspect-square w-full object-cover" : "aspect-[4/3] w-full object-cover"} />
                  {imgMarkers.map((m, i) => (
                    <div
                      key={m.id}
                      className="absolute flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-[#B8501A] text-xs font-bold text-white shadow-lg ring-2 ring-white"
                      style={{ left: `${m.x * 100}%`, top: `${m.y * 100}%` }}
                    >
                      {offset + i + 1}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
          </div>

          {/* マーカーコメント一覧 */}
          {allMarkers.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm font-semibold text-[#2F2823]">指摘・改善提案</p>
              {allMarkers.map((m, i) => (
                <div key={m.id} className="flex gap-3 rounded-lg border border-[#E8D8C7] bg-white/70 p-4">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#B8501A] text-xs font-bold text-white">
                    {i + 1}
                  </span>
                  <p className="text-sm leading-6 text-[#2F2823]">{m.comment}</p>
                </div>
              ))}
            </div>
          )}

          {suggestion.reasoning && (
            <div className="rounded-lg border border-[#E8D8C7] bg-white/70 p-4">
              <p className="mb-1 text-xs font-semibold text-[#6E5A4B]">全体の方針</p>
              <p className="text-sm leading-6 text-[#2F2823]">{suggestion.reasoning}</p>
            </div>
          )}

          {/* AIのしまい先提案（対象物 → 移動先）。以前は reasoning しか出しておらず、一番具体的な情報が見えなかった */}
          {options.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm font-semibold text-[#2F2823]">しまい先の提案</p>
              <ol className="space-y-3">
                {options.map((o, i) => (
                  <li key={i} className="flex gap-3 rounded-lg border border-[#E8D8C7] bg-white/70 p-4">
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#B8501A] text-xs font-bold text-white">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-[#2F2823]">{o.target}</p>
                      <p className="mt-1 flex items-start gap-1.5 text-sm">
                        <span aria-hidden="true" className="text-[#B8501A]">→</span>
                        <span className="rounded-full bg-[#3DAF85]/15 px-2.5 py-0.5 text-xs font-semibold leading-5 text-[#2D7C62]">
                          {o.location}
                        </span>
                      </p>
                      {o.reason && <p className="mt-2 text-sm leading-6 text-[#6E5A4B]">{o.reason}</p>}
                    </div>
                  </li>
                ))}
              </ol>
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
              className="w-full rounded-lg bg-[#B8501A] py-3 font-semibold text-white shadow-sm transition-colors hover:bg-[#9E4414]"
            >
              保存する
            </button>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main aria-live="polite" className="flex min-h-dvh flex-col bg-[#FBF5EE] text-[#2F2823]">
      <div className="bg-[#B8501A] py-1.5 text-center text-xs font-medium text-white">
        収納の改善案を準備中
      </div>
      <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <div className="mb-7 grid w-24 grid-cols-3 overflow-hidden rounded-lg border border-[#E8D8C7] bg-white">
          <div className="h-20 animate-pulse bg-[#D96B2D]" />
          <div className="h-20 animate-pulse bg-[#F5C842] [animation-delay:200ms]" />
          <div className="h-20 animate-pulse bg-[#3DAF85] [animation-delay:400ms]" />
        </div>
        <h1 className="mb-2 text-2xl font-bold tracking-tight">収納の改善案を<br className="sm:hidden" />準備しています...</h1>
        <p className="text-sm text-[#6E5A4B]">届くまで少し時間がかかります。このまま待っていてください。</p>
        {errorMessage && <p role="alert" className="mt-4 text-sm text-red-700">{errorMessage}</p>}
        <button onClick={() => router.push("/")} className="mt-8 py-3 text-sm text-[#6E5A4B]">
          トップに戻る
        </button>
      </div>
    </main>
  )
}
