import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const { sendEmailMock } = vi.hoisted(() => ({ sendEmailMock: vi.fn() }))

// after() は「渡されたコールバックを即座に実行する」実装に差し替える。
// NextRequest / NextResponse は実物を使う。
vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>()
  return {
    ...actual,
    after: (callback: () => unknown) => {
      void callback()
    },
  }
})

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }))

// 本文の組み立て（buildScanNotification）は実物を使い、送信だけを差し替える
vi.mock("@/lib/email", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/email")>()
  return { ...actual, sendEmail: sendEmailMock }
})

import { createClient } from "@/lib/supabase/server"
import { POST } from "./route"

const PNG_BYTES = "dummy-png-bytes"
const PNG_DATA_URL = `data:image/png;base64,${Buffer.from(PNG_BYTES).toString("base64")}`

type UploadCall = { path: string; body: Buffer; contentType: string | undefined }

function createSupabaseStub(
  overrides: {
    user?: { id: string; email?: string | null } | null
    uploadError?: { message: string } | null
    scanResult?: { data: { id: string } | null; error: { message: string } | null }
  } = {}
) {
  const {
    user = { id: "user-1", email: "sender@example.com" },
    uploadError = null,
    scanResult = { data: { id: "scan-1" }, error: null },
  } = overrides

  const uploadCalls: UploadCall[] = []
  const removedPaths: string[][] = []
  const insertCalls: Record<string, unknown>[] = []
  const buckets: string[] = []
  const tables: string[] = []

  const supabase = {
    auth: {
      getUser: async () => ({ data: { user } }),
    },
    storage: {
      from(bucket: string) {
        buckets.push(bucket)
        return {
          async upload(path: string, body: Buffer, options?: { contentType?: string }) {
            uploadCalls.push({ path, body, contentType: options?.contentType })
            return { data: uploadError ? null : { path }, error: uploadError }
          },
          getPublicUrl(path: string) {
            return { data: { publicUrl: `https://cdn.example.com/${path}` } }
          },
          async remove(paths: string[]) {
            removedPaths.push(paths)
            return { data: paths.map((path) => ({ name: path })), error: null }
          },
        }
      },
    },
    from(table: string) {
      tables.push(table)
      return {
        insert(payload: Record<string, unknown>) {
          insertCalls.push(payload)
          return {
            select: () => ({ single: async () => scanResult }),
          }
        },
      }
    },
  }

  vi.mocked(createClient).mockResolvedValue(supabase as never)

  return { uploadCalls, removedPaths, insertCalls, buckets, tables }
}

function scanRequest(body: unknown) {
  return new NextRequest("http://localhost/api/b/scan", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  })
}

describe("POST /api/b/scan", () => {
  beforeEach(() => {
    sendEmailMock.mockClear()
    sendEmailMock.mockResolvedValue({ sent: true })
    vi.stubEnv("ADMIN_EMAILS", "admin@example.com")
    vi.stubEnv("NEXT_PUBLIC_BASE_URL", "https://specify.example.com")
  })

  it("未ログインなら401を返し、画像アップロードもしない", async () => {
    const { uploadCalls, insertCalls } = createSupabaseStub({ user: null })

    const res = await POST(scanRequest({ area_name: "第1工具棚", image: PNG_DATA_URL }))

    expect(res.status).toBe(401)
    await expect(res.json()).resolves.toEqual({ error: "unauthorized" })
    expect(uploadCalls).toHaveLength(0)
    expect(insertCalls).toHaveLength(0)
    expect(sendEmailMock).not.toHaveBeenCalled()
  })

  it("area_nameが欠けていれば400を返す", async () => {
    const { uploadCalls } = createSupabaseStub()

    const res = await POST(scanRequest({ image: PNG_DATA_URL }))

    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({ error: "area_name and image are required" })
    expect(uploadCalls).toHaveLength(0)
  })

  it("imageが欠けていれば400を返す", async () => {
    createSupabaseStub()

    const res = await POST(scanRequest({ area_name: "第1工具棚" }))

    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({ error: "area_name and image are required" })
  })

  it("area_nameが空文字なら400を返す", async () => {
    createSupabaseStub()

    const res = await POST(scanRequest({ area_name: "", image: PNG_DATA_URL }))

    expect(res.status).toBe(400)
  })

  it("Storageのアップロードに失敗したら500を返し、b_scansへは書き込まない", async () => {
    const { insertCalls } = createSupabaseStub({ uploadError: { message: "bucket not found" } })

    const res = await POST(scanRequest({ area_name: "第1工具棚", image: PNG_DATA_URL }))

    expect(res.status).toBe(500)
    await expect(res.json()).resolves.toEqual({ error: "image upload failed" })
    expect(insertCalls).toHaveLength(0)
    expect(sendEmailMock).not.toHaveBeenCalled()
  })

  it("b_scansのinsertが失敗したら500を返し、メール通知もしない", async () => {
    createSupabaseStub({ scanResult: { data: null, error: { message: "violates rls" } } })

    const res = await POST(scanRequest({ area_name: "第1工具棚", image: PNG_DATA_URL }))

    expect(res.status).toBe(500)
    await expect(res.json()).resolves.toEqual({ error: "scan insert failed" })
    expect(sendEmailMock).not.toHaveBeenCalled()
  })

  it("insert失敗時はアップロード済みの画像をStorageから削除して孤児を残さない", async () => {
    const { uploadCalls, removedPaths } = createSupabaseStub({
      scanResult: { data: null, error: { message: "violates rls" } },
    })

    await POST(scanRequest({ area_name: "第1工具棚", image: PNG_DATA_URL }))

    expect(uploadCalls).toHaveLength(1)
    expect(removedPaths).toEqual([[uploadCalls[0].path]])
  })

  it("insertが成功したときはStorageの削除を行わない", async () => {
    const { removedPaths } = createSupabaseStub()

    await POST(scanRequest({ area_name: "第1工具棚", image: PNG_DATA_URL }))

    expect(removedPaths).toEqual([])
  })

  it("ボディが不正なJSONなら例外にせず400を返す", async () => {
    const { uploadCalls } = createSupabaseStub()

    const res = await POST(
      new NextRequest("http://localhost/api/b/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "not json",
      })
    )

    expect(res.status).toBe(400)
    expect(uploadCalls).toHaveLength(0)
  })

  it("imageが文字列でなければ400を返す（image.replaceで落ちない）", async () => {
    const { uploadCalls } = createSupabaseStub()

    const res = await POST(scanRequest({ area_name: "第1工具棚", image: 12345 }))

    expect(res.status).toBe(400)
    expect(uploadCalls).toHaveLength(0)
  })

  it("area_nameが空白のみなら400を返す", async () => {
    const { uploadCalls } = createSupabaseStub()

    const res = await POST(scanRequest({ area_name: "   ", image: PNG_DATA_URL }))

    expect(res.status).toBe(400)
    expect(uploadCalls).toHaveLength(0)
  })

  it("insertがエラーなしでも行が返ってこなければ500を返す", async () => {
    createSupabaseStub({ scanResult: { data: null, error: null } })

    const res = await POST(scanRequest({ area_name: "第1工具棚", image: PNG_DATA_URL }))

    expect(res.status).toBe(500)
    await expect(res.json()).resolves.toEqual({ error: "scan insert failed" })
  })

  it("成功時はscan_idとstatus=pendingを返す", async () => {
    createSupabaseStub()

    const res = await POST(scanRequest({ area_name: "第1工具棚", image: PNG_DATA_URL }))

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ scan_id: "scan-1", status: "pending" })
  })

  it("data URLのヘッダを外した画像本体を、拡張子付きのユーザー別パスへアップロードする", async () => {
    const { uploadCalls, buckets } = createSupabaseStub()

    await POST(scanRequest({ area_name: "第1工具棚", image: PNG_DATA_URL }))

    expect(buckets).toContain("specify-images")
    expect(uploadCalls).toHaveLength(1)
    const [upload] = uploadCalls
    expect(upload.path).toMatch(/^b-scans\/user-1\/\d+\.png$/)
    expect(upload.contentType).toBe("image/png")
    expect(upload.body.toString("utf8")).toBe(PNG_BYTES)
  })

  it("data URLでない画像は拡張子jpgとして扱う", async () => {
    const { uploadCalls } = createSupabaseStub()

    await POST(
      scanRequest({ area_name: "第1工具棚", image: Buffer.from(PNG_BYTES).toString("base64") })
    )

    expect(uploadCalls[0].path).toMatch(/\.jpg$/)
    expect(uploadCalls[0].contentType).toBe("image/jpg")
  })

  it("b_scansへは公開URLとstatus=pendingを含む行を保存する", async () => {
    const { insertCalls, tables, uploadCalls } = createSupabaseStub()

    await POST(scanRequest({ area_name: "第1工具棚", image: PNG_DATA_URL }))

    expect(tables).toEqual(["b_scans"])
    expect(insertCalls).toEqual([
      {
        user_id: "user-1",
        area_name: "第1工具棚",
        image_url: `https://cdn.example.com/${uploadCalls[0].path}`,
        status: "pending",
      },
    ])
  })

  it("ADMIN_EMAILSが設定されていれば先頭の管理者へエリア名と送信者を含むメールを送る", async () => {
    vi.stubEnv("ADMIN_EMAILS", " admin1@example.com , admin2@example.com ")
    createSupabaseStub()

    const res = await POST(scanRequest({ area_name: "第1工具棚", image: PNG_DATA_URL }))

    expect(res.status).toBe(200)
    expect(sendEmailMock).toHaveBeenCalledTimes(1)
    const [args] = sendEmailMock.mock.calls[0]
    expect(args.to).toBe("admin1@example.com")
    expect(args.subject).toContain("第1工具棚")
    expect(args.html).toContain("sender@example.com")
    expect(args.html).toContain("https://specify.example.com/b/admin")
  })

  it("ログインユーザーのメールが取れない場合は送信者を「不明」として通知する", async () => {
    createSupabaseStub({ user: { id: "user-1", email: null } })

    await POST(scanRequest({ area_name: "第1工具棚", image: PNG_DATA_URL }))

    expect(sendEmailMock).toHaveBeenCalledTimes(1)
    const [args] = sendEmailMock.mock.calls[0]
    expect(args.html).toContain("送信者: 不明")
    expect(args.html).not.toContain("sender@example.com")
  })

  it("area_nameのHTMLはエスケープして通知本文に入れる", async () => {
    createSupabaseStub()

    await POST(scanRequest({ area_name: "<script>x</script>棚", image: PNG_DATA_URL }))

    const [args] = sendEmailMock.mock.calls[0]
    expect(args.html).toContain("&lt;script&gt;x&lt;/script&gt;棚")
    expect(args.html).not.toContain("<script>")
  })

  it("ADMIN_EMAILS未設定ならメールを送らずに成功レスポンスを返す", async () => {
    vi.stubEnv("ADMIN_EMAILS", "")
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
    createSupabaseStub()

    const res = await POST(scanRequest({ area_name: "第1工具棚", image: PNG_DATA_URL }))

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ scan_id: "scan-1", status: "pending" })
    expect(sendEmailMock).not.toHaveBeenCalled()
    expect(warnSpy).toHaveBeenCalled()
  })

  it("ADMIN_EMAILSがカンマだけの空値ならメールを送らない", async () => {
    vi.stubEnv("ADMIN_EMAILS", " , ")
    vi.spyOn(console, "warn").mockImplementation(() => {})
    createSupabaseStub()

    const res = await POST(scanRequest({ area_name: "第1工具棚", image: PNG_DATA_URL }))

    expect(res.status).toBe(200)
    expect(sendEmailMock).not.toHaveBeenCalled()
  })
})
