import Link from "next/link"
import { SiteHeader, pageShell, primaryButton } from "./_components/SiteHeader"

export default function HomePage() {
  return (
    <main className="min-h-screen bg-surface text-on-surface">
      <div className={pageShell}>
        <SiteHeader />

        <section className="flex flex-1 flex-col justify-center gap-4">
          <h1 className="text-[2.125rem] font-bold leading-[1.4] tracking-tight">
            理想の部屋を、
            <br />
            今買える家具の
            <br />
            レシピに。
          </h1>
          <p className="text-[1.0625rem] leading-[1.7] text-on-surface-variant">
            SNSで見たあの雰囲気を、ニトリ・IKEA・無印などで実際に買える家具の組み合わせにします。どこで、いくらで買えるかまで分かります。
          </p>
        </section>

        <Link href="/start" className={primaryButton}>
          理想の部屋を選ぶ
        </Link>
      </div>
    </main>
  )
}
