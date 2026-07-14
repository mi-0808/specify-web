"use client"

import { useState } from "react"
import type { Database } from "@/types/database"

type SuggestionRow = Database["public"]["Tables"]["suggestions"]["Row"]

type Marker = {
  id: string
  image_type: "room" | "storage"
  x: number
  y: number
  comment: string
}

export default function AdminPanel({
  initialSuggestions,
}: {
  initialSuggestions: SuggestionRow[]
}) {
  const [suggestions, setSuggestions] = useState(initialSuggestions)
  const [markers, setMarkers] = useState<Record<string, Marker[]>>({})
  const [sending, setSending] = useState<string | null>(null)
  const [suggesting, setSuggesting] = useState<string | null>(null)
  const [error, setError] = useState("")

  function handleImageClick(
    suggestionId: string,
    imageType: "room" | "storage",
    e: React.MouseEvent<HTMLDivElement>
  ) {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width
    const y = (e.clientY - rect.top) / rect.height
    const id = crypto.randomUUID()
    setMarkers((prev) => ({
      ...prev,
      [suggestionId]: [...(prev[suggestionId] ?? []), { id, image_type: imageType, x, y, comment: "" }],
    }))
  }

  function updateMarker(suggestionId: string, markerId: string, comment: string) {
    setMarkers((prev) => ({
      ...prev,
      [suggestionId]: (prev[suggestionId] ?? []).map((m) =>
        m.id === markerId ? { ...m, comment } : m
      ),
    }))
  }

  function removeMarker(suggestionId: string, markerId: string) {
    setMarkers((prev) => ({
      ...prev,
      [suggestionId]: (prev[suggestionId] ?? []).filter((m) => m.id !== markerId),
    }))
  }

  async function handleSuggest(suggestion: SuggestionRow) {
    setSuggesting(suggestion.id)
    setError("")
    try {
      const res = await fetch("/api/ai/suggest-c", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          room_image_url: suggestion.room_image_url,
          storage_image_url: suggestion.storage_image_url,
        }),
      })
      const data = await res.json()
      if (data.markers?.length) {
        setMarkers((prev) => ({
          ...prev,
          [suggestion.id]: data.markers.map((m: { image_type: "room" | "storage"; x: number; y: number; comment: string }) => ({
            id: crypto.randomUUID(),
            image_type: m.image_type ?? "room",
            x: m.x,
            y: m.y,
            comment: m.comment,
          })),
        }))
      } else {
        setError("AI提案を生成できませんでした")
      }
    } catch {
      setError("AI提案の取得に失敗しました")
    } finally {
      setSuggesting(null)
    }
  }

  async function handleSend(suggestionId: string) {
    const ms = markers[suggestionId] ?? []
    const incomplete = ms.some((m) => !m.comment.trim())
    if (incomplete) {
      setError("すべてのマーカーにコメントを入力してください")
      return
    }

    setSending(suggestionId)
    setError("")

    try {
      const res = await fetch("/api/admin/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ suggestion_id: suggestionId, markers: ms }),
      })
      if (!res.ok) throw new Error()
      setSuggestions((prev) => prev.filter((s) => s.id !== suggestionId))
    } catch {
      setError("送信に失敗しました")
    } finally {
      setSending(null)
    }
  }

  if (suggestions.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-[#E1CDB9] bg-white/55 px-5 py-14 text-center text-sm text-[#8B7360]">
        未対応の提案はありません
      </p>
    )
  }

  return (
    <div className="space-y-6">
      {error && <p className="text-sm text-red-600">{error}</p>}
      {suggestions.map((suggestion) => {
        const ms = markers[suggestion.id] ?? []
        const roomMarkers = ms.filter((m) => m.image_type === "room")
        const storageMarkers = ms.filter((m) => m.image_type === "storage")

        return (
          <div key={suggestion.id} className="rounded-lg border border-[#E8D8C7] bg-white/70 p-4 shadow-sm space-y-4">
            <p className="text-xs text-[#9B806C]">
              {new Date(suggestion.created_at).toLocaleString("ja-JP")}
            </p>

            {/* 写真2枚 + マーカー */}
            <div className="grid gap-4 sm:grid-cols-2">
              {(["room", "storage"] as const).map((imageType) => {
                const url = imageType === "room" ? suggestion.room_image_url : suggestion.storage_image_url
                if (!url) return null
                const imgMarkers = imageType === "room" ? roomMarkers : storageMarkers
                const label = imageType === "room" ? "部屋全体" : "収納スペース"
                const offset = imageType === "room" ? 0 : roomMarkers.length

                return (
                  <div key={imageType}>
                    <p className="mb-1 text-xs font-semibold text-[#9B806C]">{label}</p>
                    <div
                      className="relative cursor-crosshair rounded-lg overflow-hidden border border-[#E8D8C7] select-none"
                      onClick={(e) => handleImageClick(suggestion.id, imageType, e)}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt={label} className="w-full object-cover aspect-[4/3]" draggable={false} />
                      {imgMarkers.map((m, i) => (
                        <div
                          key={m.id}
                          className="pointer-events-none absolute flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-[#D96B2D] text-xs font-bold text-white shadow ring-2 ring-white"
                          style={{ left: `${m.x * 100}%`, top: `${m.y * 100}%` }}
                        >
                          {offset + i + 1}
                        </div>
                      ))}
                    </div>
                    <p className="mt-1 text-xs text-[#9B806C]">写真をクリックしてマーカーを追加</p>
                  </div>
                )
              })}
            </div>

            {/* マーカーコメント入力 */}
            {ms.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-[#9B806C]">マーカー一覧</p>
                {ms.map((m, i) => (
                  <div key={m.id} className="flex items-start gap-2 rounded-lg border border-[#E8D8C7] bg-white p-3">
                    <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#D96B2D] text-xs font-bold text-white">
                      {i + 1}
                    </span>
                    <span className="mt-1 text-xs text-[#9B806C] shrink-0">
                      {m.image_type === "room" ? "部屋" : "収納"}
                    </span>
                    <textarea
                      value={m.comment}
                      onChange={(e) => updateMarker(suggestion.id, m.id, e.target.value)}
                      placeholder="コメントを入力..."
                      rows={2}
                      className="flex-1 rounded border border-[#E8D8C7] px-2 py-1 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#D96B2D]"
                    />
                    <button
                      onClick={() => removeMarker(suggestion.id, m.id)}
                      className="mt-1 text-xs text-[#9B806C] hover:text-red-500"
                    >
                      削除
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between">
              <button
                onClick={() => handleSuggest(suggestion)}
                disabled={suggesting === suggestion.id}
                className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50 transition-colors"
              >
                {suggesting === suggestion.id ? "AI生成中..." : "✨ AIに提案させる"}
              </button>
              <button
                onClick={() => handleSend(suggestion.id)}
                disabled={sending === suggestion.id}
                className="rounded-lg bg-[#D96B2D] px-5 py-2 text-sm font-semibold text-white hover:bg-[#C85A20] disabled:opacity-50 transition-colors"
              >
                {sending === suggestion.id ? "送信中..." : "レポートを送信 ✓"}
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
