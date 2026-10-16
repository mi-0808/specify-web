import type { EmailOtpType } from "@supabase/supabase-js"
import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// 確認メールのリンク先。token_hash（メールテンプレート経由）と code（PKCE リダイレクト）の両方を受ける
export async function GET(request: Request) {
  const url = new URL(request.url)
  const tokenHash = url.searchParams.get("token_hash")
  const type = url.searchParams.get("type") as EmailOtpType | null
  const code = url.searchParams.get("code")
  const nextParam = url.searchParams.get("next") ?? "/"
  // オープンリダイレクト防止: 自サイト内のパスだけ許可
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/"

  const supabase = await createClient()
  const { error } = tokenHash && type
    ? await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
    : code
      ? await supabase.auth.exchangeCodeForSession(code)
      : { error: new Error("missing token") }

  if (error) {
    return NextResponse.redirect(new URL("/login?error=confirm", url.origin))
  }
  return NextResponse.redirect(new URL(next, url.origin))
}
