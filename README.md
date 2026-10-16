# Specify

ネットで見たおしゃれな部屋から家具を特定して、自分に合う買い方（安い版・本物・中古など）を比べて選べる Web アプリ。
今は段階1（ルームツアー動画を自動で集めて、部屋を眺めて見つける）まで。

- 企画書: [docs/specify-plan.md](docs/specify-plan.md)
- 設計書（段階1）: [docs/specify-design.md](docs/specify-design.md)
- デザイン規約: [docs/design-guidelines.md](docs/design-guidelines.md)

## 技術スタック

Next.js 16（App Router / Turbopack）・React 19・TypeScript・Tailwind CSS v4・Supabase（Auth / Postgres）・Vitest（テスト）

## セットアップ

```bash
npm install
```

```bash
cp .env.example .env.local
```

`.env.local` に各値を設定する。意味は [.env.example](.env.example) のコメントを参照。

### データベース

`supabase/migrations/` の SQL を順番に適用する。Supabase CLI がある場合:

```bash
supabase db push
```

旧企画（写真を送って提案を受け取る機能、部屋のレシピ）のテーブルも含まれている。今のアプリからは使っていない。

### 開発サーバー

```bash
npm run dev
```

## 画面構成

| パス | 役割 |
|---|---|
| `/` | 部屋を眺める（タグで絞り込み） |
| `/rooms/[id]` | 部屋の詳細：動画と、紹介されている家具・購入先 |
| `/api/cron/collect` | 部屋の自動収集（Vercel Cron が1日1回呼ぶ。`CRON_SECRET` が必要） |
| `/login` | ログイン・新規登録（今は入口なし） |

部屋は YouTube Data API でルームツアー動画を集め、説明欄の「使用アイテム」から作る（[docs/specify-design.md](docs/specify-design.md)）。
手元で収集を動かすときは、開発サーバーを起動して次を実行する。

```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/collect
```

## 配色

`src/app/globals.css` に Material Design 3 のカラーロールで定義している（ライト・ダーク両対応）。
コンポーネントでは `bg-primary` `text-on-surface` のようにロール名で使い、色コードを直接書かない。

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
