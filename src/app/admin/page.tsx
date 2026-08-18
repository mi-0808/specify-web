import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient, isAdminEmail } from "@/lib/supabase/admin"
import type { Database } from "@/types/database"
import AdminPanel from "./AdminPanel"

type SuggestionRow = Database["public"]["Tables"]["suggestions"]["Row"]

export default async function AdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect("/login")
  if (!isAdminEmail(user.email)) redirect("/dashboard")

  const adminClient = createAdminClient()
  const { data: suggestions } = await adminClient
    .from("suggestions")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: true }) as { data: SuggestionRow[] | null }

  return (
    <main className="min-h-dvh bg-[#FBF5EE] text-[#2F2823]">
      <header className="border-b border-[#E8D8C7] bg-[#FBF5EE]/95 px-4 py-4">
        <div className="mx-auto max-w-3xl">
          <h1 className="text-lg font-bold tracking-tight">管理画面</h1>
          <p className="text-xs text-[#6E5A4B]">未対応の提案一覧</p>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 py-6">
        <AdminPanel initialSuggestions={suggestions ?? []} />
      </div>
    </main>
  )
}
