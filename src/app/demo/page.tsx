"use client"

import { ChangeEvent, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import type { Database } from "@/types/database"

type Step = "shoot" | "loading" | "result"
type Suggestion = { target: string; location: string; reason: string }

const loadingMessages = [
  "部屋の余白を見ています...",
  "季節物のしまい先を探しています...",
  "床まわりの動線を整えています...",
  "提案をまとめています...",
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
      <main className="flex min-h-screen flex-col bg-[#FBF5EE] text-[#2F2823]">
        <div className="bg-[#D96B2D] py-1.5 text-center text-xs font-medium text-white">
          写真からしまい先を準備中
        </div>
        <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
          <div className="mb-7 grid w-24 grid-cols-3 overflow-hidden rounded-lg border border-[#E8D8C7] bg-white">
            <div className="h-20 animate-pulse bg-[#D96B2D]" />
            <div className="h-20 animate-pulse bg-[#F5C842] [animation-delay:200ms]" />
            <div className="h-20 animate-pulse bg-[#3DAF85] [animation-delay:400ms]" />
          </div>
          <h1 className="mb-2 text-2xl font-bold tracking-tight">しまい先を編集中</h1>
          <p className="text-sm text-[#6E5A4B]">{loadingMessages[loadingIndex]}</p>
        </div>
      </main>
    )
  }

  if (step === "result") {
    return (
      <main className="min-h-screen bg-[#FBF5EE] text-[#2F2823]">
        <div className="bg-[#D96B2D] py-1.5 text-center text-xs font-medium text-white">
          すぐ試せる収納メモ
        </div>

        <div className="mx-auto max-w-2xl space-y-5 px-4 py-6">
          <div className="space-y-3">
            <p className="inline-flex rounded-full bg-[#3DAF85]/15 px-3 py-1 text-xs font-semibold text-[#2D7C62]">
              収納の余白が見つかりました
            </p>
            <div className="space-y-2">
              <h1 className="text-3xl font-bold tracking-tight">今日できる、3つのしまい方</h1>
              <p className="text-sm leading-6 text-[#6E5A4B]">
                大きく片づける前に、動線が軽くなる置き場所から始めます。
              </p>
            </div>
          </div>

          <ul className="space-y-3">
            {suggestions.map((suggestion, index) => (
              <li
                key={`${suggestion.target}-${suggestion.location}`}
                className="rounded-lg border border-[#E8D8C7] bg-white/75 p-4 shadow-sm"
              >
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div>
                    <p className="mb-1 text-xs font-semibold text-[#D96B2D]">しまうもの</p>
                    <h2 className="text-xl font-bold text-[#2F2823]">{suggestion.target}</h2>
                  </div>
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#F5C842]/30 text-sm font-bold text-[#8A5A10]">
                    {index + 1}
                  </span>
                </div>
                <div className="grid gap-3 text-sm sm:grid-cols-[0.9fr_1.1fr]">
                  <div className="rounded-lg bg-[#FBF5EE] p-3">
                    <p className="text-xs font-semibold text-[#9B806C]">しまい先</p>
                    <p className="mt-1 font-semibold text-[#3B312A]">{suggestion.location}</p>
                  </div>
                  <div className="rounded-lg bg-[#FBF5EE] p-3">
                    <p className="text-xs font-semibold text-[#9B806C]">整う理由</p>
                    <p className="mt-1 leading-6 text-[#5E4D40]">{suggestion.reason}</p>
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
              className="w-full rounded-lg border border-[#E1CDB9] bg-white/60 py-3 font-medium text-[#6E5A4B] transition-colors hover:bg-white"
            >
              もう一度撮る
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full rounded-lg bg-[#D96B2D] py-3 font-semibold text-white shadow-sm transition-colors hover:bg-[#C85A20] disabled:opacity-50"
            >
              {saving ? "保存中..." : "保存する"}
            </button>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#FBF5EE] text-[#2F2823]">
      <div className="bg-[#D96B2D] py-1.5 text-center text-xs font-medium text-white">
        写真で収納を整える
      </div>

      <div className="mx-auto max-w-2xl space-y-6 px-4 py-6">
        <div className="space-y-3">
          <p className="inline-flex rounded-full bg-[#F5C842]/25 px-3 py-1 text-xs font-semibold text-[#8A5A10]">
            Step 1
          </p>
          <h1 className="text-3xl font-bold tracking-tight">部屋と収納の余白を写す</h1>
          <p className="text-sm leading-6 text-[#6E5A4B]">
            どちらか1枚で始められます。両方あると、しまい先の文脈まで見えやすくなります。
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

        <div className="rounded-lg border border-[#E8D8C7] bg-white/70 p-4 text-sm shadow-sm">
          {hasBothPhotos ? (
            <p className="font-semibold text-[#2D7C62]">より精度の高い提案が受け取れます</p>
          ) : storagePhoto ? (
            <p className="text-[#6E5A4B]">収納スペースだけで提案します</p>
          ) : roomPhoto ? (
            <p className="text-[#6E5A4B]">部屋全体の写真で提案します</p>
          ) : (
            <p className="text-[#8B7360]">どちらか1枚を撮影すると提案に進めます</p>
          )}
        </div>

        {errorMessage && (
          <p className="text-sm text-red-600 text-center">{errorMessage}</p>
        )}

        <div className="space-y-3">
          <button
            onClick={handleAnalyze}
            disabled={!canAnalyze}
            className="w-full rounded-lg bg-[#D96B2D] py-4 text-base font-semibold text-white shadow-sm transition-colors hover:bg-[#C85A20] disabled:bg-[#E1CDB9] disabled:text-[#9B806C]"
          >
            提案を見る
          </button>
          <button
            onClick={() => router.push("/")}
            className="w-full py-2 text-sm text-[#8B7360]"
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
    <section className="space-y-3 rounded-lg border border-[#E8D8C7] bg-white/70 p-4 shadow-sm">
      <div>
        <h2 className="font-semibold text-[#2F2823]">{title}</h2>
        <p className="mt-1 text-xs text-[#8B7360]">{description}</p>
      </div>

      {photo ? (
        <div className="space-y-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photo}
            alt={`${title}のプレビュー`}
            className="aspect-[4/3] w-full rounded-lg bg-[#F9F3EC] object-cover"
          />
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={onRetake}
              className="rounded-lg border border-[#E1CDB9] py-2 text-sm font-medium text-[#6E5A4B] transition-colors hover:bg-[#FBF5EE]"
            >
              撮り直し
            </button>
            <button
              onClick={onClear}
              className="rounded-lg py-2 text-sm font-medium text-[#9B806C] transition-colors hover:bg-[#FBF5EE]"
            >
              削除
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={onCapture}
          className="aspect-[4/3] w-full rounded-lg border-2 border-dashed border-[#E1CDB9] bg-[#FBF5EE] text-sm font-semibold text-[#8B7360] transition-colors hover:border-[#D96B2D] hover:bg-[#F9F3EC] hover:text-[#C85A20]"
        >
          撮影する
        </button>
      )}
    </section>
  )
}
