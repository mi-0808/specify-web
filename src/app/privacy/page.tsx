import type { Metadata } from "next"
import { LargeTitle } from "../_components/LargeTitle"

export const metadata: Metadata = { title: "プライバシーポリシー | Specify" }

const h2 = "text-[1.0625rem] font-semibold"
const p = "text-[0.9375rem] leading-[1.8] text-on-surface-variant"

// Google ログインの公開に必要。ログインしていなくても開ける（proxy.ts の isPublicRoute）
export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-surface text-on-surface">
      <article className="mx-auto flex w-full max-w-xl flex-col gap-6 px-5 pb-12 pt-4 md:pt-8">
        <LargeTitle title="プライバシーポリシー" subtitle="2026年10月17日 制定・2026年10月25日 改定" alsoDesktop />

        <p className={p}>Specify運営者（以下「運営者」）は、Specify（以下「本サービス」）で扱う利用者の情報を、次のとおり取り扱います。</p>

        <section className="space-y-2">
          <h2 className={h2}>1. 集める情報</h2>
          <ul className={`${p} list-disc pl-5`}>
            <li>Googleでログインしたときに受け取る、メールアドレスと名前</li>
            <li>本サービスで保存した部屋、探索した部屋、作ったジャンル</li>
            <li>サービスの動作に必要なアクセスの記録（日時、ブラウザの種類など）</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className={h2}>2. 使う目的</h2>
          <p className={p}>ログインして本人を確かめるため、保存した内容を表示するため、不具合の調査とサービスの改善のためだけに使います。広告には使いません。</p>
        </section>

        <section className="space-y-2">
          <h2 className={h2}>3. 預け先</h2>
          <p className={p}>情報は、データを保存する Supabase と、サイトを配信する Vercel に預けています。どちらも本サービスを動かすためだけに使います。</p>
        </section>

        <section className="space-y-2">
          <h2 className={h2}>4. 第三者への提供</h2>
          <p className={p}>法令にもとづく場合を除き、本人の同意なく第三者に渡すことはありません。</p>
        </section>

        <section className="space-y-2">
          <h2 className={h2}>5. Googleから受け取る情報</h2>
          <p className={p}>Googleから受け取る情報は、ログインのためだけに使います。その扱いは Google API Services User Data Policy（Limited Use の要件を含む）に従います。</p>
        </section>

        <section className="space-y-2">
          <h2 className={h2}>6. Amazonアソシエイト・楽天アフィリエイト</h2>
          <p className={p}>本サービスは Amazon のアソシエイト、楽天アフィリエイトのパートナーとして、紹介した商品が Amazon・楽天市場で買われると紹介料を受け取ります。Amazon・楽天へのリンクを開くと、それぞれが Cookie などを使って、どのリンクから来たかを記録します。運営者から Amazon・楽天に、利用者の情報を渡すことはありません。</p>
        </section>

        <section className="space-y-2">
          <h2 className={h2}>7. 削除の依頼</h2>
          <p className={p}>アカウントと保存した内容の削除を希望するときは、下の問い合わせ先にご連絡ください。確認のうえ削除します。</p>
        </section>

        <section className="space-y-2">
          <h2 className={h2}>8. 変更</h2>
          <p className={p}>このポリシーを変えるときは、このページでお知らせします。</p>
        </section>

        <section className="space-y-2">
          <h2 className={h2}>9. 問い合わせ先</h2>
          <p className={p}>Specify運営者<br /><a href="mailto:m22121139@gmail.com" className="text-primary underline underline-offset-2">m22121139@gmail.com</a></p>
        </section>
      </article>
    </main>
  )
}
