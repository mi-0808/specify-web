"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { inspectVideoById, saveRoom } from "@/lib/collector/collect"
import { youtubeIdFromUrl } from "@/lib/collector/parse"
import { insertGenre, NEW_GENRE } from "@/lib/genres"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

export type AddState = { error: string | null }

const UUID = /^[0-9a-f-]{36}$/i

const MESSAGES = {
  "not-found": "動画が見つかりませんでした。公開されている動画のリンクか確かめてください。",
  "not-embeddable": "この動画は、ほかのサイトでの再生が許可されていないため使えません。",
} as const

// Server Action は画面を通さず直接呼べるので、ログインと入力をここで必ず確認する
// ponytail: 回数制限なし（ログインした人だけ）。いたずらが増えたらユーザーごとの上限を足す
export async function addRoom(_prev: AddState, formData: FormData): Promise<AddState> {
  const supabase = await createClient()
  // 入れるジャンル：既存のジャンルの ID か、「新しいジャンルを作る」
  const genre = String(formData.get("genre") ?? "")
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/login?next=${encodeURIComponent(UUID.test(genre) ? `/add?genre=${genre}` : "/add")}`)

  const videoId = youtubeIdFromUrl(String(formData.get("url") ?? ""))
  if (!videoId) return { error: "YouTube の動画のリンクを貼ってください。" }

  const newName = String(formData.get("newGenreName") ?? "")
  let genreId: string | null = null
  if (genre !== NEW_GENRE) {
    if (!UUID.test(genre)) return { error: "入れるジャンルを選んでください。" }
    const { data } = await supabase.from("genres").select("id").eq("id", genre).maybeSingle()
    if (!data) return { error: "そのジャンルは見つかりませんでした。選び直してください。" }
    genreId = data.id
  }

  // マイページの「自分が探索した部屋」に残す。すでにある部屋でも記録する
  const remember = () =>
    supabase.from("explored_rooms").upsert({ user_id: user.id, room_id: videoId, explored_at: new Date().toISOString() })
  const db = createAdminClient()
  const createGenre = async (): Promise<string | AddState> => {
    const created = await insertGenre(supabase, user.id, newName)
    return "error" in created ? { error: created.error } : created.id
  }

  const { data: existing } = await supabase.from("rooms").select("id, genre_id").eq("id", videoId).maybeSingle()
  if (existing) {
    // 1つの部屋は1つのジャンルだけ。ジャンルが消されて「ジャンルなし」になった部屋だけ、選んだジャンルに入れる
    if (!existing.genre_id) {
      const id = genreId ?? (await createGenre())
      if (typeof id !== "string") return id
      const { error } = await db.from("rooms").update({ genre_id: id }).eq("id", videoId).is("genre_id", null)
      if (error) return { error: "ジャンルに入れられませんでした。時間をおいてもう一度お試しください。" }
      revalidatePath("/")
    }
    await remember()
    redirect(`/rooms/${videoId}`)
  }

  const apiKey = process.env.YOUTUBE_API_KEY
  if (!apiKey) return { error: "今は探索できません。時間をおいてもう一度お試しください。" }

  const result = await inspectVideoById(apiKey, videoId)
  if (!result.ok) return { error: MESSAGES[result.reason] }
  // 新しいジャンルは、部屋を入れられると分かってから作る（使えない動画で空のジャンルが残らないように）
  const id = genreId ?? (await createGenre())
  if (typeof id !== "string") return id
  await saveRoom(db, result.video, result.items, id)
  await remember()
  revalidatePath("/")
  redirect(`/rooms/${videoId}`)
}
