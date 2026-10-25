// 説明欄の URL のうち、サーバーから取りに行ってよい先（SSRF 対策。docs/specify-design.md 5章）
// 店を増やすときはここに足す

// 最後にたどり着いてよい店のページ
export const SHOP_HOSTS: Record<string, string> = {
  "item.rakuten.co.jp": "楽天市場",
  "room.rakuten.co.jp": "楽天ROOM",
  "www.amazon.co.jp": "Amazon",
  "amazon.co.jp": "Amazon",
  "www.nitori-net.jp": "ニトリ",
  "www.ikea.com": "IKEA",
  "www.muji.com": "無印良品",
  "www.palcloset.jp": "3COINS",
  "zozo.jp": "ZOZOTOWN",
}

// 転送のためだけに通ってよい先（短縮 URL・アフィリエイトの転送）
const REDIRECT_HOSTS = new Set([
  "a.r10.to",
  "hb.afl.rakuten.co.jp",
  "pt.afl.rakuten.co.jp",
  "amzn.to",
  "amzn.asia",
])

export const isShopHost = (host: string) => host in SHOP_HOSTS
export const isAllowedHost = (host: string) => isShopHost(host) || REDIRECT_HOSTS.has(host)
export const shopName = (host: string) => SHOP_HOSTS[host] ?? host

const ASIN = /\/(?:dp|gp\/product|gp\/aw\/d)\/([A-Z0-9]{10})(?=[/?]|$)/i

// Amazon の店のページを、Specify のトラッキングID付きのリンクにする（クリエイターのタグは外す。2026-10-25 決定）
// Amazon 以外と、タグが設定されていないときは null（説明欄のリンクをそのまま使う）
export function amazonLink(url: string, tag: string | undefined): string | null {
  const u = new URL(url)
  if (!tag || shopName(u.hostname) !== "Amazon") return null
  const asin = u.pathname.match(ASIN)?.[1]
  if (asin) return `https://www.amazon.co.jp/dp/${asin}?tag=${encodeURIComponent(tag)}`
  // 商品ページ以外（検索・ほしい物リストなど）は、行き先はそのままでタグだけ替える
  for (const key of ["linkCode", "linkId", "ascsubtag"]) u.searchParams.delete(key)
  u.searchParams.set("tag", tag)
  return u.href
}

// 楽天市場の商品ページを、Specify の楽天アフィリエイトのリンクにする（クリエイターのリンクは外す。2026-10-25 決定）
// 楽天ROOM の投稿と同じ hb.afl.rakuten.co.jp/hgc/{アフィリエイトID}/?pc={商品の URL} の形。開くと楽天の商品ページに転送される
// 楽天市場の商品ページ以外と、ID が設定されていないときは null（説明欄のリンクをそのまま使う）
export function rakutenLink(url: string, affiliateId: string | undefined): string | null {
  const u = new URL(url)
  if (!affiliateId || u.hostname !== "item.rakuten.co.jp" || !/^\/[^/]+\/[^/]+\/?$/.test(u.pathname)) return null
  return `https://hb.afl.rakuten.co.jp/hgc/${affiliateId}/?pc=${encodeURIComponent(u.origin + u.pathname)}`
}
