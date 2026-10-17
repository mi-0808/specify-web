import { createHash, randomBytes } from "node:crypto"
import { NextResponse } from "next/server"

// Google ログインの入口。Supabase を経由せずに Google へ送るので、Google の画面にはこのサイトのドメインが出る
export async function GET(request: Request) {
  const url = new URL(request.url)
  const nextParam = url.searchParams.get("next") ?? "/"
  // オープンリダイレクト防止: 自サイト内のパスだけ許可
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/"
  // state は別サイトから勝手に戻されるのを防ぐため、nonce は ID トークンの使い回しを防ぐため
  const state = randomBytes(16).toString("hex")
  const nonce = randomBytes(16).toString("hex")

  const google = new URL("https://accounts.google.com/o/oauth2/v2/auth")
  google.search = new URLSearchParams({
    client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!,
    redirect_uri: `${url.origin}/auth/google/callback`,
    response_type: "code",
    scope: "openid email profile",
    state,
    // Supabase は「ID トークンの nonce = 渡した値の SHA-256」を確かめるので、Google にはハッシュを渡す
    nonce: createHash("sha256").update(nonce).digest("hex"),
    prompt: "select_account",
  }).toString()

  const res = NextResponse.redirect(google)
  res.cookies.set("google_oauth", JSON.stringify({ state, nonce, next }), {
    httpOnly: true,
    secure: url.protocol === "https:",
    sameSite: "lax",
    path: "/auth/google",
    maxAge: 600,
  })
  return res
}
