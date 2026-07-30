import { describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

type Row = Record<string, unknown>

type OrderCall = { table: string; column: string; ascending: boolean | undefined }

type SupabaseStub = {
  auth: { getUser: () => Promise<{ data: { user: { id: string } | null } }> }
  from: (table: string) => unknown
  /** ルートが問い合わせたテーブル名の履歴 */
  queriedTables: string[]
  /** order() の引数の履歴 */
  orderCalls: OrderCall[]
}

let supabaseStub: SupabaseStub

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => supabaseStub,
}))

const { GET } = await import("./route")

/**
 * Supabase クライアントの簡易フェイク。
 * eq() の絞り込み・order() の並べ替え・select() の列射影を実際に行うので、
 * ルート側が正しい条件でクエリを組み立てているかを検証できる。
 */
function createSupabaseStub(options: {
  user?: { id: string } | null
  tables?: Record<string, Row[]>
  /** b_markers のクエリを失敗させて data: null を返す */
  failMarkers?: boolean
}): SupabaseStub {
  const tables = options.tables ?? {}
  const stub: SupabaseStub = {
    auth: {
      getUser: async () => ({ data: { user: options.user ?? null } }),
    },
    from: () => undefined,
    queriedTables: [],
    orderCalls: [],
  }

  stub.from = (table: string) => {
    stub.queriedTables.push(table)
    let rows = [...(tables[table] ?? [])]
    let columns: string[] = []

    const builder = {
      select(select: string) {
        columns = select.split(",").map((c) => c.trim())
        return builder
      },
      eq(column: string, value: unknown) {
        rows = rows.filter((row) => row[column] === value)
        return builder
      },
      order(column: string, opts?: { ascending?: boolean }) {
        stub.orderCalls.push({ table, column, ascending: opts?.ascending })
        if (table === "b_markers" && options.failMarkers) {
          return Promise.resolve({ data: null, error: { message: "boom" } })
        }
        rows.sort((a, b) => {
          const diff = Number(a[column]) - Number(b[column])
          return opts?.ascending === false ? -diff : diff
        })
        return Promise.resolve({ data: rows.map((row) => project(row, columns)), error: null })
      },
      single() {
        if (rows.length !== 1) {
          return Promise.resolve({ data: null, error: { message: "no rows returned" } })
        }
        return Promise.resolve({ data: project(rows[0], columns), error: null })
      },
    }
    return builder
  }

  return stub
}

function project(row: Row, columns: string[]): Row {
  const out: Row = {}
  for (const column of columns) out[column] = row[column]
  return out
}

const ME = { id: "user-me" }

function scanRow(overrides: Row = {}): Row {
  return {
    id: "scan-1",
    user_id: ME.id,
    area_name: "第1工具棚",
    image_url: "https://example.com/scan-1.jpg",
    status: "done",
    created_at: "2026-07-01T00:00:00Z",
    ...overrides,
  }
}

function markerRow(overrides: Row = {}): Row {
  return {
    id: "marker-1",
    scan_id: "scan-1",
    x: 0.1,
    y: 0.2,
    category: "safety",
    comment: "通路に工具が置かれています",
    sort_order: 0,
    created_at: "2026-07-02T00:00:00Z",
    ...overrides,
  }
}

function request(query = "") {
  return new NextRequest(`http://localhost/api/b/report${query}`)
}

describe("GET /api/b/report", () => {
  it("未ログインなら401を返しDBに一切問い合わせない", async () => {
    supabaseStub = createSupabaseStub({ user: null, tables: { b_scans: [scanRow()] } })

    const res = await GET(request("?scan_id=scan-1"))

    expect(res.status).toBe(401)
    await expect(res.json()).resolves.toEqual({ error: "unauthorized" })
    expect(supabaseStub.queriedTables).toEqual([])
  })

  it("scan_idが未指定なら400を返しDBに一切問い合わせない", async () => {
    supabaseStub = createSupabaseStub({ user: ME, tables: { b_scans: [scanRow()] } })

    const res = await GET(request())

    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({ error: "scan_id required" })
    expect(supabaseStub.queriedTables).toEqual([])
  })

  it("scan_idが空文字なら400を返す", async () => {
    supabaseStub = createSupabaseStub({ user: ME, tables: { b_scans: [scanRow()] } })

    const res = await GET(request("?scan_id="))

    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({ error: "scan_id required" })
  })

  it("存在しないscan_idなら404を返す", async () => {
    supabaseStub = createSupabaseStub({ user: ME, tables: { b_scans: [scanRow()] } })

    const res = await GET(request("?scan_id=scan-unknown"))

    expect(res.status).toBe(404)
    await expect(res.json()).resolves.toEqual({ error: "not found" })
  })

  it("他人のスキャンは存在しても404を返しマーカーも読まない", async () => {
    supabaseStub = createSupabaseStub({
      user: ME,
      tables: {
        b_scans: [scanRow({ id: "scan-other", user_id: "user-other" })],
        b_markers: [markerRow({ scan_id: "scan-other" })],
      },
    })

    const res = await GET(request("?scan_id=scan-other"))

    expect(res.status).toBe(404)
    await expect(res.json()).resolves.toEqual({ error: "not found" })
    expect(supabaseStub.queriedTables).toEqual(["b_scans"])
  })

  it("status=pendingならstatusだけを返しマーカーを問い合わせない", async () => {
    supabaseStub = createSupabaseStub({
      user: ME,
      tables: {
        b_scans: [scanRow({ status: "pending" })],
        b_markers: [markerRow()],
      },
    })

    const res = await GET(request("?scan_id=scan-1"))

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ status: "pending" })
    expect(supabaseStub.queriedTables).toEqual(["b_scans"])
  })

  it("status=doneならエリア名・画像URL・マーカーをsort_order昇順で返す", async () => {
    supabaseStub = createSupabaseStub({
      user: ME,
      tables: {
        b_scans: [scanRow()],
        b_markers: [
          markerRow({ id: "marker-c", sort_order: 2, comment: "3番目" }),
          markerRow({ id: "marker-a", sort_order: 0, comment: "1番目" }),
          markerRow({ id: "marker-b", sort_order: 1, comment: "2番目" }),
        ],
      },
    })

    const res = await GET(request("?scan_id=scan-1"))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe("done")
    expect(body.area_name).toBe("第1工具棚")
    expect(body.image_url).toBe("https://example.com/scan-1.jpg")
    expect(body.markers.map((m: Row) => m.id)).toEqual(["marker-a", "marker-b", "marker-c"])
    // scan の内部情報（id / user_id / created_at）はレスポンスに含めない
    expect(Object.keys(body).sort()).toEqual(["area_name", "image_url", "markers", "status"])
    expect(supabaseStub.orderCalls).toEqual([
      { table: "b_markers", column: "sort_order", ascending: true },
    ])
  })

  it("自分のスキャンが複数あってもscan_idで指定した1件だけを返す", async () => {
    supabaseStub = createSupabaseStub({
      user: ME,
      tables: {
        b_scans: [
          scanRow({ id: "scan-1", area_name: "第1工具棚" }),
          scanRow({ id: "scan-2", area_name: "第2工具棚", image_url: "https://example.com/scan-2.jpg" }),
        ],
        b_markers: [markerRow({ id: "for-scan-2", scan_id: "scan-2", comment: "2番の指摘" })],
      },
    })

    const res = await GET(request("?scan_id=scan-2"))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.area_name).toBe("第2工具棚")
    expect(body.image_url).toBe("https://example.com/scan-2.jpg")
    expect(body.markers.map((m: Row) => m.id)).toEqual(["for-scan-2"])
  })

  it("他のスキャンのマーカーは混ざらず、内部カラムも返さない", async () => {
    supabaseStub = createSupabaseStub({
      user: ME,
      tables: {
        b_scans: [scanRow()],
        b_markers: [
          markerRow({ id: "mine" }),
          markerRow({ id: "theirs", scan_id: "scan-2" }),
        ],
      },
    })

    const res = await GET(request("?scan_id=scan-1"))
    const body = await res.json()

    expect(body.markers).toEqual([
      {
        id: "mine",
        x: 0.1,
        y: 0.2,
        category: "safety",
        comment: "通路に工具が置かれています",
        sort_order: 0,
      },
    ])
    expect(Object.keys(body.markers[0])).not.toContain("scan_id")
  })

  it("マーカーが1件も無ければ空配列を返す", async () => {
    supabaseStub = createSupabaseStub({
      user: ME,
      tables: { b_scans: [scanRow()], b_markers: [] },
    })

    const res = await GET(request("?scan_id=scan-1"))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.status).toBe("done")
    expect(body.markers).toEqual([])
  })

  it("マーカー取得が失敗してもレポート本体は200で空配列を返す", async () => {
    supabaseStub = createSupabaseStub({
      user: ME,
      tables: { b_scans: [scanRow()], b_markers: [markerRow()] },
      failMarkers: true,
    })

    const res = await GET(request("?scan_id=scan-1"))

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({
      status: "done",
      area_name: "第1工具棚",
      image_url: "https://example.com/scan-1.jpg",
      markers: [],
    })
  })
})
