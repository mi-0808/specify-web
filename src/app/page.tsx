import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { TAG_NAMES } from "@/lib/collector/parse"
import { SiteHeader } from "./_components/SiteHeader"
import { ROOM_CARD_SELECT, RoomCard } from "./_components/RoomCard"
import { GenreCreate } from "./_components/GenreCreate"

const PAGE_SIZE = 24

type Props = { searchParams: Promise<{ tag?: string; genre?: string; page?: string }> }

const UUID = /^[0-9a-f-]{36}$/i

// 一覧のいちばん下と、部屋がないときに出す「見つけた動画を追加する」案内
function AddRoomPrompt({ text = "探している部屋が見つかりませんか？ YouTube で見つけたルームツアーを追加できます。" }: { text?: string }) {
  return (
    <>
      <p className="text-[0.9375rem] leading-[1.7] text-on-surface-variant">{text}</p>
      <Link
        href="/add"
        className="focus-ring inline-flex min-h-11 items-center rounded-full bg-primary px-5 text-[0.9375rem] font-semibold text-on-primary hover:bg-primary-hover"
      >
        動画から部屋を追加する
      </Link>
    </>
  )
}

// 眺めて見つける（docs/specify-design.md 2章）
export default async function DiscoverPage({ searchParams }: Props) {
  const params = await searchParams
  const tag = TAG_NAMES.includes(params.tag ?? "") ? params.tag! : null
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1)
  const from = (page - 1) * PAGE_SIZE

  const supabase = await createClient()
  const [{ data: { user } }, { data: genres, error: genresError }] = await Promise.all([
    supabase.auth.getUser(),
    // ponytail: ユーザーのジャンルは部屋の多い順に20個まで。増えたら「もっと見る」かジャンル一覧ページを作る
    supabase.rpc("genres_with_counts").gt("room_count", 0).order("room_count", { ascending: false }).limit(20),
  ])
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
    `focus-ring inline-flex min-h-11 items-center whitespace-nowrap rounded-full px-4 text-[0.9375rem] font-medium transition-colors ${
      active ? "bg-secondary-container text-on-secondary-container" : "border border-outline text-on-surface hover:bg-surface-container-low"
    }`

  return (
    <main className="min-h-screen bg-surface text-on-surface">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-5 py-8">
        <SiteHeader current="discover" />
        <section className="space-y-3">
          <h1 className="text-[1.75rem] font-bold leading-[1.4]">見つけた部屋の家具を、そのまま探せる。</h1>
          <p className="text-[1.0625rem] leading-[1.7] text-on-surface-variant">
            ルームツアー動画で紹介されている家具と、その購入先をまとめています。
          </p>
        </section>

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

        {rooms.length === 0 ? (
          <div className="space-y-4 rounded-2xl bg-surface-container p-6">
            <p className="text-[1.0625rem] leading-[1.7]">
              {filterName ? `「${filterName}」の部屋はまだありません。` : "部屋を集めています。しばらくしてからもう一度ご覧ください。"}
            </p>
            <AddRoomPrompt text={filterName ? `見つけた「${filterName}」の部屋の動画があれば、追加してみませんか？` : undefined} />
            {filterName && (
              <Link href="/" className="focus-ring inline-block rounded text-[0.9375rem] text-primary underline underline-offset-4">
                すべての部屋を見る
              </Link>
            )}
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {rooms.map((room) => (
              <li key={room.id}>
                <RoomCard room={room} />
              </li>
            ))}
          </ul>
        )}

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

        {rooms.length > 0 && !hasMore && (
          <div className="space-y-3 rounded-2xl border border-dashed border-outline p-6 text-center">
            <AddRoomPrompt />
          </div>
        )}
      </div>
    </main>
  )
}
