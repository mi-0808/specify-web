import OpenAI from "openai"
import { createAdminClient } from "@/lib/supabase/admin"

/**
 * AI提案の完成イメージ画像を生成してStorageに保存し、suggestions を done にする。
 *
 * 呼び出し元はAPI Routeの after() 内（レスポンス後）。
 * ユーザーセッションを持たない文脈で走るため service role key を使う。
 * 画像生成に失敗しても提案テキストは配信したいので、status は done にする。
 */
export async function generateResultImage({
  suggestionId,
  reasoning,
}: {
  suggestionId: string
  reasoning: string
}): Promise<void> {
  const db = createAdminClient()

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    const image = await openai.images.generate({
      model: "dall-e-3",
      prompt: `収納が整理整頓された部屋のイメージ図。手書き風のイラスト。改善ポイント：${reasoning}`,
      n: 1,
      size: "1024x1024",
    })

    const imageUrl = image.data?.[0]?.url
    if (!imageUrl) throw new Error("生成画像のURLが返りませんでした")

    const res = await fetch(imageUrl)
    if (!res.ok) throw new Error(`生成画像の取得に失敗 (${res.status})`)
    const buffer = Buffer.from(await res.arrayBuffer())

    const path = `generated-${suggestionId}.png`
    const { error: uploadError } = await db.storage
      .from("specify-images")
      .upload(path, buffer, { contentType: "image/png", upsert: true })
    if (uploadError) throw uploadError

    const { data } = db.storage.from("specify-images").getPublicUrl(path)

    const { error: updateError } = await db
      .from("suggestions")
      .update({ result_image_url: data.publicUrl, status: "done" })
      .eq("id", suggestionId)
    // 更新が通らないと status が analyzing のまま残り、UIが永久に生成中表示になる
    if (updateError) throw updateError
  } catch (error) {
    // 画像がなくても提案テキストは見せられるので done にして届ける
    console.error(`[result-image] 画像生成に失敗: suggestion=${suggestionId}`, error)
    try {
      const { error: fallbackError } = await db
        .from("suggestions")
        .update({ status: "done" })
        .eq("id", suggestionId)
      if (fallbackError) throw fallbackError
    } catch (fallbackError) {
      // ここで投げると after() 内で未処理のPromise拒否になるためログに留める
      console.error(
        `[result-image] statusをdoneにできませんでした: suggestion=${suggestionId}`,
        fallbackError
      )
    }
  }
}
