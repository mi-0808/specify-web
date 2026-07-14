import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient, ADMIN_EMAILS } from "@/lib/supabase/admin"

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user?.email || !ADMIN_EMAILS.includes(user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { suggestion_id, markers } = await req.json()
  if (!suggestion_id || !Array.isArray(markers)) {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createAdminClient() as any

  if (markers.length > 0) {
    const rows = markers.map(
      (m: { image_type: string; x: number; y: number; comment: string }, i: number) => ({
        suggestion_id,
        image_type: m.image_type,
        x: m.x,
        y: m.y,
        comment: m.comment,
        sort_order: i,
      })
    )
    const { error } = await db.from("suggestion_markers").insert(rows)
    if (error) return NextResponse.json({ error: "marker insert failed" }, { status: 500 })
  }

  await db.from("suggestions").update({ status: "done" }).eq("id", suggestion_id)

  return NextResponse.json({ ok: true })
}
