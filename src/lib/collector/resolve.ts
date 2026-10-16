import { isAllowedHost, isShopHost } from "./shops"

export type Product = { host: string; title: string | null; image: string | null }

const MAX_HOPS = 5
const MAX_BYTES = 512 * 1024
const TIMEOUT_MS = 15_000 // 楽天の商品ページは応答まで約10秒かかることがある（裏側の処理なので待ってよい）
const UA = "Mozilla/5.0 (compatible; SpecifyBot/1.0)"

// 説明欄の URL を許可リストの中だけでたどり、店の商品ページの名前と写真を取る（docs/specify-design.md 5章）
// 許可リストの外に出たら null（その家具は出さない）
export async function resolveProduct(url: string, fetchImpl: typeof fetch = fetch): Promise<Product | null> {
  let current: URL
  try {
    current = new URL(url)
  } catch {
    return null
  }

  for (let hop = 0; hop <= MAX_HOPS; hop++) {
    if (current.protocol !== "https:" || !isAllowedHost(current.hostname)) return null
    if (isRakutenRoomProfile(current)) return null

    const res = await fetchImpl(current, {
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { "user-agent": UA, accept: "text/html" },
    }).catch(() => null)

    if (res && res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location")
      if (!location) return null
      current = new URL(location, current)
      continue
    }
    if (!isShopHost(current.hostname)) return null

    // 取れなくても、店のページだと分かっていれば名前と写真なしで出す
    const html = res?.ok ? await readHead(res).catch(() => "") : ""
    const title = cleanTitle(ogContent(html, "og:title"))
    const image = httpsOnly(ogContent(html, "og:image"))
    // ロボット向けの汎用ページ（Amazon など）は、取れなかったものとして扱う
    if (title === "Amazon" || image?.includes("/share-icons/")) return { host: current.hostname, title: null, image: null }
    return { host: current.hostname, title, image }
  }
  return null
}

// 楽天ROOM は「/ユーザー名/数字」が商品。「/ユーザー名」「/ユーザー名/items」は人のおすすめ一覧なので家具として出さない
const isRakutenRoomProfile = (u: URL) =>
  u.hostname === "room.rakuten.co.jp" && !/^\/[^/]+\/\d+\/?$/.test(u.pathname)

async function readHead(res: Response): Promise<string> {
  if (!res.body) return ""
  const reader = res.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  while (size < MAX_BYTES) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    size += value.byteLength
  }
  await reader.cancel().catch(() => {})
  const charset = res.headers.get("content-type")?.match(/charset=([\w-]+)/i)?.[1] ?? "utf-8"
  try {
    return new TextDecoder(charset).decode(Buffer.concat(chunks))
  } catch {
    return new TextDecoder().decode(Buffer.concat(chunks))
  }
}

function ogContent(html: string, property: string): string | null {
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    if (!new RegExp(`(?:property|name)=["']${property}["']`, "i").test(tag)) continue
    const content = tag.match(/content=["']([^"']*)["']/i)?.[1]
    if (content) return decodeEntities(content)
  }
  return null
}

const decodeEntities = (s: string) =>
  s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">")

// 楽天の「【ポイント5倍…】＼激安！／[セール…] 商品名：ショップ名」から、先頭の宣伝とショップ名を外す
const cleanTitle = (t: string | null) =>
  t
    ?.replace(/^Amazon\.co\.jp\s*[:：]\s*/, "")
    .replace(/^(?:【[^】]*】|＼[^／]*／|\[[^\]]*\]|［[^］]*］|\s)+/, "")
    .replace(/：[^：]*$/, "")
    .trim()
    .slice(0, 200) || null

function httpsOnly(u: string | null): string | null {
  try {
    return u && new URL(u).protocol === "https:" ? u : null
  } catch {
    return null
  }
}
