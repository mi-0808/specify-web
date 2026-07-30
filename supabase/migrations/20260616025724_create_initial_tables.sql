
-- profiles（Supabase Auth と連携）
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  display_name text,
  created_at timestamptz default now() not null
);

-- spaces（ARスキャンした収納スペース）
create table public.spaces (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles on delete cascade not null,
  name text not null,
  width_cm numeric,
  height_cm numeric,
  depth_cm numeric,
  volume_cm3 numeric generated always as (width_cm * height_cm * depth_cm) stored,
  image_url text,
  created_at timestamptz default now() not null
);

-- items（スペース内の収納アイテム）
create table public.items (
  id uuid primary key default gen_random_uuid(),
  space_id uuid references public.spaces on delete cascade not null,
  user_id uuid references public.profiles on delete cascade not null,
  name text not null,
  width_cm numeric,
  height_cm numeric,
  depth_cm numeric,
  category text,
  created_at timestamptz default now() not null
);

-- suggestions（AI提案結果キャッシュ）
create table public.suggestions (
  id uuid primary key default gen_random_uuid(),
  space_id uuid references public.spaces on delete cascade not null,
  score numeric check (score >= 0 and score <= 100),
  reasoning text,
  storage_options jsonb,
  created_at timestamptz default now() not null
);

-- ユーザー登録時に自動でprofileを作成するトリガー
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id)
  values (new.id);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
