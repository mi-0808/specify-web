import Link from "next/link"
import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import {
  SHOPS,
  budgetLabel,
  findRecipe,
  findStyle,
  latestCheckedAt,
  totalOf,
  yen,
} from "@/data/recipes"
import { SiteHeader, pageShell, primaryButton } from "../../_components/SiteHeader"
import { togglePurchase, toggleSave } from "./actions"
import { ToggleButton } from "./ToggleButton"
import { ProductPhoto } from "../../_components/ProductPhoto"

type Props = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props) {
  const recipe = findRecipe((await params).id)
  const style = recipe && findStyle(recipe.style)
  return { title: style ? `${style.name}・${budgetLabel(recipe.budget)}のレシピ | Specify` : "Specify" }
}

export default async function RecipePage({ params }: Props) {
  const recipe = findRecipe((await params).id)
  const style = recipe && findStyle(recipe.style)
  if (!recipe || !style) notFound()

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const bought = new Set<string>()
  let saved = false
  if (user) {
    const [{ data }, { data: save }] = await Promise.all([
      supabase.from("purchases").select("item_id").eq("recipe_id", recipe.id),
      supabase.from("saved_recipes").select("recipe_id").eq("recipe_id", recipe.id).maybeSingle(),
    ])
    data?.forEach((p) => bought.add(p.item_id))
    saved = !!save
  }

  const total = totalOf(recipe)
  const [y, m, d] = latestCheckedAt(recipe).split("-").map(Number)

  return (
    <main className="min-h-screen bg-surface text-on-surface">
      <div className={pageShell}>
        <SiteHeader />

        <section className="space-y-3">
          <Link href={`/start/${style.id}`} className="focus-ring inline-block rounded py-2 text-[0.9375rem] text-primary">
            ← 予算を選び直す
          </Link>
          <h1 className="text-[1.75rem] font-bold leading-[1.4]">
            {style.name}・{budgetLabel(recipe.budget)}のレシピ
          </h1>
          <p className="text-[1.0625rem] leading-[1.7]">
            合計 <span className="text-[1.375rem] font-bold">{yen(total)}</span>
            <span className="text-on-surface-variant">（予算の残り {yen(recipe.budget - total)}）</span>
          </p>
          <p className="text-[0.8125rem] leading-[1.6] text-on-surface-variant">
            {y}年{m}月{d}日時点の公式サイトの価格です。送料は含みません。購入前に商品ページで確認してください。
          </p>
          {user ? (
            <form action={toggleSave}>
              <input type="hidden" name="recipeId" value={recipe.id} />
              <ToggleButton on={saved} label="このレシピを保存する" onLabel="保存済み ✓" />
            </form>
          ) : (
            <div className="space-y-3 rounded-2xl bg-surface-container p-4">
              <p className="text-[0.9375rem] leading-[1.6]">
                会員登録すると、このレシピを保存して、買った物を記録できます。記録をもとに、次に何を足せばいいかをマイページに出します。
              </p>
              <Link href={`/login?signup=1&next=/recipes/${recipe.id}`} className={primaryButton}>
                会員登録して保存する
              </Link>
            </div>
          )}
        </section>

        <ol className="space-y-3">
          {recipe.items.map((item, index) => (
            <li
              key={item.id}
              className={`space-y-3 rounded-2xl p-5 ${
                index === 0
                  ? "bg-primary-container text-on-primary-container"
                  : "border border-outline-variant bg-surface-container-lowest"
              }`}
            >
              <p className="text-[0.9375rem] font-semibold">
                {index === 0 ? "最初の1点" : `${index + 1}点目`}・{item.role}
              </p>
              <a href={item.url} target="_blank" rel="noopener noreferrer" tabIndex={-1} aria-hidden="true" className="block">
                <ProductPhoto item={item} />
              </a>
              <div className="space-y-1">
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="focus-ring rounded text-[1.0625rem] font-semibold leading-[1.5] underline decoration-1 underline-offset-4"
                >
                  {item.name}
                  <span aria-hidden="true"> ↗</span>
                  <span className="sr-only">（{SHOPS[item.shop].name}の商品ページを新しいタブで開きます）</span>
                </a>
                <p className="text-[0.9375rem] opacity-90">
                  {SHOPS[item.shop].name}・{yen(item.price)}
                </p>
              </div>
              <p className="text-[0.9375rem] leading-[1.6]">{item.reason}</p>
              {user && (
                <form action={togglePurchase}>
                  <input type="hidden" name="recipeId" value={recipe.id} />
                  <input type="hidden" name="itemId" value={item.id} />
                  <ToggleButton on={bought.has(item.id)} label={`${item.role}を買った`} onLabel={`${item.role}を買った ✓`} />
                </form>
              )}
            </li>
          ))}
        </ol>
      </div>
    </main>
  )
}
