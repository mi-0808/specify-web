"use client";

import { Suspense, useRef, useState } from "react";
import Script from "next/script";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";

// Google Identity Services（https://accounts.google.com/gsi/client）のうち、使う分だけの型
type GoogleId = {
  initialize(options: {
    client_id: string;
    callback: (res: { credential: string }) => void;
    nonce: string;
    use_fedcm_for_button?: boolean;
  }): void;
  renderButton(parent: HTMLElement, options: Record<string, string | number>): void;
};
declare global {
  interface Window {
    google?: { accounts: { id: GoogleId } };
  }
}

async function sha256Hex(text: string) {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, "0")).join("");
}

function LoginForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const buttonRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(
    searchParams.get("error") === "confirm" ? "ログインできませんでした。もう一度お試しください。" : null
  );
  const rawNext = searchParams.get("next") ?? "/";
  // このサイトの中のパスだけを許す（"//evil.com" や "https://…" には飛ばさない）
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/";

  // Google のボタンをこのサイトの中で出す。Supabase 経由のリダイレクトだと、Google の画面に supabase.co のドメインが出てしまうため
  async function setupGoogleButton() {
    const google = window.google;
    const parent = buttonRef.current;
    if (!google || !parent) return;
    // 同じ ID トークンを使い回されないように、ランダムな値を Google（ハッシュ）と Supabase（そのまま）に渡す
    const nonce = crypto.randomUUID();
    google.accounts.id.initialize({
      client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!,
      nonce: await sha256Hex(nonce),
      use_fedcm_for_button: true,
      callback: async ({ credential }) => {
        setLoading(true);
        setError(null);
        const { error } = await createClient().auth.signInWithIdToken({ provider: "google", token: credential, nonce });
        if (error) {
          setError(error.message);
          setLoading(false);
          return;
        }
        router.push(next);
        router.refresh();
      },
    });
    google.accounts.id.renderButton(parent, {
      theme: "filled_black",
      shape: "pill",
      size: "large",
      text: "continue_with",
      locale: "ja",
      width: Math.min(parent.offsetWidth, 400),
    });
  }

  return (
    <div className="max-w-sm w-full space-y-6">
      <Script src="https://accounts.google.com/gsi/client" onReady={() => void setupGoogleButton()} />
      <div className="text-center">
        <img src="/icon.svg" alt="" className="mx-auto mb-3 size-14" />
        <h1 className="text-2xl font-bold text-on-surface">Specify</h1>
        <p className="mt-1 text-sm text-on-surface-variant">ログイン / 新規登録</p>
      </div>

      {/* Google のボタンが入る。読み込み前とログイン中は高さだけ確保しておく */}
      <div ref={buttonRef} aria-busy={loading} className={`flex h-11 justify-center ${loading ? "pointer-events-none opacity-50" : ""}`} />

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
