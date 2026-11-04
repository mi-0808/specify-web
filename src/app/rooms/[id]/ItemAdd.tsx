"use client"

import { useActionState } from "react"
import { addRoomItem, type AddItemState } from "./actions"

const input =
  "w-full rounded-lg border border-outline bg-surface-container-lowest px-3 py-2.5 text-base text-on-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"

// 説明欄に無い家具（YouTube ショッピングの商品タグにだけ載っているものなど）を、商品ページのリンクで足す
// 目立たせないよう、標準の <details> で畳んでおき、押したときだけフォームを出す
export function ItemAdd({ roomId, shops }: { roomId: string; shops: string[] }) {
  const [state, action, pending] = useActionState<AddItemState, FormData>(addRoomItem, { error: null })
  return (
    <details className="group">
      <summary className="focus-ring inline-flex min-h-11 cursor-pointer list-none items-center gap-1.5 rounded text-[0.9375rem] text-primary underline underline-offset-4 [&::-webkit-details-marker]:hidden">
        <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
          <path d="M12 5v14" className="group-open:hidden" />
          <path d="M5 12h14" />
        </svg>
        商品のリンクを追加
      </summary>
      <form action={action} className="mt-2 space-y-3">
        <input type="hidden" name="roomId" value={roomId} />
        <p className="text-[0.8125rem] leading-[1.6] text-on-surface-variant">
          動画に映っている家具の商品ページを貼ってください。使えるのは {shops.join("・")} です。
        </p>
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
          className="focus-ring min-h-11 rounded-full border border-outline px-5 text-[0.9375rem] text-primary hover:bg-surface-container-low disabled:opacity-60"
        >
          {pending ? "商品ページを調べています…" : "追加する"}
        </button>
      </form>
    </details>
  )
}
