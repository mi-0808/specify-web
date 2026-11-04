import { createHash } from "node:crypto"

// 説明欄から「ラベル＋URL」を読み取る（docs/specify-design.md 4章）
const URL_RE = /https?:\/\/[^\s　]+/
const TIME_RE = /^\d{1,2}:\d{2}(?::\d{2})?\s*/
const SKIP_RE = /まとめ|こちら|チャンネル|登録|BGM|music|instagram|インスタ|twitter|tiktok|お問い?合わせ|お問合せ/i
const MAX_LABEL = 30

// 「▶︎https://…」の「▶︎」のように文字も数字もないものはラベルにせず、前の行の商品名を使う
const cleanLabel = (s: string) => {
  const label = s.replace(TIME_RE, "").replace(/[：:\s　]+$/, "").replace(/^[・\-–—\s　]+/, "").trim()
  return /[\p{L}\p{N}]/u.test(label) ? label : ""
}

export function parseItems(description: string): { label: string; url: string }[] {
  const items: { label: string; url: string }[] = []
  let pending: string | null = null
  // 「・ソファー(無印良品)」→ 説明文 → 空行 → URL のように、商品名と URL が離れている書き方のために、
  // 最後の「・」の行を空行をまたいで覚えておく。URL を1つ読むか、見出しが来たら忘れる
  let bullet: string | null = null

  for (const raw of description.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line) {
      pending = null
      continue
    }
    const match = line.match(URL_RE)
    if (!match) {
      // 見出し（●）やハッシュタグの行は、次の URL のラベルにしない。【】の行は次の行の URL のラベルにはする
      pending = /^[●#＃]/.test(line) ? null : cleanLabel(line)
      if (/^[●#＃【]/.test(line)) bullet = null
      else if (/^[・•]/.test(line)) bullet = pending
      continue
    }
    const label = cleanLabel(line.slice(0, match.index)) || pending || bullet
    pending = null
    bullet = null
    const url = match[0].replace(/[)）」』】>]+$/, "")
    if (label && label.length <= MAX_LABEL && !label.includes("。") && !SKIP_RE.test(label)) items.push({ label, url })
  }
  return items
}

export const hashText = (text: string) => createHash("sha256").update(text).digest("hex")

// 貼られたリンクから YouTube の動画 ID を取り出す。YouTube 以外や形が違うものは null
export function youtubeIdFromUrl(input: string): string | null {
  let url: URL
  try {
    url = new URL(input.trim())
  } catch {
    return null
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null
  const host = url.hostname.replace(/^(www|m|music)\./, "")
  const id =
    host === "youtu.be"
      ? url.pathname.slice(1)
      : host === "youtube.com"
        ? url.pathname === "/watch"
          ? url.searchParams.get("v")
          : url.pathname.match(/^\/(?:shorts|live|embed)\/([^/]+)/)?.[1]
        : null
  return id && /^[\w-]{11}$/.test(id) ? id : null
}
