import Link from "next/link"
import { createClient, getUser } from "@/lib/supabase/server"
import { SiteHeader } from "./_components/SiteHeader"
import { AddRoomCard, ROOM_CARD_SELECT, RoomCard } from "./_components/RoomCard"
import { GenreCreate } from "./_components/GenreCreate"
import { FilterChips } from "./_components/FilterChips"
import { LargeTitle } from "./_components/LargeTitle"

const PAGE_SIZE = 24

type Props = { searchParams: Promise<{ genre?: string; page?: string }> }

const UUID = /^[0-9a-f-]{36}$/i

// 眺めて見つける（docs/specify-design.md 2章）
export default async function DiscoverPage({ searchParams }: Props) {
  const params = await searchParams
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1)
  const from = (page - 1) * PAGE_SIZE

  const supabase = await createClient()
  const { data: { user } } = await getUser()
  const [{ data: genres, error: genresError }, { data: savedRows }] = await Promise.all([
    // 公式もユーザーのジャンルも、部屋の多い順に（作ったばかりの0部屋のジャンルも出す）。スマホは3行目から先を「もっと見る」で開く
    supabase.rpc("genres_with_counts").select("id, name, room_count").order("room_count", { ascending: false }),
    // 毎日開く理由として、ログイン中は保存した部屋を「また見る」で上に出す
    user
      ? supabase.from("saved_rooms").select("rooms(id, title, thumbnail_url)").order("created_at", { ascending: false }).limit(10)
      : Promise.resolve({ data: [] as { rooms: { id: string; title: string; thumbnail_url: string } | null }[] }),
  ])
  const savedRooms = (savedRows ?? []).flatMap((r) => (r.rooms ? [r.rooms] : []))
  if (genresError) throw genresError
  const genre = UUID.test(params.genre ?? "") ? (genres.find((g) => g.id === params.genre) ?? null) : null

  let query = supabase
    .from("rooms")
    .select(ROOM_CARD_SELECT)
    .order("published_at", { ascending: false })
    .range(from, from + PAGE_SIZE) // 1件多く取って、続きがあるか判定する
  if (genre) query = query.eq("genre_id", genre.id)
  const { data, error } = await query
  if (error) throw error
  const rooms = data.slice(0, PAGE_SIZE)
  const hasMore = data.length > PAGE_SIZE
  const filterName = genre?.name

  const href = (genreId: string | null, p = 1) => {
    const q = new URLSearchParams()
    if (genreId) q.set("genre", genreId)
    if (p > 1) q.set("page", String(p))
    const s = q.toString()
    return s ? `/?${s}` : "/"
  }
  const current = genre?.id ?? null
  const showSaved = savedRooms.length > 0 && !filterName && page === 1

  return (
    <main className="min-h-screen bg-surface text-on-surface">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-5 pb-8 pt-4 md:gap-8 md:pt-8">
        <SiteHeader current="discover" />
        {/* スマホは最初の画面でタイムラインを多く見せたいので、サブタイトルは出さない */}
        <LargeTitle brand title="さがす" />
        {/* パソコンは今の見出しのまま */}
        <section className="hidden space-y-3 md:block">
          <h1 className="text-[1.75rem] font-bold leading-[1.4]">見つけた部屋の家具を、そのまま探せる。</h1>
          <p className="text-[1.0625rem] leading-[1.7] text-on-surface-variant">
            ルームツアー動画で紹介されている家具と、その購入先をまとめています。
          </p>
        </section>

        {showSaved && (
          <section aria-labelledby="saved-row-title" className="space-y-3">
            <div className="flex items-baseline justify-between">
              <h2 id="saved-row-title" className="text-[1.25rem] font-semibold">
                また見る
              </h2>
              <Link href="/saved" className="focus-ring rounded py-2 text-[0.9375rem] text-primary">
                すべて
              </Link>
            </div>
            <ul className="-mx-5 flex snap-x gap-3 overflow-x-auto px-5 pb-1 [scrollbar-width:none]">
              {savedRooms.map((r) => (
                <li key={r.id} className="w-40 shrink-0 snap-start">
                  <Link href={`/rooms/${r.id}`} className="focus-ring block rounded-2xl">
                    {/* eslint-disable-next-line @next/next/no-img-element -- YouTube のサムネイルをそのまま表示する */}
                    <img src={r.thumbnail_url} alt="" loading="lazy" className="aspect-video w-full rounded-2xl object-cover soft-card" />
                    <p className="mt-2 line-clamp-2 text-[0.8125rem] leading-[1.5]">{r.title}</p>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <nav aria-label="ジャンルで絞り込む">
          <FilterChips
            chips={[
              { key: "all", label: "すべて", href: "/", active: !genre },
              ...genres.map((g) => ({ key: g.id, label: g.name, href: href(g.id === genre?.id ? null : g.id), active: g.id === genre?.id })),
            ]}
            trailing={<GenreCreate loggedIn={!!user} />}
          />
        </nav>

        {rooms.length === 0 && (
          <div className="space-y-2">
            <p className="text-[1.0625rem] leading-[1.7]">
              {filterName ? `「${filterName}」の部屋はまだありません。` : "まだ部屋がありません。気になる動画のリンクを貼って、最初の部屋を入れてください。"}
            </p>
            {filterName && (
              <Link href="/" className="focus-ring inline-block rounded text-[0.9375rem] text-primary underline underline-offset-4">
                すべての部屋を見る
              </Link>
            )}
          </div>
        )}

        <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {rooms.map((room) => (
            <li key={room.id}>
              <RoomCard room={room} />
            </li>
          ))}
          {/* 一覧の最後（続きがないとき）と、部屋がないときに「動画から部屋を追加」のカードを置く */}
          {!hasMore && (
            <li>
              <AddRoomCard genreId={genre?.id} />
            </li>
          )}
        </ul>

        {(page > 1 || hasMore) && (
          <nav aria-label="ページ" className="flex justify-between">
            {page > 1 ? (
              <Link href={href(current, page - 1)} className="focus-ring rounded py-2 text-[0.9375rem] text-primary">
                ← 前へ
              </Link>
            ) : (
              <span />
            )}
            {hasMore && (
              <Link href={href(current, page + 1)} className="focus-ring rounded py-2 text-[0.9375rem] text-primary">
                もっと見る →
              </Link>
            )}
          </nav>
        )}

      </div>
    </main>
  )
}
