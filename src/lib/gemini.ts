/**
 * Gemini（Google AI Studio）のOpenAI互換エンドポイントを叩く共通クライアント。
 *
 * 無料枠のGeminiはOpenRouterには存在せず（`:free` のGoogle系はGemmaと画像生成のみ）、
 * Googleの API 直にしか無いためこちらを使う。→ docs/ai-gemini-plan.md
 *
 * 画像URLをそのまま渡せない点に注意。Geminiは任意の公開URLを取りに行かないため、
 * こちら側で取得して data URI に変換してから送る。
 */

/** テストがURLで行き先を振り分けるため、文字列を二重管理しないようexportしている。 */
export const GEMINI_ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"
const DEFAULT_MODEL = "gemini-3.6-flash"

/**
 * 画像1枚あたりの生バイト数の上限。
 * インライン画像はリクエスト全体で20MBまでという制約があり、base64化で約1.34倍に膨らむ。
 * 2枚送るケース（部屋＋収納）があるので1枚7MBに抑える。
 */
const MAX_IMAGE_BYTES = 7 * 1024 * 1024

/** Gemini呼び出しに起因する失敗。呼び出し側はこれを捕捉してHTTPステータスに変換する。 */
export class GeminiError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "GeminiError"
  }
}

/** 使用するモデル。GEMINI_MODEL で差し替えられる（モデル終息時にコード変更なしで移れるように）。 */
export function geminiModel(): string {
  return process.env.GEMINI_MODEL || DEFAULT_MODEL
}

/** 画像取得のタイムアウト。応答しないホストにワーカーを占有されないため。 */
const IMAGE_FETCH_TIMEOUT_MS = 15_000

/**
 * 取得してよい画像URLか検証する。
 *
 * `POST /api/analyze` は未認証で叩ける（`src/proxy.ts` の matcher からも除外されている）ため、
 * 検証しないと「任意のURLをサーバーに取りに行かせる」踏み台になる（SSRF）。
 * 実際に渡ってくるのは自分の Supabase Storage の公開URLだけなので、そのオリジンに限定する。
 */
function assertAllowedImageUrl(url: string): void {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!supabaseUrl) throw new GeminiError("NEXT_PUBLIC_SUPABASE_URL not set")

  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new GeminiError("画像URLの形式が不正です")
  }

  // ローカル開発では http のSupabaseを指すことがあるので、スキームではなくオリジンで判定する
  if (parsed.origin !== new URL(supabaseUrl).origin) {
    throw new GeminiError(`許可されていないオリジンの画像URLです (${parsed.origin})`)
  }
}

/**
 * レスポンスボディを上限付きで読む。
 *
 * `arrayBuffer()` で読み切ってからサイズを見ると、上限を超える分も一度メモリに載ってしまう。
 * Content-Length は詐称・省略され得るので、読みながら数えて超えた時点で打ち切る。
 */
async function readCapped(res: Response): Promise<Buffer> {
  const declared = Number(res.headers.get("content-length"))
  if (Number.isFinite(declared) && declared > MAX_IMAGE_BYTES) {
    throw new GeminiError(`画像が大きすぎます (${declared} bytes)`)
  }
  if (!res.body) throw new GeminiError("画像のレスポンスが空です")

  const reader = res.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > MAX_IMAGE_BYTES) {
        await reader.cancel()
        throw new GeminiError(`画像が大きすぎます (${total} bytes 以上)`)
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }

  return Buffer.concat(chunks)
}

/** 画像URLを取得して data URI に変換する。 */
async function toDataUri(url: string): Promise<string> {
  assertAllowedImageUrl(url)

  // リダイレクトを追うと許可オリジンのチェックを迂回されるため、追わずに失敗させる
  const res = await fetch(url, {
    redirect: "error",
    signal: AbortSignal.timeout(IMAGE_FETCH_TIMEOUT_MS),
  })
  if (!res.ok) {
    throw new GeminiError(`画像の取得に失敗しました (${res.status})`)
  }

  // charset等のパラメータが付くことがあるので先頭のMIMEタイプだけ取る
  const contentType = (res.headers.get("content-type") ?? "image/jpeg").split(";")[0].trim()
  if (!contentType.startsWith("image/")) {
    throw new GeminiError(`画像ではないURLが渡されました (${contentType})`)
  }

  const buffer = await readCapped(res)

  return `data:${contentType};base64,${buffer.toString("base64")}`
}

/**
 * プロンプトと画像をGeminiに渡し、返ってきたテキストをそのまま返す。
 *
 * 画像は渡された順にインライン化する。JSONの解釈は呼び出し側の責務
 * （モデルがコードフェンスや補足文を付けてくるため、`parseMarkerArray()` 等でほぐす）。
 */
export async function callGemini({
  prompt,
  imageUrls = [],
  maxTokens,
}: {
  prompt: string
  imageUrls?: string[]
  maxTokens?: number
}): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new GeminiError("GEMINI_API_KEY not set")

  const content: object[] = [{ type: "text", text: prompt }]
  for (const url of imageUrls) {
    content.push({ type: "image_url", image_url: { url: await toDataUri(url) } })
  }

  const res = await fetch(GEMINI_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: geminiModel(),
      messages: [{ role: "user", content }],
      ...(maxTokens ? { max_tokens: maxTokens } : {}),
    }),
  })

  if (!res.ok) {
    const detail = await res.text()
    throw new GeminiError(`Gemini API エラー (${res.status}): ${detail}`)
  }

  const json = await res.json()
  const choice = json.choices?.[0]

  // max_tokens 打ち切りは200で返るうえ、途中まで妥当なJSONに見えることがある。
  // 呼び出し側のパース失敗として現れると原因が追いにくいので、ここで残しておく。
  if (choice?.finish_reason === "length") {
    console.warn(
      `[gemini] max_tokensで打ち切られました（思考トークンも上限に含まれます）: model=${geminiModel()}`
    )
  }

  return choice?.message?.content ?? ""
}
