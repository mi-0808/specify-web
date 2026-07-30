import { NextRequest, NextResponse, after } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient, isAdminEmail } from "@/lib/supabase/admin"
import { buildReportNotification, sendEmail } from "@/lib/email"

const CATEGORIES = ["safety", "flow", "suggestion"] as const

type MarkerInput = {
  x: number
  y: number
  category: (typeof CATEGORIES)[number]
  comment: string
}

function isValidMarker(marker: unknown): marker is MarkerInput {
  if (typeof marker !== "object" || marker === null) return false
  const { x, y, category, comment } = marker as Partial<MarkerInput>
  return (
    typeof x === "number" &&
    Number.isFinite(x) &&
    typeof y === "number" &&
    Number.isFinite(y) &&
    typeof category === "string" &&
    (CATEGORIES as readonly string[]).includes(category) &&
    typeof comment === "string" &&
    comment.trim().length > 0
  )
}

/**
 * 座標は写真に対する 0〜1 の比率。クリック位置の丸めで僅かに範囲外になることがあるため、
 * 400で管理者の入力を捨てるのではなく範囲に収める。
 */
function clampRatio(value: number): number {
  return Math.min(1, Math.max(0, value))
}

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
    if (!markers.every(isValidMarker)) {
      return NextResponse.json({ error: "invalid marker" }, { status: 400 })
    }
    const rows = markers.map((m: MarkerInput, i: number) => ({
      scan_id,
      x: clampRatio(m.x),
      y: clampRatio(m.y),
      category: m.category,
      comment: m.comment,
      sort_order: i,
    }))
    const { error: markerError } = await db.from("b_markers").insert(rows)
    if (markerError) {
      return NextResponse.json({ error: "marker insert failed" }, { status: 500 })
    }
  }

  // スキャンをdoneに更新。ここが失敗したまま完成通知を送ると、
  // 担当者はpendingのレポートのリンクを踏むことになる
  const { error: statusError } = await db
    .from("b_scans")
    .update({ status: "done" })
    .eq("id", scan_id)

  if (statusError) {
    console.error(`[b/admin/report] statusの更新に失敗: scan=${scan_id}`, statusError)
    return NextResponse.json({ error: "status update failed" }, { status: 500 })
  }

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
