-- ユーザーが作るジャンル（docs/specify-design.md「ジャンル」）
-- 部屋は「集める言葉」で自動で入り、さらに人が足したり（だれでも）外したり（作った本人だけ）できる
create table public.genres (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 12),
  keyword text not null check (char_length(keyword) between 1 and 20),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create unique index genres_name_key on public.genres (lower(name));

create table public.room_genres (
  room_id text not null references public.rooms(id) on delete cascade,
  genre_id uuid not null references public.genres(id) on delete cascade,
  excluded boolean not null default false, -- true: 言葉で自動で入った部屋を、ジャンルを作った本人が外した
  added_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (room_id, genre_id)
);

alter table public.genres enable row level security;
alter table public.room_genres enable row level security;

create policy "誰でもジャンルを読める" on public.genres for select using (true);
create policy "ログインした人はジャンルを作れる" on public.genres
  for insert to authenticated with check ((select auth.uid()) = created_by);
create policy "作った本人はジャンルを消せる" on public.genres
  for delete using ((select auth.uid()) = created_by);

create policy "誰でも部屋のジャンルを読める" on public.room_genres for select using (true);
create policy "ログインした人は部屋を足せる。外すのは作った本人だけ" on public.room_genres
  for insert to authenticated with check (
    (select auth.uid()) = added_by
    and (not excluded or (select auth.uid()) = (select g.created_by from public.genres g where g.id = genre_id))
  );
create policy "足した本人か、ジャンルを作った本人は消せる" on public.room_genres
  for delete using (
    (select auth.uid()) = added_by
    or (select auth.uid()) = (select g.created_by from public.genres g where g.id = genre_id)
  );

-- 部屋がジャンルに入るか：外されていない、かつ（人が足した、またはタイトル・家具の名前に集める言葉がある）
create function public.room_in_genre(r public.rooms, g public.genres) returns boolean
language sql stable set search_path = '' as $$
  select not exists (
      select 1 from public.room_genres rg where rg.room_id = r.id and rg.genre_id = g.id and rg.excluded
    )
    and (
      exists (select 1 from public.room_genres rg where rg.room_id = r.id and rg.genre_id = g.id and not rg.excluded)
      or position(lower(g.keyword) in lower(r.title)) > 0
      or exists (
        select 1 from public.room_items i
        where i.room_id = r.id
          and (position(lower(g.keyword) in lower(i.label)) > 0
               or position(lower(g.keyword) in lower(coalesce(i.product_title, ''))) > 0)
      )
    )
$$;

-- ponytail: 表示のたびに全部屋×全ジャンルを判定する。部屋やジャンルが数千を超えたら、判定結果をテーブルに持つ
create function public.rooms_in_genre(gid uuid) returns setof public.rooms
language sql stable set search_path = '' as $$
  select r.* from public.rooms r join public.genres g on g.id = gid where public.room_in_genre(r, g)
$$;

create function public.genres_for_room(rid text) returns setof public.genres
language sql stable set search_path = '' as $$
  select g.* from public.genres g join public.rooms r on r.id = rid where public.room_in_genre(r, g)
$$;

create function public.genres_with_counts() returns table (id uuid, name text, room_count bigint)
language sql stable set search_path = '' as $$
  select g.id, g.name, count(r.id)
  from public.genres g left join public.rooms r on public.room_in_genre(r, g)
  group by g.id, g.name
$$;
