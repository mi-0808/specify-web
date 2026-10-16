"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"

export type GenreState = { error: string | null }

const UUID = /^[0-9a-f-]{36}$/i
const ROOM = /^[\w-]{11}$/

// Server Action は画面を通さず直接呼べるので、ログインと入力をここで必ず確認する
async function signedIn(next: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/login?signup=1&next=${encodeURIComponent(next)}`)
  return { supabase, userId: user.id }
}

export async function createGenre(_prev: GenreState, formData: FormData): Promise<GenreState> {
  const name = String(formData.get("name") ?? "").trim()
  const keyword = String(formData.get("keyword") ?? "").trim() || name
  if (name.length < 1 || name.length > 12) return { error: "ジャンル名は1〜12文字で入れてください。" }
  if (keyword.length > 20) return { error: "集める言葉は20文字までです。" }
  if (/https?:|www\./i.test(name + keyword)) return { error: "ジャンル名にリンクは入れられません。" }

  const { supabase, userId } = await signedIn("/")
  const { data, error } = await supabase
    .from("genres")
    .insert({ name, keyword, created_by: userId })
    .select("id")
    .single()
  if (error?.code === "23505") return { error: `「${name}」はすでにあります。` }
  if (error) return { error: "作れませんでした。時間をおいてもう一度お試しください。" }

  revalidatePath("/")
  redirect(`/?genre=${data.id}`)
}

export async function addToGenre(formData: FormData) {
  const roomId = String(formData.get("roomId") ?? "")
  const genreId = String(formData.get("genreId") ?? "")
  if (!ROOM.test(roomId) || !UUID.test(genreId)) return
  const { supabase, userId } = await signedIn(`/rooms/${roomId}`)

  // ジャンルを作った本人なら、前に外した部屋をもう一度入れられる（外した記録を消してから足す）
  await supabase.from("room_genres").delete().match({ room_id: roomId, genre_id: genreId, excluded: true })
  const { error } = await supabase.from("room_genres").insert({ room_id: roomId, genre_id: genreId, added_by: userId })
  if (error && error.code !== "23505") throw new Error("ジャンルに入れられませんでした。")
  revalidatePath(`/rooms/${roomId}`)
  revalidatePath("/")
}

// 自分が足した部屋を外す。ジャンルを作った本人は、言葉で自動で入った部屋も外せる
export async function removeFromGenre(formData: FormData) {
  const roomId = String(formData.get("roomId") ?? "")
  const genreId = String(formData.get("genreId") ?? "")
  if (!ROOM.test(roomId) || !UUID.test(genreId)) return
  const { supabase, userId } = await signedIn(`/rooms/${roomId}`)

  const { data: genre } = await supabase.from("genres").select("created_by").eq("id", genreId).maybeSingle()
  if (!genre) return
  await supabase.from("room_genres").delete().match({ room_id: roomId, genre_id: genreId })
  if (genre.created_by === userId) {
    const { error } = await supabase
      .from("room_genres")
      .insert({ room_id: roomId, genre_id: genreId, added_by: userId, excluded: true })
    if (error) throw new Error("ジャンルから外せませんでした。")
  }
  revalidatePath(`/rooms/${roomId}`)
  revalidatePath("/")
}
