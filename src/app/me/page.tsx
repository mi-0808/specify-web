import Link from "next/link"
import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { SiteHeader } from "../_components/SiteHeader"
import { LargeTitle } from "../_components/LargeTitle"
import { signOut } from "../_components/actions"

export const metadata: Metadata = { title: "マイページ | Specify" }

const group = "soft-card overflow-hidden rounded-2xl bg-surface-container-lowest"
const row = "flex items-center gap-3 border-b border-outline-variant/70 px-4 py-3 last:border-b-0"

// マイページ（スマホは下のタブ、パソコンは右上の「マイページ」から）。未ログインでも開けて、会員登録へ案内する
export default async function MyPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: explored } = user
    ? await supabase
        .from("explored_rooms")
        .select("explored_at, rooms(id, title, thumbnail_url)")
        .order("explored_at", { ascending: false })
        .limit(50)
    : { data: [] }
  const rooms = (explored ?? []).flatMap((e) => (e.rooms ? [e.rooms] : []))

  return (
    <main className="min-h-screen bg-surface text-on-surface">
      <div className="mx-auto flex w-full max-w-xl flex-col gap-6 px-5 pb-8 pt-4 md:pt-8">
        <SiteHeader current="me" />
        <LargeTitle title="マイページ" alsoDesktop />

        {!user ? (
          <section className="space-y-4">
            <p className="text-[0.9375rem] leading-[1.7] text-on-surface-variant">
              会員登録すると、部屋を保存したり、探索した部屋を見返したりできます。
            </p>
            <Link
              href="/login?signup=1&next=%2Fme"
              className="focus-ring block rounded-full bg-primary px-6 py-3.5 text-center font-semibold text-on-primary hover:bg-primary-hover"
            >
              新規登録
            </Link>
            <Link href="/login?next=%2Fme" className="focus-ring block rounded-full border border-outline px-6 py-3.5 text-center text-primary">
              ログイン
            </Link>
          </section>
        ) : (
          <>
            <div className={group}>
              <div className={`${row} justify-between`}>
                <span className="min-w-0 truncate">{user.email}</span>
                <span className="shrink-0 text-[0.8125rem] text-on-surface-variant">ログイン中</span>
              </div>
            </div>

            <section aria-labelledby="explored-title" className="space-y-2">
              <h2 id="explored-title" className="px-1 text-[0.8125rem] text-on-surface-variant">
                自分が探索した部屋
              </h2>
              {rooms.length === 0 ? (
                <div className={`${group} space-y-2 p-4`}>
                  <p className="text-[0.9375rem]">まだ探索した部屋はありません。</p>
                  <Link href="/add" className="focus-ring inline-block rounded text-[0.9375rem] text-primary underline underline-offset-4">
                    気になる動画の部屋を探索する
                  </Link>
                </div>
              ) : (
                <ul className={group}>
                  {rooms.map((r) => (
                    <li key={r.id} className="border-b border-outline-variant/70 last:border-b-0">
                      <Link href={`/rooms/${r.id}`} className="focus-ring flex items-center gap-3 px-4 py-3 hover:bg-surface-container-low">
                        {/* eslint-disable-next-line @next/next/no-img-element -- YouTube のサムネイルをそのまま表示する */}
                        <img src={r.thumbnail_url} alt="" loading="lazy" className="aspect-video w-20 shrink-0 rounded-lg object-cover" />
                        <span className="line-clamp-2 text-[0.9375rem] leading-[1.5]">{r.title}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <form action={signOut} className={group}>
              <button type="submit" className="focus-ring w-full px-4 py-3.5 text-center text-error hover:bg-surface-container-low">
                ログアウト
              </button>
            </form>
          </>
        )}
      </div>
    </main>
  )
}
