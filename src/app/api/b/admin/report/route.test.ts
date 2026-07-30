import { beforeEach, describe, expect, it, vi } from "vitest"
import type { NextRequest } from "next/server"
import { POST } from "./route"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { sendEmail } from "@/lib/email"

// after() はレスポンス後に実行されるため、テストではコールバックを溜めて flushAfter() で明示的に走らせる
const { afterCallbacks } = vi.hoisted(() => ({
  afterCallbacks: [] as Array<() => unknown>,
}))

vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>()
  return {
    ...actual,
    after: (fn: () => unknown) => {
      afterCallbacks.push(fn)
    },
  }
})

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }))

vi.mock("@/lib/supabase/admin", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/supabase/admin")>()
  // isAdminEmail は本物（ADMIN_EMAILS の実挙動を確かめたい）
  return { ...actual, createAdminClient: vi.fn() }
})

vi.mock("@/lib/email", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/email")>()
  // buildReportNotification は本物、送信だけ差し替える
  return { ...actual, sendEmail: vi.fn(async () => ({ sent: true })) }
})

const ADMIN_EMAIL = "admin@example.com"

async function flushAfter() {
  const callbacks = afterCallbacks.splice(0, afterCallbacks.length)
  for (const cb of callbacks) await cb()
}

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

type DbOptions = {
  scan?: { id: string; user_id: string; area_name: string } | null
  scanError?: { message: string } | null
  markerError?: { message: string } | null
  statusError?: { message: string } | null
  recipientEmail?: string | null
}

function stubAdminDb(options: DbOptions = {}) {
  const {
    scan = { id: "scan-1", user_id: "user-1", area_name: "第1工具棚" },
    scanError = null,
    markerError = null,
    statusError = null,
    recipientEmail = "tanaka@example.com",
  } = options

  const single = vi.fn(async () => ({ data: scan, error: scanError }))
  const selectEq = vi.fn(() => ({ single }))
  const select = vi.fn(() => ({ eq: selectEq }))
  const insert = vi.fn(async (rows: unknown) => { void rows; return { error: markerError } })
  const updateEq = vi.fn(async () => ({ error: statusError }))
  const update = vi.fn((values: unknown) => { void values; return { eq: updateEq } })
  // どのテーブルに対する update だったかを記録する（from の呼び出し順に依存せず検証するため）
  const updatedTables: string[] = []
  const insertedTables: string[] = []
  const getUserById = vi.fn(async () => ({
    data: { user: recipientEmail ? { email: recipientEmail } : null },
  }))

  const from = vi.fn((table: string) => ({
    select,
    insert: (rows: unknown) => {
      insertedTables.push(table)
      return insert(rows)
    },
    update: (values: unknown) => {
      updatedTables.push(table)
      return update(values as never)
    },
  }))

  const db = { from, auth: { admin: { getUserById } } }
  vi.mocked(createAdminClient).mockReturnValue(
    db as unknown as ReturnType<typeof createAdminClient>
  )

  return {
    from,
    select,
    selectEq,
    single,
    insert,
    insertedTables,
    update,
    updateEq,
    updatedTables,
    getUserById,
  }
}

describe("POST /api/b/admin/report", () => {
  beforeEach(() => {
    afterCallbacks.length = 0
    vi.mocked(createClient).mockReset()
    vi.mocked(createAdminClient).mockReset()
    vi.mocked(sendEmail).mockReset()
    vi.mocked(sendEmail).mockResolvedValue({ sent: true })
    vi.stubEnv("ADMIN_EMAILS", ADMIN_EMAIL)
    vi.stubEnv("NEXT_PUBLIC_BASE_URL", "https://specify.example.com")
    stubLoggedInAs(ADMIN_EMAIL)
  })

  it("未ログインなら403を返しDBに触らない", async () => {
    stubLoggedInAs(null)
    stubAdminDb()

    const res = await POST(makeRequest({ scan_id: "scan-1", markers: [] }))

    expect(res.status).toBe(403)
    await expect(res.json()).resolves.toEqual({ error: "forbidden" })
    expect(createAdminClient).not.toHaveBeenCalled()
  })

  it("ADMIN_EMAILSに含まれないユーザーなら403を返す", async () => {
    stubLoggedInAs("stranger@example.com")
    stubAdminDb()

    const res = await POST(makeRequest({ scan_id: "scan-1", markers: [] }))

    expect(res.status).toBe(403)
    expect(createAdminClient).not.toHaveBeenCalled()
  })

  it("ADMIN_EMAILSが未設定なら管理者は存在せず403を返す", async () => {
    vi.stubEnv("ADMIN_EMAILS", "")
    stubAdminDb()

    const res = await POST(makeRequest({ scan_id: "scan-1", markers: [] }))

    expect(res.status).toBe(403)
    expect(createAdminClient).not.toHaveBeenCalled()
  })

  it("ADMIN_EMAILSがカンマ区切り・空白入りでも該当ユーザーは通す", async () => {
    vi.stubEnv("ADMIN_EMAILS", ` other@example.com , ${ADMIN_EMAIL} `)
    const db = stubAdminDb()

    const res = await POST(makeRequest({ scan_id: "scan-1", markers: [] }))

    expect(res.status).toBe(200)
    expect(db.updatedTables).toEqual(["b_scans"])
  })

  it("scan_idが無ければ400を返す", async () => {
    stubAdminDb()

    const res = await POST(makeRequest({ markers: [] }))

    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({ error: "invalid payload" })
    expect(createAdminClient).not.toHaveBeenCalled()
  })

  it("markersが配列でなければ400を返す", async () => {
    stubAdminDb()

    const res = await POST(makeRequest({ scan_id: "scan-1", markers: "not-an-array" }))

    expect(res.status).toBe(400)
    expect(createAdminClient).not.toHaveBeenCalled()
  })

  it("markersが未指定なら400を返す", async () => {
    stubAdminDb()

    const res = await POST(makeRequest({ scan_id: "scan-1" }))

    expect(res.status).toBe(400)
    expect(createAdminClient).not.toHaveBeenCalled()
  })

  it("存在しないscan_idなら404を返し更新も通知もしない", async () => {
    const db = stubAdminDb({ scan: null, scanError: { message: "no rows" } })

    const res = await POST(makeRequest({ scan_id: "missing", markers: [] }))

    expect(res.status).toBe(404)
    await expect(res.json()).resolves.toEqual({ error: "scan not found" })
    expect(db.update).not.toHaveBeenCalled()
    expect(db.getUserById).not.toHaveBeenCalled()
    expect(afterCallbacks).toHaveLength(0)
  })

  it("エラーは無くてもscanが取れなければ404を返す", async () => {
    const db = stubAdminDb({ scan: null, scanError: null })

    const res = await POST(makeRequest({ scan_id: "missing", markers: [] }))

    expect(res.status).toBe(404)
    expect(db.updatedTables).toEqual([])
  })

  it("マーカーが並び順どおりのsort_orderとscan_id付きで挿入される", async () => {
    const db = stubAdminDb()
    const markers = [
      { x: 0.1, y: 0.2, category: "safety", comment: "床の油" },
      { x: 0.3, y: 0.4, category: "flow", comment: "工具が散乱" },
    ]

    const res = await POST(makeRequest({ scan_id: "scan-1", markers }))

    expect(res.status).toBe(200)
    expect(db.insert).toHaveBeenCalledWith([
      { scan_id: "scan-1", x: 0.1, y: 0.2, category: "safety", comment: "床の油", sort_order: 0 },
      { scan_id: "scan-1", x: 0.3, y: 0.4, category: "flow", comment: "工具が散乱", sort_order: 1 },
    ])
    expect(db.insertedTables).toEqual(["b_markers"])
  })

  it("マーカーの中身が不正なら400を返し、b_markersへ書き込まない", async () => {
    const db = stubAdminDb()

    const cases: unknown[] = [
      {},
      { x: "0.1", y: 0.2, category: "safety", comment: "床の油" },
      { x: 0.1, y: 0.2, category: "danger", comment: "床の油" },
      { x: 0.1, y: 0.2, category: "safety", comment: "   " },
      { x: Number.NaN, y: 0.2, category: "safety", comment: "床の油" },
      null,
    ]

    for (const marker of cases) {
      const res = await POST(makeRequest({ scan_id: "scan-1", markers: [marker] }))
      expect(res.status).toBe(400)
      await expect(res.json()).resolves.toEqual({ error: "invalid marker" })
    }

    expect(db.insert).not.toHaveBeenCalled()
    expect(db.update).not.toHaveBeenCalled()
  })

  it("座標が0〜1をわずかに外れても400にせず範囲内に丸めて保存する", async () => {
    const db = stubAdminDb()

    const res = await POST(
      makeRequest({
        scan_id: "scan-1",
        markers: [{ x: -0.001, y: 1.002, category: "flow", comment: "端の指摘" }],
      })
    )

    expect(res.status).toBe(200)
    expect(db.insert).toHaveBeenCalledWith([
      { scan_id: "scan-1", x: 0, y: 1, category: "flow", comment: "端の指摘", sort_order: 0 },
    ])
  })

  it("status更新が失敗したら500を返し、完成通知を送らない", async () => {
    const db = stubAdminDb({ statusError: { message: "violates rls" } })
    vi.spyOn(console, "error").mockImplementation(() => {})

    const res = await POST(makeRequest({ scan_id: "scan-1", markers: [] }))

    expect(res.status).toBe(500)
    await expect(res.json()).resolves.toEqual({ error: "status update failed" })
    expect(db.getUserById).not.toHaveBeenCalled()
    expect(afterCallbacks).toHaveLength(0)
    expect(vi.mocked(sendEmail)).not.toHaveBeenCalled()
  })

  it("markersが空配列ならb_markersへの挿入はしないがdone更新は行う", async () => {
    const db = stubAdminDb()

    const res = await POST(makeRequest({ scan_id: "scan-1", markers: [] }))

    expect(res.status).toBe(200)
    expect(db.insert).not.toHaveBeenCalled()
    expect(db.update).toHaveBeenCalledWith({ status: "done" })
    expect(db.updateEq).toHaveBeenCalledWith("id", "scan-1")
  })

  it("マーカー挿入に失敗したら500を返しdone更新も通知もしない", async () => {
    const db = stubAdminDb({ markerError: { message: "insert failed" } })

    const res = await POST(
      makeRequest({
        scan_id: "scan-1",
        markers: [{ x: 0.5, y: 0.5, category: "safety", comment: "床の油" }],
      })
    )

    expect(res.status).toBe(500)
    await expect(res.json()).resolves.toEqual({ error: "marker insert failed" })
    expect(db.update).not.toHaveBeenCalled()
    expect(db.getUserById).not.toHaveBeenCalled()
  })

  it("成功時にb_scansのstatusをdoneに更新して{ok:true}を返す", async () => {
    const db = stubAdminDb()

    const res = await POST(
      makeRequest({
        scan_id: "scan-1",
        markers: [{ x: 0.5, y: 0.5, category: "safety", comment: "床の油" }],
      })
    )

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ ok: true })
    expect(db.updatedTables).toEqual(["b_scans"])
    expect(db.update).toHaveBeenCalledWith({ status: "done" })
    expect(db.updateEq).toHaveBeenCalledWith("id", "scan-1")
  })

  it("担当者のメールアドレスが取れたらレポートURL入りの通知をafterで送る", async () => {
    const db = stubAdminDb({ recipientEmail: "tanaka@example.com" })

    await POST(makeRequest({ scan_id: "scan-1", markers: [] }))

    expect(db.getUserById).toHaveBeenCalledWith("user-1")
    // レスポンスを返した時点ではまだ送信していない
    expect(sendEmail).not.toHaveBeenCalled()

    await flushAfter()

    expect(sendEmail).toHaveBeenCalledTimes(1)
    const arg = vi.mocked(sendEmail).mock.calls[0][0]
    expect(arg.to).toBe("tanaka@example.com")
    expect(arg.subject).toContain("第1工具棚")
    expect(arg.html).toContain('href="https://specify.example.com/b/report/scan-1"')
  })

  it("担当者のメールアドレスが取れなければ通知を送らない", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
    stubAdminDb({ recipientEmail: null })

    const res = await POST(makeRequest({ scan_id: "scan-1", markers: [] }))

    expect(res.status).toBe(200)
    expect(afterCallbacks).toHaveLength(0)
    await flushAfter()
    expect(sendEmail).not.toHaveBeenCalled()
    expect(warnSpy.mock.calls.flat().join(" ")).toContain("scan=scan-1")
  })
})
