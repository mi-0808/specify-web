-- 完成イメージ画像（AI生成）の廃止に伴う後片付け。
--
-- 1. status='analyzing' は「AI解析済み・画像生成待ち」を表す中間状態だった。
--    画像生成を廃止し done への遷移を /api/analyze に移したことでこの状態は生まれなくなるが、
--    移行前に生成待ちのまま残った行は誰も done にしないため、閲覧画面
--    （/demo/waiting/[id]）が done か failed になるまでポーリングし続けて
--    「生成中」表示のまま固まる。解析結果は揃っているので done にして提示可能にする。
--
-- 2. result_image_url は AI生成画像の保存先だったカラム。生成を廃止し、唯一の書き込み元だった
--    POST /api/admin/upload も（呼び出すUIが無い状態だったため）削除したので、書き手がいない。
--    本番では一度も値が入っていない（8行中0行）ことを確認済み。

UPDATE suggestions
SET status = 'done'
WHERE status = 'analyzing'
  AND reasoning IS NOT NULL;

ALTER TABLE suggestions
  DROP COLUMN IF EXISTS result_image_url;
