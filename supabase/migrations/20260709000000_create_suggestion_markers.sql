-- ToC提案の画像マーカー（管理者が写真上に打つピン）
-- image_type: どちらの写真に対するマーカーか（部屋全体 / 収納スペース）

CREATE TABLE IF NOT EXISTS suggestion_markers (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  suggestion_id  uuid NOT NULL REFERENCES suggestions(id) ON DELETE CASCADE,
  image_type     text NOT NULL CHECK (image_type IN ('room', 'storage')),
  x              float NOT NULL,   -- 0〜1（写真幅に対するパーセンテージ）
  y              float NOT NULL,   -- 0〜1（写真高さに対するパーセンテージ）
  comment        text NOT NULL,
  sort_order     int NOT NULL DEFAULT 0,
  created_at     timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS suggestion_markers_suggestion_id_idx
  ON suggestion_markers(suggestion_id);
