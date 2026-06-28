"use client"

import { ChangeEvent, useState } from "react"
import type { Database } from "@/types/database"

type SuggestionRow = Database["public"]["Tables"]["suggestions"]["Row"]

export default function AdminPanel({
  initialSuggestions,
}: {
  initialSuggestions: SuggestionRow[]
}) {
  const [suggestions, setSuggestions] = useState(initialSuggestions)
  const [pendingFiles, setPendingFiles] = useState<Record<string, File>>({})
  const [uploadingId, setUploadingId] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState("")

  function handleFileChange(id: string, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    setPendingFiles((current) => ({ ...current, [id]: file }))
  }

  async function handleUpload(id: string) {
    const file = pendingFiles[id]
    if (!file) return

    setUploadingId(id)
    setErrorMessage("")

    const formData = new FormData()
    formData.append("suggestionId", id)
    formData.append("file", file)

    try {
      const response = await fetch("/api/admin/upload", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) throw new Error("upload failed")

      setSuggestions((current) => current.filter((suggestion) => suggestion.id !== id))
      setPendingFiles((current) => {
        const next = { ...current }
        delete next[id]
        return next
      })
    } catch (error) {
      console.error(error)
      setErrorMessage("アップロードに失敗しました。時間をおいてもう一度お試しください。")
    } finally {
      setUploadingId(null)
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
    <div className="space-y-4">
      {errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}

      <ul className="space-y-4">
        {suggestions.map((suggestion) => (
          <li
            key={suggestion.id}
            className="rounded-lg border border-[#E8D8C7] bg-white/70 p-4 shadow-sm"
          >
            <p className="mb-3 text-xs text-[#9B806C]">
              {new Date(suggestion.created_at).toLocaleString("ja-JP")}
            </p>

            <div className="mb-3 grid gap-3 sm:grid-cols-2">
              {suggestion.room_image_url && (
                <div>
                  <p className="mb-1 text-xs font-semibold text-[#9B806C]">部屋全体</p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={suggestion.room_image_url}
                    alt="部屋全体"
                    className="aspect-[4/3] w-full rounded-lg object-cover"
                  />
                </div>
              )}
              {suggestion.storage_image_url && (
                <div>
                  <p className="mb-1 text-xs font-semibold text-[#9B806C]">収納スペース</p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={suggestion.storage_image_url}
                    alt="収納スペース"
                    className="aspect-[4/3] w-full rounded-lg object-cover"
                  />
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <input
                type="file"
                accept="image/*"
                onChange={(event) => handleFileChange(suggestion.id, event)}
                className="text-sm"
              />
              <button
                onClick={() => handleUpload(suggestion.id)}
                disabled={!pendingFiles[suggestion.id] || uploadingId === suggestion.id}
                className="rounded-lg bg-[#D96B2D] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#C85A20] disabled:bg-[#E1CDB9] disabled:text-[#9B806C]"
              >
                {uploadingId === suggestion.id ? "アップロード中..." : "結果画像をアップロード"}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
