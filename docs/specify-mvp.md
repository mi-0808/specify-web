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

3つの内部ステップ（`shoot` → `submitting` → `sent`）を持つ単一ページとして実装する。
解析結果は同一画面では待たず、`/demo/waiting/[id]` で待つ。

| ステップ | 要素 | 状態 |
|---|---|---|
| `shoot` | 部屋全体・収納スペースの撮影（どちらか1枚でOK）、「提案を見る」ボタン | 未撮影 / 片方のみ / 2枚 |
| `submitting` | 送信中のローディング表示（Storageアップロード＋レコード作成） | 送信中 |
| `sent` | 送信完了。「提案を確認する」で `/demo/waiting/[id]` へ | 送信成功 / 送信失敗（`shoot` に戻してリトライ） |

- **遷移**：`shoot` → `submitting` → `sent` → `/demo/waiting/[id]`。
  `waiting` で `status = 'done'` になると提案が表示され、「保存する」で `/dashboard` へ遷移する。
  `status = 'failed'` の場合は撮り直し導線を出す。

#### `shoot` の撮影対象

- 「部屋全体」と「収納スペース」の2種類
- どちらか1枚以上あれば提案に進める（両方必須ではない）
- 両方撮ると提案の質が上がる旨をUIで促す

#### `shoot` の撮影パターン

##### 部屋全体を撮る

- 任意（スキップ可）
- スキップ時は「収納スペースだけで提案します」と表示

##### 収納スペースを撮る

- 任意（スキップ可）
- スキップ時は「部屋全体の写真で提案します」と表示

※ 両方スキップは不可。どちらか1枚は必須。

#### `shoot` の状態管理

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

写真をAI（OpenAI `gpt-4o`）に渡し、改善方針と提案リストを生成して `suggestions` 行を更新する。
`/demo` からはレスポンスを待たずに非同期でキックされ、担当者は `/demo/waiting/[id]` で結果を待つ。

**リクエスト**

```typescript
{
  suggestion_id: string
  room_image_url: string | null      // 部屋全体（スキップ時は null）
  storage_image_url: string | null   // 収納スペース（スキップ時は null）
}
```

`room_image_url` / `storage_image_url` はどちらか一方が `null` でもよい（渡された写真だけで解析する）。
両方 `null` の場合は 400 を返す。

**副作用**：`suggestions` の `reasoning` / `storage_options` / `raw_json` / `status` を更新する。
成功時は `status = 'analyzing'`、AI呼び出しやJSONパースに失敗した場合は `status = 'failed'` にする。

### 完成イメージ画像の生成（`src/lib/result-image.ts`）

`reasoning` を元に DALL·E 3 で完成イメージ画像を生成し、Storage に保存して
`suggestions.result_image_url` と `status = 'done'` を更新する。
`/api/analyze` のレスポンス後（`after()`）に内部関数として呼ぶ。

以前は `POST /api/generate` というエンドポイントだったが、
認証なしで課金APIを叩けてしまう点と、サーバー間fetchではセッションが無くRLSに弾かれる点から、
HTTPホップを廃止して service role key を使う内部モジュールに変更した。
画像生成に失敗した場合も提案テキストは配信したいので `status = 'done'` にする。

### `POST /api/admin/upload`（管理者のみ）

WoZ用。管理者が手動で作成した結果画像をアップロードし、`result_image_url` / `status = 'done'` を更新する。

### `POST /api/admin/report`（管理者のみ）

WoZ用。写真上のマーカー（`suggestion_markers`）を保存し、`status = 'done'` に更新する。

---

## 5. DBスキーマ

`suggestions` は元々 `score` / `reasoning` / `storage_options`（Json）のみだったため、
写真URL・AI生出力・進行ステータスを保持するカラムを追加している
（`supabase/migrations/20260627095401_add_suggestions_image_markup_columns.sql` /
`20260730000706_add_suggestions_image_tag_raw_json.sql`）。

```sql
ALTER TABLE suggestions
  ADD COLUMN IF NOT EXISTS image_tag text,
  ADD COLUMN IF NOT EXISTS raw_json jsonb,
  ADD COLUMN IF NOT EXISTS room_image_url text,
  ADD COLUMN IF NOT EXISTS storage_image_url text,
  ADD COLUMN IF NOT EXISTS result_image_url text,
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending';
```

- `room_image_url` / `storage_image_url`：撮影画像の保存先URL（Supabase Storage）。スキップ時は `null`
- `result_image_url`：AI生成 or 管理者がアップロードした完成イメージ画像
- `status`：`pending`（受付） → `analyzing`（AI解析済み・画像生成待ち） → `done`（提示可能） / `failed`（解析失敗）
- `raw_json`：AIの生レスポンス（デバッグ・後からの再解釈用）
- `storage_options`：`StorageOption[]`（対象物・収納先・理由）をJsonとして格納

写真上のマーカーは別テーブルに持つ（`supabase/migrations/20260714025118_add_suggestion_markers.sql`）。

```sql
CREATE TABLE suggestion_markers (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  suggestion_id  uuid NOT NULL REFERENCES suggestions(id) ON DELETE CASCADE,
  image_type     text NOT NULL CHECK (image_type IN ('room', 'storage')),
  x              float NOT NULL,   -- 0〜1
  y              float NOT NULL,   -- 0〜1
  comment        text NOT NULL,
  sort_order     int NOT NULL DEFAULT 0,
  created_at     timestamptz DEFAULT now()
);
```

RLSは `20260616025745_enable_rls_policies.sql`（ToC）と `20260708155650_create_tob_tables.sql`（ToB）、
`20260714025118_add_suggestion_markers.sql` で有効化されている。
`spaces` は本人のみ、`suggestions` は自分の `spaces` に紐づくものだけ、
`suggestion_markers` は読み取りのみ（書き込みは service role key を使う管理者APIに限定）。

---

## 6. 実装状況

| # | 内容 | 状態 |
|---|---|---|
| ① | `POST /api/analyze`（当初はWoZの固定文、現在はgpt-4oによる解析） | 実装済み |
| ② | `suggestions` のカラム追加と `src/types/database.ts` の型更新 | 実装済み |
| ③ | `/demo` を撮影フローに置き換え（AR計測コードは参照しない） | 実装済み（`shoot` → `submitting` → `sent` の3ステップ） |
| ④ | 撮影画像を `/api/analyze` に送信し結果を表示 | 実装済み（結果は `/demo/waiting/[id]` で表示） |
| ⑤ | `spaces` / `suggestions` への保存と `/dashboard` の履歴表示 | 実装済み |

※ ③④は当初案の `intro` → `capture` → `analyzing` → `result` ではなく、
送信完了を即座に返して結果を別画面（`/demo/waiting/[id]`）で待つ構成に変更した。
AIの解析＋画像生成に時間がかかり、同一画面で待たせるとタイムアウトしやすいため。

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
