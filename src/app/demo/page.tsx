"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import dynamic from "next/dynamic"
import type { SpaceDimensions } from "@/lib/webxr/measure"

const ARMeasureScene = dynamic(
  () => import("@/components/ar/ARMeasureScene"),
  { ssr: false }
)

type Step = "intro" | "ar" | "result"

export default function DemoPage() {
  const [step, setStep] = useState<Step>("intro")
  const [dimensions, setDimensions] = useState<SpaceDimensions | null>(null)
  const router = useRouter()

  function handleMeasured(dims: SpaceDimensions) {
    setDimensions(dims)
    setStep("result")
  }

  if (step === "ar") {
    return (
      <div className="relative w-full h-screen">
        {/* デモバナー */}
        <div className="absolute top-0 inset-x-0 z-50 bg-amber-500 text-white text-xs text-center py-1.5 font-medium">
          デモ版 — 計測データは保存されません
        </div>
        <ARMeasureScene onMeasured={handleMeasured} />
        <button
          onClick={() => setStep("intro")}
          className="absolute top-8 left-4 z-50 px-3 py-1.5 bg-black/50 text-white text-sm rounded-full"
        >
          ✕ 戻る
        </button>
      </div>
    )
  }

  if (step === "result" && dimensions) {
    return (
      <main className="min-h-screen bg-gray-50 flex flex-col">
        {/* デモバナー */}
        <div className="bg-amber-500 text-white text-xs text-center py-1.5 font-medium">
          デモ版 — 計測データは保存されません
        </div>

        <div className="flex-1 flex flex-col items-center justify-center px-6 space-y-6">
          <div className="text-center">
            <p className="text-4xl mb-2">📦</p>
            <h1 className="text-xl font-bold text-gray-900">計測完了！</h1>
          </div>

          <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm p-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-blue-50 rounded-xl p-4 text-center">
                <p className="text-xs text-gray-500 mb-1">幅</p>
                <p className="text-3xl font-bold text-blue-600">{dimensions.width_cm}</p>
                <p className="text-xs text-gray-500">cm</p>
              </div>
              <div className="bg-blue-50 rounded-xl p-4 text-center">
                <p className="text-xs text-gray-500 mb-1">奥行き</p>
                <p className="text-3xl font-bold text-blue-600">{dimensions.depth_cm}</p>
                <p className="text-xs text-gray-500">cm</p>
              </div>
            </div>
          </div>

          <div className="w-full max-w-sm space-y-3">
            <button
              onClick={() => { setDimensions(null); setStep("ar") }}
              className="w-full py-3 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
            >
              もう一度計測する
            </button>
            <button
              onClick={() => router.push("/login")}
              className="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors"
            >
              登録して保存する
            </button>
          </div>

          <p className="text-xs text-gray-400 text-center max-w-xs">
            アカウント登録でデータの保存・AIによる収納提案・トランクルーム検索が使えます
          </p>
        </div>
      </main>
    )
  }

  // intro
  return (
    <main className="min-h-screen bg-gray-50 flex flex-col">
      {/* デモバナー */}
      <div className="bg-amber-500 text-white text-xs text-center py-1.5 font-medium">
        デモ版 — 計測データは保存されません
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6 space-y-8">
        <div className="text-center space-y-2">
          <p className="text-5xl">📐</p>
          <h1 className="text-2xl font-bold text-gray-900">ARで棚を計測</h1>
          <p className="text-gray-500 text-sm leading-relaxed">
            スマートフォンのカメラで収納スペースの<br />
            幅・奥行きを自動計測します
          </p>
        </div>

        <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm p-5 space-y-3">
          {[
            { step: "1", text: "カメラを棚や押入れに向ける" },
            { step: "2", text: "平面が検出されたら4隅をタップ" },
            { step: "3", text: "幅・奥行きが自動で表示される" },
          ].map(({ step, text }) => (
            <div key={step} className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-full bg-blue-600 text-white text-sm font-bold flex items-center justify-center shrink-0">
                {step}
              </div>
              <p className="text-sm text-gray-700">{text}</p>
            </div>
          ))}
        </div>

        <div className="w-full max-w-sm space-y-3">
          <button
            onClick={() => setStep("ar")}
            className="w-full py-4 bg-blue-600 text-white rounded-xl font-semibold text-base hover:bg-blue-700 transition-colors shadow-md"
          >
            ARカメラを起動する
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
