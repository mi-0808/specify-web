
-- RLS有効化
alter table public.profiles enable row level security;
alter table public.spaces enable row level security;
alter table public.items enable row level security;
alter table public.suggestions enable row level security;

-- profiles: 自分のプロフィールのみ
create policy "profiles: own read" on public.profiles
  for select using (auth.uid() = id);

create policy "profiles: own update" on public.profiles
  for update using (auth.uid() = id);

-- spaces: 自分のスペースのみ
create policy "spaces: own all" on public.spaces
  for all using (auth.uid() = user_id);

-- items: 自分のアイテムのみ
create policy "items: own all" on public.items
  for all using (auth.uid() = user_id);

-- suggestions: 自分のスペースに紐づく提案のみ
create policy "suggestions: own space" on public.suggestions
  for all using (
    exists (
      select 1 from public.spaces
      where spaces.id = suggestions.space_id
        and spaces.user_id = auth.uid()
    )
  );
