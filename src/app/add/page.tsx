import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { SiteHeader } from "../_components/SiteHeader"
import { AddForm } from "./AddForm"

export const metadata: Metadata = { title: "気になる動画の部屋を探索 | Specify" }
// 商品ページを順にたどるので時間がかかる（このページの Server Action にも効く）
export const maxDuration = 120

const UUID = /^[0-9a-f-]{36}$/i

type Props = { searchParams: Promise<{ genre?: string }> }

export default async function AddPage({ searchParams }: Props) {
  const { genre } = await searchParams
  const supabase = await createClient()
  // 公式のジャンルが先、そのあとユーザーのジャンルが部屋の多い順
  const { data: genres, error } = await supabase.rpc("genres_with_counts").select("id, name")
  if (error) throw error
  const fixedGenre = UUID.test(genre ?? "") ? (genres.find((g) => g.id === genre) ?? null) : null

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
        <AddForm fixedGenre={fixedGenre} genres={genres} />
      </div>
    </main>
  )
}
