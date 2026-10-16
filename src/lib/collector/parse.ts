import { createHash } from "node:crypto"

// 説明欄から「ラベル＋URL」を読み取る（docs/specify-design.md 4章）
const URL_RE = /https?:\/\/[^\s　]+/
const TIME_RE = /^\d{1,2}:\d{2}(?::\d{2})?\s*/
const SKIP_RE = /まとめ|こちら|チャンネル|登録|BGM|music|instagram|インスタ|twitter|tiktok|お問い?合わせ|お問合せ/i
const MAX_LABEL = 30

const cleanLabel = (s: string) =>
  s.replace(TIME_RE, "").replace(/[：:\s　]+$/, "").replace(/^[・\-–—\s　]+/, "").trim()

export function parseItems(description: string): { label: string; url: string }[] {
  const items: { label: string; url: string }[] = []
  let pending: string | null = null

  for (const raw of description.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line) {
      pending = null
      continue
    }
    const match = line.match(URL_RE)
    if (!match) {
      // 見出し（●）やハッシュタグの行は、次の URL のラベルにしない
      pending = /^[●#＃]/.test(line) ? null : cleanLabel(line)
      continue
    }
    const label = cleanLabel(line.slice(0, match.index)) || pending
    pending = null
    const url = match[0].replace(/[)）」』】>]+$/, "")
    if (label && label.length <= MAX_LABEL && !label.includes("。") && !SKIP_RE.test(label)) items.push({ label, url })
  }
  return items
}

const TAGS: [string, RegExp][] = [
  ["韓国", /韓国/],
  ["北欧", /北欧/],
  ["ナチュラル", /ナチュラル/],
  ["カフェ", /カフェ/],
  ["モノトーン", /モノトーン|白黒/],
  ["ホテルライク", /ホテルライク/],
  ["アンティーク", /アンティーク|ヴィンテージ|ビンテージ/],
  ["ミニマル", /ミニマル|ミニマリスト/],
]
export const TAG_NAMES = TAGS.map(([name]) => name)

export const detectTags = (text: string) => TAGS.filter(([, re]) => re.test(text)).map(([name]) => name)

export const hashText = (text: string) => createHash("sha256").update(text).digest("hex")
