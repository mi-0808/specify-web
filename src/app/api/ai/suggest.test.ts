import { beforeEach, describe, expect, it, vi } from "vitest"
import type { NextRequest } from "next/server"
import { POST as suggestB } from "./suggest-b/route"
import { POST as suggestC } from "./suggest-c/route"
import { createClient } from "@/lib/supabase/server"

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }))

const ADMIN_EMAIL = "admin@example.com"

function makeRequest(body: unknown): NextRequest {
  return { json: async () => body } as unknown as NextRequest
}

function stubLoggedInAs(email: string | null) {
  vi.mocked(createClient).mockResolvedValue({
    auth: {
      getUser: async () => ({ data: { user: email ? { email } : null } }),
    },
  } as unknown as Awaited<ReturnType<typeof createClient>>)
}

/** OpenRouter が content として text を返す成功レスポンス */
function stubOpenRouterContent(text: string) {
  return vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify({ choices: [{ message: { content: text } }] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  )
}

function requestBodyOf(spy: ReturnType<typeof stubOpenRouterContent>) {
  return JSON.parse(String(spy.mock.calls[0][1]?.body))
}

beforeEach(() => {
  vi.mocked(createClient).mockReset()
  vi.stubEnv("ADMIN_EMAILS", ADMIN_EMAIL)
  vi.stubEnv("OPENROUTER_API_KEY", "test-openrouter-key")
  stubLoggedInAs(ADMIN_EMAIL)
})

describe("POST /api/ai/suggest-b", () => {
  it("未ログインなら403を返しOpenRouterを呼ばない", async () => {
    stubLoggedInAs(null)
    const fetchSpy = vi.spyOn(globalThis, "fetch")

    const res = await suggestB(makeRequest({ image_url: "https://example.com/a.jpg" }))

    expect(res.status).toBe(403)
    await expect(res.json()).resolves.toEqual({ error: "forbidden" })
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it("ADMIN_EMAILSに含まれないユーザーなら403を返す", async () => {
    stubLoggedInAs("stranger@example.com")
    const fetchSpy = vi.spyOn(globalThis, "fetch")

    const res = await suggestB(makeRequest({ image_url: "https://example.com/a.jpg" }))

    expect(res.status).toBe(403)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it("ADMIN_EMAILSが未設定ならログイン済みでも403を返す", async () => {
    vi.stubEnv("ADMIN_EMAILS", "")
    const fetchSpy = vi.spyOn(globalThis, "fetch")

    const res = await suggestB(makeRequest({ image_url: "https://example.com/a.jpg" }))

    expect(res.status).toBe(403)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it("image_urlが空文字なら400を返す", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch")

    const res = await suggestB(makeRequest({ image_url: "" }))

    expect(res.status).toBe(400)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it("権限チェックはボディのパースより先に行われる（不正ボディでも403）", async () => {
    stubLoggedInAs("stranger@example.com")

    const res = await suggestB({
      json: async () => {
        throw new SyntaxError("Unexpected end of JSON input")
      },
    } as unknown as NextRequest)

    expect(res.status).toBe(403)
  })

  it("管理者の不正なリクエストボディは捕捉されず例外が伝播する（現状の実装）", async () => {
    await expect(
      suggestB({
        json: async () => {
          throw new SyntaxError("Unexpected end of JSON input")
        },
      } as unknown as NextRequest)
    ).rejects.toThrow(SyntaxError)
  })

  it("fetch自体が失敗した場合は捕捉されず例外が伝播する（現状の実装）", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network down"))

    await expect(
      suggestB(makeRequest({ image_url: "https://example.com/a.jpg" }))
    ).rejects.toThrow("network down")
  })

  it("image_urlが無ければ400を返しOpenRouterを呼ばない", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch")

    const res = await suggestB(makeRequest({ area_name: "第1工具棚" }))

    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({ error: "image_url required" })
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it("OPENROUTER_API_KEYが未設定なら500を返しOpenRouterを呼ばない", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "")
    const fetchSpy = vi.spyOn(globalThis, "fetch")

    const res = await suggestB(makeRequest({ image_url: "https://example.com/a.jpg" }))

    expect(res.status).toBe(500)
    await expect(res.json()).resolves.toEqual({ error: "OPENROUTER_API_KEY not set" })
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it("画像URLとエリア名をOpenRouterへのプロンプトに載せて送る", async () => {
    const fetchSpy = stubOpenRouterContent("[]")

    await suggestB(
      makeRequest({ image_url: "https://example.com/a.jpg", area_name: "第1工具棚" })
    )

    const [url, init] = fetchSpy.mock.calls[0]
    expect(url).toBe("https://openrouter.ai/api/v1/chat/completions")
    expect(init?.headers).toMatchObject({ Authorization: "Bearer test-openrouter-key" })
    const body = requestBodyOf(fetchSpy)
    const content = body.messages[0].content
    expect(content[0].text).toContain("第1工具棚")
    expect(content[1]).toEqual({
      type: "image_url",
      image_url: { url: "https://example.com/a.jpg" },
    })
  })

  it("area_nameが無ければプロンプトのエリア名は「不明」になる", async () => {
    const fetchSpy = stubOpenRouterContent("[]")

    await suggestB(makeRequest({ image_url: "https://example.com/a.jpg" }))

    expect(requestBodyOf(fetchSpy).messages[0].content[0].text).toContain("エリア名：不明")
  })

  it("OpenRouterがエラーステータスを返したら500を返す", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("rate limited", { status: 429 })
    )

    const res = await suggestB(makeRequest({ image_url: "https://example.com/a.jpg" }))

    expect(res.status).toBe(500)
    await expect(res.json()).resolves.toEqual({ error: "openrouter error" })
  })

  it("JSON配列が返ればマーカー配列をそのまま返す", async () => {
    stubOpenRouterContent(
      '[{"x":0.3,"y":0.5,"category":"safety","comment":"通路に工具が置かれている"}]'
    )

    const res = await suggestB(makeRequest({ image_url: "https://example.com/a.jpg" }))

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({
      markers: [{ x: 0.3, y: 0.5, category: "safety", comment: "通路に工具が置かれている" }],
    })
  })

  it("コードフェンスや前後の説明文が付いていても中のJSON配列を取り出す", async () => {
    stubOpenRouterContent(
      '診断結果です。\n```json\n[{"x":0.1,"y":0.2,"category":"flow","comment":"動線が交差"}]\n```\nご確認ください。'
    )

    const res = await suggestB(makeRequest({ image_url: "https://example.com/a.jpg" }))

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({
      markers: [{ x: 0.1, y: 0.2, category: "flow", comment: "動線が交差" }],
    })
  })

  it("JSONでないテキストが返れば200で空のマーカー配列を返す", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    stubOpenRouterContent("申し訳ありませんが、この画像は診断できません。")

    const res = await suggestB(makeRequest({ image_url: "https://example.com/a.jpg" }))

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ markers: [] })
  })

  it("contentが空（choicesが無い）でも例外にせず空のマーカー配列を返す", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ choices: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    )

    const res = await suggestB(makeRequest({ image_url: "https://example.com/a.jpg" }))

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ markers: [] })
  })

  it("配列の後に補足文が続いても先頭の配列を取り出せる", async () => {
    stubOpenRouterContent('[{"x":0.1,"y":0.2}]\nおまけ: [{"x":0.9,"y":0.9}]')

    const res = await suggestB(makeRequest({ image_url: "https://example.com/a.jpg" }))

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ markers: [{ x: 0.1, y: 0.2 }] })
  })

  it("マーカー1件がオブジェクト単体で返っても配列に包んで返す", async () => {
    stubOpenRouterContent('{"x":0.3,"y":0.5,"category":"safety","comment":"1件だけ"}')

    const res = await suggestB(makeRequest({ image_url: "https://example.com/a.jpg" }))

    expect(res.status).toBe(200)
    const json = (await res.json()) as { markers: unknown }
    expect(Array.isArray(json.markers)).toBe(true)
    expect(json.markers).toEqual([{ x: 0.3, y: 0.5, category: "safety", comment: "1件だけ" }])
  })
})

describe("POST /api/ai/suggest-c", () => {
  it("ADMIN_EMAILSに含まれないユーザーなら403を返しOpenRouterを呼ばない", async () => {
    stubLoggedInAs("stranger@example.com")
    const fetchSpy = vi.spyOn(globalThis, "fetch")

    const res = await suggestC(makeRequest({ room_image_url: "https://example.com/room.jpg" }))

    expect(res.status).toBe(403)
    await expect(res.json()).resolves.toEqual({ error: "forbidden" })
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it("未ログインなら403を返しOpenRouterを呼ばない", async () => {
    stubLoggedInAs(null)
    const fetchSpy = vi.spyOn(globalThis, "fetch")

    const res = await suggestC(makeRequest({ room_image_url: "https://example.com/room.jpg" }))

    expect(res.status).toBe(403)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it("両方の画像URLが空文字なら400を返す", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch")

    const res = await suggestC(makeRequest({ room_image_url: "", storage_image_url: "" }))

    expect(res.status).toBe(400)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it("部屋写真も収納写真も無ければ400を返す", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch")

    const res = await suggestC(makeRequest({}))

    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({ error: "image_url required" })
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it("OPENROUTER_API_KEYが未設定なら500を返す", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "")
    const fetchSpy = vi.spyOn(globalThis, "fetch")

    const res = await suggestC(makeRequest({ room_image_url: "https://example.com/room.jpg" }))

    expect(res.status).toBe(500)
    await expect(res.json()).resolves.toEqual({ error: "OPENROUTER_API_KEY not set" })
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it("片方の写真だけならその画像だけをcontentに含める", async () => {
    const fetchSpy = stubOpenRouterContent("[]")

    await suggestC(makeRequest({ storage_image_url: "https://example.com/storage.jpg" }))

    const content = requestBodyOf(fetchSpy).messages[0].content
    expect(content).toHaveLength(2)
    expect(content[1]).toEqual({
      type: "image_url",
      image_url: { url: "https://example.com/storage.jpg" },
    })
  })

  it("両方の写真があれば部屋→収納の順にcontentに含める", async () => {
    const fetchSpy = stubOpenRouterContent("[]")

    await suggestC(
      makeRequest({
        room_image_url: "https://example.com/room.jpg",
        storage_image_url: "https://example.com/storage.jpg",
      })
    )

    const content = requestBodyOf(fetchSpy).messages[0].content
    expect(content).toHaveLength(3)
    expect(content[1].image_url.url).toBe("https://example.com/room.jpg")
    expect(content[2].image_url.url).toBe("https://example.com/storage.jpg")
  })

  it("OpenRouterがエラーステータスを返したら500を返す", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("boom", { status: 500 }))

    const res = await suggestC(makeRequest({ room_image_url: "https://example.com/room.jpg" }))

    expect(res.status).toBe(500)
    await expect(res.json()).resolves.toEqual({ error: "openrouter error" })
  })

  it("JSON配列が返ればimage_type付きのマーカー配列をそのまま返す", async () => {
    stubOpenRouterContent(
      '[{"image_type":"room","x":0.3,"y":0.5,"comment":"床に物が散乱"},' +
        '{"image_type":"storage","x":0.6,"y":0.4,"comment":"上段が使いにくい"}]'
    )

    const res = await suggestC(
      makeRequest({
        room_image_url: "https://example.com/room.jpg",
        storage_image_url: "https://example.com/storage.jpg",
      })
    )

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({
      markers: [
        { image_type: "room", x: 0.3, y: 0.5, comment: "床に物が散乱" },
        { image_type: "storage", x: 0.6, y: 0.4, comment: "上段が使いにくい" },
      ],
    })
  })

  it("コードフェンス付きJSONでも中身を取り出せる", async () => {
    stubOpenRouterContent(
      '```json\n[{"image_type":"room","x":0.2,"y":0.2,"comment":"棚が空"}]\n```'
    )

    const res = await suggestC(makeRequest({ room_image_url: "https://example.com/room.jpg" }))

    await expect(res.json()).resolves.toEqual({
      markers: [{ image_type: "room", x: 0.2, y: 0.2, comment: "棚が空" }],
    })
  })

  it("JSONでないテキストが返れば200で空のマーカー配列を返す", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    stubOpenRouterContent("写真が暗すぎて判断できませんでした。")

    const res = await suggestC(makeRequest({ room_image_url: "https://example.com/room.jpg" }))

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ markers: [] })
  })
})
