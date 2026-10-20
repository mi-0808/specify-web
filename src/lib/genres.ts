import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database"

// /add のジャンルの選択肢で「新しいジャンルを作る」を表す値
export const NEW_GENRE = "new"

// ジャンルを作る（一覧の「＋」と /add の「新しいジャンルを作る」）。RLS で created_by が本人か確かめている
export async function insertGenre(
  supabase: SupabaseClient<Database>,
  userId: string,
  rawName: string,
): Promise<{ id: string } | { error: string }> {
  const name = rawName.trim()
  if (name.length < 1 || name.length > 12) return { error: "ジャンル名は1〜12文字で入れてください。" }
  if (/https?:|www\./i.test(name)) return { error: "ジャンル名にリンクは入れられません。" }

  const { data, error } = await supabase.from("genres").insert({ name, created_by: userId }).select("id").single()
  if (error?.code === "23505") return { error: `「${name}」はすでにあります。` }
  if (error) return { error: "ジャンルを作れませんでした。時間をおいてもう一度お試しください。" }
  return { id: data.id }
}
