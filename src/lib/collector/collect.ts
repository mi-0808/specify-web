import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database"
import { detectTags, hashText, isInteriorVideo, parseItems } from "./parse"
import { resolveProduct } from "./resolve"
import { SHOP_HOSTS } from "./shops"
import { getVideos, searchVideoIds, type Video } from "./youtube"

export const QUERIES = [
  "一人暮らし ルームツアー",
  "ルームツアー 1K",
  "ルームツアー ワンルーム",
  "ルームツアー 韓国インテリア",
  "ルームツアー 北欧インテリア",
  "ルームツアー 6畳",
]
const MIN_ITEMS = 3 // 買える家具がこれ未満の動画は出さない
const MAX_LINKS = 30 // 1本の説明欄から取りに行く URL の上限
const MAX_NEW_PER_RUN = 60 // ponytail: 1回で新しく読む動画の上限。増やすなら収集を分割実行にする
const VIDEO_CONCURRENCY = 4 // 動画4本 × 商品ページ4件 = 同時に最大16件まで取りに行く
const DEADLINE_MS = 240_000 // Vercel の maxDuration（300秒）より前に打ち切る

type Db = SupabaseClient<Database>

// docs/specify-design.md 3章。YouTube の規約に合わせ、保存済みの動画も毎回取り直し、消えたものは削除する
export async function collect(apiKey: string, db: Db) {
  const startedAt = Date.now()
  const searched = (await Promise.all(QUERIES.map((q) => searchVideoIds(apiKey, q)))).flat()

  const known = await loadKnownRooms(db)

  const videos = await getVideos(apiKey, [...new Set([...known.keys(), ...searched])])
  const alive = new Set<string>()
  let added = 0
  let refreshed = 0
  let skippedNew = 0

  await mapLimit(videos, VIDEO_CONCURRENCY, async (v) => {
    if (!v.embeddable || !v.isPublic) return
    const hash = hashText(v.description)

    if (known.get(v.id) === hash) {
      const { error } = await db.from("rooms").update(toRoom(v, hash)).eq("id", v.id)
      if (error) throw error
      alive.add(v.id)
      refreshed++
      return
    }
    if (added >= MAX_NEW_PER_RUN || Date.now() - startedAt > DEADLINE_MS) {
      // 時間切れ。保存済みの動画は消さずに次回に回す
      if (known.has(v.id)) alive.add(v.id)
      skippedNew++
      return
    }

    if (!isInteriorVideo(`${v.title}\n${v.description}`)) return
    const items = await resolveItems(v.description)
    if (items.length < MIN_ITEMS) return
    await saveRoom(db, v, items)
    alive.add(v.id)
    added++
  })

  const removed = [...known.keys()].filter((id) => !alive.has(id))
  if (removed.length) {
    const { error } = await db.from("rooms").delete().in("id", removed)
    if (error) throw error
  }
  return { searched: searched.length, added, refreshed, removed: removed.length, skippedNew }
}

export type ImportResult =
  | { ok: true; roomId: string }
  | { ok: false; reason: "not-found" | "not-embeddable" | "not-interior" | "no-items" }

// 貼られた動画1本を取り込む（/add）。家具・インテリアの動画で、買える家具が3つ以上あるときだけ保存する
export async function importVideo(apiKey: string, db: Db, videoId: string): Promise<ImportResult> {
  const [v] = await getVideos(apiKey, [videoId])
  if (!v || !v.isPublic) return { ok: false, reason: "not-found" }
  if (!v.embeddable) return { ok: false, reason: "not-embeddable" }
  if (!isInteriorVideo(`${v.title}\n${v.description}`)) return { ok: false, reason: "not-interior" }
  const items = await resolveItems(v.description)
  if (items.length < MIN_ITEMS) return { ok: false, reason: "no-items" }
  await saveRoom(db, v, items)
  return { ok: true, roomId: v.id }
}

const toRoom = (v: Video, hash: string) => ({
  id: v.id,
  title: v.title,
  channel_id: v.channelId,
  channel_title: v.channelTitle,
  thumbnail_url: v.thumbnail,
  published_at: v.publishedAt,
  tags: detectTags(`${v.title}\n${v.description}`),
  description_hash: hash,
  refreshed_at: new Date().toISOString(),
})

type Item = Awaited<ReturnType<typeof resolveItems>>[number]

async function saveRoom(db: Db, v: Video, items: Item[]) {
  // 家具を入れ終わるまでは hash を空にしておき、途中で失敗しても次回に読み直されるようにする
  const { error: upsertError } = await db.from("rooms").upsert(toRoom(v, ""))
  if (upsertError) throw upsertError
  const { error: deleteError } = await db.from("room_items").delete().eq("room_id", v.id)
  if (deleteError) throw deleteError
  const { error: insertError } = await db
    .from("room_items")
    .insert(items.map((item, position) => ({ ...item, room_id: v.id, position })))
  if (insertError) throw insertError
  const { error: hashError } = await db.from("rooms").update({ description_hash: hashText(v.description) }).eq("id", v.id)
  if (hashError) throw hashError
}

// Supabase は1回に1000件までしか返さないので、ページを分けて全件読む
async function loadKnownRooms(db: Db) {
  const known = new Map<string, string>()
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from("rooms").select("id, description_hash").order("id").range(from, from + 999)
    if (error) throw error
    for (const r of data) known.set(r.id, r.description_hash)
    if (data.length < 1000) return known
  }
}

const GENERIC_LABELS = new Set([...Object.values(SHOP_HOSTS), "楽天", "Amazon購入品", "楽天購入品"])

async function resolveItems(description: string) {
  const seen = new Set<string>()
  const links = parseItems(description)
    .filter(({ url }) => !seen.has(url) && seen.add(url))
    .slice(0, MAX_LINKS)
  const products = await mapLimit(links, 4, (l) => resolveProduct(l.url))
  return links.flatMap((l, i) => {
    const p = products[i]
    // 「Amazon」「楽天」のような店名だけのラベルで商品名も取れないものは、何の家具か分からないので出さない
    if (!p || (!p.title && GENERIC_LABELS.has(l.label))) return []
    return [{ label: l.label, url: l.url, shop_host: p.host, product_title: p.title, image_url: p.image }]
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
