-- 家具が1つ当てはまるだけで部屋がジャンルに入り、文脈なく見えていた。家具の名前での判定をやめる
-- 部屋がジャンルに入るか：外されていない、かつ（人か収集が足した、またはタイトルに集める言葉がある）
create or replace function public.room_in_genre(r public.rooms, g public.genres) returns boolean
language sql stable set search_path = '' as $$
  select not exists (
      select 1 from public.room_genres rg where rg.room_id = r.id and rg.genre_id = g.id and rg.excluded
    )
    and (
      exists (select 1 from public.room_genres rg where rg.room_id = r.id and rg.genre_id = g.id and not rg.excluded)
      or position(lower(g.keyword) in lower(r.title)) > 0
    )
$$;
