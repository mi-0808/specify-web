import Link from "next/link"
import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { createClient, getUser } from "@/lib/supabase/server"
import { SiteHeader } from "../_components/SiteHeader"
import { LargeTitle } from "../_components/LargeTitle"
import { ROOM_CARD_SELECT, RoomCard, type RoomCardData } from "../_components/RoomCard"

export const metadata: Metadata = { title: "保存した部屋 | Specify" }

export default async function SavedPage() {
  const supabase = await createClient()
  const { data: { user } } = await getUser()
  if (!user) redirect("/login?next=/saved")

  const { data, error } = await supabase
    .from("saved_rooms")
    .select(`created_at, rooms(${ROOM_CARD_SELECT})`)
    .order("created_at", { ascending: false })
  if (error) throw error
  const rooms = data.flatMap((s) => (s.rooms ? [s.rooms as RoomCardData] : []))

  return (
    <main className="min-h-screen bg-surface text-on-surface">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-5 pb-8 pt-4 md:pt-8">
        <SiteHeader current="saved" />
        <LargeTitle title="保存した部屋" alsoDesktop />
        {rooms.length === 0 ? (
          <div className="space-y-4 rounded-2xl bg-surface-container p-6">
            <p className="text-[1.0625rem] leading-[1.7]">気に入った部屋を保存すると、ここで見返せます。</p>
            <Link href="/" className="focus-ring inline-block rounded text-primary underline underline-offset-4">
              部屋を探す
            </Link>
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {rooms.map((room) => (
              <li key={room.id}>
                <RoomCard room={room} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  )
}
