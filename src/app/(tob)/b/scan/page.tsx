"use client"

import { ChangeEvent, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

type Step = "input" | "capture" | "sent"

export default function BScanPage() {
  const [step, setStep] = useState<Step>("input")
  const [areaName, setAreaName] = useState("")
  const [photo, setPhoto] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const supabase = createClient()

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === "string") setPhoto(reader.result)
    }
    reader.readAsDataURL(f)
    e.target.value = ""
  }

  async function handleSubmit() {
    if (!photo || !file) return
    setSubmitting(true)
    setError("")

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push("/login")
        return
      }

      const reader = new FileReader()
      const imageBase64 = await new Promise<string>((resolve) => {
        reader.onload = () => resolve(reader.result as string)
        reader.readAsDataURL(file)
      })

      const res = await fetch("/api/b/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ area_name: areaName, image: imageBase64 }),
      })

      if (!res.ok) throw new Error("送信に失敗しました")

      setStep("sent")
    } catch {
      setError("送信に失敗しました。時間をおいてもう一度お試しください。")
    } finally {
      setSubmitting(false)
    }
  }

  if (step === "sent") {
    return (
      <main className="flex flex-col items-center justify-center min-h-[calc(100vh-49px)] px-4 text-center">
        <div className="max-w-sm w-full space-y-6">
          <div className="flex h-16 w-16 mx-auto items-center justify-center rounded-full bg-green-100 text-3xl">
            ✅
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-slate-900">送信しました</h1>
            <p className="text-sm text-slate-500 leading-6">
              レポートが完成次第、登録メールアドレスにお知らせします。
              <br />この画面は閉じていただいて構いません。
            </p>
          </div>
          <div className="space-y-3">
            <button
              onClick={() => router.push("/b/workspace")}
              className="w-full rounded-lg bg-blue-600 py-3 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
            >
              エリア一覧に戻る
            </button>
            <button
              onClick={() => { setStep("input"); setAreaName(""); setPhoto(null); setFile(null) }}
              className="w-full py-2 text-sm text-slate-400"
            >
              続けて撮影する
            </button>
          </div>
        </div>
      </main>
    )
  }

  if (step === "capture") {
    return (
      <main className="min-h-[calc(100vh-49px)] px-4 py-6">
        <div className="mx-auto max-w-lg space-y-5">
          <button
            onClick={() => setStep("input")}
            className="text-sm text-slate-400 hover:text-slate-600"
          >
            ← 戻る
          </button>

          <div className="space-y-1">
            <p className="text-xs font-semibold text-blue-600">Step 2 / 2</p>
            <h1 className="text-2xl font-bold text-slate-900">「{areaName}」を撮影</h1>
            <p className="text-sm text-slate-500">エリア全体が写るよう、少し離れて撮影してください。</p>
          </div>

          <div
            onClick={() => !photo && fileInputRef.current?.click()}
            className={`relative aspect-[4/3] w-full rounded-xl overflow-hidden border-2 transition-colors ${
              photo
                ? "border-slate-200"
                : "border-dashed border-slate-300 bg-slate-100 cursor-pointer hover:border-blue-400 hover:bg-blue-50"
            }`}
          >
            {photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photo} alt="撮影した写真" className="w-full h-full object-cover" />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-slate-400">
                <span className="text-4xl">📷</span>
                <span className="text-sm font-medium">タップして撮影 / 選択</span>
              </div>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleFileChange}
          />

          {photo && (
            <button
              onClick={() => { setPhoto(null); setFile(null) }}
              className="text-sm text-slate-400 underline"
            >
              撮り直す
            </button>
          )}

          {error && <p className="text-sm text-red-500">{error}</p>}

          <button
            onClick={handleSubmit}
            disabled={!photo || submitting}
            className="w-full rounded-xl bg-blue-600 py-4 text-base font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400"
          >
            {submitting ? "送信中..." : "この写真で送信する"}
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-[calc(100vh-49px)] px-4 py-6">
      <div className="mx-auto max-w-lg space-y-5">
        <div className="space-y-1">
          <p className="text-xs font-semibold text-blue-600">Step 1 / 2</p>
          <h1 className="text-2xl font-bold text-slate-900">エリア名を入力</h1>
          <p className="text-sm text-slate-500">
            撮影するエリアの名前を入力してください。（例：第1工具棚、組立作業台）
          </p>
        </div>

        <input
          type="text"
          value={areaName}
          onChange={(e) => setAreaName(e.target.value)}
          placeholder="例：第1工具棚"
          className="w-full rounded-lg border border-slate-300 px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
          onKeyDown={(e) => e.key === "Enter" && areaName.trim() && setStep("capture")}
        />

        <button
          onClick={() => setStep("capture")}
          disabled={!areaName.trim()}
          className="w-full rounded-xl bg-blue-600 py-4 text-base font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400"
        >
          次へ：写真を撮る
        </button>
      </div>
    </main>
  )
}
