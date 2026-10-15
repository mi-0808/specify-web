import { describe, expect, it } from "vitest"
import { RECIPES, SHOPS, STYLES, totalOf } from "./recipes"

describe("レシピデータの整合性", () => {
  it("レシピIDが重複せず、`${style}-${budget}` になっている", () => {
    const ids = RECIPES.map((r) => r.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const r of RECIPES) expect(r.id).toBe(`${r.style}-${r.budget}`)
  })

  for (const r of RECIPES) {
    it(`${r.id}: 中身が正しい`, () => {
      expect(STYLES.some((s) => s.id === r.style)).toBe(true)
      expect(totalOf(r)).toBeLessThanOrEqual(r.budget)

      const itemIds = r.items.map((i) => i.id)
      expect(new Set(itemIds).size).toBe(itemIds.length)

      for (const i of r.items) {
        const url = new URL(i.url)
        expect(url.protocol, i.id).toBe("https:")
        expect(url.host, i.id).toBe(SHOPS[i.shop].host)
        expect(i.checkedAt, i.id).toMatch(/^\d{4}-\d{2}-\d{2}$/)
        expect(Number.isNaN(Date.parse(i.checkedAt)), i.id).toBe(false)
        expect(Number.isInteger(i.price) && i.price > 0, i.id).toBe(true)
      }
    })
  }
})
