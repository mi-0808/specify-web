import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { ADMIN_EMAILS } from "@/lib/supabase/admin"

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email || !ADMIN_EMAILS.includes(user.email)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 })
  }

  const { room_image_url, storage_image_url } = await req.json()
  if (!room_image_url && !storage_image_url) {
    return NextResponse.json({ error: "image_url required" }, { status: 400 })
  }

  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) return NextResponse.json({ error: "OPENROUTER_API_KEY not set" }, { status: 500 })

  const prompt = `あなたは収納・片付けの専門家です。
添付の写真（部屋全体 and/or 収納スペース）を見て、改善できる点を3〜5件指摘してください。

以下のJSON形式のみで返してください。
image_typeは "room"（部屋全体）または "storage"（収納スペース）です。
xとyは各写真上の位置を0〜1の比率で表します（左上が0,0・右下が1,1）。

[
  { "image_type": "room", "x": 0.3, "y": 0.5, "comment": "床に物が散乱しており..." },
  { "image_type": "storage", "x": 0.6, "y": 0.4, "comment": "収納の上段が..." }
]

JSONの配列のみ返してください。説明文・マークダウン記法は不要です。`

  const content: object[] = [{ type: "text", text: prompt }]
  if (room_image_url) {
    content.push({ type: "image_url", image_url: { url: room_image_url } })
  }
  if (storage_image_url) {
    content.push({ type: "image_url", image_url: { url: storage_image_url } })
  }

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.0-flash-exp:free",
      messages: [{ role: "user", content }],
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
