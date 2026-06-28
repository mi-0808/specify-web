ALTER TABLE suggestions
  ADD COLUMN IF NOT EXISTS room_image_url text,
  ADD COLUMN IF NOT EXISTS storage_image_url text,
  ADD COLUMN IF NOT EXISTS result_image_url text,
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending';
-- status: 'pending'（管理者未対応）/ 'done'（結果画像アップ済み）
