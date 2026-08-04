import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { callGemini } from "@/lib/gemini"
import { jsonCandidates } from "@/lib/ai-markers"

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

  // 片方だけの撮影でも解析できるように、渡された画像だけを送る
  const imageUrls = [room_image_url, storage_image_url].filter(Boolean) as string[]

  const photoDescription =
    room_image_url && storage_image_url
      ? "以下の2枚の画像（部屋全体・収納スペース）"
      : room_image_url
        ? "以下の画像（部屋全体）"
        : "以下の画像（収納スペース）"

  let parsed: AnalyzeResult
  try {
    const raw = await callGemini({
      prompt: `${photoDescription}を分析して、収納の改善提案をしてください。
JSON形式で返してください：
{
  "reasoning": "全体的な改善方針の説明（200字程度）",
  "suggestions": [
    { "target": "対象物", "location": "移動先", "reason": "理由" }
  ]
}
JSONのみ返してください。`,
      imageUrls,
      // Geminiのmax_tokensは思考トークンも含めて数える。テキストのみのプロンプトで実測した
      // ところ、本文394に対し思考が約730消費された（total 1211）。画像2枚だとさらに増えるため、
      // gpt-4o時代の1000から引き上げて余裕を持たせる。切れるとJSONが壊れてstatus=failedになる。
      maxTokens: 4000,
    })

    parsed = parseAnalyzeResult(raw)
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
      // 完成イメージ画像の生成を廃止したので、以前 generateResultImage() が担っていた
      // done への遷移をここで行う。analyzing のまま残すとUIが永久に生成中表示になる。
      status: "done",
    })
    .eq("id", suggestion_id)

  if (updateError) {
    console.error(`[analyze] 提案の保存に失敗: suggestion=${suggestion_id}`, updateError)
    return NextResponse.json({ error: "update failed" }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

/**
 * AIレスポンスから reasoning / suggestions を取り出す。
 *
 * プロンプトでJSONのみを求めていても、モデルは前置きや補足文を付けてくる。
 * 素の JSON.parse だと status=failed が確定保存され、ユーザーには「解析に失敗」が出たまま
 * リトライもされないため、マーカー提案（`parseMarkerArray()`）と同じく候補を順に試す。
 */
function parseAnalyzeResult(raw: string): AnalyzeResult {
  for (const candidate of jsonCandidates(raw)) {
    let parsed: unknown
    try {
      parsed = JSON.parse(candidate)
    } catch {
      continue
    }
    if (typeof parsed !== "object" || parsed === null) continue

    const { reasoning, suggestions } = parsed as Partial<AnalyzeResult>
    if (typeof reasoning !== "string" || !Array.isArray(suggestions)) continue

    return { reasoning, suggestions }
  }

  throw new Error("AIレスポンスから reasoning / suggestions を取り出せませんでした")
}
