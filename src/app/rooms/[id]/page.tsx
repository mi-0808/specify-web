import { notFound } from "next/navigation"
import { createClient, getUser } from "@/lib/supabase/server"
import { shopName } from "@/lib/collector/shops"
import { SiteHeader } from "../../_components/SiteHeader"
import { SaveButton } from "./SaveButton"
import { BackButton } from "./BackButton"
import { removeFromGenre } from "../../genres/actions"
import Link from "next/link"

type Props = { params: Promise<{ id: string }> }

const VIDEO_ID = /^[\w-]{11}$/
const chipClass =
  "focus-ring inline-flex min-h-11 items-center rounded-full border border-outline px-4 text-[0.9375rem] text-on-surface hover:bg-surface-container-low"

async function loadRoom(id: string) {
  if (!VIDEO_ID.test(id)) return null
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("rooms")
    .select("id, title, channel_id, channel_title, tags, room_items(position, label, url, shop_host, product_title, image_url)")
    .eq("id", id)
    .order("position", { referencedTable: "room_items" })
    .maybeSingle()
  if (error) throw error
  return data
}

export async function generateMetadata({ params }: Props) {
  const room = await loadRoom((await params).id)
  return { title: room ? `${room.title} | Specify` : "Specify" }
}

// 部屋の詳細（docs/specify-design.md 2章）
export default async function RoomPage({ params }: Props) {
  const room = await loadRoom((await params).id)
  if (!room) notFound()

  const supabase = await createClient()
  const { data: { user } } = await getUser()
  const [{ data: saved }, { data: genres }, { data: myAdds }] = await Promise.all([
    user ? supabase.from("saved_rooms").select("room_id").eq("room_id", room.id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.rpc("genres_for_room", { rid: room.id }).select("id, name, created_by"),
    user
      ? supabase.from("room_genres").select("genre_id").eq("room_id", room.id).eq("added_by", user.id).eq("excluded", false)
      : Promise.resolve({ data: [] as { genre_id: string }[] }),
  ])
  const mine = new Set((myAdds ?? []).map((a) => a.genre_id))
  // 外せるのは、ジャンルを作った本人か、自分で足した人だけ
  const removable = (g: { id: string; created_by: string }) => !!user && (g.created_by === user.id || mine.has(g.id))

  return (
    <main className="min-h-screen bg-surface text-on-surface">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-5 pb-8 pt-8">
        <SiteHeader />
        <div className="-mb-4">
          <BackButton />
        </div>

        <section className="space-y-3">
          <div className="overflow-hidden rounded-2xl bg-surface-container">
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${room.id}`}
              title={room.title}
              allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              loading="lazy"
              className="aspect-video w-full"
            />
          </div>
          <div>
            <h1 className="text-[1.375rem] font-bold leading-[1.4]">{room.title}</h1>
            <div className="flex items-center justify-between gap-4">
              <a
                href={`https://www.youtube.com/channel/${room.channel_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="focus-ring min-w-0 truncate rounded text-[0.9375rem] text-on-surface-variant underline underline-offset-4"
              >
                {room.channel_title}
              </a>
              <SaveButton roomId={room.id} saved={!!saved} loggedIn={!!user} />
            </div>
          </div>
        </section>

        {(room.tags.length > 0 || (genres ?? []).length > 0) && (
          <section className="space-y-3" aria-labelledby="genres-title">
            <h2 id="genres-title" className="text-[1.0625rem] font-semibold">ジャンル</h2>
            <ul className="flex flex-wrap items-center gap-2">
              {room.tags.map((t) => (
                <li key={t}>
                  <Link href={`/?tag=${encodeURIComponent(t)}`} className={chipClass}>
                    {t}
                  </Link>
                </li>
              ))}
              {(genres ?? []).map((g) => (
                <li key={g.id} className="flex items-center">
                  <Link href={`/?genre=${g.id}`} className={`${chipClass} ${removable(g) ? "rounded-r-none pr-2" : ""}`}>
                    {g.name}
                  </Link>
                  {removable(g) && (
                    <form action={removeFromGenre}>
                      <input type="hidden" name="roomId" value={room.id} />
                      <input type="hidden" name="genreId" value={g.id} />
                      <button
                        type="submit"
                        aria-label={`「${g.name}」から外す`}
                        className="focus-ring inline-flex min-h-11 items-center rounded-r-full border border-l-0 border-outline px-3 text-on-surface-variant hover:bg-surface-container-high"
                      >
                        ×
                      </button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="space-y-4">
          <div className="space-y-1">
            <h2 className="text-[1.25rem] font-semibold">この部屋の家具（{room.room_items.length}点）</h2>
            <p className="text-[0.8125rem] leading-[1.6] text-on-surface-variant">
              動画の説明欄で紹介されているアイテムです。リンク先は、クリエイターが紹介しているページです。
            </p>
          </div>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {room.room_items.map((item) => (
              <li key={item.position} className="flex gap-4 rounded-2xl border border-outline-variant bg-surface-container-lowest p-4">
                <div
                  className={`flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-xl ${
                    item.image_url ? "bg-white" : "bg-surface-container"
                  }`}
                >
                  {item.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element -- 店の画像をそのまま表示し、こちらには保存しない
                    <img src={item.image_url} alt="" loading="lazy" className="size-full object-contain" />
                  ) : (
                    <span className="px-2 text-center text-[0.8125rem] text-on-surface-variant">{shopName(item.shop_host)}</span>
                  )}
                </div>
                <div className="min-w-0 space-y-1">
                  <p className="text-[0.8125rem] font-semibold text-on-surface-variant">{item.label}</p>
                  <p className="line-clamp-2 text-[0.9375rem] font-semibold leading-[1.5]">
                    {item.product_title ?? item.label}
                  </p>
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer sponsored"
                    className="focus-ring inline-block rounded py-1 text-[0.9375rem] text-primary underline underline-offset-4"
                  >
                    {shopName(item.shop_host)}で見る ↗<span className="sr-only">（新しいタブで開きます）</span>
                  </a>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  )
}
