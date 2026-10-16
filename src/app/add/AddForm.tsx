"use client"

import { useActionState } from "react"
import { addRoom, type AddState } from "./actions"

export function AddForm() {
  const [state, action, pending] = useActionState<AddState, FormData>(addRoom, { error: null })
  return (
    <form action={action} className="space-y-4">
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
          className="w-full rounded-lg border border-outline bg-surface-container-lowest px-3 py-2.5 text-base text-on-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        />
      </div>
      {state.error && (
        <p id="add-error" role="alert" className="text-[0.9375rem] leading-[1.6] text-error">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        aria-busy={pending}
        className="focus-ring w-full rounded-full bg-primary px-6 py-3.5 text-base font-semibold text-on-primary transition-colors hover:bg-primary-hover disabled:opacity-60"
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
