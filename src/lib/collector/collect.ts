import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database"
import { hashText, parseItems } from "./parse"
import { resolveProduct } from "./resolve"
import { amazonLink, rakutenLink, SHOP_HOSTS } from "./shops"
import { getVideos, type Video } from "./youtube"

const MAX_LINKS = 30 // 1本の説明欄から取りに行く URL の上限
const VIDEO_CONCURRENCY = 4 // 動画4本 × 商品ページ4件 = 同時に最大16件まで取りに行く
const DEADLINE_MS = 240_000 // Vercel の maxDuration（300秒）より前に打ち切る

type Db = SupabaseClient<Database>

// docs/specify-design.md 3章。部屋は /add で人が入れる。毎日の収集は、YouTube の規約に合わせて
// 保存済みの動画を取り直し、説明欄が変わった動画は家具を読み直し、消えた・埋め込み不可になったものは削除する
export async function collect(apiKey: string, db: Db) {
  const startedAt = Date.now()
  const known = await loadKnownRooms(db)
  const videos = await getVideos(apiKey, [...known.keys()])
  const alive = new Set<string>()
  let refreshed = 0
  let reread = 0
  let skipped = 0

  await mapLimit(videos, VIDEO_CONCURRENCY, async (v) => {
    if (!v.embeddable || !v.isPublic) return
    const room = known.get(v.id)!
    const hash = hashText(v.description)

    if (room.hash === hash) {
      const { error } = await db.from("rooms").update(toRoom(v, hash, room.genreId)).eq("id", v.id)
      if (error) throw error
      alive.add(v.id)
      refreshed++
      return
    }
    if (Date.now() - startedAt > DEADLINE_MS) {
      // 時間切れ。消さずに次回に回す
      alive.add(v.id)
      skipped++
      return
    }

    // 説明欄が変わったので、家具を読み直す
    await saveRoom(db, v, await resolveItems(v.description), room.genreId)
    alive.add(v.id)
    reread++
  })

  const removed = [...known.keys()].filter((id) => !alive.has(id))
  if (removed.length) {
    const { error } = await db.from("rooms").delete().in("id", removed)
    if (error) throw error
  }
  return { refreshed, reread, removed: removed.length, skipped }
}

export type InspectResult =
  | { ok: true; video: Video; items: Item[] }
  | { ok: false; reason: "not-found" | "not-embeddable" }

// 貼られた動画1本を調べる（/add）。公開されていて、埋め込みが許可されていれば ok（家具の数は問わない）
export async function inspectVideoById(apiKey: string, videoId: string): Promise<InspectResult> {
  const [v] = await getVideos(apiKey, [videoId])
  if (!v || !v.isPublic) return { ok: false, reason: "not-found" }
  if (!v.embeddable) return { ok: false, reason: "not-embeddable" }
  return { ok: true, video: v, items: await resolveItems(v.description) }
}

const toRoom = (v: Video, hash: string, genreId: string | null) => ({
  id: v.id,
  title: v.title,
  channel_id: v.channelId,
  channel_title: v.channelTitle,
  thumbnail_url: v.thumbnail,
  published_at: v.publishedAt,
  genre_id: genreId,
  description_hash: hash,
  refreshed_at: new Date().toISOString(),
})

type Item = Awaited<ReturnType<typeof resolveItems>>[number]

export async function saveRoom(db: Db, v: Video, items: Item[], genreId: string | null) {
  // 家具を入れ終わるまでは hash を空にしておき、途中で失敗しても次回に読み直されるようにする
  const { error: upsertError } = await db.from("rooms").upsert(toRoom(v, "", genreId))
  if (upsertError) throw upsertError
  const { error: deleteError } = await db.from("room_items").delete().eq("room_id", v.id)
  if (deleteError) throw deleteError
  if (items.length) {
    const { error: insertError } = await db
      .from("room_items")
      .insert(items.map((item, position) => ({ ...item, room_id: v.id, position })))
    if (insertError) throw insertError
  }
  const { error: hashError } = await db.from("rooms").update({ description_hash: hashText(v.description) }).eq("id", v.id)
  if (hashError) throw hashError
}

// Supabase は1回に1000件までしか返さないので、ページを分けて全件読む
async function loadKnownRooms(db: Db) {
  const known = new Map<string, { hash: string; genreId: string | null }>()
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from("rooms").select("id, description_hash, genre_id").order("id").range(from, from + 999)
    if (error) throw error
    for (const r of data) known.set(r.id, { hash: r.description_hash, genreId: r.genre_id })
    if (data.length < 1000) return known
  }
}

const GENERIC_LABELS = new Set([...Object.values(SHOP_HOSTS), "楽天", "Amazon購入品", "楽天購入品"])

async function resolveItems(description: string) {
  const seen = new Set<string>()
  const links = parseItems(description)
    .filter(({ url }) => !seen.has(url) && seen.add(url))
    .slice(0, MAX_LINKS)
  // ponytail: リンクは読み直したときに替わる。タグや ID を変えたら、説明欄が変わっていない部屋は古いリンクのまま（全部読み直す処理が要る）
  const products = await mapLimit(links, 4, async (l) => {
    const p = await resolveProduct(l.url)
    if (!p) return null
    // 楽天市場の商品と、楽天ROOM の投稿が紹介している楽天市場の商品は、Specify の楽天アフィリエイトのリンクにする
    const rakuten = rakutenLink(p.item ?? p.url, process.env.RAKUTEN_AFFILIATE_ID)
    if (rakuten) return { ...p, host: "item.rakuten.co.jp", url: rakuten }
    return { ...p, url: amazonLink(p.url, process.env.AMAZON_ASSOCIATE_TAG) ?? l.url }
  })
  return links.flatMap((l, i) => {
    const p = products[i]
    // 「Amazon」「楽天」のような店名だけのラベルで商品名も取れないものは、何の家具か分からないので出さない
    if (!p || (!p.title && GENERIC_LABELS.has(l.label))) return []
    return [{ label: l.label, url: p.url, shop_host: p.host, product_title: p.title, image_url: p.image }]
  })
}

async function mapLimit<T, R>(xs: T[], limit: number, f: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = []
  let next = 0
  await Promise.all(
    Array.from({ length: Math.min(limit, xs.length) }, async () => {
      while (next < xs.length) {
        const i = next++
        out[i] = await f(xs[i])
      }
    }),
  )
  return out
}
