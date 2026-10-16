import type { Metadata } from "next"
import { SiteHeader } from "../_components/SiteHeader"
import { AddForm } from "./AddForm"

export const metadata: Metadata = { title: "気になる動画の部屋を探索 | Specify" }
// 商品ページを順にたどるので時間がかかる（このページの Server Action にも効く）
export const maxDuration = 120

export default function AddPage() {
  return (
    <main className="min-h-screen bg-surface text-on-surface">
      <div className="mx-auto flex w-full max-w-xl flex-col gap-8 px-5 pb-8 pt-4 md:pt-8">
        <SiteHeader />
        <section className="space-y-3">
          <h1 className="text-[1.75rem] font-bold leading-[1.4]">気になる動画の部屋を探索</h1>
          <p className="text-[1.0625rem] leading-[1.7] text-on-surface-variant">
            ルームツアーなど、家具やインテリアの YouTube 動画のリンクを貼ってください。動画で紹介されている家具と、その買える場所が分かります。探索した部屋は、みんなの一覧にも並び、マイページから見返せます。
          </p>
        </section>
        <AddForm />
      </div>
    </main>
  )
}
