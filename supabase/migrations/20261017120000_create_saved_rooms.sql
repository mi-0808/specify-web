-- 気に入った部屋の保存（本人だけが読み書きできる）
create table public.saved_rooms (
  user_id uuid not null references auth.users(id) on delete cascade,
  room_id text not null references public.rooms(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, room_id)
);

alter table public.saved_rooms enable row level security;

create policy "本人の保存だけ読める" on public.saved_rooms
  for select using ((select auth.uid()) = user_id);
create policy "本人の保存だけ追加できる" on public.saved_rooms
  for insert with check ((select auth.uid()) = user_id);
create policy "本人の保存だけ消せる" on public.saved_rooms
  for delete using ((select auth.uid()) = user_id);
