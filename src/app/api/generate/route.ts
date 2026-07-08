import { NextRequest, NextResponse } from "next/server"
import OpenAI from "openai"
import { createClient } from "@/lib/supabase/server"

export async function POST(req: NextRequest) {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  const { suggestion_id, reasoning } = await req.json()

  const supabase = await createClient()

  const image = await openai.images.generate({
    model: "dall-e-3",
    prompt: `収納が整理整頓された部屋のイメージ図。手書き風のイラスト。改善ポイント：${reasoning}`,
    n: 1,
    size: "1024x1024",
  })

  const imageUrl = image.data?.[0]?.url
  if (!imageUrl) return NextResponse.json({ error: "no image" }, { status: 500 })

  // Supabase Storageに保存
  const res = await fetch(imageUrl)
  const blob = await res.blob()
  const arrayBuffer = await blob.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)
  const path = `generated-${suggestion_id}.png`

  await supabase.storage.from("specify-images").upload(path, buffer, {
    contentType: "image/png",
    upsert: true,
  })

  const { data } = supabase.storage.from("specify-images").getPublicUrl(path)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any)
    .from("suggestions")
    .update({ result_image_url: data.publicUrl, status: "done" })
    .eq("id", suggestion_id)

  return NextResponse.json({ ok: true })
}
