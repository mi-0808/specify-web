
CREATE TABLE IF NOT EXISTS b_scans (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES auth.users(id),
  area_name   text NOT NULL,
  image_url   text,
  status      text NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'done')),
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS b_markers (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id     uuid REFERENCES b_scans(id) ON DELETE CASCADE,
  x           float NOT NULL,
  y           float NOT NULL,
  category    text NOT NULL CHECK (category IN ('safety', 'flow', 'suggestion')),
  comment     text NOT NULL,
  sort_order  int NOT NULL DEFAULT 0,
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS b_scans_user_id_idx ON b_scans(user_id);
CREATE INDEX IF NOT EXISTS b_scans_status_idx ON b_scans(status);
CREATE INDEX IF NOT EXISTS b_markers_scan_id_idx ON b_markers(scan_id);

ALTER TABLE b_scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE b_markers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "b_scans_owner" ON b_scans
  FOR ALL USING (auth.uid() = user_id);

-- b_markers: 本人のスキャンに紐づくものは読み取り可、書き込みはservice_role（管理者API）のみ
CREATE POLICY "b_markers_read_owner" ON b_markers
  FOR SELECT USING (
    scan_id IN (SELECT id FROM b_scans WHERE user_id = auth.uid())
  );
