"use client"

import { useActionState, useState } from "react"
import { NEW_GENRE } from "@/lib/genres"
import { addRoom, type AddState } from "./actions"

type Genre = { id: string; name: string }

const input =
  "w-full rounded-lg border border-outline bg-surface-container-lowest px-3 py-2.5 text-base text-on-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"

// ジャンルの一覧から開いたときは、そのジャンルに入れる（選ぶ欄は出さない）。「すべて」から開いたときだけ選ぶか、新しく作る
export function AddForm({ fixedGenre, genres }: { fixedGenre: Genre | null; genres: Genre[] }) {
  const [state, action, pending] = useActionState<AddState, FormData>(addRoom, { error: null })
  const [choice, setChoice] = useState("")
  return (
    <form action={action} className="space-y-4">
      {fixedGenre && (
        <>
          <input type="hidden" name="genre" value={fixedGenre.id} />
          <p className="inline-flex items-center rounded-full bg-primary-container px-4 py-1.5 text-[0.9375rem] text-on-primary-container">
            「{fixedGenre.name}」に入れます
          </p>
        </>
      )}
      <div className="space-y-2">
        <label htmlFor="url" className="block text-[0.9375rem] font-semibold">
          YouTube の動画のリンク
        </label>
        <input
          id="url"
          name="url"
          type="url"
          required
          inputMode="url"
          placeholder="https://www.youtube.com/watch?v=…"
          aria-describedby={state.error ? "add-error" : undefined}
          aria-invalid={!!state.error}
          className={input}
        />
      </div>
      {!fixedGenre && (
        <div className="space-y-2">
          <label htmlFor="genre" className="block text-[0.9375rem] font-semibold">
            入れるジャンル
          </label>
          <select id="genre" name="genre" required value={choice} onChange={(e) => setChoice(e.target.value)} className={input}>
            <option value="" disabled>
              選んでください
            </option>
            {genres.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
            <option value={NEW_GENRE}>＋ 新しいジャンルを作る</option>
          </select>
        </div>
      )}
      {choice === NEW_GENRE && (
        <div className="space-y-2">
          <label htmlFor="new-genre-name" className="block text-[0.9375rem] font-semibold">
            新しいジャンルの名前（12文字まで）
          </label>
          <input id="new-genre-name" name="newGenreName" required maxLength={12} placeholder="グリーンのある部屋" className={input} />
        </div>
      )}
      {state.error && (
        <p id="add-error" role="alert" className="text-[0.9375rem] leading-[1.6] text-error">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        aria-busy={pending}
        className="focus-ring w-full rounded-full bg-primary px-6 py-3.5 text-base font-semibold text-on-primary hover:bg-primary-hover disabled:opacity-60"
      >
        {pending ? "動画の家具を調べています…" : "探索する"}
      </button>
      {pending && (
        <p role="status" className="text-[0.8125rem] text-on-surface-variant">
          家具の購入先を調べています。1分ほどかかることがあります。
        </p>
      )}
    </form>
  )
}
