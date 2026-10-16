import Link from "next/link"
import { getUser } from "@/lib/supabase/server"

type Current = "discover" | "saved" | "me"

const link = "focus-ring inline-flex min-h-11 items-center rounded px-2 text-[0.9375rem] hover:text-on-surface"

// パソコンだけ、右上にリンクを横一列で並べる（スマホは下のタブバー）。ログアウトはマイページの中
export async function SiteHeader({ current }: { current?: Current }) {
  const { data: { user } } = await getUser()

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
    <header className="hidden flex-wrap items-center justify-between gap-x-6 gap-y-1 md:flex">
      <Link href="/" className="focus-ring inline-flex items-center gap-2 rounded text-lg font-bold tracking-tight">
        <img src="/icon.svg" alt="" className="size-7" />
        Specify
      </Link>
      <nav aria-label="メインメニュー">
        <ul className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {item("discover", "/", "さがす")}
          {user && item("saved", "/saved", "保存した部屋")}
          {user ? (
            item("me", "/me", "マイページ")
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
