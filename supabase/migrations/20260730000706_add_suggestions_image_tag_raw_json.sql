-- image_tag / raw_json は本番DBにマイグレーション履歴なしで追加されていたため、
-- 履歴に載せるために追記する（既存環境では IF NOT EXISTS により no-op）
ALTER TABLE suggestions
  ADD COLUMN IF NOT EXISTS image_tag text,
  ADD COLUMN IF NOT EXISTS raw_json jsonb;
