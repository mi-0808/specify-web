import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/** 管理画面・管理者APIを使えるメールアドレス（ADMIN_EMAILS をカンマ区切りで設定する） */
export function getAdminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim())
    .filter(Boolean);
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  // メールアドレスの大文字小文字で管理者判定が変わらないようにする
  // （Supabase側は小文字で保持するため、ADMIN_EMAILSに大文字で書くと弾かれてしまう）
  const normalized = email.trim().toLowerCase();
  return getAdminEmails().some((allowed) => allowed.toLowerCase() === normalized);
}

export function createAdminClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
