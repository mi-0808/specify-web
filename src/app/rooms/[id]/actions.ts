"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"

// Server Action は画面を通さず直接呼べるので、ログインと部屋の実在をここで必ず確認する
export async function toggleSave(formData: FormData) {
  const roomId = String(formData.get("roomId") ?? "")
  if (!/^[\w-]{11}$/.test(roomId)) return

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/login?signup=1&next=/rooms/${roomId}`)

  const key = { user_id: user.id, room_id: roomId }
  const { data: existing } = await supabase.from("saved_rooms").select("room_id").match(key).maybeSingle()
  // 部屋が存在しなければ外部キーで insert が失敗する
  const { error } = existing
    ? await supabase.from("saved_rooms").delete().match(key)
    : await supabase.from("saved_rooms").insert(key)
  if (error) throw new Error("保存できませんでした。時間をおいてもう一度お試しください。")

  revalidatePath(`/rooms/${roomId}`)
  revalidatePath("/saved")
}

// ジャンルを作った本人だけが消せる（RLS で守っている。消せなかったときは0件になる）。家具・保存は外部キーで一緒に消える
export async function deleteRoom(formData: FormData) {
  const roomId = String(formData.get("roomId") ?? "")
  if (!/^[\w-]{11}$/.test(roomId)) return

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/login?next=/rooms/${roomId}`)

  const { data, error } = await supabase.from("rooms").delete().eq("id", roomId).select("genre_id")
  if (error || !data.length) throw new Error("部屋を消せませんでした。")

  revalidatePath("/")
  revalidatePath("/saved")
  redirect(data[0].genre_id ? `/?genre=${data[0].genre_id}` : "/")
}
