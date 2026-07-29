import { NextRequest, NextResponse, after } from "next/server"
import OpenAI from "openai"
import type { ChatCompletionContentPart } from "openai/resources/chat/completions"
import { createClient } from "@/lib/supabase/server"
import { generateResultImage } from "@/lib/result-image"

type AnalyzeResult = {
  reasoning: string
  suggestions: { target: string; location: string; reason: string }[]
}

export async function POST(req: NextRequest) {
  const { suggestion_id, room_image_url, storage_image_url } = await req.json()

  if (!suggestion_id) {
    return NextResponse.json({ error: "suggestion_id required" }, { status: 400 })
  }
  if (!room_image_url && !storage_image_url) {
    return NextResponse.json({ error: "at least one image is required" }, { status: 400 })
  }

  const supabase = await createClient()

  // 片方だけの撮影でも解析できるように、渡された画像だけをメッセージに含める
  const imageParts: ChatCompletionContentPart[] = []
  if (room_image_url) {
    imageParts.push({ type: "image_url", image_url: { url: room_image_url } })
  }
  if (storage_image_url) {
    imageParts.push({ type: "image_url", image_url: { url: storage_image_url } })
  }

  const photoDescription =
    room_image_url && storage_image_url
      ? "以下の2枚の画像（部屋全体・収納スペース）"
      : room_image_url
        ? "以下の画像（部屋全体）"
        : "以下の画像（収納スペース）"

  let parsed: AnalyzeResult
  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `${photoDescription}を分析して、収納の改善提案をしてください。
JSON形式で返してください：
{
  "reasoning": "全体的な改善方針の説明（200字程度）",
  "suggestions": [
    { "target": "対象物", "location": "移動先", "reason": "理由" }
  ]
}
JSONのみ返してください。`,
            },
            ...imageParts,
          ],
        },
      ],
      max_tokens: 1000,
    })

    parsed = parseAnalyzeResult(completion.choices[0]?.message.content ?? "")
  } catch (error) {
    console.error(`[analyze] 解析に失敗: suggestion=${suggestion_id}`, error)
    await supabase.from("suggestions").update({ status: "failed" }).eq("id", suggestion_id)
    return NextResponse.json({ error: "analyze failed" }, { status: 502 })
  }

  const { error: updateError } = await supabase
    .from("suggestions")
    .update({
      reasoning: parsed.reasoning,
      storage_options: parsed.suggestions,
      raw_json: parsed,
      status: "analyzing",
    })
    .eq("id", suggestion_id)

  if (updateError) {
    console.error(`[analyze] 提案の保存に失敗: suggestion=${suggestion_id}`, updateError)
    return NextResponse.json({ error: "update failed" }, { status: 500 })
  }

  // 完成イメージ画像の生成はレスポンス後に実行する（DALL·Eの応答を担当者に待たせない）
  const reasoning = parsed.reasoning
  after(() => generateResultImage({ suggestionId: suggestion_id, reasoning }))

  return NextResponse.json({ ok: true })
}

function parseAnalyzeResult(raw: string): AnalyzeResult {
  const cleaned = raw.replace(/```json|```/g, "").trim()
  const parsed: unknown = JSON.parse(cleaned)

  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("AIレスポンスがオブジェクトではありません")
  }

  const { reasoning, suggestions } = parsed as Partial<AnalyzeResult>
  if (typeof reasoning !== "string" || !Array.isArray(suggestions)) {
    throw new Error("AIレスポンスに reasoning / suggestions が含まれていません")
  }

  return { reasoning, suggestions }
}
