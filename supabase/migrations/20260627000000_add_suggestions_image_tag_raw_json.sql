ALTER TABLE suggestions
  ADD COLUMN IF NOT EXISTS image_tag text,
  ADD COLUMN IF NOT EXISTS raw_json jsonb;
