"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { insertGenre } from "@/lib/genres"
import { createClient } from "@/lib/supabase/server"

export type GenreState = { error: string | null }

const UUID = /^[0-9a-f-]{36}$/i

// Server Action は画面を通さず直接呼べるので、ログインと入力をここで必ず確認する
async function signedIn(next: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/login?signup=1&next=${encodeURIComponent(next)}`)
  return { supabase, userId: user.id }
}

export async function createGenre(_prev: GenreState, formData: FormData): Promise<GenreState> {
  const { supabase, userId } = await signedIn("/")
  const result = await insertGenre(supabase, userId, String(formData.get("name") ?? ""))
  if ("error" in result) return { error: result.error }

  revalidatePath("/")
  redirect(`/?genre=${result.id}`)
}

// 作った本人だけが消せる（RLS でも守っている）。ジャンルの部屋は外部キーで「ジャンルなし」になり、「すべて」に残る
export async function deleteGenre(formData: FormData) {
  const genreId = String(formData.get("genreId") ?? "")
  if (!UUID.test(genreId)) return
  const { supabase, userId } = await signedIn("/me")
  const { error } = await supabase.from("genres").delete().match({ id: genreId, created_by: userId })
  if (error) throw new Error("ジャンルを消せませんでした。")
  revalidatePath("/me")
  revalidatePath("/")
}
