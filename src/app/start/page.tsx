import Link from "next/link"
import type { Metadata } from "next"
import { STYLES } from "@/data/recipes"
import { SiteHeader, pageShell } from "../_components/SiteHeader"

export const metadata: Metadata = { title: "雰囲気を選ぶ | Specify" }

export default function StartPage() {
  return (
    <main className="min-h-screen bg-surface text-on-surface">
      <div className={pageShell}>
        <SiteHeader />
        <section className="space-y-6">
          <div className="space-y-2">
            <p className="text-[0.9375rem] text-on-surface-variant">ステップ 1 / 2</p>
            <h1 className="text-[1.75rem] font-bold leading-[1.4]">どんな部屋にしたい？</h1>
          </div>
          <ul className="space-y-3">
            {STYLES.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/start/${s.id}`}
                  className="focus-ring block rounded-2xl border border-outline-variant bg-surface-container-lowest p-5 transition-colors hover:bg-surface-container-low"
                >
                  <span className="block text-[1.0625rem] font-semibold">{s.name}</span>
                  <span className="mt-1 block text-[0.9375rem] leading-[1.6] text-on-surface-variant">
                    {s.description}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  )
}
