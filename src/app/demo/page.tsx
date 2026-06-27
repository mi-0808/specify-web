"use client"

import { ChangeEvent, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import type { Database } from "@/types/database"

type Step = "shoot" | "loading" | "result"
type Suggestion = { target: string; location: string; reason: string }

const loadingMessages = [
  "写真を確認しています...",
  "収納のポイントを探しています...",
  "改善案をまとめています...",
  "もうすぐ完成です！",
]

export default function DemoPage() {
  const [step, setStep] = useState<Step>("shoot")
  const [roomPhoto, setRoomPhoto] = useState<string | null>(null)
  const [storagePhoto, setStoragePhoto] = useState<string | null>(null)
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [loadingIndex, setLoadingIndex] = useState(0)
  const [errorMessage, setErrorMessage] = useState("")
  const [saving, setSaving] = useState(false)
  const roomInputRef = useRef<HTMLInputElement>(null)
  const storageInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const supabase = createClient()

  const canAnalyze = roomPhoto !== null || storagePhoto !== null
  const hasBothPhotos = roomPhoto !== null && storagePhoto !== null

  useEffect(() => {
    if (step !== "loading") return

    const intervalId = window.setInterval(() => {
      setLoadingIndex((current) => (current + 1) % loadingMessages.length)
    }, 2000)

    return () => window.clearInterval(intervalId)
  }, [step])

  function handlePhotoChange(
    event: ChangeEvent<HTMLInputElement>,
    setPhoto: (value: string | null) => void
  ) {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setPhoto(reader.result)
        setErrorMessage("")
      }
    }
    reader.readAsDataURL(file)
    event.target.value = ""
  }

  async function handleAnalyze() {
    if (!canAnalyze) return

    setLoadingIndex(0)
    setStep("loading")
    setErrorMessage("")

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomPhoto, storagePhoto }),
      })

      if (!response.ok) throw new Error("Failed to analyze photos")

      const data = await response.json() as { suggestions?: Suggestion[] }
      setSuggestions(data.suggestions ?? [])
      setStep("result")
    } catch (error) {
      console.error(error)
      setErrorMessage("提案の取得に失敗しました。時間をおいてもう一度お試しください。")
      setStep("shoot")
    }
  }

  function resetDemo() {
    setRoomPhoto(null)
    setStoragePhoto(null)
    setSuggestions([])
    setErrorMessage("")
    setSaving(false)
    setStep("shoot")
  }

  async function handleSave() {
    if (suggestions.length === 0 || saving) return

    setSaving(true)
    setErrorMessage("")

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push("/login")
      return
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any
    const { data: space, error: spaceError } = await db
      .from("spaces")
      .insert({
        user_id: user.id,
        name: "デモ撮影",
      } satisfies Database["public"]["Tables"]["spaces"]["Insert"])
      .select("id")
      .single()

    if (spaceError || !space) {
      console.error(spaceError)
      setErrorMessage("保存に失敗しました。時間をおいてもう一度お試しください。")
      setSaving(false)
      return
    }

    const imageTag = hasBothPhotos ? "room_and_storage" : roomPhoto ? "room" : "storage"
    const { error: suggestionError } = await db
      .from("suggestions")
      .insert({
        space_id: space.id,
        score: null,
        reasoning: "写真から作成した収納改善案",
        storage_options: suggestions,
        image_tag: imageTag,
        raw_json: { suggestions },
      } satisfies Database["public"]["Tables"]["suggestions"]["Insert"])

    if (suggestionError) {
      console.error(suggestionError)
      setErrorMessage("保存に失敗しました。時間をおいてもう一度お試しください。")
      setSaving(false)
      return
    }

    router.push("/dashboard")
  }

  if (step === "loading") {
    return (
      <main className="min-h-screen bg-gray-50 flex flex-col">
        <div className="bg-amber-500 text-white text-xs text-center py-1.5 font-medium">
          デモ版
        </div>
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
          <div className="w-16 h-16 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin mb-6" />
          <h1 className="text-xl font-bold text-gray-900 mb-2">提案を作成中</h1>
          <p className="text-gray-500">{loadingMessages[loadingIndex]}</p>
        </div>
      </main>
    )
  }

  if (step === "result") {
    return (
      <main className="min-h-screen bg-gray-50">
        <div className="bg-amber-500 text-white text-xs text-center py-1.5 font-medium">
          デモ版
        </div>

        <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
          <div className="text-center space-y-2">
            <p className="text-4xl">📦</p>
            <h1 className="text-2xl font-bold text-gray-900">収納改善案</h1>
            <p className="text-sm text-gray-500">撮影した写真をもとに、すぐ試せる提案をまとめました</p>
          </div>

          <ul className="space-y-3">
            {suggestions.map((suggestion) => (
              <li key={`${suggestion.target}-${suggestion.location}`} className="bg-white rounded-xl p-4 shadow-sm">
                <p className="text-xs font-semibold text-blue-600 mb-1">何を</p>
                <h2 className="text-lg font-bold text-gray-900 mb-3">{suggestion.target}</h2>
                <div className="space-y-3 text-sm">
                  <div>
                    <p className="text-xs font-semibold text-gray-400">どこに</p>
                    <p className="text-gray-800">{suggestion.location}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-400">なぜ</p>
                    <p className="text-gray-700 leading-relaxed">{suggestion.reason}</p>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          {errorMessage && (
            <p className="text-sm text-red-600 text-center">{errorMessage}</p>
          )}

          <div className="space-y-3">
            <button
              onClick={resetDemo}
              className="w-full py-3 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-100 transition-colors"
            >
              もう一度撮る
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {saving ? "保存中..." : "保存する"}
            </button>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="bg-amber-500 text-white text-xs text-center py-1.5 font-medium">
        デモ版
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        <div className="text-center space-y-2">
          <p className="text-4xl">📷</p>
          <h1 className="text-2xl font-bold text-gray-900">写真で収納を見直す</h1>
          <p className="text-sm text-gray-500 leading-relaxed">
            部屋全体か収納スペースのどちらか1枚で提案できます。両方撮ると提案の質が上がります。
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <PhotoCapture
            title="部屋全体を撮る"
            description="家具の配置や床まわりが分かる写真"
            photo={roomPhoto}
            onCapture={() => roomInputRef.current?.click()}
            onRetake={() => roomInputRef.current?.click()}
            onClear={() => setRoomPhoto(null)}
          />
          <PhotoCapture
            title="収納スペースを撮る"
            description="押入れやクローゼットの中が分かる写真"
            photo={storagePhoto}
            onCapture={() => storageInputRef.current?.click()}
            onRetake={() => storageInputRef.current?.click()}
            onClear={() => setStoragePhoto(null)}
          />
        </div>

        <input
          ref={roomInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(event) => handlePhotoChange(event, setRoomPhoto)}
        />
        <input
          ref={storageInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(event) => handlePhotoChange(event, setStoragePhoto)}
        />

        <div className="bg-white rounded-xl p-4 shadow-sm text-sm">
          {hasBothPhotos ? (
            <p className="text-blue-700 font-medium">より精度の高い提案が受け取れます</p>
          ) : storagePhoto ? (
            <p className="text-gray-600">収納スペースだけで提案します</p>
          ) : roomPhoto ? (
            <p className="text-gray-600">部屋全体の写真で提案します</p>
          ) : (
            <p className="text-gray-500">どちらか1枚を撮影すると提案に進めます</p>
          )}
        </div>

        {errorMessage && (
          <p className="text-sm text-red-600 text-center">{errorMessage}</p>
        )}

        <div className="space-y-3">
          <button
            onClick={handleAnalyze}
            disabled={!canAnalyze}
            className="w-full py-4 bg-blue-600 text-white rounded-xl font-semibold text-base hover:bg-blue-700 transition-colors shadow-md disabled:opacity-40 disabled:hover:bg-blue-600"
          >
            提案を見る
          </button>
          <button
            onClick={() => router.push("/")}
            className="w-full py-2 text-gray-500 text-sm"
          >
            トップに戻る
          </button>
        </div>
      </div>
    </main>
  )
}

function PhotoCapture({
  title,
  description,
  photo,
  onCapture,
  onRetake,
  onClear,
}: {
  title: string
  description: string
  photo: string | null
  onCapture: () => void
  onRetake: () => void
  onClear: () => void
}) {
  return (
    <section className="bg-white rounded-xl p-4 shadow-sm space-y-3">
      <div>
        <h2 className="font-semibold text-gray-900">{title}</h2>
        <p className="text-xs text-gray-500 mt-1">{description}</p>
      </div>

      {photo ? (
        <div className="space-y-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photo}
            alt={`${title}のプレビュー`}
            className="w-full aspect-[4/3] object-cover rounded-lg bg-gray-100"
          />
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={onRetake}
              className="py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-100 transition-colors"
            >
              撮り直し
            </button>
            <button
              onClick={onClear}
              className="py-2 text-gray-500 rounded-lg text-sm font-medium hover:bg-gray-100 transition-colors"
            >
              削除
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={onCapture}
          className="w-full aspect-[4/3] rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 text-gray-600 text-sm font-medium hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
        >
          撮影する
        </button>
      )}
    </section>
  )
}
