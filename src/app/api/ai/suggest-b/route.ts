import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { isAdminEmail } from "@/lib/supabase/admin"
import { parseMarkerArray } from "@/lib/ai-markers"
import { callGemini, GeminiError } from "@/lib/gemini"

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!isAdminEmail(user?.email)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 })
  }

  const { image_url, area_name } = await req.json()
  if (!image_url) return NextResponse.json({ error: "image_url required" }, { status: 400 })

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: "GEMINI_API_KEY not set" }, { status: 500 })
  }

  const prompt = `あなたは工場・現場の安全と動線を診断する専門家です。
この現場写真（エリア名：${area_name ?? "不明"}）を見て、問題点や改善点を3〜5件指摘してください。

以下のJSON形式のみで返してください。xとyは写真上の位置を0〜1の比率（左上が0,0・右下が1,1）で表します。
categoryは "safety"（安全）、"flow"（動線）、"suggestion"（改善提案）のいずれかです。

[
  { "x": 0.3, "y": 0.5, "category": "safety", "comment": "..." },
  { "x": 0.6, "y": 0.3, "category": "flow", "comment": "..." }
]

JSONの配列のみ返してください。説明文・マークダウン記法は不要です。`

  let text: string
  try {
    text = await callGemini({ prompt, imageUrls: [image_url] })
  } catch (error) {
    if (!(error instanceof GeminiError)) throw error
    console.error("Gemini error:", error)
    return NextResponse.json({ error: "gemini error" }, { status: 500 })
  }

  const markers = parseMarkerArray(text)
  if (markers.length === 0 && text.trim()) {
    console.error("parse error:", text)
  }
  return NextResponse.json({ markers })
}
