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

import { GEMINI_ENDPOINT } from "@/lib/gemini"

/** 3バイトの画像。base64では "AQID" になる */
const IMAGE_BYTES = new Uint8Array([1, 2, 3])
const IMAGE_DATA_URI = "data:image/jpeg;base64,AQID"

function imageResponse(contentType = "image/jpeg") {
  return new Response(IMAGE_BYTES, { status: 200, headers: { "Content-Type": contentType } })
}

function completionResponse(text: string) {
  return new Response(JSON.stringify({ choices: [{ message: { content: text } }] }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  })
}

/**
 * 画像URLの取得とGemini APIの2種類のfetchをまとめてスタブする。
 * Geminiは公開URLを取りに行かないため、ルートは画像を自前で取得してdata URI化する。
 * URLで行き先を振り分けないと、画像取得のレスポンスをAPIの応答として読んでしまう。
 */
function stubGemini(
  options: { content?: string; api?: Response; image?: Response } = {}
) {
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    if (String(input) === GEMINI_ENDPOINT) {
      return options.api ?? completionResponse(options.content ?? "[]")
    }
    return options.image ?? imageResponse()
  })
}

/** Geminiが content として text を返す成功レスポンス */
function stubGeminiContent(text: string) {
  return stubGemini({ content: text })
}

function geminiCallOf(spy: ReturnType<typeof stubGemini>) {
  const call = spy.mock.calls.find(([input]) => String(input) === GEMINI_ENDPOINT)
  if (!call) throw new Error("Gemini API が呼ばれていません")
  return call
}

function requestBodyOf(spy: ReturnType<typeof stubGemini>) {
  return JSON.parse(String(geminiCallOf(spy)[1]?.body))
}

beforeEach(() => {
  vi.mocked(createClient).mockReset()
  vi.stubEnv("ADMIN_EMAILS", ADMIN_EMAIL)
  vi.stubEnv("GEMINI_API_KEY", "test-gemini-key")
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co")
  stubLoggedInAs(ADMIN_EMAIL)
})

describe("POST /api/ai/suggest-b", () => {
  it("未ログインなら403を返しGeminiを呼ばない", async () => {
    stubLoggedInAs(null)
    const fetchSpy = vi.spyOn(globalThis, "fetch")

    const res = await suggestB(makeRequest({ image_url: "https://example.supabase.co/a.jpg" }))

    expect(res.status).toBe(403)
    await expect(res.json()).resolves.toEqual({ error: "forbidden" })
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it("ADMIN_EMAILSに含まれないユーザーなら403を返す", async () => {
    stubLoggedInAs("stranger@example.com")
    const fetchSpy = vi.spyOn(globalThis, "fetch")

    const res = await suggestB(makeRequest({ image_url: "https://example.supabase.co/a.jpg" }))

    expect(res.status).toBe(403)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it("ADMIN_EMAILSが未設定ならログイン済みでも403を返す", async () => {
    vi.stubEnv("ADMIN_EMAILS", "")
    const fetchSpy = vi.spyOn(globalThis, "fetch")

    const res = await suggestB(makeRequest({ image_url: "https://example.supabase.co/a.jpg" }))

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
      suggestB(makeRequest({ image_url: "https://example.supabase.co/a.jpg" }))
    ).rejects.toThrow("network down")
  })

  it("image_urlが無ければ400を返しGeminiを呼ばない", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch")

    const res = await suggestB(makeRequest({ area_name: "第1工具棚" }))

    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({ error: "image_url required" })
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it("GEMINI_API_KEYが未設定なら500を返しGeminiを呼ばない", async () => {
    vi.stubEnv("GEMINI_API_KEY", "")
    const fetchSpy = vi.spyOn(globalThis, "fetch")

    const res = await suggestB(makeRequest({ image_url: "https://example.supabase.co/a.jpg" }))

    expect(res.status).toBe(500)
    await expect(res.json()).resolves.toEqual({ error: "GEMINI_API_KEY not set" })
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it("画像URLとエリア名をGeminiへのプロンプトに載せて送る", async () => {
    const fetchSpy = stubGeminiContent("[]")

    await suggestB(
      makeRequest({ image_url: "https://example.supabase.co/a.jpg", area_name: "第1工具棚" })
    )

    // 1回目は画像の取得、2回目がGemini API
    expect(fetchSpy.mock.calls[0][0]).toBe("https://example.supabase.co/a.jpg")
    const [url, init] = geminiCallOf(fetchSpy)
    expect(url).toBe(GEMINI_ENDPOINT)
    expect(init?.headers).toMatchObject({ Authorization: "Bearer test-gemini-key" })
    const body = requestBodyOf(fetchSpy)
    expect(body.model).toBe("gemini-3.6-flash")
    const content = body.messages[0].content
    expect(content[0].text).toContain("第1工具棚")
    // 画像URLではなくdata URIとして送る（Geminiは公開URLを取りに行かない）
    expect(content[1]).toEqual({
      type: "image_url",
      image_url: { url: IMAGE_DATA_URI },
    })
  })

  it("GEMINI_MODELが設定されていればそのモデルを使う", async () => {
    vi.stubEnv("GEMINI_MODEL", "gemini-3.5-flash")
    const fetchSpy = stubGeminiContent("[]")

    await suggestB(makeRequest({ image_url: "https://example.supabase.co/a.jpg" }))

    expect(requestBodyOf(fetchSpy).model).toBe("gemini-3.5-flash")
  })

  it("画像の取得に失敗したら500を返しGemini APIは呼ばない", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    const fetchSpy = stubGemini({ image: new Response("not found", { status: 404 }) })

    const res = await suggestB(makeRequest({ image_url: "https://example.supabase.co/a.jpg" }))

    expect(res.status).toBe(500)
    await expect(res.json()).resolves.toEqual({ error: "gemini error" })
    expect(fetchSpy.mock.calls.some(([input]) => String(input) === GEMINI_ENDPOINT)).toBe(false)
  })

  it("画像でないURLを渡されたら500を返す", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    stubGemini({
      image: new Response("<html>", { status: 200, headers: { "Content-Type": "text/html" } }),
    })

    const res = await suggestB(makeRequest({ image_url: "https://example.supabase.co/a.jpg" }))

    expect(res.status).toBe(500)
    await expect(res.json()).resolves.toEqual({ error: "gemini error" })
  })

  it("area_nameが無ければプロンプトのエリア名は「不明」になる", async () => {
    const fetchSpy = stubGeminiContent("[]")

    await suggestB(makeRequest({ image_url: "https://example.supabase.co/a.jpg" }))

    expect(requestBodyOf(fetchSpy).messages[0].content[0].text).toContain("エリア名：不明")
  })

  it("Geminiがエラーステータスを返したら500を返す", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    stubGemini({ api: new Response("rate limited", { status: 429 }) })

    const res = await suggestB(makeRequest({ image_url: "https://example.supabase.co/a.jpg" }))

    expect(res.status).toBe(500)
    await expect(res.json()).resolves.toEqual({ error: "gemini error" })
  })

  it("JSON配列が返ればマーカー配列をそのまま返す", async () => {
    stubGeminiContent(
      '[{"x":0.3,"y":0.5,"category":"safety","comment":"通路に工具が置かれている"}]'
    )

    const res = await suggestB(makeRequest({ image_url: "https://example.supabase.co/a.jpg" }))

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({
      markers: [{ x: 0.3, y: 0.5, category: "safety", comment: "通路に工具が置かれている" }],
    })
  })

  it("コードフェンスや前後の説明文が付いていても中のJSON配列を取り出す", async () => {
    stubGeminiContent(
      '診断結果です。\n```json\n[{"x":0.1,"y":0.2,"category":"flow","comment":"動線が交差"}]\n```\nご確認ください。'
    )

    const res = await suggestB(makeRequest({ image_url: "https://example.supabase.co/a.jpg" }))

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({
      markers: [{ x: 0.1, y: 0.2, category: "flow", comment: "動線が交差" }],
    })
  })

  it("JSONでないテキストが返れば200で空のマーカー配列を返す", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    stubGeminiContent("申し訳ありませんが、この画像は診断できません。")

    const res = await suggestB(makeRequest({ image_url: "https://example.supabase.co/a.jpg" }))

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ markers: [] })
  })

  it("contentが空（choicesが無い）でも例外にせず空のマーカー配列を返す", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    stubGemini({
      api: new Response(JSON.stringify({ choices: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    })

    const res = await suggestB(makeRequest({ image_url: "https://example.supabase.co/a.jpg" }))

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ markers: [] })
  })

  it("配列の後に補足文が続いても先頭の配列を取り出せる", async () => {
    stubGeminiContent('[{"x":0.1,"y":0.2}]\nおまけ: [{"x":0.9,"y":0.9}]')

    const res = await suggestB(makeRequest({ image_url: "https://example.supabase.co/a.jpg" }))

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ markers: [{ x: 0.1, y: 0.2 }] })
  })

  it("マーカー1件がオブジェクト単体で返っても配列に包んで返す", async () => {
    stubGeminiContent('{"x":0.3,"y":0.5,"category":"safety","comment":"1件だけ"}')

    const res = await suggestB(makeRequest({ image_url: "https://example.supabase.co/a.jpg" }))

    expect(res.status).toBe(200)
    const json = (await res.json()) as { markers: unknown }
    expect(Array.isArray(json.markers)).toBe(true)
    expect(json.markers).toEqual([{ x: 0.3, y: 0.5, category: "safety", comment: "1件だけ" }])
  })
})

describe("POST /api/ai/suggest-c", () => {
  it("ADMIN_EMAILSに含まれないユーザーなら403を返しGeminiを呼ばない", async () => {
    stubLoggedInAs("stranger@example.com")
    const fetchSpy = vi.spyOn(globalThis, "fetch")

    const res = await suggestC(makeRequest({ room_image_url: "https://example.supabase.co/room.jpg" }))

    expect(res.status).toBe(403)
    await expect(res.json()).resolves.toEqual({ error: "forbidden" })
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it("未ログインなら403を返しGeminiを呼ばない", async () => {
    stubLoggedInAs(null)
    const fetchSpy = vi.spyOn(globalThis, "fetch")

    const res = await suggestC(makeRequest({ room_image_url: "https://example.supabase.co/room.jpg" }))

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

  it("GEMINI_API_KEYが未設定なら500を返す", async () => {
    vi.stubEnv("GEMINI_API_KEY", "")
    const fetchSpy = vi.spyOn(globalThis, "fetch")

    const res = await suggestC(makeRequest({ room_image_url: "https://example.supabase.co/room.jpg" }))

    expect(res.status).toBe(500)
    await expect(res.json()).resolves.toEqual({ error: "GEMINI_API_KEY not set" })
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it("片方の写真だけならその画像だけをcontentに含める", async () => {
    const fetchSpy = stubGeminiContent("[]")

    await suggestC(makeRequest({ storage_image_url: "https://example.supabase.co/storage.jpg" }))

    const content = requestBodyOf(fetchSpy).messages[0].content
    expect(content).toHaveLength(2)
    expect(content[1]).toEqual({ type: "image_url", image_url: { url: IMAGE_DATA_URI } })
    // 取得しに行った画像URLは収納写真だけ
    const imageFetches = fetchSpy.mock.calls
      .map(([input]) => String(input))
      .filter((url) => url !== GEMINI_ENDPOINT)
    expect(imageFetches).toEqual(["https://example.supabase.co/storage.jpg"])
  })

  it("両方の写真があれば部屋→収納の順にcontentに含める", async () => {
    const fetchSpy = stubGeminiContent("[]")

    await suggestC(
      makeRequest({
        room_image_url: "https://example.supabase.co/room.jpg",
        storage_image_url: "https://example.supabase.co/storage.jpg",
      })
    )

    const content = requestBodyOf(fetchSpy).messages[0].content
    expect(content).toHaveLength(3)
    expect(content[1].image_url.url).toBe(IMAGE_DATA_URI)
    expect(content[2].image_url.url).toBe(IMAGE_DATA_URI)
    // data URI では順序を判別できないため、取得順で部屋→収納を確認する
    const imageFetches = fetchSpy.mock.calls
      .map(([input]) => String(input))
      .filter((url) => url !== GEMINI_ENDPOINT)
    expect(imageFetches).toEqual([
      "https://example.supabase.co/room.jpg",
      "https://example.supabase.co/storage.jpg",
    ])
  })

  it("Geminiがエラーステータスを返したら500を返す", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    stubGemini({ api: new Response("boom", { status: 500 }) })

    const res = await suggestC(makeRequest({ room_image_url: "https://example.supabase.co/room.jpg" }))

    expect(res.status).toBe(500)
    await expect(res.json()).resolves.toEqual({ error: "gemini error" })
  })

  it("JSON配列が返ればimage_type付きのマーカー配列をそのまま返す", async () => {
    stubGeminiContent(
      '[{"image_type":"room","x":0.3,"y":0.5,"comment":"床に物が散乱"},' +
        '{"image_type":"storage","x":0.6,"y":0.4,"comment":"上段が使いにくい"}]'
    )

    const res = await suggestC(
      makeRequest({
        room_image_url: "https://example.supabase.co/room.jpg",
        storage_image_url: "https://example.supabase.co/storage.jpg",
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
    stubGeminiContent(
      '```json\n[{"image_type":"room","x":0.2,"y":0.2,"comment":"棚が空"}]\n```'
    )

    const res = await suggestC(makeRequest({ room_image_url: "https://example.supabase.co/room.jpg" }))

    await expect(res.json()).resolves.toEqual({
      markers: [{ image_type: "room", x: 0.2, y: 0.2, comment: "棚が空" }],
    })
  })

  it("JSONでないテキストが返れば200で空のマーカー配列を返す", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    stubGeminiContent("写真が暗すぎて判断できませんでした。")

    const res = await suggestC(makeRequest({ room_image_url: "https://example.supabase.co/room.jpg" }))

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ markers: [] })
  })
})
