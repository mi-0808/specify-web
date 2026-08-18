"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import dynamic from "next/dynamic"
import { createClient } from "@/lib/supabase/client"
import type { SpaceDimensions } from "@/lib/webxr/measure"
import type { Database } from "@/types/database"

type SpaceInsert = Database["public"]["Tables"]["spaces"]["Insert"]

// ARコンポーネントはSSR無効（WebXR / DOM API を使うため）
const ARMeasureScene = dynamic(
  () => import("@/components/ar/ARMeasureScene"),
  { ssr: false }
)

type Step = "form" | "ar" | "confirm" | "saving"

export default function NewSpacePage() {
  const [step, setStep] = useState<Step>("form")
  const [spaceName, setSpaceName] = useState("")
  const [heightInput, setHeightInput] = useState("")
  const [dimensions, setDimensions] = useState<SpaceDimensions | null>(null)
  const [saving, setSaving] = useState(false)
  const router = useRouter()

  function handleMeasured(dims: SpaceDimensions) {
    setDimensions(dims)
    setStep("confirm")
  }

  async function handleSave() {
    if (!dimensions || !spaceName) return
    setSaving(true)

    // ブラウザクライアントはユーザー操作時に生成する（ビルド時のprerenderで環境変数を要求しないため）
    const supabase = createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push("/login"); return }

    const height = parseFloat(heightInput) || 0
    const { data, error } = await supabase
      .from("spaces")
      .insert({
        user_id: user.id,
        name: spaceName,
        width_cm: dimensions.width_cm,
        depth_cm: dimensions.depth_cm,
        height_cm: height,
      } satisfies SpaceInsert)
      .select()
      .single()

    if (error) {
      console.error(error)
      setSaving(false)
      return
    }

    router.push(`/spaces/${data!.id}`)
  }

  // ステップ1: スペース名入力
  if (step === "form") {
    return (
      <main className="min-h-screen bg-gray-50 flex flex-col">
        <header className="bg-white border-b px-4 py-3">
          <button onClick={() => router.back()} className="text-blue-600 text-sm">
            ← 戻る
          </button>
          <h1 className="text-center font-semibold text-gray-900 -mt-5">新しいスペース</h1>
        </header>

        <div className="flex-1 flex flex-col justify-center px-6 space-y-6">
          <div>
            <label htmlFor="spaceName" className="block text-sm font-medium text-gray-700 mb-1">
              スペース名
            </label>
            <input
              id="spaceName"
              type="text"
              value={spaceName}
              onChange={(e) => setSpaceName(e.target.value)}
              placeholder="例: リビングの押入れ"
              className="w-full px-3 py-3 border border-gray-300 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 text-base"
            />
          </div>

          <button
            onClick={() => setStep("ar")}
            disabled={!spaceName.trim()}
            className="w-full py-4 bg-blue-600 text-white rounded-xl font-semibold text-base disabled:opacity-40 hover:bg-blue-700 transition-colors"
          >
            ARで計測する
          </button>

          <p className="text-xs text-center text-gray-600">
            スマートフォンのカメラを使い、棚の4隅をタップして寸法を計測します
          </p>
        </div>
      </main>
    )
  }

  // ステップ2: AR計測
  if (step === "ar") {
    return (
      <div className="w-full h-screen">
        <ARMeasureScene onMeasured={handleMeasured} />
        <button
          onClick={() => setStep("form")}
          className="absolute top-4 left-4 z-50 px-3 py-1.5 bg-black/50 text-white text-sm rounded-full"
        >
          ✕ キャンセル
        </button>
      </div>
    )
  }

  // ステップ3: 確認・高さ入力・保存
  return (
    <main className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b px-4 py-3">
        <button onClick={() => setStep("ar")} className="text-blue-600 text-sm">
          ← 再計測
        </button>
        <h1 className="text-center font-semibold text-gray-900 -mt-5">計測結果の確認</h1>
      </header>

      <div className="flex-1 px-6 py-6 space-y-6">
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <h2 className="text-base font-semibold text-gray-900 mb-4">{spaceName}</h2>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "幅", value: dimensions?.width_cm, unit: "cm" },
              { label: "奥行き", value: dimensions?.depth_cm, unit: "cm" },
            ].map(({ label, value, unit }) => (
              <div key={label} className="bg-blue-50 rounded-xl p-3 text-center col-span-1">
                <p className="text-xs text-gray-500">{label}</p>
                <p className="text-2xl font-bold text-blue-600">{value ?? "—"}</p>
                <p className="text-xs text-gray-500">{unit}</p>
              </div>
            ))}
            <div className="bg-blue-50 rounded-xl p-3 text-center col-span-1">
              <label htmlFor="height" className="block text-xs text-gray-500">高さ</label>
              <input
                id="height"
                type="number"
                value={heightInput}
                onChange={(e) => setHeightInput(e.target.value)}
                placeholder="0"
                className="w-full text-2xl font-bold text-blue-600 bg-transparent text-center focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              />
              <p className="text-xs text-gray-500">cm</p>
            </div>
          </div>
          <p className="text-xs text-gray-600 mt-3 text-center">
            ※ 高さは手動で入力してください
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-4 bg-blue-600 text-white rounded-xl font-semibold text-base disabled:opacity-50"
        >
          {saving ? "保存中..." : "保存する"}
        </button>
      </div>
    </main>
  )
}
