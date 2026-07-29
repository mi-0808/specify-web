-- ToC用のコアテーブル（既存環境ではダッシュボードで作成済みのため IF NOT EXISTS で冪等にする）
-- 新規環境をゼロから立ち上げるときはこのファイルが最初に適用される

CREATE TABLE IF NOT EXISTS profiles (
  id            uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name  text,
  created_at    timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS spaces (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        text NOT NULL,
  width_cm    numeric,
  height_cm   numeric,
  depth_cm    numeric,
  volume_cm3  numeric,
  image_url   text,
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id    uuid NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        text NOT NULL,
  width_cm    numeric,
  height_cm   numeric,
  depth_cm    numeric,
  category    text,
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS suggestions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id         uuid NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  score            numeric,
  reasoning        text,
  storage_options  jsonb,
  created_at       timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS spaces_user_id_idx ON spaces(user_id);
CREATE INDEX IF NOT EXISTS items_space_id_idx ON items(space_id);
CREATE INDEX IF NOT EXISTS suggestions_space_id_idx ON suggestions(space_id);
