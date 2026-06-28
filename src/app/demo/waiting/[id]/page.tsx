"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import type { Database } from "@/types/database"

type SuggestionRow = Database["public"]["Tables"]["suggestions"]["Row"]

export default function DemoWaitingPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const supabase = createClient()
  const [suggestion, setSuggestion] = useState<SuggestionRow | null>(null)
  const [errorMessage, setErrorMessage] = useState("")

  useEffect(() => {
    let cancelled = false

    async function poll() {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = supabase as any
      const { data, error } = await db
        .from("suggestions")
        .select("*")
        .eq("id", params.id)
        .single()

      if (cancelled) return

      if (error || !data) {
        setErrorMessage("提案の取得に失敗しました。")
        return
      }

      setSuggestion(data as SuggestionRow)
    }

    poll()
    const intervalId = window.setInterval(poll, 5000)

    return () => {
      cancelled = true
      window.clearInterval(intervalId)
    }
  }, [params.id, supabase])

  if (suggestion?.status === "done" && suggestion.result_image_url) {
    return (
      <main className="min-h-screen bg-[#FBF5EE] text-[#2F2823]">
        <div className="bg-[#D96B2D] py-1.5 text-center text-xs font-medium text-white">
          収納の改善案が届きました
        </div>

        <div className="mx-auto max-w-2xl space-y-5 px-4 py-6">
          <div className="space-y-2">
            <p className="inline-flex rounded-full bg-[#3DAF85]/15 px-3 py-1 text-xs font-semibold text-[#2D7C62]">
              改善案ができました
            </p>
            <h1 className="text-3xl font-bold tracking-tight">こちらが提案です</h1>
          </div>

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={suggestion.result_image_url}
            alt="収納の改善案"
            className="w-full rounded-lg border border-[#E8D8C7] bg-white object-cover"
          />

          <div className="space-y-3">
            <button
              onClick={() => router.push("/demo")}
              className="w-full rounded-lg border border-[#E1CDB9] bg-white/60 py-3 font-medium text-[#6E5A4B] transition-colors hover:bg-white"
            >
              もう一度撮る
            </button>
            <button
              onClick={() => router.push("/dashboard")}
              className="w-full rounded-lg bg-[#D96B2D] py-3 font-semibold text-white shadow-sm transition-colors hover:bg-[#C85A20]"
            >
              保存する
            </button>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="flex min-h-screen flex-col bg-[#FBF5EE] text-[#2F2823]">
      <div className="bg-[#D96B2D] py-1.5 text-center text-xs font-medium text-white">
        収納の改善案を準備中
      </div>
      <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <div className="mb-7 grid w-24 grid-cols-3 overflow-hidden rounded-lg border border-[#E8D8C7] bg-white">
          <div className="h-20 animate-pulse bg-[#D96B2D]" />
          <div className="h-20 animate-pulse bg-[#F5C842] [animation-delay:200ms]" />
          <div className="h-20 animate-pulse bg-[#3DAF85] [animation-delay:400ms]" />
        </div>
        <h1 className="mb-2 text-2xl font-bold tracking-tight">収納の改善案を準備しています...</h1>
        <p className="text-sm text-[#6E5A4B]">届くまで少し時間がかかります。このまま待っていてください。</p>
        {errorMessage && <p className="mt-4 text-sm text-red-600">{errorMessage}</p>}
      </div>
    </main>
  )
}
