import type { Metadata } from "next"
import Link from "next/link"
import { LargeTitle } from "../_components/LargeTitle"
import { SiteHeader } from "../_components/SiteHeader"

export const metadata: Metadata = { title: "利用規約 | Specify" }

const h2 = "text-[1.0625rem] font-semibold"
const p = "text-[0.9375rem] leading-[1.8] text-on-surface-variant"

// ログインしていなくても開ける（proxy.ts の isPublicRoute）
export default function TermsPage() {
  return (
    <main className="min-h-screen bg-surface text-on-surface">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-5 pb-12 pt-4 md:pt-8">
        <SiteHeader />
        <article className="mx-auto flex w-full max-w-xl flex-col gap-6">
          <LargeTitle title="利用規約" subtitle="2026年10月17日 制定" alsoDesktop />

          <p className={p}>この規約は、Specify運営者（以下「運営者」）が提供する Specify（以下「本サービス」）の使い方を定めます。本サービスを使うと、この規約に同意したことになります。</p>

          <section className="space-y-2">
            <h2 className={h2}>1. アカウント</h2>
            <p className={p}>Googleアカウントでログインして使います。アカウントは本人だけが使ってください。</p>
          </section>

          <section className="space-y-2">
            <h2 className={h2}>2. 禁止していること</h2>
            <ul className={`${p} list-disc pl-5`}>
              <li>法令や公序良俗に反すること</li>
              <li>他人の権利を侵すこと</li>
              <li>本サービスの動作を妨げること、不正にアクセスすること</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className={h2}>3. 紹介している商品と外部サイト</h2>
            <p className={p}>本サービスは、動画に映る家具や雑貨と、それを買えるお店を紹介します。商品の内容、価格、在庫、購入は各お店の責任となり、運営者は保証しません。</p>
          </section>

          <section className="space-y-2">
            <h2 className={h2}>4. サービスの変更と停止</h2>
            <p className={p}>運営者は、予告なく本サービスの内容を変えたり、止めたりすることがあります。</p>
          </section>

          <section className="space-y-2">
            <h2 className={h2}>5. 責任の範囲</h2>
            <p className={p}>運営者は、本サービスを使ったことで生じた損害について、運営者に故意または重大な過失がある場合を除き、責任を負いません。</p>
          </section>

          <section className="space-y-2">
            <h2 className={h2}>6. 個人情報</h2>
            <p className={p}>
              利用者の情報は<Link href="/privacy" className="mx-1 text-primary underline underline-offset-2">プライバシーポリシー</Link>のとおり扱います。
            </p>
          </section>

          <section className="space-y-2">
            <h2 className={h2}>7. 規約の変更</h2>
            <p className={p}>この規約を変えるときは、このページでお知らせします。変更後に本サービスを使うと、新しい規約に同意したことになります。</p>
          </section>

          <section className="space-y-2">
            <h2 className={h2}>8. 準拠法</h2>
            <p className={p}>この規約は日本法に従います。</p>
          </section>

          <section className="space-y-2">
            <h2 className={h2}>9. 問い合わせ先</h2>
            <p className={p}>Specify運営者<br /><a href="mailto:m22121139@gmail.com" className="text-primary underline underline-offset-2">m22121139@gmail.com</a></p>
          </section>
        </article>
      </div>
    </main>
  )
}
