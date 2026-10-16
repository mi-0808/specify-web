"use client"

import { useFormStatus } from "react-dom"
import { toggleSave } from "./actions"
import { Popover, SignupLinks } from "../../_components/Popover"

const buttonClass =
  "focus-ring inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-[0.9375rem] transition-colors hover:bg-surface-container-high"

function BookmarkIcon({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-6" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth={1.8} strokeLinejoin="round">
      <path d="M6.5 3.5h11a1 1 0 0 1 1 1v16l-6.5-4.2-6.5 4.2v-16a1 1 0 0 1 1-1z" />
    </svg>
  )
}

function Submit({ saved }: { saved: boolean }) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      aria-pressed={saved}
      className={`${buttonClass} ${saved ? "font-semibold text-primary" : "text-on-surface-variant"}`}
    >
      <BookmarkIcon filled={saved} />
      {saved ? "保存済み" : "保存"}
    </button>
  )
}

// ログイン中は押すと保存（アイコンが塗られる）。未ログインなら、会員登録へ案内する吹き出しを出す
export function SaveButton({ roomId, saved, loggedIn }: { roomId: string; saved: boolean; loggedIn: boolean }) {
  if (loggedIn) {
    return (
      <form action={toggleSave}>
        <input type="hidden" name="roomId" value={roomId} />
        <Submit saved={saved} />
      </form>
    )
  }
  return (
    <Popover
      trigger={
        <>
          <BookmarkIcon filled={false} />
          保存
        </>
      }
      triggerClassName={`${buttonClass} text-on-surface-variant`}
      panelLabel="保存するには会員登録が必要です"
      tone="inverse"
    >
      <SignupLinks message="部屋を保存するには、会員登録が必要です。保存した部屋は、いつでも見返せます。" next={`/rooms/${roomId}`} />
    </Popover>
  )
}
