import { collect } from "@/lib/collector/collect"
import { createAdminClient } from "@/lib/supabase/admin"

export const maxDuration = 300

// Vercel Cron から1日1回呼ぶ（vercel.json）。Vercel は CRON_SECRET を Authorization ヘッダーに付けて呼ぶ
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 })
  }
  const apiKey = process.env.YOUTUBE_API_KEY
  if (!apiKey) return Response.json({ error: "YOUTUBE_API_KEY is not set" }, { status: 500 })

  const result = await collect(apiKey, createAdminClient())
  return Response.json(result)
}
