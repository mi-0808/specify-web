import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { isAdminEmail } from "@/lib/supabase/admin"

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!isAdminEmail(user?.email)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 })
  }

  const { image_url, area_name } = await req.json()
  if (!image_url) return NextResponse.json({ error: "image_url required" }, { status: 400 })

  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) return NextResponse.json({ error: "OPENROUTER_API_KEY not set" }, { status: 500 })

  const prompt = `あなたは工場・現場の安全と動線を診断する専門家です。
この現場写真（エリア名：${area_name ?? "不明"}）を見て、問題点や改善点を3〜5件指摘してください。

以下のJSON形式のみで返してください。xとyは写真上の位置を0〜1の比率（左上が0,0・右下が1,1）で表します。
categoryは "safety"（安全）、"flow"（動線）、"suggestion"（改善提案）のいずれかです。

[
  { "x": 0.3, "y": 0.5, "category": "safety", "comment": "..." },
  { "x": 0.6, "y": 0.3, "category": "flow", "comment": "..." }
]

JSONの配列のみ返してください。説明文・マークダウン記法は不要です。`

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.0-flash-exp:free",
      messages: [{
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: image_url } },
        ],
      }],
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    console.error("OpenRouter error:", err)
    return NextResponse.json({ error: "openrouter error" }, { status: 500 })
  }

  const json = await res.json()
  const text: string = json.choices?.[0]?.message?.content ?? ""

  try {
    const match = text.match(/\[[\s\S]*\]/)
    const markers = JSON.parse(match ? match[0] : text)
    return NextResponse.json({ markers })
  } catch {
    console.error("parse error:", text)
    return NextResponse.json({ markers: [] })
  }
}
