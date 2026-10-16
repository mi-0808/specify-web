-- 自動で集めたルームツアー動画と、説明欄で紹介されている家具（docs/specify-design.md 6章）
-- 書き込みは収集処理（サービスロール）だけ。誰でも読める
create table public.rooms (
  id text primary key, -- YouTube の動画 ID
  title text not null,
  channel_id text not null,
  channel_title text not null,
  thumbnail_url text not null,
  published_at timestamptz not null,
  tags text[] not null default '{}',
  description_hash text not null,
  refreshed_at timestamptz not null default now()
);

create index rooms_published_at_idx on public.rooms (published_at desc);
create index rooms_tags_idx on public.rooms using gin (tags);

create table public.room_items (
  room_id text not null references public.rooms(id) on delete cascade,
  position int not null,
  label text not null,
  url text not null,
  shop_host text not null,
  product_title text,
  image_url text,
  primary key (room_id, position)
);

alter table public.rooms enable row level security;
alter table public.room_items enable row level security;

create policy "誰でも部屋を読める" on public.rooms for select using (true);
create policy "誰でも家具を読める" on public.room_items for select using (true);
