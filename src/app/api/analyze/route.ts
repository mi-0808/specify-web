import { NextRequest, NextResponse } from "next/server"
import OpenAI from "openai"
import { createClient } from "@/lib/supabase/server"

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function POST(req: NextRequest) {
  const { suggestion_id, room_image_url, storage_image_url } = await req.json()

  const supabase = await createClient()

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `以下の2枚の画像（部屋全体・収納スペース）を分析して、収納の改善提案をしてください。
JSON形式で返してください：
{
  "reasoning": "全体的な改善方針の説明（200字程度）",
  "suggestions": [
    { "target": "対象物", "location": "移動先", "reason": "理由" }
  ]
}
JSONのみ返してください。`,
          },
          { type: "image_url", image_url: { url: room_image_url } },
          { type: "image_url", image_url: { url: storage_image_url } },
        ],
      },
    ],
    max_tokens: 1000,
  })

  const raw = completion.choices[0].message.content ?? ""
  const cleaned = raw.replace(/```json|```/g, "").trim()
  const parsed = JSON.parse(cleaned)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any
  await db
    .from("suggestions")
    .update({
      reasoning: parsed.reasoning,
      storage_options: parsed.suggestions,
      raw_json: parsed,
      status: "analyzing",
    })
    .eq("id", suggestion_id)

  // generate を非同期キック
  fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ suggestion_id, room_image_url, reasoning: parsed.reasoning }),
  })

  return NextResponse.json({ ok: true })
}
