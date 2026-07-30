// Resend経由のメール通知。
// RESEND_API_KEY が未設定の環境（ローカル等）では送信をスキップする。

const RESEND_ENDPOINT = "https://api.resend.com/emails"
const DEFAULT_FROM = "Specify <onboarding@resend.dev>"

type SendResult = { sent: boolean; reason?: string }

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string
  subject: string
  html: string
}): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.warn(`[email] RESEND_API_KEY未設定のため送信をスキップ: ${subject}`)
    return { sent: false, reason: "RESEND_API_KEY not set" }
  }

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        // 空文字が設定されているケースもフォールバックさせる（?? では空文字が通ってしまう）
        from: process.env.RESEND_FROM || DEFAULT_FROM,
        to,
        subject,
        html,
      }),
    })

    if (!res.ok) {
      const body = await res.text()
      console.error(`[email] 送信失敗 (${res.status}): ${subject} / ${body}`)
      return { sent: false, reason: `resend responded ${res.status}` }
    }

    return { sent: true }
  } catch (error) {
    console.error(`[email] 送信中に例外: ${subject}`, error)
    return { sent: false, reason: "fetch failed" }
  }
}

/** 新しいスキャンが届いたことを管理者に知らせる（ToB） */
export function buildScanNotification(areaName: string, senderEmail: string) {
  const adminUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/b/admin`
  return {
    subject: `【Specify】新しいスキャンが届きました：${areaName}`,
    html: [
      "<p>新しいスキャンが届きました。</p>",
      `<p>エリア: <strong>${escapeHtml(areaName)}</strong></p>`,
      `<p>送信者: ${escapeHtml(senderEmail)}</p>`,
      `<p><a href="${adminUrl}">管理画面を開く</a></p>`,
    ].join(""),
  }
}

/** レポート完成を担当者に知らせる（ToB） */
export function buildReportNotification(areaName: string, reportUrl: string) {
  return {
    subject: `【Specify】現場レポートが届きました：${areaName}`,
    html: [
      "<p>現場レポートが完成しました。</p>",
      `<p>エリア: <strong>${escapeHtml(areaName)}</strong></p>`,
      `<p><a href="${reportUrl}">レポートを確認する</a></p>`,
    ].join(""),
  }
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}
