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

  const { room_image_url, storage_image_url } = await req.json()
  if (!room_image_url && !storage_image_url) {
    return NextResponse.json({ error: "image_url required" }, { status: 400 })
  }

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: "GEMINI_API_KEY not set" }, { status: 500 })
  }

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

  // 片方だけの撮影でも解析できるように、渡された画像だけを送る
  const imageUrls = [room_image_url, storage_image_url].filter(Boolean) as string[]

  let text: string
  try {
    text = await callGemini({ prompt, imageUrls })
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
