import { NextRequest, NextResponse, after } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { buildScanNotification, sendEmail } from "@/lib/email"
import { getAdminEmails } from "@/lib/supabase/admin"

export async function POST(req: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const { area_name, image } = await req.json()
  if (!area_name || !image) {
    return NextResponse.json({ error: "area_name and image are required" }, { status: 400 })
  }

  // base64 → Uint8Array → Supabase Storage
  const base64Data = image.replace(/^data:image\/\w+;base64,/, "")
  const buffer = Buffer.from(base64Data, "base64")
  const ext = image.match(/^data:image\/(\w+);/)?.[1] ?? "jpg"
  const path = `b-scans/${user.id}/${Date.now()}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from("specify-images")
    .upload(path, buffer, { contentType: `image/${ext}` })

  if (uploadError) {
    return NextResponse.json({ error: "image upload failed" }, { status: 500 })
  }

  const { data: urlData } = supabase.storage.from("specify-images").getPublicUrl(path)

  const { data: scan, error: scanError } = await supabase
    .from("b_scans")
    .insert({ user_id: user.id, area_name, image_url: urlData.publicUrl, status: "pending" })
    .select("id")
    .single()

  if (scanError || !scan) {
    return NextResponse.json({ error: "scan insert failed" }, { status: 500 })
  }

  // 管理者へメール通知。レスポンスを待たせないが after() でランタイムに完了を保証させる
  const adminEmail = getAdminEmails()[0]
  if (adminEmail) {
    const { subject, html } = buildScanNotification(area_name, user.email ?? "不明")
    after(() => sendEmail({ to: adminEmail, subject, html }))
  } else {
    console.warn("[b/scan] ADMIN_EMAILS未設定のため管理者通知をスキップ")
  }

  return NextResponse.json({ scan_id: scan.id, status: "pending" })
}
