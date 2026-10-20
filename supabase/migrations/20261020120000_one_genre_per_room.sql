-- 1つの部屋は1つのジャンルにだけ入る（docs/specify-design.md「ジャンル」）
-- 部屋は /add で人が入れたときにジャンルが決まる。言葉で自動で入れる仕組みと、雰囲気のタグはやめる

-- 今ある部屋は新しい集め方で集め直す。家具・保存・探索の履歴・ジャンルの記録も外部キーで一緒に消える
delete from public.rooms;

drop function public.genres_with_counts();
drop function public.genres_for_room(text);
drop function public.rooms_in_genre(uuid);
drop function public.room_in_genre(public.rooms, public.genres);
drop table public.room_genres;

drop index public.rooms_tags_idx;
alter table public.rooms drop column tags;
-- 部屋は /add で必ずジャンルを決めて入る。ジャンルが消されたら、部屋は「すべて」にだけ残る（ジャンルなし）
alter table public.rooms add column genre_id uuid references public.genres(id) on delete set null;
create index rooms_genre_id_idx on public.rooms (genre_id, published_at desc);

-- 作った人がいないジャンル（created_by が空）は公式ジャンル。誰も消せない
alter table public.genres drop column keyword;
alter table public.genres alter column created_by drop not null;
insert into public.genres (name, created_by, created_at)
select name, null, '2026-01-01'::timestamptz + n * interval '1 second'
from unnest(array['韓国', '北欧', 'ナチュラル', 'カフェ', 'モノトーン', 'ホテルライク', 'アンティーク', 'ミニマル'])
  with ordinality as t(name, n);

-- ジャンルを作った本人は、そのジャンルの部屋を消せる。入れるのは /add（サービスロール）だけ
create policy "ジャンルを作った本人は部屋を消せる" on public.rooms
  for delete to authenticated using (
    exists (select 1 from public.genres g where g.id = genre_id and g.created_by = (select auth.uid()))
  );

-- 一覧のジャンルの列：公式を決まった順に、そのあとユーザーのジャンルを部屋の多い順（0部屋も出す）
create function public.genres_with_counts() returns table (id uuid, name text, created_by uuid, room_count bigint)
language sql stable set search_path = '' as $$
  select g.id, g.name, g.created_by, count(r.id)
  from public.genres g left join public.rooms r on r.genre_id = g.id
  group by g.id
  order by g.created_by is not null, case when g.created_by is null then g.created_at end, count(r.id) desc, g.created_at desc
$$;
