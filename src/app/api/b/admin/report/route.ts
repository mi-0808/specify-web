import { NextRequest, NextResponse, after } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient, isAdminEmail } from "@/lib/supabase/admin"
import { buildReportNotification, sendEmail } from "@/lib/email"

export async function POST(req: NextRequest) {
  // ログインユーザーの確認（anon keyで）
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!isAdminEmail(user?.email)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 })
  }

  const { scan_id, markers } = await req.json()
  if (!scan_id || !Array.isArray(markers)) {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 })
  }

  // DB操作はservice role keyで（RLSをバイパス）
  const db = createAdminClient()

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

  // 担当者のメールアドレスを取得して通知（after()でレスポンス後に確実に送る）
  const { data: userData } = await db.auth.admin.getUserById(scan.user_id)
  const recipient = userData?.user?.email
  if (recipient) {
    const reportUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/b/report/${scan_id}`
    const { subject, html } = buildReportNotification(scan.area_name, reportUrl)
    after(() => sendEmail({ to: recipient, subject, html }))
  } else {
    console.warn(`[b/admin/report] 担当者のメールアドレスが取得できず通知をスキップ: scan=${scan_id}`)
  }

  return NextResponse.json({ ok: true })
}
