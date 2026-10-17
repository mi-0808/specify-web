import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// Google から code 付きで戻ってくる。code を ID トークンに替えて、Supabase のログインにつなぐ
export async function GET(request: Request) {
  const url = new URL(request.url)
  const fail = NextResponse.redirect(new URL("/login?error=confirm", url.origin))
  const cookieStore = await cookies()
  const saved = cookieStore.get("google_oauth")?.value
  cookieStore.delete({ name: "google_oauth", path: "/auth/google" })

  const code = url.searchParams.get("code")
  let state: string, nonce: string, next: string
  try {
    ;({ state, nonce, next } = JSON.parse(saved ?? ""))
  } catch {
    return fail
  }
  if (!code || url.searchParams.get("state") !== state) return fail

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    body: new URLSearchParams({
      code,
      client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: `${url.origin}/auth/google/callback`,
      grant_type: "authorization_code",
    }),
  })
  const { id_token } = (await tokenRes.json()) as { id_token?: string }
  if (!tokenRes.ok || !id_token) return fail

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithIdToken({ provider: "google", token: id_token, nonce })
  if (error) return fail
  return NextResponse.redirect(new URL(next, url.origin))
}
