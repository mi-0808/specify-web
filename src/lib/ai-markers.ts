/**
 * LLMが返したテキストからマーカーのJSON配列を取り出す。
 *
 * モデルはコードフェンスで囲んだり、配列の後に補足文（さらに別の配列を含むことすらある）を
 * 付けてくるため、素直に貪欲マッチしたJSON.parseは失敗しやすい。
 * 配列として解釈できなかった場合は空配列を返し、呼び出し側で0件として扱えるようにする。
 */
export function parseMarkerArray(text: string): unknown[] {
  for (const candidate of jsonCandidates(text)) {
    try {
      const parsed: unknown = JSON.parse(candidate)
      // オブジェクト単体で返ってきた場合は1件の配列として扱う
      if (Array.isArray(parsed)) return parsed
      if (typeof parsed === "object" && parsed !== null) return [parsed]
    } catch {
      // 次の候補を試す
    }
  }
  return []
}

function jsonCandidates(text: string): string[] {
  // ```json ... ``` のコードフェンスを剥がす
  const unfenced = text.replace(/```(?:json)?/gi, "").trim()

  const candidates = [unfenced]

  // 貪欲マッチ（配列が1つだけならこれで取れる）
  const greedy = unfenced.match(/\[[\s\S]*\]/)
  if (greedy) candidates.push(greedy[0])

  // 非貪欲マッチ（配列＋補足文のように複数の[]がある場合の先頭の配列）
  const lazy = unfenced.match(/\[[\s\S]*?\]/)
  if (lazy) candidates.push(lazy[0])

  // オブジェクト単体で返ってきた場合
  const object = unfenced.match(/\{[\s\S]*\}/)
  if (object) candidates.push(object[0])

  return candidates
}
