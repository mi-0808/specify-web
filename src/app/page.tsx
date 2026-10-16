import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { TAG_NAMES } from "@/lib/collector/parse"
import { SiteHeader } from "./_components/SiteHeader"
import { AddRoomCard, ROOM_CARD_SELECT, RoomCard } from "./_components/RoomCard"
import { GenreCreate } from "./_components/GenreCreate"
import { LargeTitle } from "./_components/LargeTitle"

const PAGE_SIZE = 24

type Props = { searchParams: Promise<{ tag?: string; genre?: string; page?: string }> }

const UUID = /^[0-9a-f-]{36}$/i

// 眺めて見つける（docs/specify-design.md 2章）
export default async function DiscoverPage({ searchParams }: Props) {
  const params = await searchParams
  const tag = TAG_NAMES.includes(params.tag ?? "") ? params.tag! : null
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1)
  const from = (page - 1) * PAGE_SIZE

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const [{ data: genres, error: genresError }, { data: savedRows }] = await Promise.all([
    // ponytail: ユーザーのジャンルは部屋の多い順に20個まで。増えたら「もっと見る」かジャンル一覧ページを作る
    supabase.rpc("genres_with_counts").gt("room_count", 0).order("room_count", { ascending: false }).limit(20),
    // 毎日開く理由として、ログイン中は保存した部屋を「また見る」で上に出す
    user
      ? supabase.from("saved_rooms").select("rooms(id, title, thumbnail_url)").order("created_at", { ascending: false }).limit(10)
      : Promise.resolve({ data: [] as { rooms: { id: string; title: string; thumbnail_url: string } | null }[] }),
  ])
  const savedRooms = (savedRows ?? []).flatMap((r) => (r.rooms ? [r.rooms] : []))
  if (genresError) throw genresError
  // 作ったばかりで部屋が0件のジャンルは上の一覧に入らないので、直接読む
  const genreId = UUID.test(params.genre ?? "") ? params.genre! : null
  const genre = genreId
    ? (genres.find((g) => g.id === genreId) ??
      (await supabase.from("genres").select("id, name").eq("id", genreId).maybeSingle()).data)
    : null

  const base = genre ? supabase.rpc("rooms_in_genre", { gid: genre.id }).select(ROOM_CARD_SELECT) : supabase.from("rooms").select(ROOM_CARD_SELECT)
  let query = base.order("published_at", { ascending: false }).range(from, from + PAGE_SIZE) // 1件多く取って、続きがあるか判定する
  if (tag && !genre) query = query.contains("tags", [tag])
  const { data, error } = await query
  if (error) throw error
  const rooms = data.slice(0, PAGE_SIZE)
  const hasMore = data.length > PAGE_SIZE
  const filterName = genre?.name ?? tag
  const genreChips = genre && !genres.some((g) => g.id === genre.id) ? [...genres, genre] : genres

  const href = (filter: { tag?: string; genre?: string } | null, p = 1) => {
    const q = new URLSearchParams()
    if (filter?.tag) q.set("tag", filter.tag)
    if (filter?.genre) q.set("genre", filter.genre)
    if (p > 1) q.set("page", String(p))
    const s = q.toString()
    return s ? `/?${s}` : "/"
  }
  const current = genre ? { genre: genre.id } : tag ? { tag } : null
  const chip = (active: boolean) =>
    `focus-ring press inline-flex min-h-11 items-center whitespace-nowrap rounded-full px-4 text-[0.9375rem] font-medium transition-colors ${
      active
        ? "bg-secondary-container text-on-secondary-container"
        : "border border-outline-variant bg-surface-container-lowest text-on-surface hover:bg-surface-container-low"
    }`
  const showSaved = savedRooms.length > 0 && !filterName && page === 1

  return (
    <main className="min-h-screen bg-surface text-on-surface">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-5 pb-8 pt-4 md:pt-8">
        <SiteHeader current="discover" />
        <LargeTitle brand title="さがす" subtitle="ルームツアーの家具と、その買える場所" />
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
                  <Link href={`/rooms/${r.id}`} className="focus-ring press block rounded-2xl">
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
          <ul className="flex flex-wrap gap-2">
            {TAG_NAMES.map((t) => (
              <li key={t}>
                <Link href={href(t === tag ? null : { tag: t })} aria-current={t === tag ? "page" : undefined} className={chip(t === tag)}>
                  {t}
                </Link>
              </li>
            ))}
            {genreChips.map((g) => (
              <li key={g.id}>
                <Link
                  href={href(g.id === genre?.id ? null : { genre: g.id })}
                  aria-current={g.id === genre?.id ? "page" : undefined}
                  className={chip(g.id === genre?.id)}
                >
                  {g.name}
                </Link>
              </li>
            ))}
            <li>
              <GenreCreate loggedIn={!!user} />
            </li>
          </ul>
        </nav>

        {rooms.length === 0 && (
          <div className="space-y-2">
            <p className="text-[1.0625rem] leading-[1.7]">
              {filterName ? `「${filterName}」の部屋はまだありません。` : "部屋を集めています。しばらくしてからもう一度ご覧ください。"}
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
              <AddRoomCard />
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
