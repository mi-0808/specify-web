import type { Metadata } from "next"
import { SiteHeader } from "../_components/SiteHeader"
import { AddForm } from "./AddForm"

export const metadata: Metadata = { title: "動画から部屋を追加 | Specify" }
// 商品ページを順にたどるので時間がかかる（このページの Server Action にも効く）
export const maxDuration = 120

export default function AddPage() {
  return (
    <main className="min-h-screen bg-surface text-on-surface">
      <div className="mx-auto flex w-full max-w-xl flex-col gap-8 px-5 py-8">
        <SiteHeader />
        <section className="space-y-3">
          <h1 className="text-[1.75rem] font-bold leading-[1.4]">動画から部屋を追加</h1>
          <p className="text-[1.0625rem] leading-[1.7] text-on-surface-variant">
            ルームツアーなど、家具やインテリアの YouTube 動画のリンクを貼ってください。説明欄で紹介されている家具から、部屋を作ります。追加した部屋は、みんなのフィードにも並びます。
          </p>
        </section>
        <AddForm />
      </div>
    </main>
  )
}
