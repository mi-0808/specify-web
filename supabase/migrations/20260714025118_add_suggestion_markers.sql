
CREATE TABLE suggestion_markers (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  suggestion_id uuid REFERENCES suggestions(id) ON DELETE CASCADE,
  image_type   text NOT NULL CHECK (image_type IN ('room', 'storage')),
  x            float NOT NULL,
  y            float NOT NULL,
  comment      text NOT NULL,
  sort_order   int NOT NULL DEFAULT 0,
  created_at   timestamptz DEFAULT now()
);

CREATE INDEX suggestion_markers_suggestion_id_idx ON suggestion_markers(suggestion_id);

ALTER TABLE suggestion_markers ENABLE ROW LEVEL SECURITY;

-- 自分の提案に紐づくものは読み取りのみ（書き込みはservice_role＝管理者APIだけ）
CREATE POLICY "suggestion_markers_read_owner" ON suggestion_markers
  FOR SELECT USING (
    suggestion_id IN (
      SELECT s.id FROM suggestions s
      JOIN spaces sp ON sp.id = s.space_id
      WHERE sp.user_id = auth.uid()
    )
  );
