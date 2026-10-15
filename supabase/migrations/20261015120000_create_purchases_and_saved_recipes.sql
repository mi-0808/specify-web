-- レシピの「買った」の記録。recipe_id・item_id は src/data/recipes.ts の ID（DB からは参照先を確認できないため、書き込み前にサーバー側で確認する）
create table public.purchases (
  user_id uuid not null references auth.users(id) on delete cascade,
  recipe_id text not null,
  item_id text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, recipe_id, item_id)
);

alter table public.purchases enable row level security;

create policy "本人の記録だけ読める" on public.purchases
  for select using ((select auth.uid()) = user_id);
create policy "本人の記録だけ追加できる" on public.purchases
  for insert with check ((select auth.uid()) = user_id);
create policy "本人の記録だけ消せる" on public.purchases
  for delete using ((select auth.uid()) = user_id);

-- 保存したレシピ（マイページに出す）
create table public.saved_recipes (
  user_id uuid not null references auth.users(id) on delete cascade,
  recipe_id text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, recipe_id)
);

alter table public.saved_recipes enable row level security;

create policy "本人の保存だけ読める" on public.saved_recipes
  for select using ((select auth.uid()) = user_id);
create policy "本人の保存だけ追加できる" on public.saved_recipes
  for insert with check ((select auth.uid()) = user_id);
create policy "本人の保存だけ消せる" on public.saved_recipes
  for delete using ((select auth.uid()) = user_id);
