ALTER TABLE suggestions
  ADD COLUMN IF NOT EXISTS room_image_url text,
  ADD COLUMN IF NOT EXISTS storage_image_url text,
  ADD COLUMN IF NOT EXISTS result_image_url text,
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending';
-- status: 'pending'（受付） / 'analyzing'（AI解析済み） / 'done'（提示可能） / 'failed'（解析失敗）
