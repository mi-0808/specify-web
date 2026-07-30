-- SECURITY DEFINER関数のsearch_pathが可変だと、呼び出し側のsearch_path操作で
-- 意図しないスキーマの同名オブジェクトを実行させられる（Supabase security advisor: 0011）
-- 関数本体は public.profiles と完全修飾済みなので、search_path を空にしても挙動は変わらない
ALTER FUNCTION public.handle_new_user() SET search_path = '';
