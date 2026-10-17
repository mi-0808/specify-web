"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

function LoginForm() {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const error = searchParams.get("error") === "confirm" ? "ログインできませんでした。もう一度お試しください。" : null;
  const rawNext = searchParams.get("next") ?? "/";
  // このサイトの中のパスだけを許す（"//evil.com" や "https://…" には飛ばさない）
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/";

  return (
    <div className="max-w-sm w-full space-y-6">
      <div className="text-center">
        <img src="/icon.svg" alt="" className="mx-auto mb-3 size-14" />
        <h1 className="text-2xl font-bold text-on-surface">Specify</h1>
        <p className="mt-1 text-sm text-on-surface-variant">ログイン / 新規登録</p>
      </div>

      {/* /auth/google から Google に移る。Supabase を通さないので、Google の画面にこのサイトのドメインが出る */}
      <a
        href={`/auth/google?next=${encodeURIComponent(next)}`}
        onClick={() => setLoading(true)}
        aria-busy={loading}
        className={`w-full py-2.5 flex items-center justify-center gap-2.5 border border-outline rounded-lg bg-surface-container-lowest text-on-surface font-medium hover:bg-surface-container-low ${loading ? "pointer-events-none opacity-50" : ""}`}
      >
        <svg aria-hidden="true" viewBox="0 0 48 48" className="size-5">
          <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
          <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
          <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
          <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
        </svg>
        {loading ? "処理中..." : "Googleで続ける"}
      </a>

      {error && <p role="alert" className="text-sm text-error text-center">{error}</p>}

      <p className="text-center text-xs leading-relaxed text-balance text-on-surface-variant">
        続けると
        <Link href="/terms" className="mx-1 whitespace-nowrap text-primary underline underline-offset-2">利用規約</Link>と
        <Link href="/privacy" className="mx-1 whitespace-nowrap text-primary underline underline-offset-2">プライバシーポリシー</Link>
        に同意したことになります
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <main className="flex items-center justify-center min-h-screen bg-surface px-4">
      <Suspense fallback={<div className="text-sm text-on-surface-variant">読み込み中...</div>}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
