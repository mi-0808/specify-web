import { createClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database"

// サービスロールで RLS を越えて書き込む。サーバー専用（収集処理だけが使う）
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set")
  return createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
