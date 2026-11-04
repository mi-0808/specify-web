"use client"

import { useActionState } from "react"
import { addRoomItem, type AddItemState } from "./actions"

const input =
  "w-full rounded-lg border border-outline bg-surface-container-lowest px-3 py-2.5 text-base text-on-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"

// 説明欄に無い家具（YouTube ショッピングの商品タグにだけ載っているものなど）を、商品ページのリンクで足す
export function ItemAdd({ roomId, shops }: { roomId: string; shops: string[] }) {
  const [state, action, pending] = useActionState<AddItemState, FormData>(addRoomItem, { error: null })
  return (
    <form action={action} className="space-y-3 rounded-2xl border border-outline-variant bg-surface-container-lowest p-4">
      <input type="hidden" name="roomId" value={roomId} />
      <div className="space-y-1">
        <h3 className="text-[1.0625rem] font-semibold">商品のリンクを追加</h3>
        <p className="text-[0.8125rem] leading-[1.6] text-on-surface-variant">
          動画に映っている家具の商品ページを貼ってください。使えるのは {shops.join("・")} です。
        </p>
      </div>
      <div className="space-y-2">
        <label htmlFor="item-url" className="block text-[0.9375rem] font-semibold">
          商品ページのリンク
        </label>
        <input
          id="item-url"
          name="url"
          type="url"
          required
          inputMode="url"
          placeholder="https://item.rakuten.co.jp/…"
          aria-describedby={state.error ? "item-error" : undefined}
          aria-invalid={!!state.error}
          className={input}
        />
      </div>
      {state.error && (
        <p id="item-error" role="alert" className="text-[0.9375rem] leading-[1.6] text-error">
          {state.error}
        </p>
      )}
      <div className="space-y-2">
        <label htmlFor="item-label" className="block text-[0.9375rem] font-semibold">
          ラベル（なくても可）
        </label>
        <input id="item-label" name="label" maxLength={40} placeholder="ラグ（空なら商品名を使います）" className={input} />
      </div>
      <button
        type="submit"
        disabled={pending}
        aria-busy={pending}
        className="focus-ring w-full rounded-full bg-primary px-6 py-3 text-base font-semibold text-on-primary hover:bg-primary-hover disabled:opacity-60"
      >
        {pending ? "商品ページを調べています…" : "追加する"}
      </button>
    </form>
  )
}
