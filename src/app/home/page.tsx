import Link from "next/link"
import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { RECIPES, SHOPS, budgetLabel, findStyle, yen } from "@/data/recipes"
import { SiteHeader, pageShell, primaryButton } from "../_components/SiteHeader"
import { ProductPhoto } from "../_components/ProductPhoto"

export const metadata: Metadata = { title: "マイページ | Specify" }

export default async function MyHomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login?next=/home")

  const [{ data }, { data: saves }] = await Promise.all([
    supabase.from("purchases").select("recipe_id, item_id"),
    supabase.from("saved_recipes").select("recipe_id"),
  ])
  const bought = new Set((data ?? []).map((p) => `${p.recipe_id}/${p.item_id}`))
  const savedIds = new Set((saves ?? []).map((s) => s.recipe_id))
  const started = RECIPES.filter((r) => savedIds.has(r.id))

  return (
    <main className="min-h-screen bg-surface text-on-surface">
      <div className={pageShell}>
        <SiteHeader />
        <h1 className="text-[1.75rem] font-bold leading-[1.4]">マイページ</h1>

        {started.length === 0 ? (
          <section className="space-y-4">
            <h2 className="text-[1.25rem] font-semibold">まずはレシピを選びましょう</h2>
            <p className="text-[1.0625rem] leading-[1.7] text-on-surface-variant">
              レシピを保存して、商品に「買った」を付けると、ここに次の一手が出ます。
            </p>
            <Link href="/start" className={primaryButton}>
              理想の部屋を選ぶ
            </Link>
          </section>
        ) : (
          <ul className="space-y-4">
            {started.map((r) => {
              const style = findStyle(r.style)!
              const done = r.items.filter((i) => bought.has(`${r.id}/${i.id}`))
              const next = r.items.find((i) => !bought.has(`${r.id}/${i.id}`))
              return (
                <li key={r.id} className="space-y-4 rounded-2xl border border-outline-variant bg-surface-container-lowest p-5">
                  <div className="space-y-1">
                    <h2 className="text-[1.25rem] font-semibold">
                      <Link href={`/recipes/${r.id}`} className="focus-ring rounded underline underline-offset-4">
                        {style.name}・{budgetLabel(r.budget)}のレシピ
                      </Link>
                    </h2>
                    <p className="text-[0.9375rem] text-on-surface-variant">
                      {r.items.length}点中{done.length}点・使った金額 {yen(done.reduce((s, i) => s + i.price, 0))}
                    </p>
                  </div>
                  {next ? (
                    <div className="space-y-2 rounded-xl bg-primary-container p-4 text-on-primary-container">
                      <p className="text-[0.9375rem] font-semibold">次の一手・{next.role}</p>
                      <ProductPhoto item={next} className="w-32" />
                      <a
                        href={next.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="focus-ring rounded text-[1.0625rem] font-semibold underline underline-offset-4"
                      >
                        {next.name}
                        <span aria-hidden="true"> ↗</span>
                        <span className="sr-only">（{SHOPS[next.shop].name}の商品ページを新しいタブで開きます）</span>
                      </a>
                      <p className="text-[0.9375rem]">
                        {SHOPS[next.shop].name}・{yen(next.price)}
                      </p>
                    </div>
                  ) : (
                    <p className="text-[1.0625rem] font-semibold">このレシピは完成です</p>
                  )}
                </li>
              )
            })}
          </ul>
        )}

        {started.length > 0 && (
          <Link href="/start" className="focus-ring inline-block rounded py-2 text-[0.9375rem] text-primary">
            ほかのレシピを見る
          </Link>
        )}
      </div>
    </main>
  )
}
