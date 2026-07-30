import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import BScanPage from "./page"

const push = vi.fn()

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}))

const getUser = vi.fn(async () => ({ data: { user: { id: "user-1" } } }))

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ auth: { getUser } }),
}))

// vitest.setup.ts の restoreAllMocks は vi.fn の呼び出し履歴を消さないので明示的にクリアする
beforeEach(() => {
  push.mockClear()
  getUser.mockClear()
})

function okResponse() {
  return new Response(JSON.stringify({ scan_id: "scan-1" }), { status: 200 })
}

/** 撮影ステップで写真を1枚選び、プレビューが出るまで待つ */
async function selectPhoto(container: HTMLElement) {
  const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement
  fireEvent.change(fileInput, {
    target: { files: [new File(["dummy-bytes"], "area.png", { type: "image/png" })] },
  })

  // FileReader.readAsDataURL は非同期なので、プレビューが出るまで待つ
  await waitFor(() => expect(screen.getByAltText("撮影した写真")).toBeInTheDocument())
}

/** エリア名入力ステップから撮影ステップへ進む */
function gotoCapture(areaName = "第1工具棚") {
  const { container } = render(<BScanPage />)

  fireEvent.change(screen.getByPlaceholderText("例：第1工具棚"), {
    target: { value: areaName },
  })
  fireEvent.click(screen.getByRole("button", { name: "次へ：写真を撮る" }))

  return { container }
}

/** エリア名入力 → 撮影ステップ → 写真選択済み、までを進める */
async function gotoCaptureWithPhoto(areaName = "第1工具棚") {
  const { container } = gotoCapture(areaName)
  await selectPhoto(container)
  return { container }
}

describe("BScanPage エリア名入力ステップ", () => {
  it("エリア名が空なら「次へ：写真を撮る」は押せず撮影ステップに進まない", () => {
    render(<BScanPage />)

    const next = screen.getByRole("button", { name: "次へ：写真を撮る" })
    expect(next).toBeDisabled()

    fireEvent.click(next)

    expect(screen.getByRole("heading", { name: "エリア名を入力" })).toBeInTheDocument()
  })

  it("空白のみのエリア名では次へ進めない（Enterキーでも進まない）", () => {
    render(<BScanPage />)

    const input = screen.getByPlaceholderText("例：第1工具棚")
    fireEvent.change(input, { target: { value: "   " } })

    expect(screen.getByRole("button", { name: "次へ：写真を撮る" })).toBeDisabled()

    fireEvent.keyDown(input, { key: "Enter" })

    expect(screen.getByRole("heading", { name: "エリア名を入力" })).toBeInTheDocument()
  })

  it("エリア名を入力すると撮影ステップに進み、見出しにエリア名が出る", () => {
    render(<BScanPage />)

    fireEvent.change(screen.getByPlaceholderText("例：第1工具棚"), {
      target: { value: "組立作業台" },
    })
    fireEvent.click(screen.getByRole("button", { name: "次へ：写真を撮る" }))

    expect(screen.getByRole("heading", { name: "「組立作業台」を撮影" })).toBeInTheDocument()
  })
})

describe("BScanPage 撮影ステップ", () => {
  it("写真を選ぶまで「この写真で送信する」は押せず、選ぶと押せるようになる", async () => {
    const { container } = gotoCapture()

    expect(screen.getByRole("button", { name: "この写真で送信する" })).toBeDisabled()

    await selectPhoto(container)

    expect(screen.getByRole("button", { name: "この写真で送信する" })).toBeEnabled()
  })

  it("写真未選択のまま送信ボタンを押しても送信完了画面に進まない", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(okResponse())

    gotoCapture()
    fireEvent.click(screen.getByRole("button", { name: "この写真で送信する" }))

    expect(screen.getByRole("heading", { name: "「第1工具棚」を撮影" })).toBeInTheDocument()
    expect(screen.queryByRole("heading", { name: "送信しました" })).not.toBeInTheDocument()
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it("「撮り直す」を押すとプレビューが消え、送信ボタンが再び押せなくなる", async () => {
    const { container } = gotoCapture()
    await selectPhoto(container)

    fireEvent.click(screen.getByRole("button", { name: "撮り直す" }))

    expect(screen.queryByAltText("撮影した写真")).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "この写真で送信する" })).toBeDisabled()
  })

  it("「← 戻る」でエリア名入力に戻ると入力済みのエリア名が保持されている", () => {
    gotoCapture("組立作業台")

    fireEvent.click(screen.getByRole("button", { name: "← 戻る" }))

    expect(screen.getByRole("heading", { name: "エリア名を入力" })).toBeInTheDocument()
    expect(screen.getByPlaceholderText("例：第1工具棚")).toHaveValue("組立作業台")
  })
})

describe("BScanPage 送信（API応答を待たずに完了画面を出す）", () => {
  it("送信ボタンを押した直後、fetchが未解決でも送信完了画面が表示される", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(() => new Promise<Response>(() => {}))

    await gotoCaptureWithPhoto()

    fireEvent.click(screen.getByRole("button", { name: "この写真で送信する" }))

    // await を挟まずに完了画面が出ていること = API応答を待っていない
    expect(screen.getByRole("heading", { name: "送信しました" })).toBeInTheDocument()
    expect(screen.getByText("写真をアップロード中...")).toBeInTheDocument()
    expect(fetchSpy).not.toHaveBeenCalled()

    // バックグラウンドのPOSTはエリア名と画像を送る
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1))
    const [url, init] = fetchSpy.mock.calls[0]
    expect(url).toBe("/api/b/scan")
    expect(init?.method).toBe("POST")
    const body = JSON.parse(String(init?.body))
    expect(body.area_name).toBe("第1工具棚")
    expect(body.image).toMatch(/^data:image\/png;base64,/)
  })

  it("アップロードが成功するとアップロード中の表示が消える", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(okResponse())

    await gotoCaptureWithPhoto()
    fireEvent.click(screen.getByRole("button", { name: "この写真で送信する" }))

    await waitFor(() =>
      expect(screen.queryByText("写真をアップロード中...")).not.toBeInTheDocument()
    )
    expect(screen.getByRole("heading", { name: "送信しました" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "エリア一覧に戻る" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "もう一度送信する" })).not.toBeInTheDocument()
  })

  it("送信成功後に「続けて撮影する」を押すとエリア名も写真もクリアされて最初から始まる", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(okResponse())

    await gotoCaptureWithPhoto("組立作業台")
    fireEvent.click(screen.getByRole("button", { name: "この写真で送信する" }))

    await waitFor(() =>
      expect(screen.queryByText("写真をアップロード中...")).not.toBeInTheDocument()
    )

    fireEvent.click(screen.getByRole("button", { name: "続けて撮影する" }))

    expect(screen.getByRole("heading", { name: "エリア名を入力" })).toBeInTheDocument()
    expect(screen.getByPlaceholderText("例：第1工具棚")).toHaveValue("")
    expect(screen.getByRole("button", { name: "次へ：写真を撮る" })).toBeDisabled()
    expect(screen.queryByAltText("撮影した写真")).not.toBeInTheDocument()
  })

  it("「エリア一覧に戻る」を押すとワークスペースへ遷移する", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(okResponse())

    await gotoCaptureWithPhoto()
    fireEvent.click(screen.getByRole("button", { name: "この写真で送信する" }))

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "エリア一覧に戻る" })).toBeInTheDocument()
    )
    fireEvent.click(screen.getByRole("button", { name: "エリア一覧に戻る" }))

    expect(push).toHaveBeenCalledWith("/b/workspace")
  })

  it("未ログインならログイン画面へ遷移し、POSTしない", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(okResponse())
    getUser.mockResolvedValueOnce({ data: { user: null } } as never)

    await gotoCaptureWithPhoto()
    fireEvent.click(screen.getByRole("button", { name: "この写真で送信する" }))

    await waitFor(() => expect(push).toHaveBeenCalledWith("/login"))
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})

describe("BScanPage 連続送信のレース", () => {
  it("前回の送信の遅延した失敗応答で、現在の送信画面が「送信できませんでした」に変わらない", async () => {
    let rejectFirst: ((reason: Error) => void) | undefined
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockImplementationOnce(
        () => new Promise((_resolve, reject) => { rejectFirst = reject })
      )
      .mockImplementationOnce(async () => okResponse())

    const { container } = await gotoCaptureWithPhoto("第1工具棚")
    fireEvent.click(screen.getByRole("button", { name: "この写真で送信する" }))
    expect(await screen.findByText("送信しました")).toBeInTheDocument()

    // 1回目の応答が返らないまま、続けて2件目を送信する
    fireEvent.click(screen.getByRole("button", { name: "続けて撮影する" }))
    fireEvent.change(screen.getByPlaceholderText("例：第1工具棚"), {
      target: { value: "作業台B" },
    })
    fireEvent.click(screen.getByRole("button", { name: "次へ：写真を撮る" }))
    await selectPhoto(container)
    fireEvent.click(screen.getByRole("button", { name: "この写真で送信する" }))

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(2))

    // ここで1回目が失敗する
    rejectFirst?.(new Error("network down"))
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(screen.queryByText("送信できませんでした")).not.toBeInTheDocument()
    expect(screen.getByText("送信しました")).toBeInTheDocument()
  })

  it("2件目の送信では2件目のエリア名がPOSTされる", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async () => okResponse())

    const { container } = await gotoCaptureWithPhoto("第1工具棚")
    fireEvent.click(screen.getByRole("button", { name: "この写真で送信する" }))
    expect(await screen.findByText("送信しました")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "続けて撮影する" }))
    fireEvent.change(screen.getByPlaceholderText("例：第1工具棚"), {
      target: { value: "作業台B" },
    })
    fireEvent.click(screen.getByRole("button", { name: "次へ：写真を撮る" }))
    await selectPhoto(container)
    fireEvent.click(screen.getByRole("button", { name: "この写真で送信する" }))

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(2))
    const body = JSON.parse(String(fetchSpy.mock.calls[1][1]?.body))
    expect(body.area_name).toBe("作業台B")
  })
})

describe("BScanPage 送信失敗時のリトライ導線", () => {
  it("fetchが失敗すると「送信できませんでした」とリトライボタンが出る", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network down"))

    await gotoCaptureWithPhoto()
    fireEvent.click(screen.getByRole("button", { name: "この写真で送信する" }))

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "送信できませんでした" })).toBeInTheDocument()
    )
    expect(
      screen.getByText("送信に失敗しました。時間をおいてもう一度お試しください。")
    ).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "もう一度送信する" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "エリア一覧に戻る" })).not.toBeInTheDocument()
  })

  it("サーバーが5xxを返した場合もエラー画面になる", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("ng", { status: 500 }))

    await gotoCaptureWithPhoto()
    fireEvent.click(screen.getByRole("button", { name: "この写真で送信する" }))

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "送信できませんでした" })).toBeInTheDocument()
    )
  })

  it("「もう一度送信する」を押すと再度POSTされ、成功すれば完了画面に戻る", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValueOnce(okResponse())

    await gotoCaptureWithPhoto()
    fireEvent.click(screen.getByRole("button", { name: "この写真で送信する" }))

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "送信できませんでした" })).toBeInTheDocument()
    )

    fireEvent.click(screen.getByRole("button", { name: "もう一度送信する" }))

    // 押した直後にエラー画面から送信中表示へ切り替わる
    expect(screen.getByText("写真をアップロード中...")).toBeInTheDocument()
    expect(screen.queryByRole("heading", { name: "送信できませんでした" })).not.toBeInTheDocument()

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(2))
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "送信しました" })).toBeInTheDocument()
    )
    expect(
      screen.queryByText("送信に失敗しました。時間をおいてもう一度お試しください。")
    ).not.toBeInTheDocument()
    expect(JSON.parse(String(fetchSpy.mock.calls[1][1]?.body)).area_name).toBe("第1工具棚")
  })

  it("「撮影画面に戻る」を押すと撮影ステップに戻り、写真とエラーが残っている", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network down"))

    await gotoCaptureWithPhoto()
    fireEvent.click(screen.getByRole("button", { name: "この写真で送信する" }))

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "送信できませんでした" })).toBeInTheDocument()
    )

    fireEvent.click(screen.getByRole("button", { name: "撮影画面に戻る" }))

    expect(screen.getByRole("heading", { name: "「第1工具棚」を撮影" })).toBeInTheDocument()
    expect(screen.getByAltText("撮影した写真")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "この写真で送信する" })).toBeEnabled()
    expect(
      screen.getByText("送信に失敗しました。時間をおいてもう一度お試しください。")
    ).toBeInTheDocument()
  })

  it("撮影画面に戻ってから再送信すると、残っていたエラー表示が消えて送信中になる", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    let resolveSecond: ((res: Response) => void) | undefined
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValueOnce(new Error("network down"))
      .mockImplementationOnce(() => new Promise<Response>((r) => { resolveSecond = r }))

    await gotoCaptureWithPhoto()
    fireEvent.click(screen.getByRole("button", { name: "この写真で送信する" }))

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "送信できませんでした" })).toBeInTheDocument()
    )

    fireEvent.click(screen.getByRole("button", { name: "撮影画面に戻る" }))
    fireEvent.click(screen.getByRole("button", { name: "この写真で送信する" }))

    // 再送信直後は成功扱いの完了画面（エラー文は消えている）
    expect(screen.getByRole("heading", { name: "送信しました" })).toBeInTheDocument()
    expect(
      screen.queryByText("送信に失敗しました。時間をおいてもう一度お試しください。")
    ).not.toBeInTheDocument()
    expect(screen.getByText("写真をアップロード中...")).toBeInTheDocument()

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(2))
    resolveSecond?.(okResponse())
    await waitFor(() =>
      expect(screen.queryByText("写真をアップロード中...")).not.toBeInTheDocument()
    )
  })
})
