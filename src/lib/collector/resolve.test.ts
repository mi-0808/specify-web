import { describe, expect, it, vi } from "vitest"
import { resolveProduct } from "./resolve"
import { amazonLink } from "./shops"

describe("amazonLink", () => {
  it("Amazon の商品ページは、クリエイターのタグを外して Specify のタグだけの短いリンクにする", () => {
    expect(amazonLink("https://www.amazon.co.jp/白いデスク/dp/B0ABCDE123/ref=sr_1?tag=creator-22&linkCode=ll1", "specify-22")).toBe(
      "https://www.amazon.co.jp/dp/B0ABCDE123?tag=specify-22",
    )
    expect(amazonLink("https://amazon.co.jp/gp/product/B0ABCDE123", "specify-22")).toBe(
      "https://www.amazon.co.jp/dp/B0ABCDE123?tag=specify-22",
    )
  })

  it("商品ページ以外は、行き先はそのままでタグだけ替える", () => {
    expect(amazonLink("https://www.amazon.co.jp/s?k=desk&tag=creator-22&linkId=x", "specify-22")).toBe(
      "https://www.amazon.co.jp/s?k=desk&tag=specify-22",
    )
  })

  it("Amazon 以外と、タグが設定されていないときは null", () => {
    expect(amazonLink("https://item.rakuten.co.jp/shop/desk/", "specify-22")).toBeNull()
    expect(amazonLink("https://www.amazon.co.jp/dp/B0ABCDE123", undefined)).toBeNull()
    expect(amazonLink("https://www.amazon.co.jp/dp/B0ABCDE123", "")).toBeNull()
  })
})

type Route = { status: number; location?: string; html?: string }

const fakeFetch = (routes: Record<string, Route>) =>
  vi.fn(async (input: URL | RequestInfo) => {
    const route = routes[String(input)]
    if (!route) throw new Error(`unexpected fetch: ${String(input)}`)
    return new Response(route.html ?? null, {
      status: route.status,
      headers: route.location ? { location: route.location } : { "content-type": "text/html; charset=utf-8" },
    })
  }) as unknown as typeof fetch

describe("resolveProduct", () => {
  it("短縮URL → アフィリエイト → 商品ページとたどり、名前と写真を取る", async () => {
    const fetch = fakeFetch({
      "https://a.r10.to/abc": { status: 301, location: "https://hb.afl.rakuten.co.jp/ichiba/x" },
      "https://hb.afl.rakuten.co.jp/ichiba/x": { status: 302, location: "https://item.rakuten.co.jp/shop/desk/" },
      "https://item.rakuten.co.jp/shop/desk/": {
        status: 200,
        html: '<meta content="【楽天市場】【ポイント5倍】＼激安！／[お買い物マラソン! 10/14] 白いデスク&amp;収納：家具のお店" property="og:title"><meta property="og:image" content="https://shop.r10s.jp/desk.jpg">',
      },
    })
    expect(await resolveProduct("https://a.r10.to/abc", fetch)).toEqual({
      host: "item.rakuten.co.jp",
      url: "https://item.rakuten.co.jp/shop/desk/",
      title: "白いデスク&収納",
      image: "https://shop.r10s.jp/desk.jpg",
    })
  })

  it("店の中でさらに転送されても、最初にたどり着いた商品の URL を返す", async () => {
    const fetch = fakeFetch({
      "https://amzn.to/abc": { status: 301, location: "https://www.amazon.co.jp/dp/B0ABCDE123?tag=creator-22" },
      "https://www.amazon.co.jp/dp/B0ABCDE123?tag=creator-22": { status: 302, location: "https://www.amazon.co.jp/errors/validateCaptcha" },
      "https://www.amazon.co.jp/errors/validateCaptcha": { status: 200, html: '<meta property="og:title" content="Amazon">' },
    })
    expect(await resolveProduct("https://amzn.to/abc", fetch)).toEqual({
      host: "www.amazon.co.jp",
      url: "https://www.amazon.co.jp/dp/B0ABCDE123?tag=creator-22",
      title: null,
      image: null,
    })
  })

  it("商品名の記号（&times; &#215; &amp;lt; など）を文字に戻す", async () => {
    const fetch = fakeFetch({
      "https://item.rakuten.co.jp/shop/mirror/": {
        status: 200,
        html: '<meta property="og:title" content="ミラー 幅12.5&times;奥行3&#215;高さ120cm &amp;lt;木製&amp;gt; &#x2605;">',
      },
    })
    expect((await resolveProduct("https://item.rakuten.co.jp/shop/mirror/", fetch))?.title).toBe(
      "ミラー 幅12.5×奥行3×高さ120cm &lt;木製&gt; ★",
    )
  })

  it("許可リストの外の URL には取りに行かない", async () => {
    const fetch = fakeFetch({})
    expect(await resolveProduct("https://www.instagram.com/someone", fetch)).toBeNull()
    expect(await resolveProduct("http://item.rakuten.co.jp/shop/desk/", fetch)).toBeNull()
    expect(await resolveProduct("https://169.254.169.254/latest/meta-data", fetch)).toBeNull()
    expect(await resolveProduct("https://room.rakuten.co.jp/someone/items", fetch)).toBeNull() // 人のおすすめ一覧
    expect(fetch).not.toHaveBeenCalled()
  })

  it("転送の途中で許可リストの外に出たら、そこで止める", async () => {
    const fetch = fakeFetch({
      "https://amzn.to/abc": { status: 301, location: "http://127.0.0.1:8080/admin" },
    })
    expect(await resolveProduct("https://amzn.to/abc", fetch)).toBeNull()
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it("転送専用の先で止まったら出さない", async () => {
    const fetch = fakeFetch({ "https://amzn.to/abc": { status: 404 } })
    expect(await resolveProduct("https://amzn.to/abc", fetch)).toBeNull()
  })
})
