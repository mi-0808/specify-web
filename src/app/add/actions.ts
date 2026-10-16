"use server"

import { redirect } from "next/navigation"
import { importVideo } from "@/lib/collector/collect"
import { youtubeIdFromUrl } from "@/lib/collector/parse"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

export type AddState = { error: string | null }

const MESSAGES = {
  "not-found": "動画が見つかりませんでした。公開されている動画のリンクか確かめてください。",
  "not-embeddable": "この動画は、ほかのサイトでの再生が許可されていないため使えません。",
  "not-interior": "家具やインテリアの動画ではないため、これは使えません。",
  "no-items": "動画の説明欄に、家具の購入先が3つ以上見つからなかったため、これは使えません。",
} as const

// Server Action は画面を通さず直接呼べるので、ログインをここで必ず確認する
// ponytail: 回数制限なし（ログインした人だけ）。いたずらが増えたらユーザーごとの上限を足す
export async function addRoom(_prev: AddState, formData: FormData): Promise<AddState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login?next=/add")

  const videoId = youtubeIdFromUrl(String(formData.get("url") ?? ""))
  if (!videoId) return { error: "YouTube の動画のリンクを貼ってください。" }

  // マイページの「自分が探索した部屋」に残す。すでにある部屋でも記録する
  const remember = () =>
    supabase.from("explored_rooms").upsert({ user_id: user.id, room_id: videoId, explored_at: new Date().toISOString() })

  const { data: existing } = await supabase.from("rooms").select("id").eq("id", videoId).maybeSingle()
  if (existing) {
    await remember()
    redirect(`/rooms/${videoId}`)
  }

  const apiKey = process.env.YOUTUBE_API_KEY
  if (!apiKey) return { error: "今は探索できません。時間をおいてもう一度お試しください。" }

  const result = await importVideo(apiKey, createAdminClient(), videoId)
  if (!result.ok) return { error: MESSAGES[result.reason] }
  await remember()
  redirect(`/rooms/${result.roomId}`)
}
