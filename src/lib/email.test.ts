import { describe, expect, it, vi } from "vitest"
import { buildReportNotification, buildScanNotification, sendEmail } from "./email"

describe("sendEmail", () => {
  it("RESEND_API_KEYが未設定なら送信せずスキップする", async () => {
    vi.stubEnv("RESEND_API_KEY", "")
    const fetchSpy = vi.spyOn(globalThis, "fetch")

    const result = await sendEmail({ to: "a@example.com", subject: "件名", html: "<p>本文</p>" })

    expect(result).toEqual({ sent: false, reason: "RESEND_API_KEY not set" })
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it("RESEND_FROMが設定されていれば送信元に使う", async () => {
    vi.stubEnv("RESEND_API_KEY", "test-key")
    vi.stubEnv("RESEND_FROM", "Specify <noreply@example.com>")
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("{}", { status: 200 }))

    const result = await sendEmail({ to: "a@example.com", subject: "件名", html: "<p>本文</p>" })

    expect(result).toEqual({ sent: true })
    const [url, init] = fetchSpy.mock.calls[0]
    expect(url).toBe("https://api.resend.com/emails")
    expect(JSON.parse(String(init?.body))).toMatchObject({
      from: "Specify <noreply@example.com>",
      to: "a@example.com",
      subject: "件名",
    })
    expect(init?.headers).toMatchObject({ Authorization: "Bearer test-key" })
  })

  it("RESEND_FROM未設定ならresend.devの既定アドレスにフォールバックする", async () => {
    vi.stubEnv("RESEND_API_KEY", "test-key")
    vi.stubEnv("RESEND_FROM", "")
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("{}", { status: 200 }))

    await sendEmail({ to: "a@example.com", subject: "件名", html: "<p>本文</p>" })

    const body = JSON.parse(String(fetchSpy.mock.calls[0][1]?.body))
    expect(body.from).toBe("Specify <onboarding@resend.dev>")
  })

  it("Resendがエラーを返したら理由付きで失敗を返す（例外は投げない）", async () => {
    vi.stubEnv("RESEND_API_KEY", "test-key")
    vi.spyOn(console, "error").mockImplementation(() => {})
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("rate limited", { status: 429 })
    )

    const result = await sendEmail({ to: "a@example.com", subject: "件名", html: "<p>本文</p>" })

    expect(result).toEqual({ sent: false, reason: "resend responded 429" })
  })

  it("fetchが例外を投げても呼び出し元には伝播させない", async () => {
    vi.stubEnv("RESEND_API_KEY", "test-key")
    vi.spyOn(console, "error").mockImplementation(() => {})
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network down"))

    await expect(
      sendEmail({ to: "a@example.com", subject: "件名", html: "<p>本文</p>" })
    ).resolves.toEqual({ sent: false, reason: "fetch failed" })
  })
})

describe("通知メールの本文", () => {
  it("スキャン通知に管理画面へのリンクとエリア名が入る", () => {
    vi.stubEnv("NEXT_PUBLIC_BASE_URL", "https://specify.example.com")

    const { subject, html } = buildScanNotification("第1工具棚", "tanaka@example.com")

    expect(subject).toContain("第1工具棚")
    expect(html).toContain("https://specify.example.com/b/admin")
    expect(html).toContain("tanaka@example.com")
  })

  it("エリア名のHTMLをエスケープする", () => {
    const { html } = buildScanNotification("<script>alert(1)</script>", "a@example.com")

    expect(html).not.toContain("<script>")
    expect(html).toContain("&lt;script&gt;")
  })

  it("レポート通知にレポートURLが入る", () => {
    const { subject, html } = buildReportNotification(
      "作業台B",
      "https://specify.example.com/b/report/abc"
    )

    expect(subject).toContain("作業台B")
    expect(html).toContain('href="https://specify.example.com/b/report/abc"')
  })
})
