import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { TAG_NAMES } from "@/lib/collector/parse"

const PAGE_SIZE = 24

type Props = { searchParams: Promise<{ tag?: string; page?: string }> }

// 眺めて見つける（docs/specify-design.md 2章）
export default async function DiscoverPage({ searchParams }: Props) {
  const params = await searchParams
  const tag = TAG_NAMES.includes(params.tag ?? "") ? params.tag! : null
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1)
  const from = (page - 1) * PAGE_SIZE

  const supabase = await createClient()
  let query = supabase
    .from("rooms")
    .select("id, title, channel_title, thumbnail_url, room_items(count)")
    .order("published_at", { ascending: false })
    .range(from, from + PAGE_SIZE) // 1件多く取って、続きがあるか判定する
  if (tag) query = query.contains("tags", [tag])
  const { data, error } = await query
  if (error) throw error
  const rooms = data.slice(0, PAGE_SIZE)
  const hasMore = data.length > PAGE_SIZE

  const href = (t: string | null, p = 1) => {
    const q = new URLSearchParams()
    if (t) q.set("tag", t)
    if (p > 1) q.set("page", String(p))
    const s = q.toString()
    return s ? `/?${s}` : "/"
  }

  return (
    <main className="min-h-screen bg-surface text-on-surface">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-5 py-8">
        <header className="space-y-3">
          <p className="text-lg font-bold tracking-tight">Specify</p>
          <h1 className="text-[1.75rem] font-bold leading-[1.4]">見つけた部屋の家具を、そのまま探せる。</h1>
          <p className="text-[1.0625rem] leading-[1.7] text-on-surface-variant">
            ルームツアー動画で紹介されている家具と、その購入先をまとめています。
          </p>
        </header>

        <nav aria-label="雰囲気で絞り込む" className="-mx-5 overflow-x-auto px-5">
          <ul className="flex gap-2">
            {TAG_NAMES.map((t) => {
              const active = t === tag
              return (
                <li key={t}>
                  <Link
                    href={href(active ? null : t)}
                    aria-current={active ? "page" : undefined}
                    className={`focus-ring inline-flex min-h-11 items-center whitespace-nowrap rounded-full px-4 text-[0.9375rem] font-medium transition-colors ${
                      active
                        ? "bg-secondary-container text-on-secondary-container"
                        : "border border-outline text-on-surface hover:bg-surface-container-low"
                    }`}
                  >
                    {t}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        {rooms.length === 0 ? (
          <p className="rounded-2xl bg-surface-container p-6 text-[1.0625rem] leading-[1.7]">
            {tag ? (
              <>
                「{tag}」の部屋はまだありません。<Link href="/" className="focus-ring rounded text-primary underline underline-offset-4">すべての部屋を見る</Link>
              </>
            ) : (
              "部屋を集めています。しばらくしてからもう一度ご覧ください。"
            )}
          </p>
        ) : (
          <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {rooms.map((room) => (
              <li key={room.id}>
                <Link
                  href={`/rooms/${room.id}`}
                  className="focus-ring group block overflow-hidden rounded-2xl border border-outline-variant bg-surface-container-lowest transition-colors hover:bg-surface-container-low"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- YouTube のサムネイルをそのまま表示する */}
                  <img src={room.thumbnail_url} alt="" loading="lazy" className="aspect-video w-full object-cover" />
                  <div className="space-y-1 p-4">
                    <p className="line-clamp-2 text-[1.0625rem] font-semibold leading-[1.5]">{room.title}</p>
                    <p className="text-[0.9375rem] text-on-surface-variant">
                      {room.channel_title}・家具 {room.room_items[0]?.count ?? 0}点
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}

        {(page > 1 || hasMore) && (
          <nav aria-label="ページ" className="flex justify-between">
            {page > 1 ? (
              <Link href={href(tag, page - 1)} className="focus-ring rounded py-2 text-[0.9375rem] text-primary">
                ← 前へ
              </Link>
            ) : (
              <span />
            )}
            {hasMore && (
              <Link href={href(tag, page + 1)} className="focus-ring rounded py-2 text-[0.9375rem] text-primary">
                もっと見る →
              </Link>
            )}
          </nav>
        )}
      </div>
    </main>
  )
}
