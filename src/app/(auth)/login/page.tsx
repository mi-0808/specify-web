"use client";

import { Suspense, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const searchParams = useSearchParams();
  const [isSignUp, setIsSignUp] = useState(searchParams.get("signup") === "1");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();
  const next = searchParams.get("next") ?? "/home";
  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    if (isSignUp) {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setError(error.message);
      } else {
        setMessage("確認メールを送りました。メールを確認してください。");
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setError(error.message);
      } else {
        router.push(next);
        router.refresh();
      }
    }

    setLoading(false);
  }

  return (
    <div className="max-w-sm w-full space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-on-surface">Specify</h1>
        <p className="mt-1 text-sm text-on-surface-variant">
          {isSignUp ? "アカウントを作成" : "ログイン"}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-on-surface mb-1">
            メールアドレス
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2.5 border border-outline rounded-lg bg-surface-container-lowest text-on-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            placeholder="you@example.com"
          />
        </div>
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-on-surface mb-1">
            パスワード
          </label>
          <input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2.5 border border-outline rounded-lg bg-surface-container-lowest text-on-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            placeholder="••••••••"
          />
        </div>

        {error && <p role="alert" className="text-sm text-error">{error}</p>}
        {message && <p role="status" className="text-sm text-on-tertiary-container">{message}</p>}

        <button
          type="submit"
          disabled={loading}
          aria-busy={loading}
          className="w-full py-2.5 bg-primary text-on-primary rounded-lg font-medium hover:bg-primary-hover disabled:opacity-50 transition-colors"
        >
          {loading ? "処理中..." : isSignUp ? "アカウント作成" : "ログイン"}
        </button>
      </form>

      <p className="text-center text-sm text-on-surface-variant">
        {isSignUp ? "すでにアカウントをお持ちの方は" : "アカウントをお持ちでない方は"}
        <button
          type="button"
          onClick={() => setIsSignUp(!isSignUp)}
          className="ml-1 text-primary hover:underline"
        >
          {isSignUp ? "ログイン" : "新規登録"}
        </button>
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
