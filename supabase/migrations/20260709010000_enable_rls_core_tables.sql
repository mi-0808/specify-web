-- ToCコアテーブルのRLS
-- RLS未設定だと /dashboard の `select * from suggestions` が他人の提案まで返してしまうため、
-- 既存環境にも適用されるよう ENABLE と CREATE POLICY を無条件で実行する（ポリシーは貼り直し）
-- 管理者API（/api/admin/*）は service role key を使うためRLSをバイパスする

ALTER TABLE profiles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE spaces              ENABLE ROW LEVEL SECURITY;
ALTER TABLE items               ENABLE ROW LEVEL SECURITY;
ALTER TABLE suggestions         ENABLE ROW LEVEL SECURITY;
ALTER TABLE suggestion_markers  ENABLE ROW LEVEL SECURITY;

-- profiles: 本人のみ
DROP POLICY IF EXISTS "profiles_owner" ON profiles;
CREATE POLICY "profiles_owner" ON profiles
  FOR ALL
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- spaces: 本人のみ
DROP POLICY IF EXISTS "spaces_owner" ON spaces;
CREATE POLICY "spaces_owner" ON spaces
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- items: 本人のみ
DROP POLICY IF EXISTS "items_owner" ON items;
CREATE POLICY "items_owner" ON items
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- suggestions: 自分のスペースに紐づくものだけ
-- （/api/analyze・/api/generate はログインユーザーのセッションでUPDATEするためUPDATEも許可する）
DROP POLICY IF EXISTS "suggestions_owner" ON suggestions;
CREATE POLICY "suggestions_owner" ON suggestions
  FOR ALL
  USING (space_id IN (SELECT id FROM spaces WHERE user_id = auth.uid()))
  WITH CHECK (space_id IN (SELECT id FROM spaces WHERE user_id = auth.uid()));

-- suggestion_markers: 自分の提案に紐づくものは読み取りのみ（書き込みはservice_role＝管理者APIだけ）
DROP POLICY IF EXISTS "suggestion_markers_read_owner" ON suggestion_markers;
CREATE POLICY "suggestion_markers_read_owner" ON suggestion_markers
  FOR SELECT
  USING (
    suggestion_id IN (
      SELECT s.id FROM suggestions s
      JOIN spaces sp ON sp.id = s.space_id
      WHERE sp.user_id = auth.uid()
    )
  );
