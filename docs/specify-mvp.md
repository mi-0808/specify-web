# Specify MVP 設計書

## 1. コア体験の定義

> **「写真を撮る → 場所タグを選ぶ → AI提案が返る」**

AR計測（4隅タップによる寸法取得）はMVPのコア体験ではなく将来拡張とする。`/demo` は現在AR計測フローになっているため、本MVPでは「撮影→AI提案」フローに置き換える主改修対象とする。

---

## 2. 既存ファイルの扱い方針

| ファイル / ディレクトリ | 分類 | 理由 |
|---|---|---|
| `src/app/page.tsx` | 改修 | トップから `/demo` への導線をコア体験（撮影フロー）に合わせて調整 |
| `src/app/demo/page.tsx` | **改修（主対象）** | AR計測フローを撮影→AI提案フローに置き換える |
| `src/app/dashboard/page.tsx` | 改修 | 収納スペース一覧に加え、提案履歴の表示に対応させる |
| `src/app/ar-test/page.tsx` | 対象外 | AR検証用。MVPでは触らない |
| `src/app/spaces/new/page.tsx` | 対象外 | AR計測フロー。MVPでは触らない |
| `src/app/(auth)/login/page.tsx` | 流用 | 既存の認証フローをそのまま使用 |
| `src/components/ar/` | 対象外 | AR計測コンポーネント群。MVPでは未使用 |
| `src/lib/supabase/` | 流用 | クライアント初期化等そのまま使用 |
| `src/lib/webxr/` | 対象外 | WebXR計測ロジック。MVPでは未使用 |
| `src/store/arStore.ts` | 対象外 | AR計測用の状態管理。MVPでは未使用 |
| `src/types/database.ts` | 改修 | `suggestions` テーブルの型変更に追従（4章のALTER TABLEに対応） |

---

## 3. 画面構成（3画面）

コア体験は `/` → `/demo` → `/dashboard` の3画面のみで完結させる。

### `/`（トップ）

- **要素**：プロダクト価値訴求（コピー）、「撮ってみる」CTA（`/demo` へ遷移）、ログイン導線（任意）
- **状態**：初回訪問 / ログイン済み再訪
- **遷移**：CTAタップ → `/demo`

### `/demo`（撮影→提案フロー）

3つの内部ステップ（`intro` → `capture` → `result`）を持つ単一ページとして実装する。

| ステップ | 要素 | 状態 |
|---|---|---|
| `intro` | フロー説明、「撮影を始める」ボタン | 初期表示 |
| `capture` | カメラプレビュー、部屋全体と収納スペースの撮影、撮影ボタン、スキップボタン | 権限許可待ち / 撮影中 / 撮影済みプレビュー |
| `analyzing` | ローディング表示（`POST /api/analyze` 待機） | 解析中 / タイムアウト |
| `result` | AI提案カード（対象物・収納先・理由）、「もう一度撮る」ボタン、「ダッシュボードに保存」ボタン | 提案成功 / 提案失敗（リトライ導線） |

- **遷移**：`intro` → `capture` → `analyzing` → `result`。`result` から「ダッシュボードに保存」で `/dashboard` へ遷移（未ログイン時は `/login` を経由）

#### `capture` の撮影対象

- 「部屋全体」と「収納スペース」の2種類
- どちらか1枚以上あれば提案に進める（両方必須ではない）
- 両方撮ると提案の質が上がる旨をUIで促す

#### `capture` の撮影ステップ

##### Step1-A: 部屋全体を撮る

- 任意（スキップ可）
- スキップ時は「収納スペースだけで提案します」と表示

##### Step1-B: 収納スペースを撮る

- 任意（スキップ可）
- スキップ時は「部屋全体の写真で提案します」と表示

※ 両方スキップは不可。どちらか1枚は必須。

#### `capture` の状態管理

```typescript
const [roomPhoto, setRoomPhoto] = useState<string | null>(null)       // 部屋全体
const [storagePhoto, setStoragePhoto] = useState<string | null>(null) // 収納スペース
// どちらかがnullでないこと → 次へ進める条件
```

### `/dashboard`（収納スペース一覧 + 提案履歴）

- **要素**：`spaces` 一覧、各スペースに紐づく最新 `suggestions` のサマリ、新規撮影への導線（`/demo` へ）
- **状態**：データなし（空状態の促し） / データあり
- **遷移**：「新しく撮影する」→ `/demo`、スペース選択 → 詳細（MVP範囲では一覧+簡易詳細のみ）

---

## 4. APIエンドポイント仕様

### `POST /api/analyze`

#### オズの魔法使い実装

- AIは使わない
- 固定の提案テキスト3件を返すだけ
- リクエストは受け取るが中身は見ない

```typescript
// app/api/analyze/route.ts
export async function POST() {
  return Response.json({
    suggestions: [
      { target: "冬物のコート", location: "押入れの上段", reason: "使用頻度が低いものは上段にまとめると動線がスッキリします" },
      { target: "季節外の寝具", location: "圧縮袋に入れてクローゼット奥", reason: "圧縮袋で体積を減らすと収納スペースを大幅に確保できます" },
      { target: "床に置いてある小物", location: "引き出しや収納ボックスの中", reason: "床面積を空けると部屋全体がスッキリ見えます" },
    ]
  })
}
```

---

## 5. DBスキーマ変更

既存の `suggestions` テーブルは `score` / `reasoning` / `storage_options`（Json）を持つが、画像URLと撮影場所タグを保持できないため最小限のカラムを追加する。

```sql
-- suggestionsテーブルへの最小限のカラム追加

ALTER TABLE suggestions
  ADD COLUMN image_url text,
  ADD COLUMN location_tag text CHECK (location_tag IN ('closet', 'oshiire', 'other')),
  ADD COLUMN summary text;
```

- `image_url`：撮影画像の保存先URL（Supabase Storage）。未保存（オプトアウト）の場合は `null`
- `location_tag`：撮影場所タグ。スキップ時は `null`
- `summary`：AI提案の総括コメント（`AnalyzeResponse.summary` に対応）

`storage_options` 列は既存の `Json` 型のまま `StorageOption[]` を格納する用途で流用する。

---

## 6. 実装順序

① `POST /api/analyze` エンドポイントを実装する（リクエストは受け取るが中身は見ず、4章の固定提案3件を返す）

② `suggestions` テーブルに5章のALTER TABLEを適用し、`src/types/database.ts` の型を更新する

③ `/demo` を `intro` → `capture` → `analyzing` → `result` の4ステップ構成に置き換える（既存のAR計測コード・`ARMeasureScene` 呼び出しは削除し、`getUserMedia` ベースの単純な撮影UIに差し替える）

④ `capture` ステップで撮影した画像を `/api/analyze` に送信し、`result` ステップでレスポンスを表示する

⑤ `result` ステップの「ダッシュボードに保存」から `spaces` / `suggestions` への保存処理を実装し、`/dashboard` で一覧・履歴表示に対応させる

---

## 7. MVP対象外リスト

以下のファイル・機能は本MVPでは一切変更しない。

- `src/app/ar-test/page.tsx`
- `src/app/spaces/new/page.tsx`（AR計測による新規スペース作成フロー）
- `src/components/ar/`（`ARMeasureScene` 等すべて）
- `src/lib/webxr/`（`measure.ts` 等すべて）
- `src/store/arStore.ts`
- WebXR / 4隅タップによる寸法計測機能そのもの
- 3D配置シミュレーション、Before/After記録、季節リマインド通知、コミュニティ/シェア機能（いずれも将来スコープ）
