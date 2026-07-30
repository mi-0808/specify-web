import { createClient } from "@/lib/supabase/server"
import { createAdminClient, isAdminEmail } from "@/lib/supabase/admin"
import { redirect } from "next/navigation"
import BAdminPanel from "./BAdminPanel"

export default async function BAdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!isAdminEmail(user?.email)) {
    redirect("/b/workspace")
  }

  // 他ユーザーのスキャンを一覧するためRLSをバイパスする（管理者確認済み）
  const db = createAdminClient()

  const { data: pending } = await db
    .from("b_scans")
    .select("id, area_name, image_url, status, created_at, user_id")
    .eq("status", "pending")
    .order("created_at", { ascending: true })

  const { data: done } = await db
    .from("b_scans")
    .select("id, area_name, image_url, status, created_at")
    .eq("status", "done")
    .order("created_at", { ascending: false })
    .limit(10)

  return (
    <BAdminPanel
      pendingScans={pending ?? []}
      doneScans={done ?? []}
    />
  )
}
