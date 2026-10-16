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
      className="focus-ring soft-card group block overflow-hidden rounded-[20px] bg-surface-container-lowest hover:bg-surface-container-low"
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

// 一覧の最後に置く「気になる動画の部屋を探索」。部屋のカードと同じ形にして、一覧の流れに溶け込ませる
export function AddRoomCard() {
  return (
    <Link
      href="/add"
      className="focus-ring soft-card group block overflow-hidden rounded-[20px] bg-surface-container hover:bg-surface-container-high"
    >
      <div className="flex aspect-video w-full items-center justify-center bg-surface-container-high">
        <span className="inline-flex size-14 items-center justify-center rounded-full bg-primary text-on-primary group-hover:bg-primary-hover">
          {/* 角の丸い再生ボタン（動画を貼って探索する）。ロゴではなく一般的な形 */}
          <svg viewBox="0 0 24 24" aria-hidden="true" className="size-7">
            <rect x="2.5" y="5.5" width="19" height="13" rx="4" fill="currentColor" />
            <path d="M10 9.2v5.6l4.8-2.8L10 9.2Z" className="fill-primary group-hover:fill-primary-hover" />
          </svg>
        </span>
      </div>
      <div className="space-y-1 p-4">
        <p className="text-[1.0625rem] font-semibold leading-[1.5]">気になる動画の部屋を探索</p>
        <p className="text-[0.9375rem] text-on-surface-variant">YouTube のリンクを貼るだけ</p>
      </div>
    </Link>
  )
}

export const ROOM_CARD_SELECT = "id, title, channel_title, thumbnail_url, room_items(count)"
