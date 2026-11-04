"use client"

import Link from "next/link"
import { useActionState } from "react"
import { addRoomItem, type AddItemState } from "./actions"

const input =
  "w-full rounded-lg border border-outline bg-surface-container-lowest px-3 py-2.5 text-base text-on-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
const card = "rounded-2xl border border-outline-variant bg-surface-container-lowest p-4"

// 家具のカードと同じ形の「＋」と見出し。開いているときは「−」
function Head({ hint }: { hint: string }) {
  return (
    <div className="flex items-center gap-4">
      <div className="flex size-24 shrink-0 items-center justify-center rounded-xl bg-surface-container text-primary">
        <svg viewBox="0 0 24 24" aria-hidden="true" className="size-8" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
          <path d="M12 5v14" className="group-open:hidden" />
          <path d="M5 12h14" />
        </svg>
      </div>
      <div className="min-w-0 space-y-1">
        <p className="text-[0.9375rem] font-semibold leading-[1.5]">商品のリンクを追加</p>
        <p className="text-[0.8125rem] leading-[1.6] text-on-surface-variant">{hint}</p>
      </div>
    </div>
  )
}

// 説明欄に無い家具（YouTube ショッピングの商品タグにだけ載っているものなど）を、商品ページのリンクで足す
// 一覧の最後のカードとして置き、標準の <details> で押したときだけ入力欄を出す
export function ItemAdd({ roomId, shops, loggedIn }: { roomId: string; shops: string[]; loggedIn: boolean }) {
  const [state, action, pending] = useActionState<AddItemState, FormData>(addRoomItem, { error: null })
  if (!loggedIn) {
    return (
      <Link href={`/login?next=/rooms/${roomId}`} className={`focus-ring group block hover:bg-surface-container-low ${card}`}>
        <Head hint="ログインすると、動画に映っている家具を足せます" />
      </Link>
    )
  }
  return (
    <details className={`group ${card}`}>
      <summary className="focus-ring -m-1 cursor-pointer list-none rounded-xl p-1 [&::-webkit-details-marker]:hidden">
        <Head hint={`動画に映っている家具を足せます（${shops.join("・")}）`} />
      </summary>
      <form action={action} className="mt-4 space-y-3">
        <input type="hidden" name="roomId" value={roomId} />
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
