import { beforeEach, describe, expect, it, vi } from "vitest"
import type { NextRequest } from "next/server"

type UpdateCall = { table: string; values: Record<string, unknown>; column: string; id: unknown }

const mocks = vi.hoisted(() => ({
  callGemini: vi.fn(),
  updateCalls: [] as UpdateCall[],
  updateResult: { error: null as unknown },
}))

vi.mock("@/lib/gemini", () => ({
  callGemini: mocks.callGemini,
  GeminiError: class GeminiError extends Error {},
}))

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: (table: string) => ({
      update: (values: Record<string, unknown>) => ({
        eq: async (column: string, id: unknown) => {
          mocks.updateCalls.push({ table, values, column, id })
          return mocks.updateResult
        },
      }),
    }),
  }),
}))

import { POST } from "./route"

function makeRequest(body: unknown): NextRequest {
  return { json: async () => body } as unknown as NextRequest
}

/** callGemini に渡された画像URL */
function imageUrlsOfLastCall(): string[] {
  const [args] = mocks.callGemini.mock.calls.at(-1) ?? []
  return args.imageUrls
}

function promptOfLastCall(): string {
  const [args] = mocks.callGemini.mock.calls.at(-1) ?? []
  return args.prompt
}

function maxTokensOfLastCall(): number | undefined {
  const [args] = mocks.callGemini.mock.calls.at(-1) ?? []
  return args.maxTokens
}

const validAnalyzeJson = JSON.stringify({
  reasoning: "動線上に使用頻度の高い物を置き直すと片付けが続きます。",
  suggestions: [{ target: "工具箱", location: "作業台下の棚", reason: "使う場所の近くに置く" }],
})

beforeEach(() => {
  mocks.callGemini.mockReset()
  mocks.updateCalls.length = 0
  mocks.updateResult.error = null
  vi.stubEnv("GEMINI_API_KEY", "test-gemini-key")
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co")
})

describe("POST /api/analyze のバリデーション", () => {
  it("suggestion_idが無ければ400を返しAIを呼ばない", async () => {
    const res = await POST(makeRequest({ room_image_url: "https://example.supabase.co/room.jpg" }))

    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({ error: "suggestion_id required" })
    expect(mocks.callGemini).not.toHaveBeenCalled()
    expect(mocks.updateCalls).toEqual([])
  })

  it("画像が両方nullなら400を返しAIを呼ばない", async () => {
    const res = await POST(
      makeRequest({ suggestion_id: "s-1", room_image_url: null, storage_image_url: null })
    )

    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({ error: "at least one image is required" })
    expect(mocks.callGemini).not.toHaveBeenCalled()
  })
})

describe("POST /api/analyze に渡す画像", () => {
  it("部屋写真だけでも解析でき、画像は1枚だけ渡る", async () => {
    mocks.callGemini.mockResolvedValue(validAnalyzeJson)

    const res = await POST(
      makeRequest({ suggestion_id: "s-1", room_image_url: "https://example.supabase.co/room.jpg" })
    )

    expect(res.status).toBe(200)
    expect(imageUrlsOfLastCall()).toEqual(["https://example.supabase.co/room.jpg"])
    expect(promptOfLastCall()).toContain("以下の画像（部屋全体）")
  })

  it("収納写真だけなら収納スペースの説明文で解析する", async () => {
    mocks.callGemini.mockResolvedValue(validAnalyzeJson)

    const res = await POST(
      makeRequest({ suggestion_id: "s-1", storage_image_url: "https://example.supabase.co/storage.jpg" })
    )

    expect(res.status).toBe(200)
    expect(imageUrlsOfLastCall()).toEqual(["https://example.supabase.co/storage.jpg"])
    expect(promptOfLastCall()).toContain("以下の画像（収納スペース）")
  })

  it("両方あれば部屋・収納の順に2枚渡る", async () => {
    mocks.callGemini.mockResolvedValue(validAnalyzeJson)

    await POST(
      makeRequest({
        suggestion_id: "s-1",
        room_image_url: "https://example.supabase.co/room.jpg",
        storage_image_url: "https://example.supabase.co/storage.jpg",
      })
    )

    expect(imageUrlsOfLastCall()).toEqual([
      "https://example.supabase.co/room.jpg",
      "https://example.supabase.co/storage.jpg",
    ])
    expect(promptOfLastCall()).toContain("以下の2枚の画像（部屋全体・収納スペース）")
  })
})

describe("POST /api/analyze の解析成功", () => {
  it("reasoning・storage_options・raw_json・status=done でsuggestionsを更新する", async () => {
    mocks.callGemini.mockResolvedValue(validAnalyzeJson)

    const res = await POST(
      makeRequest({ suggestion_id: "s-42", room_image_url: "https://example.supabase.co/room.jpg" })
    )

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ ok: true })
    expect(mocks.updateCalls).toEqual([
      {
        table: "suggestions",
        column: "id",
        id: "s-42",
        values: {
          reasoning: "動線上に使用頻度の高い物を置き直すと片付けが続きます。",
          storage_options: [
            { target: "工具箱", location: "作業台下の棚", reason: "使う場所の近くに置く" },
          ],
          raw_json: {
            reasoning: "動線上に使用頻度の高い物を置き直すと片付けが続きます。",
            suggestions: [
              { target: "工具箱", location: "作業台下の棚", reason: "使う場所の近くに置く" },
            ],
          },
          status: "done",
        },
      },
    ])
  })

  it("解析はDBへの1回の更新で完結する（画像生成の後続処理は無い）", async () => {
    mocks.callGemini.mockResolvedValue(validAnalyzeJson)

    await POST(makeRequest({ suggestion_id: "s-7", room_image_url: "https://example.supabase.co/room.jpg" }))

    // 完成イメージ画像の生成を廃止したので、analyzing のまま残る中間状態は無い
    expect(mocks.updateCalls).toHaveLength(1)
    expect(mocks.updateCalls[0].values.status).toBe("done")
  })

  it("```json で囲まれたレスポンスでもパースできる", async () => {
    mocks.callGemini.mockResolvedValue("```json\n" + validAnalyzeJson + "\n```")

    const res = await POST(
      makeRequest({ suggestion_id: "s-1", room_image_url: "https://example.supabase.co/room.jpg" })
    )

    expect(res.status).toBe(200)
    expect(mocks.updateCalls[0].values.status).toBe("done")
  })

  it("前置きが付いていてもパースできる（モデルは挨拶を足してくる）", async () => {
    mocks.callGemini.mockResolvedValue(
      "はい、こちらが分析結果です。\n```json\n" + validAnalyzeJson + "\n```"
    )

    const res = await POST(
      makeRequest({ suggestion_id: "s-1", room_image_url: "https://example.supabase.co/room.jpg" })
    )

    expect(res.status).toBe(200)
    expect(mocks.updateCalls[0].values.status).toBe("done")
  })

  it("JSONの後ろに補足文が続いていてもパースできる", async () => {
    mocks.callGemini.mockResolvedValue(validAnalyzeJson + "\n\n補足: 撮影時は照明を点けてください。")

    const res = await POST(
      makeRequest({ suggestion_id: "s-1", room_image_url: "https://example.supabase.co/room.jpg" })
    )

    expect(res.status).toBe(200)
    expect(mocks.updateCalls[0].values.reasoning).toBe(
      "動線上に使用頻度の高い物を置き直すと片付けが続きます。"
    )
  })

  it("思考トークンで本文が切れないよう max_tokens を指定して呼ぶ", async () => {
    mocks.callGemini.mockResolvedValue(validAnalyzeJson)

    await POST(makeRequest({ suggestion_id: "s-1", room_image_url: "https://example.supabase.co/room.jpg" }))

    expect(maxTokensOfLastCall()).toBe(4000)
  })

  it("raw_jsonにはreasoningとsuggestionsだけが残り、AIの余計なキーは保存されない", async () => {
    mocks.callGemini.mockResolvedValue(
      JSON.stringify({
        reasoning: "説明",
        suggestions: [{ target: "工具箱", location: "棚", reason: "近い" }],
        confidence: 0.4,
      })
    )

    await POST(makeRequest({ suggestion_id: "s-1", room_image_url: "https://example.supabase.co/room.jpg" }))

    expect(mocks.updateCalls[0].values.raw_json).toEqual({
      reasoning: "説明",
      suggestions: [{ target: "工具箱", location: "棚", reason: "近い" }],
    })
  })

  it("更新でDBエラーが返ったら500を返す", async () => {
    mocks.callGemini.mockResolvedValue(validAnalyzeJson)
    mocks.updateResult.error = { message: "permission denied" }
    vi.spyOn(console, "error").mockImplementation(() => {})

    const res = await POST(
      makeRequest({ suggestion_id: "s-1", room_image_url: "https://example.supabase.co/room.jpg" })
    )

    expect(res.status).toBe(500)
    await expect(res.json()).resolves.toEqual({ error: "update failed" })
  })
})

describe("POST /api/analyze の解析失敗", () => {
  it("AI呼び出しが例外を投げたらstatus=failedに更新して502を返す", async () => {
    mocks.callGemini.mockRejectedValue(new Error("gemini down"))
    vi.spyOn(console, "error").mockImplementation(() => {})

    const res = await POST(
      makeRequest({ suggestion_id: "s-9", room_image_url: "https://example.supabase.co/room.jpg" })
    )

    expect(res.status).toBe(502)
    await expect(res.json()).resolves.toEqual({ error: "analyze failed" })
    expect(mocks.updateCalls).toEqual([
      { table: "suggestions", column: "id", id: "s-9", values: { status: "failed" } },
    ])
  })

  it("AIがJSONでない文字列を返したらstatus=failedに更新して502を返す", async () => {
    mocks.callGemini.mockResolvedValue("すみません、画像を解析できません。")
    vi.spyOn(console, "error").mockImplementation(() => {})

    const res = await POST(
      makeRequest({ suggestion_id: "s-9", room_image_url: "https://example.supabase.co/room.jpg" })
    )

    expect(res.status).toBe(502)
    expect(mocks.updateCalls).toEqual([
      { table: "suggestions", column: "id", id: "s-9", values: { status: "failed" } },
    ])
  })

  it("suggestionsが配列でないJSONもfailedとして扱う", async () => {
    mocks.callGemini.mockResolvedValue(
      JSON.stringify({ reasoning: "説明", suggestions: "配列ではない" })
    )
    vi.spyOn(console, "error").mockImplementation(() => {})

    const res = await POST(
      makeRequest({ suggestion_id: "s-9", room_image_url: "https://example.supabase.co/room.jpg" })
    )

    expect(res.status).toBe(502)
    expect(mocks.updateCalls[0].values).toEqual({ status: "failed" })
  })

  it("reasoningが文字列でないJSONもfailedとして扱う", async () => {
    mocks.callGemini.mockResolvedValue(
      JSON.stringify({ reasoning: { text: "説明" }, suggestions: [] })
    )
    vi.spyOn(console, "error").mockImplementation(() => {})

    const res = await POST(
      makeRequest({ suggestion_id: "s-9", room_image_url: "https://example.supabase.co/room.jpg" })
    )

    expect(res.status).toBe(502)
    expect(mocks.updateCalls[0].values).toEqual({ status: "failed" })
  })

  it("JSON配列が返ってきた場合もfailedとして扱う", async () => {
    mocks.callGemini.mockResolvedValue("[]")
    vi.spyOn(console, "error").mockImplementation(() => {})

    const res = await POST(
      makeRequest({ suggestion_id: "s-9", room_image_url: "https://example.supabase.co/room.jpg" })
    )

    expect(res.status).toBe(502)
    expect(mocks.updateCalls[0].values).toEqual({ status: "failed" })
  })

  it("空文字が返ってcontentが取れない場合もfailedとして扱う", async () => {
    mocks.callGemini.mockResolvedValue("")
    vi.spyOn(console, "error").mockImplementation(() => {})

    const res = await POST(
      makeRequest({ suggestion_id: "s-9", room_image_url: "https://example.supabase.co/room.jpg" })
    )

    expect(res.status).toBe(502)
    expect(mocks.updateCalls[0].values).toEqual({ status: "failed" })
  })
})
