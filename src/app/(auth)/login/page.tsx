"use client";

import { Suspense, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/dashboard";
  // ToB（/b/…）から来たときは for Business の青、それ以外は ToC のクリーム/オレンジに合わせる
  const forB = next.startsWith("/b");
  const t = forB
    ? { muted: "text-slate-500", border: "border-slate-200", ring: "focus-visible:ring-blue-500", btn: "bg-blue-600 hover:bg-blue-700", link: "text-blue-600" }
    : { muted: "text-[#6E5A4B]", border: "border-[#E8D8C7]", ring: "focus-visible:ring-[#B8501A]", btn: "bg-[#B8501A] hover:bg-[#9E4414]", link: "text-[#B8501A]" };
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
    <main className={`flex items-center justify-center min-h-dvh px-4 ${forB ? "bg-slate-50 text-slate-900" : "bg-[#FBF5EE] text-[#2F2823]"}`}>
    <div className="max-w-sm w-full space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold">Specify{forB && <span className="font-normal text-slate-400"> for Business</span>}</h1>
        <p className={`mt-1 text-sm ${t.muted}`}>
          {isSignUp ? "アカウントを作成" : "ログイン"}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className={`block text-sm font-medium ${t.muted} mb-1`}>
            メールアドレス
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={`w-full rounded-lg border ${t.border} bg-white px-3 py-3 focus:outline-none focus-visible:ring-2 ${t.ring}`}
            placeholder="you@example.com"
          />
        </div>
        <div>
          <label htmlFor="password" className={`block text-sm font-medium ${t.muted} mb-1`}>
            パスワード
          </label>
          <input
            id="password"
            type="password"
            autoComplete={isSignUp ? "new-password" : "current-password"}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={`w-full rounded-lg border ${t.border} bg-white px-3 py-3 focus:outline-none focus-visible:ring-2 ${t.ring}`}
            placeholder="••••••••"
          />
        </div>

        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        {message && <p role="status" className="text-sm text-green-700">{message}</p>}

        <button
          type="submit"
          disabled={loading}
          className={`w-full rounded-lg ${t.btn} py-3 font-semibold text-white shadow-sm transition-colors disabled:opacity-50`}
        >
          {loading ? "処理中..." : isSignUp ? "アカウント作成" : "ログイン"}
        </button>
      </form>

      <p className={`text-center text-sm ${t.muted}`}>
        {isSignUp ? "すでにアカウントをお持ちの方は" : "アカウントをお持ちでない方は"}
        <button
          type="button"
          onClick={() => setIsSignUp(!isSignUp)}
          className={`ml-1 inline-block px-2 py-3 font-medium ${t.link} hover:underline`}
        >
          {isSignUp ? "ログイン" : "新規登録"}
        </button>
      </p>
    </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="flex min-h-dvh items-center justify-center bg-[#FBF5EE] px-4 text-sm text-[#6E5A4B]">読み込み中...</main>}>
      <LoginForm />
    </Suspense>
  );
}
