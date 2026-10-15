import Link from "next/link"
import { notFound } from "next/navigation"
import { BUDGETS, STYLES, budgetLabel, findRecipeFor, findStyle } from "@/data/recipes"
import { SiteHeader, pageShell } from "../../_components/SiteHeader"

export function generateStaticParams() {
  return STYLES.map((s) => ({ style: s.id }))
}

export async function generateMetadata({ params }: { params: Promise<{ style: string }> }) {
  const style = findStyle((await params).style)
  return { title: style ? `${style.name}の予算を選ぶ | Specify` : "Specify" }
}

export default async function BudgetPage({ params }: { params: Promise<{ style: string }> }) {
  const style = findStyle((await params).style)
  if (!style) notFound()

  return (
    <main className="min-h-screen bg-surface text-on-surface">
      <div className={pageShell}>
        <SiteHeader />
        <section className="space-y-6">
          <div className="space-y-2">
            <p className="text-[0.9375rem] text-on-surface-variant">ステップ 2 / 2・{style.name}</p>
            <h1 className="text-[1.75rem] font-bold leading-[1.4]">予算はどのくらい？</h1>
          </div>
          <ul className="space-y-3">
            {BUDGETS.map((b) => {
              const recipe = findRecipeFor(style.id, b)
              const label = `${budgetLabel(b)}で`
              return (
                <li key={b}>
                  {recipe ? (
                    <Link
                      href={`/recipes/${recipe.id}`}
                      className="focus-ring flex items-center justify-between rounded-2xl border border-outline-variant bg-surface-container-lowest p-5 text-[1.0625rem] font-semibold transition-colors hover:bg-surface-container-low"
                    >
                      {label}
                      <span aria-hidden="true" className="text-primary">→</span>
                    </Link>
                  ) : (
                    <div className="flex items-center justify-between rounded-2xl border border-outline-variant p-5 text-[1.0625rem] text-on-surface-variant">
                      {label}
                      <span className="text-[0.9375rem]">準備中</span>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
          <Link href="/start" className="focus-ring inline-block rounded py-2 text-[0.9375rem] text-primary">
            ← 雰囲気を選び直す
          </Link>
        </section>
      </div>
    </main>
  )
}
