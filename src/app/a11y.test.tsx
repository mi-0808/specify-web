import { describe, expect, it, vi } from "vitest"
import { render } from "@testing-library/react"
import axe from "axe-core"
import LoginPage from "./(auth)/login/page"

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ auth: {} }) }))

// ponytail: 静的にレンダーできる公開ページのみ。/ と /rooms/[id] は Supabase を読むため対象外（画面で確認する）
const pages = { LoginPage }

describe("axe (WCAG 2.1 AA)", () => {
  for (const [name, Page] of Object.entries(pages)) {
    it(`${name} に違反がない`, async () => {
      const { container } = render(<Page />)
      const { violations } = await axe.run(container, {
        runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] },
        // jsdom はレイアウト計算をしないため色コントラストは実測不可（上記で手計算済み）
        rules: { "color-contrast": { enabled: false } },
      })
      expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.html).join(" | ")}`)).toEqual([])
    })
  }
})
