"use client"

import { ChangeEvent, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

type Step = "input" | "capture" | "sent"
type SendState = "sending" | "ok" | "error"

export default function BScanPage() {
  const [step, setStep] = useState<Step>("input")
  const [areaName, setAreaName] = useState("")
  const [photo, setPhoto] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [sendState, setSendState] = useState<SendState>("sending")
  const [error, setError] = useState("")
  const fileInputRef = useRef<HTMLInputElement>(null)
  // 「続けて撮影する」で複数回送信したとき、古い送信の遅延応答が
  // 現在の画面状態を上書きしないように送信ごとの識別子を持つ
  const sendIdRef = useRef(0)
  const router = useRouter()

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

  // 送信完了画面を先に出し、アップロードはバックグラウンドで進める（仕様書 5-3）
  function handleSubmit() {
    if (!photo || !file) return
    setError("")
    setSendState("sending")
    setStep("sent")
    void sendScan(photo, areaName)
  }

  async function sendScan(imageBase64: string, areaNameToSend: string) {
    const sendId = ++sendIdRef.current
    const isLatest = () => sendIdRef.current === sendId

    // ブラウザクライアントはユーザー操作時に生成する（ビルド時のprerenderで環境変数を要求しないため）
    const supabase = createClient()

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push("/login")
        return
      }

      const res = await fetch("/api/b/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ area_name: areaNameToSend, image: imageBase64 }),
      })

      if (!res.ok) throw new Error(`送信に失敗しました (${res.status})`)

      if (isLatest()) setSendState("ok")
    } catch (err) {
      console.error(err)
      if (isLatest()) {
        setSendState("error")
        setError("送信に失敗しました。時間をおいてもう一度お試しください。")
      }
    }
  }

  if (step === "sent") {
    const failed = sendState === "error"

    return (
      <main aria-live="polite" className="flex flex-col items-center justify-center min-h-[calc(100vh-49px)] px-4 text-center">
        <div className="max-w-sm w-full space-y-6">
          <div
            className={`flex h-16 w-16 mx-auto items-center justify-center rounded-full text-3xl ${
              failed ? "bg-red-100" : "bg-green-100"
            }`}
          >
            {failed ? "⚠️" : "✅"}
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-slate-900">
              {failed ? "送信できませんでした" : "送信しました"}
            </h1>
            {failed ? (
              <p role="alert" className="text-sm text-red-700 leading-6">{error}</p>
            ) : (
              <p className="text-sm text-slate-500 leading-6">
                レポートが完成次第、登録メールアドレスにお知らせします。
                <br />この画面は閉じていただいて構いません。
              </p>
            )}
            {sendState === "sending" && (
              <p className="text-xs text-slate-600">写真をアップロード中...</p>
            )}
          </div>
          <div className="space-y-3">
            {failed ? (
              <>
                <button
                  onClick={() => photo && (setSendState("sending"), setError(""), void sendScan(photo, areaName))}
                  className="w-full rounded-lg bg-blue-600 py-3 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
                >
                  もう一度送信する
                </button>
                <button
                  onClick={() => setStep("capture")}
                  className="w-full py-2 text-sm text-slate-600"
                >
                  撮影画面に戻る
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => router.push("/b/workspace")}
                  className="w-full rounded-lg bg-blue-600 py-3 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
                >
                  エリア一覧に戻る
                </button>
                <button
                  onClick={() => { setStep("input"); setAreaName(""); setPhoto(null); setFile(null) }}
                  className="w-full py-2 text-sm text-slate-600"
                >
                  続けて撮影する
                </button>
              </>
            )}
          </div>
        </div>
      </main>
    )
  }

  if (step === "capture") {
    return (
      <main aria-live="polite" className="min-h-[calc(100vh-49px)] px-4 py-6">
        <div className="mx-auto max-w-lg space-y-5">
          <button
            onClick={() => setStep("input")}
            className="text-sm text-slate-600 hover:text-slate-600"
          >
            ← 戻る
          </button>

          <div className="space-y-1">
            <p className="text-xs font-semibold text-blue-600">Step 2 / 2</p>
            <h1 className="text-2xl font-bold text-slate-900">「{areaName}」を撮影</h1>
            <p className="text-sm text-slate-500">エリア全体が写るよう、少し離れて撮影してください。</p>
            <p className="text-sm text-slate-500">明るい場所で撮影すると分析精度が上がります。</p>
          </div>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={!!photo}
            aria-label={photo ? undefined : "写真を撮影または選択"}
            className={`relative block aspect-[4/3] w-full rounded-xl overflow-hidden border-2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
              photo
                ? "border-slate-200"
                : "border-dashed border-slate-300 bg-slate-100 cursor-pointer hover:border-blue-400 hover:bg-blue-50"
            }`}
          >
            {photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photo} alt="撮影した写真" className="w-full h-full object-cover" />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-slate-600">
                <span className="text-4xl">📷</span>
                <span className="text-sm font-medium">タップして撮影 / 選択</span>
              </div>
            )}
          </button>

          <input
            aria-label="エリアの写真"
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
              className="text-sm text-slate-600 underline"
            >
              撮り直す
            </button>
          )}

          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}

          <button
            onClick={handleSubmit}
            disabled={!photo}
            className="w-full rounded-xl bg-blue-600 py-4 text-base font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-600"
          >
            この写真で送信する
          </button>
        </div>
      </main>
    )
  }

  return (
    <main aria-live="polite" className="min-h-[calc(100vh-49px)] px-4 py-6">
      <div className="mx-auto max-w-lg space-y-5">
        <div className="space-y-1">
          <p className="text-xs font-semibold text-blue-600">Step 1 / 2</p>
          <h1 className="text-2xl font-bold text-slate-900">エリア名を入力</h1>
          <p className="text-sm text-slate-500">
            撮影するエリアの名前を入力してください。（例：第1工具棚、組立作業台）
          </p>
        </div>

        <input
          aria-label="エリア名"
          type="text"
          value={areaName}
          onChange={(e) => setAreaName(e.target.value)}
          placeholder="例：第1工具棚"
          className="w-full rounded-lg border border-slate-300 px-4 py-3 text-base focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          onKeyDown={(e) => e.key === "Enter" && areaName.trim() && setStep("capture")}
        />

        <button
          onClick={() => setStep("capture")}
          disabled={!areaName.trim()}
          className="w-full rounded-xl bg-blue-600 py-4 text-base font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-600"
        >
          次へ：写真を撮る
        </button>
      </div>
    </main>
  )
}
