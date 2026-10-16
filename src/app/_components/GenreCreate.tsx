"use client"

import Link from "next/link"
import { useActionState, useRef } from "react"
import { createGenre, type GenreState } from "../genres/actions"

const plusClass =
  "focus-ring press-bounce inline-flex size-11 items-center justify-center rounded-full border border-outline-variant bg-surface-container-lowest text-on-surface transition-colors hover:bg-surface-container-low"

const input =
  "w-full rounded-lg border border-outline bg-surface-container-lowest px-3 py-2.5 text-base text-on-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"

function CreateForm() {
  const [state, action, pending] = useActionState<GenreState, FormData>(createGenre, { error: null })
  return (
    <form action={action} className="space-y-3">
      <div className="space-y-1">
        <label htmlFor="genre-name" className="block text-[0.8125rem] text-on-surface-variant">
          ジャンル名（12文字まで）
        </label>
        <input id="genre-name" name="name" required maxLength={12} placeholder="グリーンのある部屋" className={input} />
      </div>
      <div className="space-y-1">
        <label htmlFor="genre-keyword" className="block text-[0.8125rem] text-on-surface-variant">
          集める言葉（空ならジャンル名と同じ）
        </label>
        <input id="genre-keyword" name="keyword" maxLength={20} placeholder="グリーン" className={input} />
        <p className="text-[0.8125rem] text-on-surface-variant">
          動画のタイトルや家具の名前にこの言葉がある部屋が、自動で入ります。
        </p>
      </div>
      {state.error && (
        <p role="alert" className="text-[0.875rem] text-error">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        aria-busy={pending}
        className="focus-ring min-h-11 w-full rounded-full bg-primary px-4 font-semibold text-on-primary hover:bg-primary-hover disabled:opacity-60"
      >
        {pending ? "作っています…" : "作る"}
      </button>
    </form>
  )
}

// 一覧のジャンルの列の最後に置く「＋」。短い作業なので、標準の <dialog> で中央に出す（デザイン規約 5章）
export function GenreCreate({ loggedIn }: { loggedIn: boolean }) {
  const ref = useRef<HTMLDialogElement>(null)
  return (
    <>
      <button type="button" aria-label="ジャンルを作る" onClick={() => ref.current?.showModal()} className={plusClass}>
        <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>
      <dialog
        ref={ref}
        aria-labelledby="genre-dialog-title"
        onClick={(e) => e.target === ref.current && ref.current.close()} // 背景をクリックで閉じる
        className="m-auto w-[min(22rem,calc(100vw-2rem))] rounded-[24px] bg-surface-container-lowest p-5 text-on-surface shadow-xl backdrop:bg-black/30 backdrop:backdrop-blur-sm"
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 id="genre-dialog-title" className="text-[1.0625rem] font-semibold">
            新しいジャンルを作る
          </h2>
          <button
            type="button"
            onClick={() => ref.current?.close()}
            aria-label="閉じる"
            className="focus-ring inline-flex size-11 items-center justify-center rounded-full text-xl text-on-surface-variant hover:bg-surface-container-high"
          >
            ×
          </button>
        </div>
        {loggedIn ? (
          <CreateForm />
        ) : (
          <div className="text-[0.9375rem] leading-[1.6]">
            <p>ジャンルを作るには、会員登録が必要です。作ったジャンルは、みんなの一覧に並びます。</p>
            <div className="mt-4 flex items-center gap-4">
              <Link
                href="/login?signup=1&next=%2F"
                className="focus-ring inline-flex min-h-11 items-center rounded-full bg-primary px-5 font-semibold text-on-primary hover:bg-primary-hover"
              >
                新規登録
              </Link>
              <Link href="/login?next=%2F" className="focus-ring inline-flex min-h-11 items-center rounded text-primary underline underline-offset-4">
                ログイン
              </Link>
            </div>
          </div>
        )}
      </dialog>
    </>
  )
}
