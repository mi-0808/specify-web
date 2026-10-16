-- 自分が探索した部屋（/add で動画のリンクを貼った履歴。マイページに出す）。本人だけが読み書きできる
create table public.explored_rooms (
  user_id uuid not null references auth.users(id) on delete cascade,
  room_id text not null references public.rooms(id) on delete cascade,
  explored_at timestamptz not null default now(),
  primary key (user_id, room_id)
);

alter table public.explored_rooms enable row level security;

create policy "本人の履歴だけ読める" on public.explored_rooms
  for select using ((select auth.uid()) = user_id);
create policy "本人の履歴だけ追加できる" on public.explored_rooms
  for insert with check ((select auth.uid()) = user_id);
create policy "本人の履歴だけ更新できる" on public.explored_rooms
  for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
