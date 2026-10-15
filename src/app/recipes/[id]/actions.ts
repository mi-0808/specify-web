"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { findRecipe } from "@/data/recipes"

const SAVE_ERROR = "保存できませんでした。時間をおいてもう一度お試しください。"

// Server Action は画面を通さず直接呼べるので、ログインとIDの実在をここで必ず確認する
async function signedIn(recipeId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/login?signup=1&next=/recipes/${recipeId}`)
  return { supabase, userId: user.id }
}

function done(recipeId: string) {
  revalidatePath(`/recipes/${recipeId}`)
  revalidatePath("/home")
}

export async function toggleSave(formData: FormData) {
  const recipeId = String(formData.get("recipeId") ?? "")
  if (!findRecipe(recipeId)) return
  const { supabase, userId } = await signedIn(recipeId)

  const key = { user_id: userId, recipe_id: recipeId }
  const { data: existing } = await supabase.from("saved_recipes").select("recipe_id").match(key).maybeSingle()
  const { error } = existing
    ? await supabase.from("saved_recipes").delete().match(key)
    : await supabase.from("saved_recipes").insert(key)
  if (error) throw new Error(SAVE_ERROR)
  done(recipeId)
}

export async function togglePurchase(formData: FormData) {
  const recipeId = String(formData.get("recipeId") ?? "")
  const itemId = String(formData.get("itemId") ?? "")
  const recipe = findRecipe(recipeId)
  if (!recipe || !recipe.items.some((i) => i.id === itemId)) return
  const { supabase, userId } = await signedIn(recipeId)

  const key = { user_id: userId, recipe_id: recipeId, item_id: itemId }
  const { data: existing } = await supabase.from("purchases").select("item_id").match(key).maybeSingle()
  const { error } = existing
    ? await supabase.from("purchases").delete().match(key)
    : await supabase.from("purchases").insert(key)
  if (error) throw new Error(SAVE_ERROR)

  // 買い始めたレシピは自動で保存する（マイページに出すため）
  await supabase
    .from("saved_recipes")
    .upsert({ user_id: userId, recipe_id: recipeId }, { onConflict: "user_id,recipe_id", ignoreDuplicates: true })
  done(recipeId)
}
