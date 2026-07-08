import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

async function notifyAdmin(areaName: string, userEmail: string) {
  const apiKey = process.env.RESEND_API_KEY
  const adminEmail = (process.env.ADMIN_EMAILS ?? "").split(",")[0].trim()
  if (!apiKey || !adminEmail) return

  const adminUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/b/admin`
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Specify <onboarding@resend.dev>",
      to: adminEmail,
      subject: `【Specify】新しいスキャンが届きました：${areaName}`,
      html: `<p>新しいスキャンが届きました。</p><p>エリア: <strong>${areaName}</strong></p><p>送信者: ${userEmail}</p><p><a href="${adminUrl}">管理画面を開く</a></p>`,
    }),
  }).catch(() => {})
}

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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any
  const { data: scan, error: scanError } = await db
    .from("b_scans")
    .insert({ user_id: user.id, area_name, image_url: urlData.publicUrl, status: "pending" })
    .select("id")
    .single()

  if (scanError || !scan) {
    return NextResponse.json({ error: "scan insert failed" }, { status: 500 })
  }

  // 管理者へメール通知（非同期・失敗しても無視）
  notifyAdmin(area_name, user.email ?? "不明")

  return NextResponse.json({ scan_id: scan.id, status: "pending" })
}
