"use client"

import { useRef } from "react"
import { deleteRoom } from "./actions"

// ジャンルを作った本人だけに出す「この部屋を消す」。保存も消えて戻せないので、標準の <dialog> で確かめてから消す
export function RoomDelete({ roomId }: { roomId: string }) {
  const ref = useRef<HTMLDialogElement>(null)
  return (
    <>
      <button
        type="button"
        onClick={() => ref.current?.showModal()}
        className="focus-ring inline-flex min-h-11 items-center gap-1.5 rounded text-[0.9375rem] text-error underline underline-offset-4"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 7h16M10 11v6M14 11v6M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3" />
        </svg>
        この部屋を消す
      </button>
      <dialog
        ref={ref}
        aria-labelledby="room-delete-title"
        onClick={(e) => e.target === ref.current && ref.current.close()} // 背景をクリックで閉じる
        className="m-auto w-[min(20rem,calc(100vw-2rem))] rounded-[24px] bg-surface-container-lowest p-5 text-on-surface shadow-xl backdrop:bg-black/30 backdrop:backdrop-blur-sm"
      >
        <h2 id="room-delete-title" className="mb-2 text-[1.0625rem] font-semibold">
          この部屋を消しますか？
        </h2>
        <p className="mb-4 text-[0.9375rem] leading-[1.6] text-on-surface-variant">
          Specify から部屋がなくなり、保存していた人の保存も消えます。元に戻せません。
        </p>
        <form action={deleteRoom} className="space-y-2">
          <input type="hidden" name="roomId" value={roomId} />
          <button type="submit" className="focus-ring min-h-11 w-full rounded-full bg-error px-4 font-semibold text-on-error hover:opacity-90">
            消す
          </button>
          <button
            type="button"
            onClick={() => ref.current?.close()}
            className="focus-ring min-h-11 w-full rounded-full border border-outline px-4 text-primary hover:bg-surface-container-low"
          >
            やめる
          </button>
        </form>
      </dialog>
    </>
  )
}
