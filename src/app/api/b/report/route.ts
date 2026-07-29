import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(req: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const scanId = req.nextUrl.searchParams.get("scan_id")
  if (!scanId) return NextResponse.json({ error: "scan_id required" }, { status: 400 })

  const db = supabase

  const { data: scan, error } = await db
    .from("b_scans")
    .select("id, area_name, image_url, status, created_at")
    .eq("id", scanId)
    .eq("user_id", user.id)
    .single()

  if (error || !scan) {
    return NextResponse.json({ error: "not found" }, { status: 404 })
  }

  if (scan.status === "pending") {
    return NextResponse.json({ status: "pending" })
  }

  const { data: markers } = await db
    .from("b_markers")
    .select("id, x, y, category, comment, sort_order")
    .eq("scan_id", scanId)
    .order("sort_order", { ascending: true })

  return NextResponse.json({
    status: "done",
    area_name: scan.area_name,
    image_url: scan.image_url,
    markers: markers ?? [],
  })
}
