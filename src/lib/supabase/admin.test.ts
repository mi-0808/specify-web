import { describe, expect, it, vi } from "vitest"
import { createAdminClient, getAdminEmails, isAdminEmail } from "./admin"

describe("getAdminEmails", () => {
  it("ADMIN_EMAILSが未設定なら空配列を返す", () => {
    vi.stubEnv("ADMIN_EMAILS", undefined)

    expect(getAdminEmails()).toEqual([])
  })

  it("ADMIN_EMAILSが空文字なら空配列を返す（空文字のアドレスを作らない）", () => {
    vi.stubEnv("ADMIN_EMAILS", "")

    expect(getAdminEmails()).toEqual([])
  })

  it("区切り文字と空白だけの値なら空配列を返す", () => {
    vi.stubEnv("ADMIN_EMAILS", " , ,,")

    expect(getAdminEmails()).toEqual([])
  })

  it("単一アドレスをそのまま1件返す", () => {
    vi.stubEnv("ADMIN_EMAILS", "admin@example.com")

    expect(getAdminEmails()).toEqual(["admin@example.com"])
  })

  it("カンマ区切りの複数アドレスを設定順に返す", () => {
    vi.stubEnv("ADMIN_EMAILS", "first@example.com,second@example.com,third@example.com")

    expect(getAdminEmails()).toEqual([
      "first@example.com",
      "second@example.com",
      "third@example.com",
    ])
  })

  it("各アドレスの前後の空白・改行を取り除く", () => {
    vi.stubEnv("ADMIN_EMAILS", "  a@example.com ,\tb@example.com\n, c@example.com  ")

    expect(getAdminEmails()).toEqual(["a@example.com", "b@example.com", "c@example.com"])
  })

  it("末尾カンマや連続カンマによる空要素は除外する", () => {
    vi.stubEnv("ADMIN_EMAILS", "a@example.com,,b@example.com,")

    expect(getAdminEmails()).toEqual(["a@example.com", "b@example.com"])
  })

  it("アドレス内の大文字は正規化されずそのまま返る", () => {
    vi.stubEnv("ADMIN_EMAILS", "Admin@Example.COM")

    expect(getAdminEmails()).toEqual(["Admin@Example.COM"])
  })

  it("環境変数を読み直すので呼び出しごとに最新の値を反映する", () => {
    vi.stubEnv("ADMIN_EMAILS", "old@example.com")
    expect(getAdminEmails()).toEqual(["old@example.com"])

    vi.stubEnv("ADMIN_EMAILS", "new@example.com")
    expect(getAdminEmails()).toEqual(["new@example.com"])
  })
})

describe("isAdminEmail", () => {
  it("ADMIN_EMAILSに含まれるアドレスならtrueを返す", () => {
    vi.stubEnv("ADMIN_EMAILS", "admin@example.com,ops@example.com")

    expect(isAdminEmail("admin@example.com")).toBe(true)
    expect(isAdminEmail("ops@example.com")).toBe(true)
  })

  it("ADMIN_EMAILSに含まれないアドレスならfalseを返す", () => {
    vi.stubEnv("ADMIN_EMAILS", "admin@example.com")

    expect(isAdminEmail("user@example.com")).toBe(false)
  })

  it("ADMIN_EMAILSが未設定なら誰も管理者にならない", () => {
    vi.stubEnv("ADMIN_EMAILS", undefined)

    expect(isAdminEmail("admin@example.com")).toBe(false)
  })

  it("スペース区切りで設定された値は1件として扱われ個々のアドレスは一致しない", () => {
    vi.stubEnv("ADMIN_EMAILS", "admin@example.com ops@example.com")

    expect(getAdminEmails()).toEqual(["admin@example.com ops@example.com"])
    expect(isAdminEmail("admin@example.com")).toBe(false)
    expect(isAdminEmail("ops@example.com")).toBe(false)
  })

  it("emailがnull・undefined・空文字ならfalseを返す", () => {
    vi.stubEnv("ADMIN_EMAILS", "admin@example.com")

    expect(isAdminEmail(null)).toBe(false)
    expect(isAdminEmail(undefined)).toBe(false)
    expect(isAdminEmail("")).toBe(false)
  })

  it("設定側に余分な空白があっても一致する", () => {
    vi.stubEnv("ADMIN_EMAILS", "  admin@example.com  ,  ops@example.com")

    expect(isAdminEmail("admin@example.com")).toBe(true)
    expect(isAdminEmail("ops@example.com")).toBe(true)
  })

  it("引数側の前後の空白を無視して一致する", () => {
    vi.stubEnv("ADMIN_EMAILS", "admin@example.com")

    expect(isAdminEmail(" admin@example.com")).toBe(true)
    expect(isAdminEmail("admin@example.com\n")).toBe(true)
  })

  it("大文字小文字の違いを無視して一致する（Supabaseは小文字で保持するため）", () => {
    vi.stubEnv("ADMIN_EMAILS", "admin@example.com")

    expect(isAdminEmail("Admin@Example.com")).toBe(true)
    expect(isAdminEmail("ADMIN@EXAMPLE.COM")).toBe(true)
  })

  it("ADMIN_EMAILSに大文字で設定しても小文字のログインメールで管理者になる", () => {
    vi.stubEnv("ADMIN_EMAILS", "Admin@Example.com")

    expect(isAdminEmail("admin@example.com")).toBe(true)
  })

  it("部分一致では管理者にならない（前方・後方に文字が付いたアドレスを拒否する）", () => {
    vi.stubEnv("ADMIN_EMAILS", "admin@example.com")

    expect(isAdminEmail("admin@example.com.attacker.test")).toBe(false)
    expect(isAdminEmail("xadmin@example.com")).toBe(false)
    expect(isAdminEmail("admin@example.co")).toBe(false)
  })
})

describe("createAdminClient", () => {
  it("URLとサービスロールキーからクライアントを作る", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co")
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-key")

    const client = createAdminClient() as unknown as {
      supabaseUrl: string
      supabaseKey: string
    }

    expect(client.supabaseUrl).toBe("https://project.supabase.co")
    expect(client.supabaseKey).toBe("service-role-key")
  })

  it("セッションを永続化せずトークンも自動更新しない（サービスロール鍵を保持しない）", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co")
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-key")

    const client = createAdminClient() as unknown as {
      auth: { persistSession: boolean; autoRefreshToken: boolean }
    }

    // supabase-js の既定値はどちらも true なので、false であることは明示指定の証拠になる
    expect(client.auth.persistSession).toBe(false)
    expect(client.auth.autoRefreshToken).toBe(false)
  })

  it("サービスロールキーが未設定なら例外を投げる（匿名キーで動き続けない）", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co")
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", undefined)

    expect(() => createAdminClient()).toThrow(/supabaseKey is required/)
  })

  it("URLが未設定なら例外を投げる", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", undefined)
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-key")

    expect(() => createAdminClient()).toThrow(/supabaseUrl is required/)
  })
})
