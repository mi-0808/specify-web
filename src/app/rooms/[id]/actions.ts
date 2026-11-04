"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { isAdmin } from "@/lib/admin"
import { MAX_LABEL, resolveManualItem } from "@/lib/collector/collect"
import { createAdminClient } from "@/lib/supabase/admin"
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

export type AddItemState = { error: string | null }

const MANUAL_START = 10000 // 説明欄の家具（最大30件）の後ろに並べる
const MAX_MANUAL = 30 // 1部屋に人が足せる家具の上限

const ITEM_MESSAGES = {
  "not-shop": "このショップのリンクは、今はまだ追加できません。上に書いたショップの商品ページを貼ってください。",
  "not-found": "商品ページが見つかりませんでした。販売が終わっているか、商品のページではない可能性があります。",
} as const

// 部屋ページから商品のリンクを足す。ログインしている人ならだれでも足せる（2026-11-04 決定）
// ponytail: 回数制限は1部屋 MAX_MANUAL 件だけ。いたずらが増えたらユーザーごとの上限を足す
export async function addRoomItem(_prev: AddItemState, formData: FormData): Promise<AddItemState> {
  const roomId = String(formData.get("roomId") ?? "")
  if (!/^[\w-]{11}$/.test(roomId)) return { error: "部屋が見つかりませんでした。" }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/login?next=/rooms/${roomId}`)

  const url = String(formData.get("url") ?? "")
  const label = String(formData.get("label") ?? "")
  if (!url.trim() || url.length > 2000) return { error: "商品ページのリンクを貼ってください。" }
  if (label.length > MAX_LABEL) return { error: `ラベルは${MAX_LABEL}文字までにしてください。` }

  const { data: items, error: readError } = await supabase
    .from("room_items")
    .select("position, url, source")
    .eq("room_id", roomId)
  if (readError) return { error: "追加できませんでした。時間をおいてもう一度お試しください。" }
  const { data: room } = await supabase.from("rooms").select("id").eq("id", roomId).maybeSingle()
  if (!room) return { error: "部屋が見つかりませんでした。" }
  const manual = items.filter((i) => i.source === "manual")
  if (manual.length >= MAX_MANUAL) return { error: `1つの部屋に追加できるのは${MAX_MANUAL}点までです。` }

  const result = await resolveManualItem(url, label)
  if (!result.ok) return { error: ITEM_MESSAGES[result.reason] }
  if (items.some((i) => i.url === result.item.url)) return { error: "この商品は、もうこの部屋に入っています。" }

  const position = Math.max(MANUAL_START - 1, ...manual.map((i) => i.position)) + 1
  const { error } = await createAdminClient()
    .from("room_items")
    .insert({ ...result.item, room_id: roomId, position, source: "manual", added_by: user.id })
  // 同時に足されて position がぶつかったときも、ここに来る
  if (error) return { error: "追加できませんでした。時間をおいてもう一度お試しください。" }

  revalidatePath(`/rooms/${roomId}`)
  return { error: null }
}

// 人が足した家具は、足した本人と管理者が消せる（説明欄の家具は消せない。読み直しで戻るため）
export async function deleteRoomItem(formData: FormData) {
  const roomId = String(formData.get("roomId") ?? "")
  const position = Number(formData.get("position"))
  if (!/^[\w-]{11}$/.test(roomId) || !Number.isInteger(position)) return

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/login?next=/rooms/${roomId}`)

  const key = { room_id: roomId, position, source: "manual" }
  const { data: item } = await supabase.from("room_items").select("added_by").match(key).maybeSingle()
  if (!item || (item.added_by !== user.id && !isAdmin(user.email))) throw new Error("この家具は消せません。")

  const { error } = await createAdminClient().from("room_items").delete().match(key)
  if (error) throw new Error("消せませんでした。時間をおいてもう一度お試しください。")
  revalidatePath(`/rooms/${roomId}`)
}
