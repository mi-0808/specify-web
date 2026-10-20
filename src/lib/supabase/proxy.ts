import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isAuthRoute = pathname.startsWith("/login");
  // 部屋を眺めるのとマイページ（未ログインなら会員登録の案内）はログイン不要。収集処理は CRON_SECRET で守る。確認メールのリンクと規約ページは未ログインで開かれる
  const isPublicRoute =
    pathname === "/" || pathname === "/me" || isAuthRoute || pathname.startsWith("/rooms/") || pathname.startsWith("/api/cron/") ||
    pathname === "/auth/confirm" || pathname.startsWith("/auth/google") || pathname === "/privacy" || pathname === "/terms";

  if (!user && !isPublicRoute) {
    // ログインのあと、クエリ（/add?genre=… など）ごと元のページに戻す
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("next", pathname + request.nextUrl.search);
    return NextResponse.redirect(url);
  }

  if (user && isAuthRoute) {
    // next はこのサイトの中のパスだけ（//evil.com や /\evil.com で外に飛ばさない）
    const next = request.nextUrl.searchParams.get("next") ?? "/";
    const { origin } = request.nextUrl;
    const url = new URL(next.startsWith("/") ? next : "/", origin);
    return NextResponse.redirect(url.origin === origin ? url : new URL("/", origin));
  }

  return supabaseResponse;
}
