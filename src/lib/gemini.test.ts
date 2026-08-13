import { beforeEach, describe, expect, it, vi } from "vitest"
import { callGemini, GEMINI_ENDPOINT, GeminiError, geminiModel } from "./gemini"

const ENDPOINT = GEMINI_ENDPOINT

const ORIGIN = "https://example.supabase.co"

function imageResponse(bytes: Uint8Array, contentType = "image/jpeg") {
  return new Response(bytes.buffer as ArrayBuffer, {
    status: 200,
    headers: { "Content-Type": contentType },
  })
}

/** URLごとに違うバイト列を返す（同一だとdata URIの並び順を検証できない） */
const IMAGE_BYTES: Record<string, Uint8Array> = {
  room: new Uint8Array([1, 2, 3]),
  storage: new Uint8Array([4, 5, 6]),
}
const ROOM_DATA_URI = "data:image/jpeg;base64,AQID"
const STORAGE_DATA_URI = "data:image/jpeg;base64,BAUG"

function completionResponse(text: string) {
  return new Response(JSON.stringify({ choices: [{ message: { content: text } }] }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  })
}

/** 画像取得とAPI呼び出しをURLで振り分けるfetchスタブ */
function stubFetch(options: { api?: Response; image?: () => Response } = {}) {
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = String(input)
    if (url === ENDPOINT) return options.api ?? completionResponse("ok")
    if (options.image) return options.image()
    return imageResponse(url.includes("storage") ? IMAGE_BYTES.storage : IMAGE_BYTES.room)
  })
}

beforeEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
  vi.stubEnv("GEMINI_API_KEY", "test-gemini-key")
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", ORIGIN)
})

describe("geminiModel", () => {
  it("GEMINI_MODELが未設定なら gemini-3.6-flash を使う", () => {
    vi.stubEnv("GEMINI_MODEL", "")
    expect(geminiModel()).toBe("gemini-3.6-flash")
  })

  it("GEMINI_MODELが設定されていればそれを使う", () => {
    vi.stubEnv("GEMINI_MODEL", "gemini-3.5-flash")
    expect(geminiModel()).toBe("gemini-3.5-flash")
  })
})

describe("callGemini", () => {
  it("APIキーが無ければGeminiErrorを投げ、fetchしない", async () => {
    vi.stubEnv("GEMINI_API_KEY", "")
    const fetchSpy = vi.spyOn(globalThis, "fetch")

    await expect(callGemini({ prompt: "test" })).rejects.toThrow(GeminiError)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it("画像が無ければテキストパートだけを送る", async () => {
    const fetchSpy = stubFetch()

    await callGemini({ prompt: "こんにちは" })

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const body = JSON.parse(String(fetchSpy.mock.calls[0][1]?.body))
    expect(body.messages[0].content).toEqual([{ type: "text", text: "こんにちは" }])
    expect(body.max_tokens).toBeUndefined()
  })

  it("画像を取得してdata URIに変換して送る", async () => {
    const fetchSpy = stubFetch()

    await callGemini({ prompt: "p", imageUrls: ["https://example.supabase.co/a.jpg"] })

    const body = JSON.parse(String(fetchSpy.mock.calls.at(-1)?.[1]?.body))
    expect(body.messages[0].content[1]).toEqual({
      type: "image_url",
      image_url: { url: "data:image/jpeg;base64,AQID" },
    })
  })

  it("Content-Typeのcharsetはdata URIに持ち込まない", async () => {
    const fetchSpy = stubFetch({
      image: () => imageResponse(new Uint8Array([1, 2, 3]), "image/png; charset=binary"),
    })

    await callGemini({ prompt: "p", imageUrls: ["https://example.supabase.co/a.png"] })

    const body = JSON.parse(String(fetchSpy.mock.calls.at(-1)?.[1]?.body))
    expect(body.messages[0].content[1].image_url.url).toBe("data:image/png;base64,AQID")
  })

  it("画像は渡された順にcontentへ並ぶ", async () => {
    const fetchSpy = stubFetch()

    await callGemini({
      prompt: "p",
      imageUrls: ["https://example.supabase.co/room.jpg", "https://example.supabase.co/storage.jpg"],
    })

    const body = JSON.parse(String(fetchSpy.mock.calls.at(-1)?.[1]?.body))
    // data URI が画像ごとに違うので、並び替わっていれば検出できる
    expect(body.messages[0].content).toEqual([
      { type: "text", text: "p" },
      { type: "image_url", image_url: { url: ROOM_DATA_URI } },
      { type: "image_url", image_url: { url: STORAGE_DATA_URI } },
    ])
  })

  it("許可オリジン外のURLはfetchせずGeminiErrorになる（SSRF対策）", async () => {
    const fetchSpy = stubFetch()

    await expect(
      callGemini({ prompt: "p", imageUrls: ["http://169.254.169.254/latest/meta-data/"] })
    ).rejects.toThrow(GeminiError)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it("URLとして解釈できない文字列もfetchせずGeminiErrorになる", async () => {
    const fetchSpy = stubFetch()

    await expect(callGemini({ prompt: "p", imageUrls: ["not a url"] })).rejects.toThrow(GeminiError)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it("NEXT_PUBLIC_SUPABASE_URLが未設定なら画像を取得しない", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "")
    const fetchSpy = stubFetch()

    await expect(
      callGemini({ prompt: "p", imageUrls: ["https://example.supabase.co/a.jpg"] })
    ).rejects.toThrow(GeminiError)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it("画像取得はリダイレクトを追わず、タイムアウトを設定する", async () => {
    const fetchSpy = stubFetch()

    await callGemini({ prompt: "p", imageUrls: ["https://example.supabase.co/a.jpg"] })

    const init = fetchSpy.mock.calls[0][1]
    expect(init?.redirect).toBe("error")
    expect(init?.signal).toBeInstanceOf(AbortSignal)
  })

  it("Content-Lengthが上限超過を申告していればボディを読まずに弾く", async () => {
    stubFetch({
      image: () =>
        new Response(new Uint8Array([1, 2, 3]).buffer as ArrayBuffer, {
          status: 200,
          headers: { "Content-Type": "image/jpeg", "Content-Length": String(50 * 1024 * 1024) },
        }),
    })

    await expect(
      callGemini({ prompt: "p", imageUrls: ["https://example.supabase.co/big.jpg"] })
    ).rejects.toThrow(GeminiError)
  })

  it("maxTokensを渡すとmax_tokensとして送る", async () => {
    const fetchSpy = stubFetch()

    await callGemini({ prompt: "p", maxTokens: 2000 })

    expect(JSON.parse(String(fetchSpy.mock.calls[0][1]?.body)).max_tokens).toBe(2000)
  })

  it("画像の取得に失敗したらGeminiErrorを投げ、APIは呼ばない", async () => {
    const fetchSpy = stubFetch({ image: () => new Response("not found", { status: 404 }) })

    await expect(
      callGemini({ prompt: "p", imageUrls: ["https://example.supabase.co/a.jpg"] })
    ).rejects.toThrow(GeminiError)
    expect(fetchSpy.mock.calls.some(([input]) => String(input) === ENDPOINT)).toBe(false)
  })

  it("画像でないContent-TypeならGeminiErrorを投げる", async () => {
    stubFetch({
      image: () =>
        new Response("<html>", { status: 200, headers: { "Content-Type": "text/html" } }),
    })

    await expect(
      callGemini({ prompt: "p", imageUrls: ["https://example.supabase.co/a.jpg"] })
    ).rejects.toThrow(GeminiError)
  })

  it("7MBを超える画像はGeminiErrorになる（リクエスト20MB制限を超えないため）", async () => {
    stubFetch({ image: () => imageResponse(new Uint8Array(7 * 1024 * 1024 + 1)) })

    await expect(
      callGemini({ prompt: "p", imageUrls: ["https://example.supabase.co/big.jpg"] })
    ).rejects.toThrow(GeminiError)
  })

  it("Content-Lengthを申告しない巨大なボディも読み切らずに打ち切る", async () => {
    const CHUNK = new Uint8Array(1024 * 1024)
    let sent = 0
    // 際限なく流し続けるストリーム。上限で打ち切らないと止まらない
    const endless = new ReadableStream<Uint8Array>({
      pull(controller) {
        sent += CHUNK.byteLength
        controller.enqueue(CHUNK)
      },
    })
    stubFetch({
      image: () =>
        new Response(endless, { status: 200, headers: { "Content-Type": "image/jpeg" } }),
    })

    await expect(
      callGemini({ prompt: "p", imageUrls: ["https://example.supabase.co/endless.jpg"] })
    ).rejects.toThrow(GeminiError)
    // 上限（7MB）付近で止まっているはず。読み切っていれば青天井に増える
    expect(sent).toBeLessThan(16 * 1024 * 1024)
  })

  it("APIがエラーステータスを返したらGeminiErrorを投げる", async () => {
    stubFetch({ api: new Response("bad request", { status: 400 }) })

    await expect(callGemini({ prompt: "p" })).rejects.toThrow(GeminiError)
  })

  it("429/503は1回だけリトライし、成功したら結果を返す", async () => {
    vi.useFakeTimers()
    vi.spyOn(console, "warn").mockImplementation(() => {})
    let apiCalls = 0
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
      apiCalls++
      return apiCalls === 1
        ? new Response("overloaded", { status: 503 })
        : completionResponse("recovered")
    })

    const promise = callGemini({ prompt: "p" })
    await vi.runAllTimersAsync()
    await expect(promise).resolves.toBe("recovered")
    expect(apiCalls).toBe(2)
    vi.useRealTimers()
  })

  it("リトライも429/503ならGeminiErrorを投げる（fetchは2回まで）", async () => {
    vi.useFakeTimers()
    vi.spyOn(console, "warn").mockImplementation(() => {})
    let apiCalls = 0
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
      apiCalls++
      return new Response("rate limited", { status: 429 })
    })

    const promise = callGemini({ prompt: "p" })
    promise.catch(() => {}) // 未処理拒否の警告を避ける（検証は下のexpectで行う）
    await vi.runAllTimersAsync()
    await expect(promise).rejects.toThrow(GeminiError)
    expect(apiCalls).toBe(2)
    vi.useRealTimers()
  })

  it("choicesが空でも例外にせず空文字を返す", async () => {
    stubFetch({
      api: new Response(JSON.stringify({ choices: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    })

    await expect(callGemini({ prompt: "p" })).resolves.toBe("")
  })

  it("max_tokens打ち切り（finish_reason=length）は警告を残す", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    stubFetch({
      api: new Response(
        JSON.stringify({ choices: [{ finish_reason: "length", message: { content: '{"ok"' } }] }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      ),
    })

    await expect(callGemini({ prompt: "p" })).resolves.toBe('{"ok"')
    expect(warn).toHaveBeenCalled()
  })

  it("Authorizationヘッダにキーを載せて送る", async () => {
    const fetchSpy = stubFetch()

    await callGemini({ prompt: "p" })

    expect(fetchSpy.mock.calls[0][1]?.headers).toMatchObject({
      Authorization: "Bearer test-gemini-key",
    })
  })
})
