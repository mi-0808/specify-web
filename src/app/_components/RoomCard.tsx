import Link from "next/link"

export type RoomCardData = {
  id: string
  title: string
  channel_title: string
  thumbnail_url: string
  room_items: { count: number }[]
}

export function RoomCard({ room }: { room: RoomCardData }) {
  return (
    <Link
      href={`/rooms/${room.id}`}
      className="focus-ring group block overflow-hidden rounded-2xl border border-outline-variant bg-surface-container-lowest transition-colors hover:bg-surface-container-low"
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- YouTube のサムネイルをそのまま表示する */}
      <img src={room.thumbnail_url} alt="" loading="lazy" className="aspect-video w-full object-cover" />
      <div className="space-y-1 p-4">
        <p className="line-clamp-2 text-[1.0625rem] font-semibold leading-[1.5]">{room.title}</p>
        <p className="text-[0.9375rem] text-on-surface-variant">
          {room.channel_title}・家具 {room.room_items[0]?.count ?? 0}点
        </p>
      </div>
    </Link>
  )
}

// 一覧の最後に置く「動画から部屋を追加」。部屋のカードと同じ形にして、一覧の流れに溶け込ませる
export function AddRoomCard() {
  return (
    <Link
      href="/add"
      className="focus-ring group block overflow-hidden rounded-2xl border border-outline-variant bg-surface-container transition-colors hover:bg-surface-container-high"
    >
      <div className="flex aspect-video w-full items-center justify-center bg-surface-container-high">
        <span className="inline-flex size-14 items-center justify-center rounded-full bg-primary text-on-primary transition-colors group-hover:bg-primary-hover">
          <svg viewBox="0 0 24 24" aria-hidden="true" className="size-7" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </span>
      </div>
      <div className="space-y-1 p-4">
        <p className="text-[1.0625rem] font-semibold leading-[1.5]">動画から部屋を追加</p>
        <p className="text-[0.9375rem] text-on-surface-variant">YouTube のリンクを貼るだけ</p>
      </div>
    </Link>
  )
}

export const ROOM_CARD_SELECT = "id, title, channel_title, thumbnail_url, room_items(count)"
