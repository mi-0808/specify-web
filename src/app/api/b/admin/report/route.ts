import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

async function sendUserEmail(to: string, areaName: string, reportUrl: string) {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Specify <onboarding@resend.dev>",
      to,
      subject: `【Specify】現場レポートが届きました：${areaName}`,
      html: `<p>現場レポートが完成しました。</p><p>エリア: <strong>${areaName}</strong></p><p><a href="${reportUrl}">レポートを確認する</a></p>`,
    }),
  }).catch(() => {})
}

export async function POST(req: NextRequest) {
  // ログインユーザーの確認（anon keyで）
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const adminEmails = (process.env.ADMIN_EMAILS ?? "").split(",").map((e) => e.trim())
  if (!user || !adminEmails.includes(user.email ?? "")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 })
  }

  const { scan_id, markers } = await req.json()
  if (!scan_id || !Array.isArray(markers)) {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 })
  }

  // DB操作はservice role keyで（RLSをバイパス）
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createAdminClient() as any

  const { data: scan, error: scanError } = await db
    .from("b_scans")
    .select("id, user_id, area_name")
    .eq("id", scan_id)
    .single()

  if (scanError || !scan) {
    return NextResponse.json({ error: "scan not found" }, { status: 404 })
  }

  // マーカー挿入
  if (markers.length > 0) {
    const rows = markers.map(
      (m: { x: number; y: number; category: string; comment: string }, i: number) => ({
        scan_id,
        x: m.x,
        y: m.y,
        category: m.category,
        comment: m.comment,
        sort_order: i,
      })
    )
    const { error: markerError } = await db.from("b_markers").insert(rows)
    if (markerError) {
      return NextResponse.json({ error: "marker insert failed" }, { status: 500 })
    }
  }

  // スキャンをdoneに更新
  await db.from("b_scans").update({ status: "done" }).eq("id", scan_id)

  // 担当者のメールアドレスを取得して通知
  const { data: userData } = await db.auth.admin.getUserById(scan.user_id)
  if (userData?.user?.email) {
    const reportUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/b/report/${scan_id}`
    sendUserEmail(userData.user.email, scan.area_name, reportUrl)
  }

  return NextResponse.json({ ok: true })
}
