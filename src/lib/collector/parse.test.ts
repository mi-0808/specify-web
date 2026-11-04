import { describe, expect, it } from "vitest"
import { parseItems, youtubeIdFromUrl } from "./parse"

// 実際のルームツアー動画の説明欄によくある書き方を再現したもの
const description = `お部屋にあるものの詳細は以下になります！

デスク：https://a.r10.to/aaaa
1人がけソファ: https://a.r10.to/bbbb
ポスター：https://www.instagram.com/someone

●楽天購入品まとめ
https://room.rakuten.co.jp/someone

●Amazon購入品
LEDテープライト
https://amzn.to/cccc
デスクチェア
https://amzn.to/dddd

00:44 全身鏡　楽天roomに載せています
13:15 ランプ
https://item.rakuten.co.jp/shop/lamp/

●BGM
Music from https://freetouse.com/music
チャンネル登録はこちら
https://youtube.com/@someone

#一人暮らし
https://example.com/hashtag-next-line`

describe("parseItems", () => {
  it("ラベル＋URLの書き方を読み取り、まとめ・SNS・BGMなどは除く", () => {
    expect(parseItems(description)).toEqual([
      { label: "デスク", url: "https://a.r10.to/aaaa" },
      { label: "1人がけソファ", url: "https://a.r10.to/bbbb" },
      { label: "ポスター", url: "https://www.instagram.com/someone" }, // URL の許可は resolve 側で判定する
      { label: "LEDテープライト", url: "https://amzn.to/cccc" },
      { label: "デスクチェア", url: "https://amzn.to/dddd" },
      { label: "ランプ", url: "https://item.rakuten.co.jp/shop/lamp/" },
    ])
  })

  it("「▶︎URL」のように記号だけの前置きなら、前の行をラベルにする", () => {
    expect(parseItems("LG 27インチ4Kモニター\n▶︎https://amzn.to/eeee\n\n無印良品のベンチ\n👉 https://amzn.to/ffff")).toEqual([
      { label: "LG 27インチ4Kモニター", url: "https://amzn.to/eeee" },
      { label: "無印良品のベンチ", url: "https://amzn.to/ffff" },
    ])
  })

  it("「・商品名」→ 説明文 → 空行 → URL の書き方でも、「・」の行をラベルにする", () => {
    const text = `【Q.オススメのアイテム】

・ソファー(無印良品)

ソファーの背面がすごく可愛くて2シーターでも存在感があります

https://www.muji.com/jp/ja/store/cmdty/detail/4550512396741

・マグネットタブレットホルダー(山崎実業)

疲れている時のゆったりとしたお風呂時間を助けてくれるアイテムです

https://www.amazon.co.jp/dp/B09GJMNC6X

・お気に入りのラグ

【YouTube】

https://www.youtube.com/@someone`
    expect(parseItems(text)).toEqual([
      { label: "ソファー(無印良品)", url: "https://www.muji.com/jp/ja/store/cmdty/detail/4550512396741" },
      { label: "マグネットタブレットホルダー(山崎実業)", url: "https://www.amazon.co.jp/dp/B09GJMNC6X" },
    ])
  })

  it("長すぎる文はラベルにしない", () => {
    expect(parseItems("何か皆様の家具やインテリア探しのお役に立てたら嬉しいですというとても長い文章です\nhttps://a.r10.to/x")).toEqual([])
  })
})

describe("youtubeIdFromUrl", () => {
  it("YouTube のいろいろな形のリンクから動画 ID を取り出す", () => {
    for (const url of [
      "https://www.youtube.com/watch?v=ozcC9rN1RlQ",
      "https://m.youtube.com/watch?v=ozcC9rN1RlQ&t=30s",
      "https://youtu.be/ozcC9rN1RlQ?si=abc",
      "https://www.youtube.com/shorts/ozcC9rN1RlQ",
      " https://youtube.com/live/ozcC9rN1RlQ ",
    ]) {
      expect(youtubeIdFromUrl(url), url).toBe("ozcC9rN1RlQ")
    }
  })

  it("YouTube 以外や形が違うものは null", () => {
    for (const url of ["https://www.instagram.com/reel/abc", "https://evil.com/watch?v=ozcC9rN1RlQ", "javascript:alert(1)", "ozcC9rN1RlQ", "https://youtu.be/short"]) {
      expect(youtubeIdFromUrl(url), url).toBeNull()
    }
  })
})
