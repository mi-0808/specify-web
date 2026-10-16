import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { signOut } from "./actions"

type Current = "discover" | "saved"

const link = "focus-ring inline-flex min-h-11 items-center rounded px-2 text-[0.9375rem] transition-colors hover:text-on-surface"

// 右上にリンクを横一列で並べる。スマホで入りきらないときはロゴの下に回る
export async function SiteHeader({ current }: { current?: Current }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const item = (key: Current, href: string, label: string) => (
    <li>
      <Link
        href={href}
        aria-current={current === key ? "page" : undefined}
        className={`${link} ${current === key ? "font-semibold text-on-surface" : "text-on-surface-variant"}`}
      >
        {label}
      </Link>
    </li>
  )

  return (
    <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1">
      <Link href="/" className="focus-ring rounded text-lg font-bold tracking-tight">
        Specify
      </Link>
      <nav aria-label="メインメニュー">
        <ul className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {item("discover", "/", "さがす")}
          {user && item("saved", "/saved", "保存した部屋")}
          {user ? (
            <li>
              <form action={signOut}>
                <button type="submit" className={`${link} text-on-surface-variant`}>
                  ログアウト
                </button>
              </form>
            </li>
          ) : (
            <>
              <li>
                <Link href="/login" className={`${link} text-on-surface-variant`}>
                  ログイン
                </Link>
              </li>
              <li>
                <Link href="/login?signup=1" className={`${link} font-semibold text-on-surface`}>
                  新規登録
                </Link>
              </li>
            </>
          )}
        </ul>
      </nav>
    </header>
  )
}
