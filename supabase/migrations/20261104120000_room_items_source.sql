-- 家具が「どこから来たか」。description は動画の説明欄から自動で読んだもの（読み直しのたびに入れ直す）
-- manual は部屋ページで人が足したもの（読み直しでは消さない）。position は 10000 から振り、説明欄の家具の後ろに並べる
-- 書き込みは今までどおりサービスロールだけ（Server Action がログインと入力を確かめてから書く）
alter table public.room_items
  add column source text not null default 'description' check (source in ('description', 'manual')),
  add column added_by uuid references auth.users(id) on delete set null;
