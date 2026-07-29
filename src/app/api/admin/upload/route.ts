import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient, isAdminEmail } from "@/lib/supabase/admin"

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!isAdminEmail(user?.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const formData = await request.formData()
  const suggestionId = formData.get("suggestionId")
  const file = formData.get("file")

  if (typeof suggestionId !== "string" || !(file instanceof File)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  const adminClient = createAdminClient()
  const extension = file.name.split(".").pop() || "jpg"
  const path = `result-${suggestionId}-${Date.now()}.${extension}`

  const { error: uploadError } = await adminClient.storage
    .from("specify-images")
    .upload(path, file)

  if (uploadError) {
    console.error(uploadError)
    return NextResponse.json({ error: "Upload failed" }, { status: 500 })
  }

  const { data: publicUrlData } = adminClient.storage
    .from("specify-images")
    .getPublicUrl(path)

  const db = adminClient
  const { error: updateError } = await db
    .from("suggestions")
    .update({
      result_image_url: publicUrlData.publicUrl,
      status: "done",
    })
    .eq("id", suggestionId)

  if (updateError) {
    console.error(updateError)
    return NextResponse.json({ error: "Update failed" }, { status: 500 })
  }

  return NextResponse.json({ ok: true, resultImageUrl: publicUrlData.publicUrl })
}
