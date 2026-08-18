"use client"

import { ChangeEvent, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import type { Database } from "@/types/database"

type Step = "shoot" | "submitting" | "sent"

export default function DemoPage() {
  const [step, setStep] = useState<Step>("shoot")
  const [roomPhoto, setRoomPhoto] = useState<string | null>(null)
  const [storagePhoto, setStoragePhoto] = useState<string | null>(null)
  const [roomFile, setRoomFile] = useState<File | null>(null)
  const [storageFile, setStorageFile] = useState<File | null>(null)
  const [suggestionId, setSuggestionId] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState("")
  const roomInputRef = useRef<HTMLInputElement>(null)
  const storageInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  // どちらか1枚あれば送信できる（2枚あると提案の精度が上がる）
  const hasBothPhotos = roomPhoto !== null && storagePhoto !== null
  const hasAnyPhoto = roomPhoto !== null || storagePhoto !== null

  function handlePhotoChange(
    event: ChangeEvent<HTMLInputElement>,
    setPhoto: (value: string | null) => void,
    setFile: (value: File | null) => void
  ) {
    const file = event.target.files?.[0]
    if (!file) return

    // 読み込みが成功してプレビューが出せたときだけ送信対象として確定させる
    // （先にsetFileすると、読めなかった写真がプレビューなしで送信されてしまう）
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setPhoto(reader.result)
        setFile(file)
        setErrorMessage("")
      } else {
        setPhoto(null)
        setFile(null)
        setErrorMessage("写真を読み込めませんでした。別の写真をお試しください。")
      }
    }
    reader.onerror = () => {
      setPhoto(null)
      setFile(null)
      setErrorMessage("写真を読み込めませんでした。別の写真をお試しください。")
    }
    reader.readAsDataURL(file)
    event.target.value = ""
  }

  async function uploadPhoto(
    supabase: ReturnType<typeof createClient>,
    file: File,
    prefix: string
  ) {
    const extension = file.name.split(".").pop() || "jpg"
    const path = `${prefix}-${Date.now()}.${extension}`
    const { error } = await supabase.storage
      .from("specify-images")
      .upload(path, file)

    if (error) throw error

    const { data } = supabase.storage.from("specify-images").getPublicUrl(path)
    return data.publicUrl
  }

  async function handleAnalyze() {
    if (!hasAnyPhoto) return

    setStep("submitting")
    setErrorMessage("")

    // ブラウザクライアントはユーザー操作時に生成する（ビルド時のprerenderで環境変数を要求しないため）
    const supabase = createClient()

    try {
      let { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        const { data: anonData, error: anonError } = await supabase.auth.signInAnonymously()
        if (anonError || !anonData.user) throw anonError ?? new Error("anonymous sign-in failed")
        user = anonData.user
      }

      // スキップされた側は null のまま送る
      const [roomImageUrl, storageImageUrl] = await Promise.all([
        roomFile ? uploadPhoto(supabase, roomFile, "room") : Promise.resolve(null),
        storageFile ? uploadPhoto(supabase, storageFile, "storage") : Promise.resolve(null),
      ])

      const { data: space, error: spaceError } = await supabase
        .from("spaces")
        .insert({
          user_id: user.id,
          name: "デモ撮影",
        } satisfies Database["public"]["Tables"]["spaces"]["Insert"])
        .select("id")
        .single()

      if (spaceError || !space) throw spaceError ?? new Error("space insert failed")

      const { data: suggestion, error: suggestionError } = await supabase
        .from("suggestions")
        .insert({
          space_id: space.id,
          room_image_url: roomImageUrl,
          storage_image_url: storageImageUrl,
          status: "pending",
        } satisfies Database["public"]["Tables"]["suggestions"]["Insert"])
        .select("id")
        .single()

      if (suggestionError || !suggestion) throw suggestionError ?? new Error("suggestion insert failed")

      setSuggestionId(suggestion.id)

      // 非同期で解析をキック（レスポンスを待たない）
      fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          suggestion_id: suggestion.id,
          room_image_url: roomImageUrl,
          storage_image_url: storageImageUrl,
        }),
      }).catch(() => {})

      setStep("sent")
    } catch (error) {
      console.error(error)
      setErrorMessage("送信に失敗しました。時間をおいてもう一度お試しください。")
      setStep("shoot")
    }
  }

  if (step === "submitting") {
    return (
      <main aria-live="polite" className="flex min-h-screen flex-col bg-[#FBF5EE] text-[#2F2823]">
        <div className="bg-[#B8501A] py-1.5 text-center text-xs font-medium text-white">
          写真を送信中
        </div>
        <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
          <div className="mb-7 grid w-24 grid-cols-3 overflow-hidden rounded-lg border border-[#E8D8C7] bg-white">
            <div className="h-20 animate-pulse bg-[#D96B2D]" />
            <div className="h-20 animate-pulse bg-[#F5C842] [animation-delay:200ms]" />
            <div className="h-20 animate-pulse bg-[#3DAF85] [animation-delay:400ms]" />
          </div>
          <h1 className="mb-2 text-2xl font-bold tracking-tight">写真を送っています</h1>
          <p className="text-sm text-[#6E5A4B]">少々お待ちください...</p>
        </div>
      </main>
    )
  }

  if (step === "sent") {
    return (
      <main aria-live="polite" className="flex min-h-screen flex-col bg-[#FBF5EE] text-[#2F2823]">
        <div className="bg-[#B8501A] py-1.5 text-center text-xs font-medium text-white">
          写真を送信しました
        </div>
        <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
          <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-[#3DAF85]/15 text-3xl">
            ✅
          </div>
          <h1 className="mb-2 text-2xl font-bold tracking-tight">送りました！</h1>
          <p className="mb-8 text-sm leading-6 text-[#6E5A4B]">
            収納の改善案を準備しています。準備ができたら、いつでも下のボタンから確認できます。
          </p>
          <div className="w-full max-w-sm space-y-3">
            <button
              onClick={() => suggestionId && router.push(`/demo/waiting/${suggestionId}`)}
              className="w-full rounded-lg bg-[#B8501A] py-3 font-semibold text-white shadow-sm transition-colors hover:bg-[#9E4414]"
            >
              提案を確認する
            </button>
            <button
              onClick={() => router.push("/")}
              className="w-full py-2 text-sm text-[#6E5A4B]"
            >
              トップに戻る
            </button>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main aria-live="polite" className="min-h-screen bg-[#FBF5EE] text-[#2F2823]">
      <div className="bg-[#B8501A] py-1.5 text-center text-xs font-medium text-white">
        写真で収納を整える
      </div>

      <div className="mx-auto max-w-2xl space-y-6 px-4 py-6">
        <div className="space-y-3">
          <p className="inline-flex rounded-full bg-[#F5C842]/25 px-3 py-1 text-xs font-semibold text-[#8A5A10]">
            Step 1
          </p>
          <h1 className="text-3xl font-bold tracking-tight">部屋と収納の余白を写す</h1>
          <p className="text-sm leading-6 text-[#6E5A4B]">
            「部屋全体」「収納スペース」のどちらか1枚から送れます。2枚あると提案の精度が上がります。
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <PhotoCapture
            title="部屋全体を撮る"
            description="家具の配置や床まわりが分かる写真"
            photo={roomPhoto}
            onCapture={() => roomInputRef.current?.click()}
            onRetake={() => roomInputRef.current?.click()}
            onClear={() => {
              setRoomPhoto(null)
              setRoomFile(null)
            }}
          />
          <PhotoCapture
            title="収納スペースを撮る"
            description="押入れやクローゼットの中が分かる写真"
            photo={storagePhoto}
            onCapture={() => storageInputRef.current?.click()}
            onRetake={() => storageInputRef.current?.click()}
            onClear={() => {
              setStoragePhoto(null)
              setStorageFile(null)
            }}
          />
        </div>

        <input
          aria-label="部屋全体の写真"
          ref={roomInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => handlePhotoChange(event, setRoomPhoto, setRoomFile)}
        />
        <input
          aria-label="収納スペースの写真"
          ref={storageInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => handlePhotoChange(event, setStoragePhoto, setStorageFile)}
        />

        <div className="rounded-lg border border-[#E8D8C7] bg-white/70 p-4 text-sm shadow-sm">
          {hasBothPhotos ? (
            <p className="font-semibold text-[#2D7C62]">2枚とも撮影できました</p>
          ) : hasAnyPhoto ? (
            <p className="text-[#6E5A4B]">
              {roomPhoto
                ? "部屋全体の写真だけで提案します。収納スペースも撮ると精度が上がります"
                : "収納スペースの写真だけで提案します。部屋全体も撮ると精度が上がります"}
            </p>
          ) : (
            <p className="text-[#6E5A4B]">どちらか1枚を撮影すると提案に進めます</p>
          )}
        </div>

        {errorMessage && (
          <p role="alert" className="text-sm text-red-700 text-center">{errorMessage}</p>
        )}

        <div className="space-y-3">
          <button
            onClick={handleAnalyze}
            disabled={!hasAnyPhoto}
            className="w-full rounded-lg bg-[#B8501A] py-4 text-base font-semibold text-white shadow-sm transition-colors hover:bg-[#9E4414] disabled:bg-[#E1CDB9] disabled:text-[#6E5A4B]"
          >
            提案を見る
          </button>
          <button
            onClick={() => router.push("/")}
            className="w-full py-2 text-sm text-[#6E5A4B]"
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
        <p className="mt-1 text-xs text-[#6E5A4B]">{description}</p>
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
              className="rounded-lg py-2 text-sm font-medium text-[#6E5A4B] transition-colors hover:bg-[#FBF5EE]"
            >
              削除
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={onCapture}
          className="aspect-[4/3] w-full rounded-lg border-2 border-dashed border-[#E1CDB9] bg-[#FBF5EE] text-sm font-semibold text-[#6E5A4B] transition-colors hover:border-[#D96B2D] hover:bg-[#F9F3EC] hover:text-[#C85A20]"
        >
          撮影する
        </button>
      )}
    </section>
  )
}
