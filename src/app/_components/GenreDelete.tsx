"use client"

import { useRef } from "react"
import { deleteGenre } from "../genres/actions"

// マイページのジャンルの行の右に置くゴミ箱。消すと戻せないので、標準の <dialog> で確かめてから消す
export function GenreDelete({ id, name }: { id: string; name: string }) {
  const ref = useRef<HTMLDialogElement>(null)
  return (
    <>
      <button
        type="button"
        aria-label={`「${name}」を消す`}
        onClick={() => ref.current?.showModal()}
        className="focus-ring inline-flex size-11 shrink-0 items-center justify-center rounded-full text-error hover:bg-surface-container-low"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 7h16M10 11v6M14 11v6M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3" />
        </svg>
      </button>
      <dialog
        ref={ref}
        aria-labelledby={`delete-${id}`}
        onClick={(e) => e.target === ref.current && ref.current.close()} // 背景をクリックで閉じる
        className="m-auto w-[min(20rem,calc(100vw-2rem))] rounded-[24px] bg-surface-container-lowest p-5 text-on-surface shadow-xl backdrop:bg-black/30 backdrop:backdrop-blur-sm"
      >
        <h2 id={`delete-${id}`} className="mb-2 text-[1.0625rem] font-semibold">
          「{name}」を消しますか？
        </h2>
        <p className="mb-4 text-[0.9375rem] leading-[1.6] text-on-surface-variant">
          ジャンルの列から消えます。入っていた部屋は消えず、「すべて」に残ります。
        </p>
        <form action={deleteGenre} className="space-y-2">
          <input type="hidden" name="genreId" value={id} />
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
