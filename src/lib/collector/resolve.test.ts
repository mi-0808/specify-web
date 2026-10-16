import { describe, expect, it, vi } from "vitest"
import { resolveProduct } from "./resolve"

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
      title: "白いデスク&収納",
      image: "https://shop.r10s.jp/desk.jpg",
    })
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
