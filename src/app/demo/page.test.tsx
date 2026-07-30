import { describe, expect, it, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import DemoPage from "./page"

const push = vi.fn()

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}))

const createClient = vi.fn()

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => createClient(),
}))

type SupabaseMockOptions = {
  uploadError?: { message: string } | null
  spaceError?: { message: string } | null
  suggestionError?: { message: string } | null
}

type InsertedRows = { spaces: unknown[]; suggestions: unknown[] }

function setupSupabase(options: SupabaseMockOptions = {}) {
  const inserted: InsertedRows = { spaces: [], suggestions: [] }
  const uploadedPaths: string[] = []

  const client = {
    auth: {
      getUser: vi.fn(async () => ({ data: { user: { id: "user-1" } } })),
      signInAnonymously: vi.fn(async () => ({
        data: { user: { id: "anon-1" } },
        error: null,
      })),
    },
    storage: {
      from: () => ({
        upload: vi.fn(async (path: string) => {
          uploadedPaths.push(path)
          return { error: options.uploadError ?? null }
        }),
        getPublicUrl: (path: string) => ({
          data: { publicUrl: `https://cdn.example.com/${path}` },
        }),
      }),
    },
    from: (table: "spaces" | "suggestions") => ({
      insert: (row: unknown) => {
        inserted[table].push(row)
        return {
          select: () => ({
            single: async () =>
              table === "spaces"
                ? {
                    data: options.spaceError ? null : { id: "space-1" },
                    error: options.spaceError ?? null,
                  }
                : {
                    data: options.suggestionError ? null : { id: "suggestion-1" },
                    error: options.suggestionError ?? null,
                  },
          }),
        }
      },
    }),
  }

  createClient.mockReturnValue(client)
  return { client, inserted, uploadedPaths }
}

function fileInputs() {
  const inputs = document.querySelectorAll<HTMLInputElement>('input[type="file"]')
  return { room: inputs[0], storage: inputs[1] }
}

function makeImage(name: string) {
  return new File(["dummy-bytes"], name, { type: "image/jpeg" })
}

/** プレビュー画像（FileReaderのdata URL）が出るまで待つ */
async function waitForPreview(altText: string) {
  await waitFor(() => {
    expect(screen.getByAltText(altText)).toBeInTheDocument()
  })
}

describe("デモ撮影画面の送信条件", () => {
  it("写真が1枚もないと送信ボタンはdisabledで、1枚撮るよう案内する", () => {
    setupSupabase()
    render(<DemoPage />)

    expect(screen.getByRole("button", { name: "提案を見る" })).toBeDisabled()
    expect(screen.getByText("どちらか1枚を撮影すると提案に進めます")).toBeInTheDocument()
  })

  it("部屋全体だけ選んでも送信でき、部屋の写真だけで提案する案内が出る", async () => {
    setupSupabase()
    render(<DemoPage />)

    await userEvent.upload(fileInputs().room, makeImage("room.jpg"))
    await waitForPreview("部屋全体を撮るのプレビュー")

    expect(screen.getByRole("button", { name: "提案を見る" })).toBeEnabled()
    expect(
      screen.getByText(
        "部屋全体の写真だけで提案します。収納スペースも撮ると精度が上がります"
      )
    ).toBeInTheDocument()
  })

  it("収納スペースだけ選んでも送信でき、収納の写真だけで提案する案内が出る", async () => {
    setupSupabase()
    render(<DemoPage />)

    await userEvent.upload(fileInputs().storage, makeImage("storage.jpg"))
    await waitForPreview("収納スペースを撮るのプレビュー")

    expect(screen.getByRole("button", { name: "提案を見る" })).toBeEnabled()
    expect(
      screen.getByText(
        "収納スペースの写真だけで提案します。部屋全体も撮ると精度が上がります"
      )
    ).toBeInTheDocument()
  })

  it("2枚そろうと「2枚とも撮影できました」に変わる", async () => {
    setupSupabase()
    render(<DemoPage />)

    await userEvent.upload(fileInputs().room, makeImage("room.jpg"))
    await waitForPreview("部屋全体を撮るのプレビュー")
    await userEvent.upload(fileInputs().storage, makeImage("storage.jpg"))
    await waitForPreview("収納スペースを撮るのプレビュー")

    expect(screen.getByText("2枚とも撮影できました")).toBeInTheDocument()
    expect(
      screen.queryByText(/写真だけで提案します/)
    ).not.toBeInTheDocument()
  })

  it("唯一の写真を削除すると送信ボタンが再びdisabledに戻る", async () => {
    setupSupabase()
    render(<DemoPage />)

    await userEvent.upload(fileInputs().room, makeImage("room.jpg"))
    await waitForPreview("部屋全体を撮るのプレビュー")

    await userEvent.click(screen.getByRole("button", { name: "削除" }))

    expect(screen.getByRole("button", { name: "提案を見る" })).toBeDisabled()
    expect(screen.getByText("どちらか1枚を撮影すると提案に進めます")).toBeInTheDocument()
  })

  it("2枚から部屋全体だけ削除すると収納1枚の案内に戻り送信は有効のまま", async () => {
    setupSupabase()
    render(<DemoPage />)

    await userEvent.upload(fileInputs().room, makeImage("room.jpg"))
    await waitForPreview("部屋全体を撮るのプレビュー")
    await userEvent.upload(fileInputs().storage, makeImage("storage.jpg"))
    await waitForPreview("収納スペースを撮るのプレビュー")

    // 「部屋全体を撮る」カード側の削除ボタン（1枚目）を押す
    await userEvent.click(screen.getAllByRole("button", { name: "削除" })[0])

    expect(screen.queryByAltText("部屋全体を撮るのプレビュー")).not.toBeInTheDocument()
    expect(screen.getByAltText("収納スペースを撮るのプレビュー")).toBeInTheDocument()
    expect(
      screen.getByText(
        "収納スペースの写真だけで提案します。部屋全体も撮ると精度が上がります"
      )
    ).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "提案を見る" })).toBeEnabled()
  })
})

describe("デモ撮影画面の読み込み失敗", () => {
  it("FileReaderが失敗した写真は送信対象にならず、エラーを表示する", async () => {
    setupSupabase()

    // FileReader.readAsDataURL を失敗させる
    const originalReadAsDataURL = FileReader.prototype.readAsDataURL
    vi.spyOn(FileReader.prototype, "readAsDataURL").mockImplementation(function (
      this: FileReader
    ) {
      setTimeout(() => this.onerror?.(new ProgressEvent("error") as ProgressEvent<FileReader>), 0)
    })

    render(<DemoPage />)
    await userEvent.upload(fileInputs().room, makeImage("broken.jpg"))

    expect(
      await screen.findByText("写真を読み込めませんでした。別の写真をお試しください。")
    ).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "提案を見る" })).toBeDisabled()
    expect(screen.queryByAltText("部屋全体を撮るのプレビュー")).not.toBeInTheDocument()

    FileReader.prototype.readAsDataURL = originalReadAsDataURL
  })
})

describe("デモ撮影画面の送信処理", () => {
  it("片方だけの写真ならスキップした側のURLはnullで登録される", async () => {
    const { inserted, uploadedPaths } = setupSupabase()
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("{}", { status: 200 }))
    render(<DemoPage />)

    await userEvent.upload(fileInputs().storage, makeImage("storage.jpg"))
    await waitForPreview("収納スペースを撮るのプレビュー")
    await userEvent.click(screen.getByRole("button", { name: "提案を見る" }))

    await waitFor(() => {
      expect(screen.getByText("送りました！")).toBeInTheDocument()
    })

    expect(uploadedPaths).toHaveLength(1)
    expect(uploadedPaths[0]).toMatch(/^storage-\d+\.jpg$/)
    expect(inserted.spaces[0]).toMatchObject({ user_id: "user-1", name: "デモ撮影" })
    expect(inserted.suggestions[0]).toMatchObject({
      space_id: "space-1",
      room_image_url: null,
      storage_image_url: `https://cdn.example.com/${uploadedPaths[0]}`,
      status: "pending",
    })

    const [url, init] = fetchSpy.mock.calls[0]
    expect(url).toBe("/api/analyze")
    expect(JSON.parse(String(init?.body))).toEqual({
      suggestion_id: "suggestion-1",
      room_image_url: null,
      storage_image_url: `https://cdn.example.com/${uploadedPaths[0]}`,
    })
  })

  it("2枚とも送ると両方アップロードされ、確認ボタンで待機画面へ遷移する", async () => {
    const { inserted } = setupSupabase()
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 200 }))
    render(<DemoPage />)

    await userEvent.upload(fileInputs().room, makeImage("room.png"))
    await waitForPreview("部屋全体を撮るのプレビュー")
    await userEvent.upload(fileInputs().storage, makeImage("storage.jpg"))
    await waitForPreview("収納スペースを撮るのプレビュー")
    await userEvent.click(screen.getByRole("button", { name: "提案を見る" }))

    await waitFor(() => {
      expect(screen.getByText("送りました！")).toBeInTheDocument()
    })

    expect(inserted.suggestions[0]).toMatchObject({
      room_image_url: expect.stringMatching(/^https:\/\/cdn\.example\.com\/room-\d+\.png$/),
      storage_image_url: expect.stringMatching(
        /^https:\/\/cdn\.example\.com\/storage-\d+\.jpg$/
      ),
    })

    await userEvent.click(screen.getByRole("button", { name: "提案を確認する" }))
    expect(push).toHaveBeenCalledWith("/demo/waiting/suggestion-1")
  })

  it("未ログインなら匿名サインインしてそのユーザーIDで登録する", async () => {
    const { client, inserted } = setupSupabase()
    client.auth.getUser.mockResolvedValue({ data: { user: null } } as never)
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 200 }))
    render(<DemoPage />)

    await userEvent.upload(fileInputs().room, makeImage("room.jpg"))
    await waitForPreview("部屋全体を撮るのプレビュー")
    await userEvent.click(screen.getByRole("button", { name: "提案を見る" }))

    await waitFor(() => {
      expect(screen.getByText("送りました！")).toBeInTheDocument()
    })

    expect(client.auth.signInAnonymously).toHaveBeenCalled()
    expect(inserted.spaces[0]).toMatchObject({ user_id: "anon-1" })
  })

  it("アップロードが失敗したら撮影画面に戻りエラーメッセージを出す", async () => {
    setupSupabase({ uploadError: { message: "storage down" } })
    vi.spyOn(console, "error").mockImplementation(() => {})
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("{}", { status: 200 }))
    render(<DemoPage />)

    await userEvent.upload(fileInputs().room, makeImage("room.jpg"))
    await waitForPreview("部屋全体を撮るのプレビュー")
    await userEvent.click(screen.getByRole("button", { name: "提案を見る" }))

    await waitFor(() => {
      expect(
        screen.getByText("送信に失敗しました。時間をおいてもう一度お試しください。")
      ).toBeInTheDocument()
    })

    // 撮影画面に戻り、写真は保持されたまま再送信できる
    expect(screen.getByRole("button", { name: "提案を見る" })).toBeEnabled()
    expect(screen.getByAltText("部屋全体を撮るのプレビュー")).toBeInTheDocument()
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it("spacesの登録に失敗したら解析APIを叩かず送信完了画面にも進まない", async () => {
    const { inserted } = setupSupabase({ spaceError: { message: "rls denied" } })
    vi.spyOn(console, "error").mockImplementation(() => {})
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("{}", { status: 200 }))
    render(<DemoPage />)

    await userEvent.upload(fileInputs().room, makeImage("room.jpg"))
    await waitForPreview("部屋全体を撮るのプレビュー")
    await userEvent.click(screen.getByRole("button", { name: "提案を見る" }))

    await waitFor(() => {
      expect(
        screen.getByText("送信に失敗しました。時間をおいてもう一度お試しください。")
      ).toBeInTheDocument()
    })

    expect(fetchSpy).not.toHaveBeenCalled()
    expect(inserted.suggestions).toHaveLength(0)
    expect(screen.queryByText("送りました！")).not.toBeInTheDocument()
  })

  it("送信中は撮影画面ではなく送信中画面を表示する", async () => {
    const { client } = setupSupabase()
    let releaseGetUser: () => void = () => {}
    const gate = new Promise<void>((resolve) => {
      releaseGetUser = resolve
    })
    client.auth.getUser.mockImplementation(async () => {
      await gate
      return { data: { user: { id: "user-1" } } }
    })
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 200 }))
    render(<DemoPage />)

    await userEvent.upload(fileInputs().room, makeImage("room.jpg"))
    await waitForPreview("部屋全体を撮るのプレビュー")
    await userEvent.click(screen.getByRole("button", { name: "提案を見る" }))

    expect(screen.getByText("写真を送っています")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "提案を見る" })).not.toBeInTheDocument()

    releaseGetUser()
    await waitFor(() => {
      expect(screen.getByText("送りました！")).toBeInTheDocument()
    })
  })

  it("suggestionsの登録に失敗したら解析APIを叩かずエラーにする", async () => {
    setupSupabase({ suggestionError: { message: "insert denied" } })
    vi.spyOn(console, "error").mockImplementation(() => {})
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("{}", { status: 200 }))
    render(<DemoPage />)

    await userEvent.upload(fileInputs().room, makeImage("room.jpg"))
    await waitForPreview("部屋全体を撮るのプレビュー")
    await userEvent.click(screen.getByRole("button", { name: "提案を見る" }))

    await waitFor(() => {
      expect(
        screen.getByText("送信に失敗しました。時間をおいてもう一度お試しください。")
      ).toBeInTheDocument()
    })

    expect(fetchSpy).not.toHaveBeenCalled()
    expect(screen.queryByText("送りました！")).not.toBeInTheDocument()
  })
})
