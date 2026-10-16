"use client"

import { Popover, SignupLinks } from "../../_components/Popover"
import { addToGenre } from "../../genres/actions"

const triggerClass =
  "focus-ring inline-flex min-h-11 items-center rounded-full border-2 border-dashed border-outline px-4 text-[0.9375rem] text-on-surface-variant hover:bg-surface-container-low"

// 部屋を、だれかが作ったジャンルに入れる。ログインしていなければ会員登録へ案内する
export function GenreAdd({ roomId, loggedIn, options }: { roomId: string; loggedIn: boolean; options: { id: string; name: string }[] }) {
  return (
    <Popover
      trigger="＋ ジャンルに入れる"
      triggerClassName={triggerClass}
      panelLabel="ジャンルに入れる"
      tone={loggedIn ? "surface" : "inverse"}
      align="left"
    >
      {!loggedIn ? (
        <SignupLinks message="部屋をジャンルに入れるには、会員登録が必要です。" next={`/rooms/${roomId}`} />
      ) : options.length === 0 ? (
        <p>入れられるジャンルがありません。トップの「＋」から新しいジャンルを作れます。</p>
      ) : (
        <form action={addToGenre} className="space-y-3">
          <input type="hidden" name="roomId" value={roomId} />
          <label htmlFor="genre-select" className="block font-semibold">
            どのジャンルに入れますか？
          </label>
          <select
            id="genre-select"
            name="genreId"
            required
            className="w-full rounded-lg border border-outline bg-surface-container-lowest px-3 py-2.5 text-base text-on-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {options.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
          <button type="submit" className="focus-ring min-h-11 w-full rounded-full bg-primary px-4 font-semibold text-on-primary hover:bg-primary-hover">
            入れる
          </button>
          <p className="text-[0.8125rem] text-on-surface-variant">ほしいジャンルがなければ、トップの「＋」から作れます。</p>
        </form>
      )}
    </Popover>
  )
}
