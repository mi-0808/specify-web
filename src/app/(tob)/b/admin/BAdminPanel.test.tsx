import { describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import BAdminPanel from "./BAdminPanel"

const scan = (id: string, area_name: string, image_url: string | null = "https://img.example.com/a.png") => ({
  id,
  area_name,
  image_url,
  status: "pending",
  created_at: "2026-07-01T09:00:00.000Z",
})

/** jsdom には crypto.randomUUID がない環境があるので、決定的なIDを供給する */
function stubRandomUUID() {
  let n = 0
  const uuid = () => `uuid-${++n}` as `${string}-${string}-${string}-${string}-${string}`
  if (typeof globalThis.crypto?.randomUUID === "function") {
    vi.spyOn(globalThis.crypto, "randomUUID").mockImplementation(uuid)
  } else {
    vi.stubGlobal("crypto", { ...globalThis.crypto, randomUUID: uuid })
  }
}

/** 写真クリックの座標計算は getBoundingClientRect 依存なので固定する */
function stubImageRect() {
  vi.spyOn(HTMLDivElement.prototype, "getBoundingClientRect").mockReturnValue({
    left: 100,
    top: 50,
    width: 200,
    height: 100,
    right: 300,
    bottom: 150,
    x: 100,
    y: 50,
    toJSON: () => ({}),
  } as DOMRect)
}

/** onClick が付いている写真コンテナ（img の親） */
function photoArea(areaName: string) {
  const img = screen.getByAltText(areaName)
  return img.parentElement as HTMLElement
}

function clickPhoto(areaName: string, clientX: number, clientY: number) {
  fireEvent.click(photoArea(areaName), { clientX, clientY })
}

function setup(pending = [scan("s1", "第1工具棚")], done: ReturnType<typeof scan>[] = []) {
  stubRandomUUID()
  stubImageRect()
  return render(<BAdminPanel pendingScans={pending} doneScans={done} />)
}

describe("BAdminPanel 未対応件数バッジ", () => {
  it("未対応スキャンの件数がバッジに出る", () => {
    setup([scan("s1", "第1工具棚"), scan("s2", "組立作業台")])

    expect(screen.getByText("未対応 2")).toBeInTheDocument()
  })

  it("未対応が0件ならバッジを出さず、案内文を表示する", () => {
    setup([])

    expect(screen.queryByText(/^未対応 /)).not.toBeInTheDocument()
    expect(screen.getByText("未対応のスキャンはありません")).toBeInTheDocument()
  })
})

describe("BAdminPanel マーカー追加", () => {
  it("写真をクリックするとクリック位置の相対座標にマーカーが追加され、連番が振られる", () => {
    setup()

    expect(screen.getByText("写真上をクリックしてマーカーを追加してください")).toBeInTheDocument()

    clickPhoto("第1工具棚", 150, 70) // x=(150-100)/200=0.25, y=(70-50)/100=0.2
    clickPhoto("第1工具棚", 200, 100) // x=0.5, y=0.5

    const area = photoArea("第1工具棚")
    const pins = within(area).getAllByText(/^[0-9]+$/)
    expect(pins.map((p) => p.textContent)).toEqual(["1", "2"])
    expect(pins[0].style.left).toBe("25%")
    expect(pins[0].style.top).toBe("20%")
    expect(pins[1].style.left).toBe("50%")
    expect(pins[1].style.top).toBe("50%")

    // マーカー入力欄も同じ数だけ出る
    expect(screen.getByText("マーカー一覧")).toBeInTheDocument()
    expect(screen.getAllByPlaceholderText("コメントを入力...")).toHaveLength(2)
  })

  it("マーカーを削除すると残りの連番が振り直される", () => {
    setup()

    clickPhoto("第1工具棚", 120, 60)
    clickPhoto("第1工具棚", 200, 100)

    fireEvent.change(screen.getAllByPlaceholderText("コメントを入力...")[1], {
      target: { value: "2番目のコメント" },
    })
    fireEvent.click(screen.getAllByRole("button", { name: "削除" })[0])

    const remaining = screen.getAllByPlaceholderText("コメントを入力...")
    expect(remaining).toHaveLength(1)
    expect(remaining[0]).toHaveValue("2番目のコメント")
    const pins = within(photoArea("第1工具棚")).getAllByText(/^[0-9]+$/)
    expect(pins.map((p) => p.textContent)).toEqual(["1"])
  })
})

describe("BAdminPanel スキャンの切り替え", () => {
  it("画像がないスキャンではクリック領域を出さず案内文を表示する", () => {
    setup([scan("s1", "第1工具棚", null)])

    expect(screen.getByText("画像がありません")).toBeInTheDocument()
    expect(screen.queryByAltText("第1工具棚")).not.toBeInTheDocument()
    expect(
      screen.queryByText("写真上をクリックしてマーカーを追加してください")
    ).not.toBeInTheDocument()
  })

  it("別のスキャンを選ぶと入力中のマーカーとエラーがリセットされる", async () => {
    setup([scan("s1", "第1工具棚"), scan("s2", "組立作業台")])

    clickPhoto("第1工具棚", 150, 70)
    fireEvent.click(screen.getByRole("button", { name: "レポートを送信 ✓" }))
    expect(
      await screen.findByText("すべてのマーカーにコメントを入力してください")
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: /組立作業台/ }))

    expect(screen.getByRole("heading", { name: "組立作業台" })).toBeInTheDocument()
    expect(screen.queryByPlaceholderText("コメントを入力...")).not.toBeInTheDocument()
    expect(
      screen.queryByText("すべてのマーカーにコメントを入力してください")
    ).not.toBeInTheDocument()
  })
})

describe("BAdminPanel AI提案", () => {
  it("AI提案が返ったマーカーで置き換わり、categoryが無ければ改善提案になる", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          markers: [
            { x: 0.4, y: 0.6, category: "safety", comment: "AIコメント1" },
            { x: 0.8, y: 0.2, comment: "AIコメント2" },
          ],
        }),
        { status: 200 }
      )
    )
    setup()

    clickPhoto("第1工具棚", 110, 55) // 手動マーカーは置き換えられる
    fireEvent.click(screen.getByRole("button", { name: "✨ AIに提案させる" }))

    await waitFor(() =>
      expect(screen.getAllByPlaceholderText("コメントを入力...")).toHaveLength(2)
    )
    const comments = screen.getAllByPlaceholderText("コメントを入力...")
    expect(comments[0]).toHaveValue("AIコメント1")
    expect(comments[1]).toHaveValue("AIコメント2")
    const selects = screen.getAllByRole("combobox")
    expect(selects[0]).toHaveValue("safety")
    expect(selects[1]).toHaveValue("suggestion")

    const pins = within(photoArea("第1工具棚")).getAllByText(/^[0-9]+$/)
    expect(pins.map((p) => p.textContent)).toEqual(["1", "2"])
    expect(pins[0].style.left).toBe("40%")
    expect(pins[0].style.top).toBe("60%")
  })

  it("AIが未知のcategoryを返しても改善提案に丸めてクラッシュしない", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          markers: [{ x: 0.5, y: 0.5, category: "danger", comment: "未知カテゴリ" }],
        }),
        { status: 200 }
      )
    )
    setup()

    fireEvent.click(screen.getByRole("button", { name: "✨ AIに提案させる" }))

    await waitFor(() =>
      expect(screen.getByPlaceholderText("コメントを入力...")).toHaveValue("未知カテゴリ")
    )
    expect(screen.getByRole("combobox")).toHaveValue("suggestion")
    expect(within(photoArea("第1工具棚")).getByText("1")).toBeInTheDocument()
  })

  it("AI提案が空ならエラーを表示し、マーカーは追加されない", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ markers: [] }), { status: 200 })
    )
    setup()

    fireEvent.click(screen.getByRole("button", { name: "✨ AIに提案させる" }))

    expect(await screen.findByText("AI提案を生成できませんでした")).toBeInTheDocument()
    expect(screen.queryByPlaceholderText("コメントを入力...")).not.toBeInTheDocument()
  })

  it("AI提案の取得が失敗するとエラーを表示する", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network down"))
    setup()

    fireEvent.click(screen.getByRole("button", { name: "✨ AIに提案させる" }))

    expect(await screen.findByText("AI提案の取得に失敗しました")).toBeInTheDocument()
  })
})

describe("BAdminPanel テンプレート", () => {
  it("カテゴリを変えるとテンプレート候補が切り替わる", () => {
    setup()
    clickPhoto("第1工具棚", 150, 70)

    fireEvent.click(screen.getByRole("button", { name: "テンプレートから選ぶ" }))

    // 初期カテゴリは動線
    expect(screen.getByRole("combobox")).toHaveValue("flow")
    expect(
      screen.getByRole("button", { name: "この工具の使用頻度に対して、取り出し位置が遠すぎます" })
    ).toBeInTheDocument()

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "safety" } })

    expect(
      screen.queryByRole("button", { name: "この工具の使用頻度に対して、取り出し位置が遠すぎます" })
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole("button", {
        name: "通路に物が出ており、緊急時の避難経路を妨げる可能性があります",
      })
    ).toBeInTheDocument()
  })

  it("テンプレートを選ぶとコメント欄に入り、一覧が閉じる", () => {
    setup()
    clickPhoto("第1工具棚", 150, 70)

    fireEvent.click(screen.getByRole("button", { name: "テンプレートから選ぶ" }))
    fireEvent.click(screen.getByRole("button", { name: "作業手順の順番と工具の配置順が逆になっています" }))

    expect(screen.getByPlaceholderText("コメントを入力...")).toHaveValue(
      "作業手順の順番と工具の配置順が逆になっています"
    )
    expect(screen.getByRole("button", { name: "テンプレートから選ぶ" })).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "作業手順の順番と工具の配置順が逆になっています" })
    ).not.toBeInTheDocument()
  })
})

describe("BAdminPanel レポート送信", () => {
  it("マーカーが0件のまま送信するとエラーを出してPOSTしない", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch")
    setup()

    fireEvent.click(screen.getByRole("button", { name: "レポートを送信 ✓" }))

    expect(await screen.findByText("マーカーを1つ以上追加してください")).toBeInTheDocument()
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it("コメント未入力のマーカーがあるとエラーを出してPOSTしない", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch")
    setup()

    clickPhoto("第1工具棚", 150, 70)
    clickPhoto("第1工具棚", 200, 100)
    fireEvent.change(screen.getAllByPlaceholderText("コメントを入力...")[0], {
      target: { value: "1つだけ入力した" },
    })

    fireEvent.click(screen.getByRole("button", { name: "レポートを送信 ✓" }))

    expect(
      await screen.findByText("すべてのマーカーにコメントを入力してください")
    ).toBeInTheDocument()
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it("空白のみのコメントも未入力として扱う", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch")
    setup()

    clickPhoto("第1工具棚", 150, 70)
    fireEvent.change(screen.getByPlaceholderText("コメントを入力..."), {
      target: { value: "   " },
    })

    fireEvent.click(screen.getByRole("button", { name: "レポートを送信 ✓" }))

    expect(
      await screen.findByText("すべてのマーカーにコメントを入力してください")
    ).toBeInTheDocument()
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it("全て入力して送信すると x,y,category,comment が /api/b/admin/report にPOSTされる", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("{}", { status: 200 }))
    setup()

    clickPhoto("第1工具棚", 150, 70) // 0.25, 0.2
    clickPhoto("第1工具棚", 300, 150) // 1, 1

    const comments = screen.getAllByPlaceholderText("コメントを入力...")
    fireEvent.change(comments[0], { target: { value: "通路が塞がっています" } })
    fireEvent.change(comments[1], { target: { value: "ラベリングを推奨します" } })
    fireEvent.change(screen.getAllByRole("combobox")[0], { target: { value: "safety" } })
    fireEvent.change(screen.getAllByRole("combobox")[1], { target: { value: "suggestion" } })

    fireEvent.click(screen.getByRole("button", { name: "レポートを送信 ✓" }))

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1))
    const [url, init] = fetchSpy.mock.calls[0]
    expect(url).toBe("/api/b/admin/report")
    expect(init?.method).toBe("POST")
    expect(JSON.parse(String(init?.body))).toEqual({
      scan_id: "s1",
      markers: [
        { x: 0.25, y: 0.2, category: "safety", comment: "通路が塞がっています" },
        { x: 1, y: 1, category: "suggestion", comment: "ラベリングを推奨します" },
      ],
    })
  })

  it("送信に成功すると未対応バッジが減り、次の未対応スキャンが選択される", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 200 }))
    setup([scan("s1", "第1工具棚"), scan("s2", "組立作業台")])

    expect(screen.getByRole("heading", { name: "第1工具棚" })).toBeInTheDocument()

    clickPhoto("第1工具棚", 150, 70)
    fireEvent.change(screen.getByPlaceholderText("コメントを入力..."), {
      target: { value: "通路が塞がっています" },
    })
    fireEvent.click(screen.getByRole("button", { name: "レポートを送信 ✓" }))

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "組立作業台" })).toBeInTheDocument()
    )
    expect(screen.getByText("未対応 1")).toBeInTheDocument()
    expect(screen.queryByPlaceholderText("コメントを入力...")).not.toBeInTheDocument()
  })

  it("送信が失敗するとエラーを表示し、入力したマーカーは保持される", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("ng", { status: 500 }))
    setup()

    clickPhoto("第1工具棚", 150, 70)
    fireEvent.change(screen.getByPlaceholderText("コメントを入力..."), {
      target: { value: "通路が塞がっています" },
    })
    fireEvent.click(screen.getByRole("button", { name: "レポートを送信 ✓" }))

    expect(await screen.findByText("送信に失敗しました")).toBeInTheDocument()
    expect(screen.getByPlaceholderText("コメントを入力...")).toHaveValue("通路が塞がっています")
    expect(screen.getByText("未対応 1")).toBeInTheDocument()
  })
})
