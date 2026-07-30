import { beforeEach, describe, expect, it, vi } from "vitest"

const { imagesGenerate, openaiConstructor, createAdminClient } = vi.hoisted(() => ({
  imagesGenerate: vi.fn(),
  openaiConstructor: vi.fn(),
  createAdminClient: vi.fn(),
}))

vi.mock("openai", () => ({
  default: class MockOpenAI {
    images = { generate: imagesGenerate }
    constructor(options: unknown) {
      openaiConstructor(options)
    }
  },
}))

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient }))

import { generateResultImage } from "./result-image"

const PUBLIC_URL = "https://cdn.example.com/specify-images/generated-sug-1.png"

/** createAdminClient() が返すクライアントの最小スタブを組み立てる */
function stubAdminClient(
  options: {
    uploadError?: { message: string } | null
    updateError?: { message: string } | null
    updateRejects?: boolean
  } = {}
) {
  const upload = vi
    .fn()
    .mockResolvedValue({ data: { path: "generated-sug-1.png" }, error: options.uploadError ?? null })
  const getPublicUrl = vi.fn().mockReturnValue({ data: { publicUrl: PUBLIC_URL } })
  const eq = options.updateRejects
    ? vi.fn().mockRejectedValue(new Error("connection lost"))
    : vi.fn().mockResolvedValue({ data: null, error: options.updateError ?? null })
  const update = vi.fn(() => ({ eq }))
  const storageFrom = vi.fn(() => ({ upload, getPublicUrl }))
  const from = vi.fn(() => ({ update }))

  createAdminClient.mockReturnValue({ storage: { from: storageFrom }, from })

  return { upload, getPublicUrl, eq, update, storageFrom, from }
}

describe("generateResultImage", () => {
  beforeEach(() => {
    imagesGenerate.mockReset()
    openaiConstructor.mockReset()
    createAdminClient.mockReset()
    vi.stubEnv("OPENAI_API_KEY", "sk-test")
  })

  it("画像を生成してStorageに保存し、公開URLとstatus=doneでsuggestionsを更新する", async () => {
    const db = stubAdminClient()
    imagesGenerate.mockResolvedValue({ data: [{ url: "https://oai.example.com/img.png" }] })
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("PNG-BYTES", { status: 200 }))
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {})

    await generateResultImage({ suggestionId: "sug-1", reasoning: "上段に工具をまとめる" })

    expect(openaiConstructor).toHaveBeenCalledWith({ apiKey: "sk-test" })
    expect(imagesGenerate).toHaveBeenCalledWith({
      model: "dall-e-3",
      prompt: expect.stringContaining("上段に工具をまとめる"),
      n: 1,
      size: "1024x1024",
    })

    expect(fetchSpy).toHaveBeenCalledWith("https://oai.example.com/img.png")

    expect(db.storageFrom).toHaveBeenCalledWith("specify-images")
    const [uploadPath, uploadBody, uploadOptions] = db.upload.mock.calls[0]
    expect(uploadPath).toBe("generated-sug-1.png")
    expect(Buffer.isBuffer(uploadBody)).toBe(true)
    expect((uploadBody as Buffer).toString()).toBe("PNG-BYTES")
    expect(uploadOptions).toEqual({ contentType: "image/png", upsert: true })
    expect(db.getPublicUrl).toHaveBeenCalledWith("generated-sug-1.png")

    expect(db.from).toHaveBeenCalledWith("suggestions")
    expect(db.update).toHaveBeenCalledTimes(1)
    expect(db.update).toHaveBeenCalledWith({ result_image_url: PUBLIC_URL, status: "done" })
    expect(db.eq).toHaveBeenCalledWith("id", "sug-1")
    // 成功パスではフォールバックのログが出ない
    expect(errorSpy).not.toHaveBeenCalled()
  })

  it("生成結果に画像が1件もなければアップロードせずstatus=doneだけを書き込む", async () => {
    const db = stubAdminClient()
    imagesGenerate.mockResolvedValue({ data: [] })
    const fetchSpy = vi.spyOn(globalThis, "fetch")
    vi.spyOn(console, "error").mockImplementation(() => {})

    await expect(
      generateResultImage({ suggestionId: "sug-2", reasoning: "棚を高さ順に並べる" })
    ).resolves.toBeUndefined()

    expect(fetchSpy).not.toHaveBeenCalled()
    expect(db.upload).not.toHaveBeenCalled()
    expect(db.update).toHaveBeenCalledTimes(1)
    expect(db.update).toHaveBeenCalledWith({ status: "done" })
    expect(db.eq).toHaveBeenCalledWith("id", "sug-2")
  })

  it("画像URLが空文字ならURLなし扱いでstatus=doneにフォールバックする", async () => {
    const db = stubAdminClient()
    imagesGenerate.mockResolvedValue({ data: [{ url: "" }] })
    const fetchSpy = vi.spyOn(globalThis, "fetch")
    vi.spyOn(console, "error").mockImplementation(() => {})

    await generateResultImage({ suggestionId: "sug-3", reasoning: "床置きをやめる" })

    expect(fetchSpy).not.toHaveBeenCalled()
    expect(db.upload).not.toHaveBeenCalled()
    // フォールバックでも更新先は suggestions 行1件だけ
    expect(db.from).toHaveBeenCalledWith("suggestions")
    expect(db.update).toHaveBeenCalledTimes(1)
    expect(db.update).toHaveBeenCalledWith({ status: "done" })
    expect(db.eq).toHaveBeenCalledWith("id", "sug-3")
  })

  it("生成結果にdataが無くてもクラッシュせずstatus=doneにフォールバックする", async () => {
    const db = stubAdminClient()
    imagesGenerate.mockResolvedValue({})
    const fetchSpy = vi.spyOn(globalThis, "fetch")
    vi.spyOn(console, "error").mockImplementation(() => {})

    await expect(
      generateResultImage({ suggestionId: "sug-7", reasoning: "空き箱を捨てる" })
    ).resolves.toBeUndefined()

    expect(fetchSpy).not.toHaveBeenCalled()
    expect(db.update).toHaveBeenCalledTimes(1)
    expect(db.update).toHaveBeenCalledWith({ status: "done" })
    expect(db.eq).toHaveBeenCalledWith("id", "sug-7")
  })

  it("生成画像のfetchが例外を投げてもアップロードせずstatus=doneにフォールバックする", async () => {
    const db = stubAdminClient()
    imagesGenerate.mockResolvedValue({ data: [{ url: "https://oai.example.com/img.png" }] })
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network down"))
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {})

    await expect(
      generateResultImage({ suggestionId: "sug-8", reasoning: "配線をまとめる" })
    ).resolves.toBeUndefined()

    expect(db.upload).not.toHaveBeenCalled()
    expect(db.update).toHaveBeenCalledTimes(1)
    expect(db.update).toHaveBeenCalledWith({ status: "done" })
    expect(errorSpy.mock.calls[0]?.[1]).toMatchObject({ message: "network down" })
  })

  it("生成画像のfetchが非OKならアップロードせずstatus=doneにフォールバックする", async () => {
    const db = stubAdminClient()
    imagesGenerate.mockResolvedValue({ data: [{ url: "https://oai.example.com/img.png" }] })
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("gone", { status: 404 }))
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {})

    await generateResultImage({ suggestionId: "sug-4", reasoning: "ラベルを貼る" })

    expect(db.upload).not.toHaveBeenCalled()
    expect(db.update).toHaveBeenCalledTimes(1)
    expect(db.update).toHaveBeenCalledWith({ status: "done" })
    expect(db.eq).toHaveBeenCalledWith("id", "sug-4")
    // 失敗理由（HTTPステータス）をログに残す
    expect(errorSpy.mock.calls[0]?.[1]).toMatchObject({ message: expect.stringContaining("404") })
  })

  it("Storageのuploadがエラーを返したらresult_image_urlを付けずstatus=doneにする", async () => {
    const db = stubAdminClient({ uploadError: { message: "bucket not found" } })
    imagesGenerate.mockResolvedValue({ data: [{ url: "https://oai.example.com/img.png" }] })
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("PNG-BYTES", { status: 200 }))
    vi.spyOn(console, "error").mockImplementation(() => {})

    await generateResultImage({ suggestionId: "sug-5", reasoning: "引き出しを仕切る" })

    expect(db.upload).toHaveBeenCalledTimes(1)
    expect(db.getPublicUrl).not.toHaveBeenCalled()
    expect(db.update).toHaveBeenCalledTimes(1)
    expect(db.update).toHaveBeenCalledWith({ status: "done" })
    expect(db.eq).toHaveBeenCalledWith("id", "sug-5")
  })

  it("OpenAIが例外を投げても呼び出し元に伝播させずstatus=doneにする", async () => {
    const db = stubAdminClient()
    imagesGenerate.mockRejectedValue(new Error("rate limit exceeded"))
    const fetchSpy = vi.spyOn(globalThis, "fetch")
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {})

    await expect(
      generateResultImage({ suggestionId: "sug-6", reasoning: "通路を確保する" })
    ).resolves.toBeUndefined()

    expect(fetchSpy).not.toHaveBeenCalled()
    expect(db.update).toHaveBeenCalledWith({ status: "done" })
    expect(db.eq).toHaveBeenCalledWith("id", "sug-6")
    expect(errorSpy.mock.calls[0]?.[0]).toContain("sug-6")
  })

  it("成功パスのupdateがerrorを返したらstatusをdoneにするフォールバックへ落ちる", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    const db = stubAdminClient({ updateError: { message: "violates rls" } })
    imagesGenerate.mockResolvedValue({ data: [{ url: "https://openai.example.com/i.png" }] })
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("bytes", { status: 200 }))

    await generateResultImage({ suggestionId: "sug-1", reasoning: "動線を確保する" })

    // 1回目（result_image_url付き）が失敗し、2回目（status only）が走る
    expect(db.update).toHaveBeenCalledTimes(2)
    expect(db.update).toHaveBeenLastCalledWith({ status: "done" })
    expect(errorSpy).toHaveBeenCalled()
  })

  it("フォールバックのupdateがrejectしても例外を呼び出し元に伝播させない", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    stubAdminClient({ updateRejects: true })
    imagesGenerate.mockRejectedValue(new Error("dall-e down"))

    await expect(
      generateResultImage({ suggestionId: "sug-1", reasoning: "動線を確保する" })
    ).resolves.toBeUndefined()

    const logged = errorSpy.mock.calls.flat().join(" ")
    expect(logged).toContain("statusをdoneにできませんでした")
  })
})
