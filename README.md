# Specify

SNSで見た理想の部屋を、今買える家具の「レシピ」にする Web アプリ。
雰囲気と予算から、ニトリ・IKEA・無印などで実際に買える商品の組み合わせ（商品・店・価格・総額）を出す。

- 企画書（部屋のレシピ）: [docs/specify-recipe-plan.md](docs/specify-recipe-plan.md)
- MVP 設計書: [docs/specify-recipe-mvp.md](docs/specify-recipe-mvp.md)
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

`.env.local` に Supabase の URL と anon キーを設定する。

### データベース

`supabase/migrations/` の SQL を順番に適用する。Supabase CLI がある場合:

```bash
supabase db push
```

旧企画（写真を送って提案を受け取る機能）のテーブルも含まれている。今のアプリからは使っていない。

### 開発サーバー

```bash
npm run dev
```

## 画面構成

| パス | 役割 |
|---|---|
| `/` | トップ（入口） |
| `/start` | 雰囲気を選ぶ |
| `/start/[style]` | 予算を選ぶ |
| `/recipes/[id]` | レシピ（保存・「買った」の記録） |
| `/home` | マイページ（保存したレシピと次の一手） |
| `/login` | ログイン・新規登録 |

レシピを見るまでは会員登録なしで使える。保存・記録・マイページは会員登録が必要。
レシピのデータは `src/data/recipes.ts` に書く。

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
