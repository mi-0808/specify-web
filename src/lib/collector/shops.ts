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
