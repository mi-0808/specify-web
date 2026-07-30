import { describe, expect, it } from "vitest"
import { parseMarkerArray } from "./ai-markers"

describe("parseMarkerArray", () => {
  it("素直なJSON配列をそのまま返す", () => {
    expect(parseMarkerArray('[{"x":0.1,"y":0.2}]')).toEqual([{ x: 0.1, y: 0.2 }])
  })

  it("コードフェンスで囲まれていても取り出せる", () => {
    const text = '```json\n[{"x":0.1,"y":0.2,"comment":"通路"}]\n```'

    expect(parseMarkerArray(text)).toEqual([{ x: 0.1, y: 0.2, comment: "通路" }])
  })

  it("配列の前後に説明文があっても取り出せる", () => {
    const text = '以下が指摘です:\n[{"x":0.4,"y":0.6}]\n以上です。'

    expect(parseMarkerArray(text)).toEqual([{ x: 0.4, y: 0.6 }])
  })

  it("配列が2つ含まれていても先頭の配列を取り出す（貪欲マッチで壊れない）", () => {
    const text = '[{"x":0.1,"y":0.2}]\nおまけ: [{"x":0.9,"y":0.9}]'

    expect(parseMarkerArray(text)).toEqual([{ x: 0.1, y: 0.2 }])
  })

  it("入れ子の配列を含む正しいJSONは貪欲マッチ側で解釈する", () => {
    const text = '[{"x":0.1,"y":0.2,"tags":["a","b"]}]'

    expect(parseMarkerArray(text)).toEqual([{ x: 0.1, y: 0.2, tags: ["a", "b"] }])
  })

  it("オブジェクト単体で返ってきたら1件の配列に包む", () => {
    expect(parseMarkerArray('{"x":0.3,"y":0.5}')).toEqual([{ x: 0.3, y: 0.5 }])
  })

  it("JSONが含まれないテキストは空配列にする", () => {
    expect(parseMarkerArray("問題は見つかりませんでした")).toEqual([])
  })

  it("空文字は空配列にする", () => {
    expect(parseMarkerArray("")).toEqual([])
  })

  it("壊れたJSONは空配列にする（例外を投げない）", () => {
    expect(parseMarkerArray('[{"x":0.1,"y":')).toEqual([])
  })

  it("空配列を返してきた場合はそのまま空配列", () => {
    expect(parseMarkerArray("[]")).toEqual([])
  })
})
