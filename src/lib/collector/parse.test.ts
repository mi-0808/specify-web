import { describe, expect, it } from "vitest"
import { detectTags, isInteriorVideo, parseItems, youtubeIdFromUrl } from "./parse"

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

  it("長すぎる文はラベルにしない", () => {
    expect(parseItems("何か皆様の家具やインテリア探しのお役に立てたら嬉しいですというとても長い文章です\nhttps://a.r10.to/x")).toEqual([])
  })
})

describe("detectTags", () => {
  it("タイトルや説明欄の言葉から雰囲気のタグを付ける", () => {
    expect(detectTags("1K8畳 IKEAと韓国インテリア｜北欧×ヴィンテージ")).toEqual(["韓国", "北欧", "アンティーク"])
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

describe("isInteriorVideo", () => {
  it("部屋・インテリアの動画だけを通す", () => {
    expect(isInteriorVideo("【ルームツアー】1K8畳の一人暮らし")).toBe(true)
    expect(isInteriorVideo("北欧インテリアで模様替え")).toBe(true)
    expect(isInteriorVideo("【料理】5分でできるパスタ")).toBe(false)
    expect(isInteriorVideo("ゲーム実況 #12")).toBe(false)
  })
})
