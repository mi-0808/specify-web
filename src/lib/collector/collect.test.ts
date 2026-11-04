import { afterEach, describe, expect, it, vi } from "vitest"
import { resolveManualItem } from "./collect"

const page = (title: string) =>
  new Response(`<meta property="og:title" content="${title}"><meta property="og:image" content="https://img.example/a.jpg">`, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8" },
  })

const fetchOf = (routes: Record<string, () => Response>) =>
  vi.fn(async (input: URL | RequestInfo) => {
    const route = routes[String(input)]
    if (!route) throw new Error(`unexpected fetch: ${String(input)}`)
    return route()
  }) as unknown as typeof fetch

describe("resolveManualItem", () => {
  afterEach(() => vi.unstubAllEnvs())

  it("Amazon は Specify のタグ付きにし、ラベルが空なら商品名を使う", async () => {
    vi.stubEnv("AMAZON_ASSOCIATE_TAG", "specify-22")
    const f = fetchOf({ "https://www.amazon.co.jp/dp/B0ABCDE123?tag=other-22": () => page("Amazon.co.jp: 白いデスク") })
    expect(await resolveManualItem(" https://www.amazon.co.jp/dp/B0ABCDE123?tag=other-22 ", "", f)).toEqual({
      ok: true,
      item: {
        label: "白いデスク",
        url: "https://www.amazon.co.jp/dp/B0ABCDE123?tag=specify-22",
        shop_host: "www.amazon.co.jp",
        product_title: "白いデスク",
        image_url: "https://img.example/a.jpg",
      },
    })
  })

  it("楽天市場は Specify の楽天アフィリエイトのリンクにし、入力したラベルを使う", async () => {
    vi.stubEnv("RAKUTEN_AFFILIATE_ID", "abc.def")
    const f = fetchOf({ "https://item.rakuten.co.jp/shop/rug/": () => page("ウールラグ：ショップ") })
    const r = await resolveManualItem("https://item.rakuten.co.jp/shop/rug/", " ラグ ", f)
    expect(r.ok && r.item).toMatchObject({
      label: "ラグ",
      url: "https://hb.afl.rakuten.co.jp/hgc/abc.def/?pc=https%3A%2F%2Fitem.rakuten.co.jp%2Fshop%2Frug%2F",
      shop_host: "item.rakuten.co.jp",
    })
  })

  it("許可リストの外と URL でないものは、取りに行かずに not-shop", async () => {
    const f = fetchOf({})
    expect(await resolveManualItem("https://store.shopping.yahoo.co.jp/shop/item.html", "", f)).toEqual({ ok: false, reason: "not-shop" })
    expect(await resolveManualItem("http://www.amazon.co.jp/dp/B0ABCDE123", "", f)).toEqual({ ok: false, reason: "not-shop" })
    expect(await resolveManualItem("ラグ", "", f)).toEqual({ ok: false, reason: "not-shop" })
    expect(f).not.toHaveBeenCalled()
  })

  it("消えた商品ページ（404）は not-found", async () => {
    const f = fetchOf({ "https://www.nitori-net.jp/ec/product/1/": () => new Response(null, { status: 404 }) })
    expect(await resolveManualItem("https://www.nitori-net.jp/ec/product/1/", "", f)).toEqual({ ok: false, reason: "not-found" })
  })

  it("商品名が取れずラベルも空なら、店の名前をラベルにする", async () => {
    const f = fetchOf({ "https://www.ikea.com/jp/ja/p/x/": () => new Response("", { status: 200 }) })
    const r = await resolveManualItem("https://www.ikea.com/jp/ja/p/x/", "", f)
    expect(r.ok && r.item.label).toBe("IKEA")
  })
})
