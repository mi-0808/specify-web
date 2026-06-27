export async function POST() {
  return Response.json({
    suggestions: [
      { target: "冬物のコート", location: "押入れの上段", reason: "使用頻度が低いものは上段にまとめると動線がスッキリします" },
      { target: "季節外の寝具", location: "圧縮袋に入れてクローゼット奥", reason: "圧縮袋で体積を減らすと収納スペースを大幅に確保できます" },
      { target: "床に置いてある小物", location: "引き出しや収納ボックスの中", reason: "床面積を空けると部屋全体がスッキリ見えます" },
    ],
  })
}
