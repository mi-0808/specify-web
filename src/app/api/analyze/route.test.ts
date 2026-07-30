import { beforeEach, describe, expect, it, vi } from "vitest"
import type { NextRequest } from "next/server"

type UpdateCall = { table: string; values: Record<string, unknown>; column: string; id: unknown }

const mocks = vi.hoisted(() => ({
  createCompletion: vi.fn(),
  generateResultImage: vi.fn(),
  updateCalls: [] as UpdateCall[],
  updateResult: { error: null as unknown },
  afterCallbacks: [] as (() => unknown)[],
}))

vi.mock("openai", () => ({
  default: class FakeOpenAI {
    chat = { completions: { create: mocks.createCompletion } }
  },
}))

vi.mock("@/lib/result-image", () => ({
  generateResultImage: mocks.generateResultImage,
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

vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>()
  return {
    ...actual,
    after: (callback: () => unknown) => {
      mocks.afterCallbacks.push(callback)
    },
  }
})

import { POST } from "./route"

function makeRequest(body: unknown): NextRequest {
  return { json: async () => body } as unknown as NextRequest
}

function completionOf(content: string) {
  return { choices: [{ message: { content } }] }
}

/** OpenAIに渡された content のうち画像パートだけを取り出す */
function imagePartsOfLastCall(): { type: string; image_url: { url: string } }[] {
  const [args] = mocks.createCompletion.mock.calls.at(-1) ?? []
  const content = args.messages[0].content as { type: string; image_url: { url: string } }[]
  return content.filter((part) => part.type === "image_url")
}

function textOfLastCall(): string {
  const [args] = mocks.createCompletion.mock.calls.at(-1) ?? []
  const content = args.messages[0].content as { type: string; text?: string }[]
  return content.find((part) => part.type === "text")?.text ?? ""
}

const validAnalyzeJson = JSON.stringify({
  reasoning: "動線上に使用頻度の高い物を置き直すと片付けが続きます。",
  suggestions: [{ target: "工具箱", location: "作業台下の棚", reason: "使う場所の近くに置く" }],
})

beforeEach(() => {
  mocks.createCompletion.mockReset()
  mocks.generateResultImage.mockReset()
  mocks.generateResultImage.mockResolvedValue(undefined)
  mocks.updateCalls.length = 0
  mocks.updateResult.error = null
  mocks.afterCallbacks.length = 0
  vi.stubEnv("OPENAI_API_KEY", "test-key")
})

describe("POST /api/analyze のバリデーション", () => {
  it("suggestion_idが無ければ400を返しAIを呼ばない", async () => {
    const res = await POST(makeRequest({ room_image_url: "https://example.com/room.jpg" }))

    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({ error: "suggestion_id required" })
    expect(mocks.createCompletion).not.toHaveBeenCalled()
    expect(mocks.updateCalls).toEqual([])
  })

  it("画像が両方nullなら400を返しAIを呼ばない", async () => {
    const res = await POST(
      makeRequest({ suggestion_id: "s-1", room_image_url: null, storage_image_url: null })
    )

    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({ error: "at least one image is required" })
    expect(mocks.createCompletion).not.toHaveBeenCalled()
  })
})

describe("POST /api/analyze に渡す画像", () => {
  it("部屋写真だけでも解析でき、画像パートは1つになる", async () => {
    mocks.createCompletion.mockResolvedValue(completionOf(validAnalyzeJson))

    const res = await POST(
      makeRequest({ suggestion_id: "s-1", room_image_url: "https://example.com/room.jpg" })
    )

    expect(res.status).toBe(200)
    expect(imagePartsOfLastCall()).toEqual([
      { type: "image_url", image_url: { url: "https://example.com/room.jpg" } },
    ])
    expect(textOfLastCall()).toContain("以下の画像（部屋全体）")
  })

  it("収納写真だけなら収納スペースの説明文で解析する", async () => {
    mocks.createCompletion.mockResolvedValue(completionOf(validAnalyzeJson))

    const res = await POST(
      makeRequest({ suggestion_id: "s-1", storage_image_url: "https://example.com/storage.jpg" })
    )

    expect(res.status).toBe(200)
    expect(imagePartsOfLastCall()).toEqual([
      { type: "image_url", image_url: { url: "https://example.com/storage.jpg" } },
    ])
    expect(textOfLastCall()).toContain("以下の画像（収納スペース）")
  })

  it("両方あれば画像パートは部屋・収納の順に2つ渡る", async () => {
    mocks.createCompletion.mockResolvedValue(completionOf(validAnalyzeJson))

    await POST(
      makeRequest({
        suggestion_id: "s-1",
        room_image_url: "https://example.com/room.jpg",
        storage_image_url: "https://example.com/storage.jpg",
      })
    )

    expect(imagePartsOfLastCall()).toEqual([
      { type: "image_url", image_url: { url: "https://example.com/room.jpg" } },
      { type: "image_url", image_url: { url: "https://example.com/storage.jpg" } },
    ])
    expect(textOfLastCall()).toContain("以下の2枚の画像（部屋全体・収納スペース）")
  })
})

describe("POST /api/analyze の解析成功", () => {
  it("reasoning・storage_options・raw_json・status=analyzing でsuggestionsを更新する", async () => {
    mocks.createCompletion.mockResolvedValue(completionOf(validAnalyzeJson))

    const res = await POST(
      makeRequest({ suggestion_id: "s-42", room_image_url: "https://example.com/room.jpg" })
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
          status: "analyzing",
        },
      },
    ])
  })

  it("```json で囲まれたレスポンスでもパースできる", async () => {
    mocks.createCompletion.mockResolvedValue(
      completionOf("```json\n" + validAnalyzeJson + "\n```")
    )

    const res = await POST(
      makeRequest({ suggestion_id: "s-1", room_image_url: "https://example.com/room.jpg" })
    )

    expect(res.status).toBe(200)
    expect(mocks.updateCalls[0].values.status).toBe("analyzing")
  })

  it("raw_jsonにはreasoningとsuggestionsだけが残り、AIの余計なキーは保存されない", async () => {
    mocks.createCompletion.mockResolvedValue(
      completionOf(
        JSON.stringify({
          reasoning: "説明",
          suggestions: [{ target: "工具箱", location: "棚", reason: "近い" }],
          confidence: 0.4,
        })
      )
    )

    await POST(makeRequest({ suggestion_id: "s-1", room_image_url: "https://example.com/room.jpg" }))

    expect(mocks.updateCalls[0].values.raw_json).toEqual({
      reasoning: "説明",
      suggestions: [{ target: "工具箱", location: "棚", reason: "近い" }],
    })
  })

  it("完成イメージ画像の生成はレスポンス後（after）に回され、その場では呼ばれない", async () => {
    mocks.createCompletion.mockResolvedValue(completionOf(validAnalyzeJson))

    await POST(makeRequest({ suggestion_id: "s-7", room_image_url: "https://example.com/room.jpg" }))

    expect(mocks.generateResultImage).not.toHaveBeenCalled()
    expect(mocks.afterCallbacks).toHaveLength(1)

    await mocks.afterCallbacks[0]()

    expect(mocks.generateResultImage).toHaveBeenCalledWith({
      suggestionId: "s-7",
      reasoning: "動線上に使用頻度の高い物を置き直すと片付けが続きます。",
    })
  })

  it("更新でDBエラーが返ったら500を返し、画像生成は予約しない", async () => {
    mocks.createCompletion.mockResolvedValue(completionOf(validAnalyzeJson))
    mocks.updateResult.error = { message: "permission denied" }
    vi.spyOn(console, "error").mockImplementation(() => {})

    const res = await POST(
      makeRequest({ suggestion_id: "s-1", room_image_url: "https://example.com/room.jpg" })
    )

    expect(res.status).toBe(500)
    await expect(res.json()).resolves.toEqual({ error: "update failed" })
    expect(mocks.afterCallbacks).toHaveLength(0)
  })
})

describe("POST /api/analyze の解析失敗", () => {
  it("AI呼び出しが例外を投げたらstatus=failedに更新して502を返す", async () => {
    mocks.createCompletion.mockRejectedValue(new Error("openai down"))
    vi.spyOn(console, "error").mockImplementation(() => {})

    const res = await POST(
      makeRequest({ suggestion_id: "s-9", room_image_url: "https://example.com/room.jpg" })
    )

    expect(res.status).toBe(502)
    await expect(res.json()).resolves.toEqual({ error: "analyze failed" })
    expect(mocks.updateCalls).toEqual([
      { table: "suggestions", column: "id", id: "s-9", values: { status: "failed" } },
    ])
    expect(mocks.afterCallbacks).toHaveLength(0)
  })

  it("AIがJSONでない文字列を返したらstatus=failedに更新して502を返す", async () => {
    mocks.createCompletion.mockResolvedValue(completionOf("すみません、画像を解析できません。"))
    vi.spyOn(console, "error").mockImplementation(() => {})

    const res = await POST(
      makeRequest({ suggestion_id: "s-9", room_image_url: "https://example.com/room.jpg" })
    )

    expect(res.status).toBe(502)
    expect(mocks.updateCalls).toEqual([
      { table: "suggestions", column: "id", id: "s-9", values: { status: "failed" } },
    ])
    expect(mocks.generateResultImage).not.toHaveBeenCalled()
  })

  it("suggestionsが配列でないJSONもfailedとして扱う", async () => {
    mocks.createCompletion.mockResolvedValue(
      completionOf(JSON.stringify({ reasoning: "説明", suggestions: "配列ではない" }))
    )
    vi.spyOn(console, "error").mockImplementation(() => {})

    const res = await POST(
      makeRequest({ suggestion_id: "s-9", room_image_url: "https://example.com/room.jpg" })
    )

    expect(res.status).toBe(502)
    expect(mocks.updateCalls[0].values).toEqual({ status: "failed" })
  })

  it("reasoningが文字列でないJSONもfailedとして扱う", async () => {
    mocks.createCompletion.mockResolvedValue(
      completionOf(JSON.stringify({ reasoning: { text: "説明" }, suggestions: [] }))
    )
    vi.spyOn(console, "error").mockImplementation(() => {})

    const res = await POST(
      makeRequest({ suggestion_id: "s-9", room_image_url: "https://example.com/room.jpg" })
    )

    expect(res.status).toBe(502)
    expect(mocks.updateCalls[0].values).toEqual({ status: "failed" })
  })

  it("JSON配列が返ってきた場合もfailedとして扱う", async () => {
    mocks.createCompletion.mockResolvedValue(completionOf("[]"))
    vi.spyOn(console, "error").mockImplementation(() => {})

    const res = await POST(
      makeRequest({ suggestion_id: "s-9", room_image_url: "https://example.com/room.jpg" })
    )

    expect(res.status).toBe(502)
    expect(mocks.updateCalls[0].values).toEqual({ status: "failed" })
  })

  it("choicesが空でcontentが取れない場合もfailedとして扱う", async () => {
    mocks.createCompletion.mockResolvedValue({ choices: [] })
    vi.spyOn(console, "error").mockImplementation(() => {})

    const res = await POST(
      makeRequest({ suggestion_id: "s-9", room_image_url: "https://example.com/room.jpg" })
    )

    expect(res.status).toBe(502)
    expect(mocks.updateCalls[0].values).toEqual({ status: "failed" })
  })
})
