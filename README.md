# Specify

現場・部屋の写真を撮って送るだけで、改善提案が返ってくる Web アプリ。
ToC（自宅の収納提案）と ToB（工場・現場の動線／安全診断）の2系統を1つの Next.js アプリで提供する。

MVP は WoZ（Wizard of Oz）方式：担当者が送った写真を管理者が確認し、提案やマーカーを付けて返す。
AI（OpenAI / OpenRouter）は管理者の入力補助・自動提案として組み込んである。

- 仕様書（ToC）: [docs/specify-mvp.md](docs/specify-mvp.md)
- 仕様書（ToB）: [docs/specify-tob-mvp.md](docs/specify-tob-mvp.md)

## 技術スタック

Next.js 16（App Router / Turbopack）・React 19・TypeScript・Tailwind CSS v4・Supabase（Auth / Postgres / Storage）・Resend（メール通知）・Vitest（テスト）

## 使っているAI

| 用途 | 経路 | モデル |
|---|---|---|
| ToC 収納提案の解析（`/api/analyze`） | OpenAI 直 | `gpt-4o` |
| ToC 完成イメージ画像の生成（`src/lib/result-image.ts`） | OpenAI 直 | `dall-e-3` |
| 管理画面のマーカー自動提案（`/api/ai/suggest-b`・`/api/ai/suggest-c`） | OpenRouter | `google/gemini-2.0-flash-exp:free` |

必要な環境変数は `OPENAI_API_KEY` と `OPENROUTER_API_KEY`。どちらも未設定でも WoZ（管理者が手動でマーカーを打つ運用）は成立する。

## セットアップ

```bash
npm install
```

```bash
cp .env.example .env.local
```

`.env.local` を編集して Supabase の URL / キー、`ADMIN_EMAILS`、`NEXT_PUBLIC_BASE_URL` を設定する。
各変数の意味は [.env.example](.env.example) のコメントを参照。

### データベース

`supabase/migrations/` の SQL を順番に適用する。Supabase CLI がある場合:

```bash
supabase db push
```

CLI を使わない場合は Supabase ダッシュボードの SQL Editor に各ファイルの内容を貼り付けて実行する。

### Storage

`specify-images` という名前の public バケットを作成する（写真の保存先）。

### メール通知（Resend）

`RESEND_API_KEY` が未設定の場合、メール送信はスキップされ警告ログだけが出る（他の機能は動く）。

送信元アドレスは `RESEND_FROM` で指定する。未設定時は `onboarding@resend.dev` にフォールバックするが、
これは Resend の開発用共有アドレスで、宛先によっては迷惑メール判定される。本番では独自ドメインを検証する。

独自ドメイン検証の手順:

1. 独自ドメインを取得する（`*.vercel.app` は DNS レコードを追加できないため検証に使えない）
2. Resend ダッシュボード → Domains → Add Domain でドメインを登録する
3. 表示された DNS レコードをドメインの DNS に登録する
   - `MX`（`send` サブドメイン、Resend のバウンス受信用）
   - `TXT`（SPF：`v=spf1 include:amazonses.com ~all`）
   - `TXT`（DKIM：`resend._domainkey`）
   - 任意で `TXT`（DMARC：`_dmarc`）
4. Resend 側で Verified になったら、`RESEND_FROM` を `Specify <noreply@取得したドメイン>` に設定する
5. `NEXT_PUBLIC_BASE_URL` も本番URLに合わせる（メール本文のリンクがこの値を使う）

### 開発サーバー

```bash
npm run dev
```

## 画面構成

### ToC（個人向け）

| パス | 役割 |
|---|---|
| `/` | ランディング |
| `/demo` | 撮影 → 送信フロー |
| `/dashboard` | 提案履歴一覧 |
| `/admin` | 管理者画面（提案作成） |

### ToB（法人向け）

| パス | 役割 |
|---|---|
| `/b` | ランディング |
| `/b/workspace` | エリア一覧 |
| `/b/scan` | 撮影 → 送信フロー |
| `/b/report/[id]` | レポート表示（画像マーカービュー） |
| `/b/admin` | 管理者画面（マーカー付与） |

`/admin` と `/b/admin` は `ADMIN_EMAILS` に含まれるメールアドレスでログインした場合のみアクセスできる。

## 検証コマンド

```bash
npm run test
```

```bash
npm run typecheck
```

```bash
npm run lint
```

```bash
npm run build
```

## 対象外（将来スコープ）

AR 計測（`/ar-test`・`/spaces/new`・`src/components/ar/`・`src/lib/webxr/`）は将来拡張用の検証コードで、MVP のフローからは参照していない。
YOLO による自動物体検出、動線距離の自動計算、Before/After 比較も将来フェーズ。
