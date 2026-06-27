import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import type { Database, Json } from "@/types/database";

type SuggestionRow = Database["public"]["Tables"]["suggestions"]["Row"];
type SuggestionItem = { target?: string; location?: string };

function getFirstSuggestion(storageOptions: Json | null): SuggestionItem {
  if (!Array.isArray(storageOptions) || storageOptions.length === 0) {
    return {};
  }

  return storageOptions[0] as SuggestionItem;
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: suggestions } = await supabase
    .from("suggestions")
    .select("*")
    .order("created_at", { ascending: false }) as { data: SuggestionRow[] | null };

  return (
    <main className="min-h-screen bg-[#FBF5EE] text-[#2F2823]">
      <header className="border-b border-[#E8D8C7] bg-[#FBF5EE]/95 px-4 py-4">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <div>
            <h1 className="text-lg font-bold tracking-tight">Specify</h1>
            <p className="text-xs text-[#9B806C]">{user.email}</p>
          </div>
          <Link
            href="/demo"
            className="rounded-lg bg-[#D96B2D] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#C85A20]"
          >
            新しく撮影する
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-4 py-6">
        <div className="mb-5 space-y-2">
          <p className="inline-flex rounded-full bg-[#3DAF85]/15 px-3 py-1 text-xs font-semibold text-[#2D7C62]">
            提案履歴
          </p>
          <h2 className="text-2xl font-bold tracking-tight">しまい先のメモ</h2>
          <p className="text-sm leading-6 text-[#6E5A4B]">
            撮影から生まれた改善案を、あとで見返せる形で残します。
          </p>
        </div>

        {!suggestions || suggestions.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[#E1CDB9] bg-white/55 px-5 py-14 text-center">
            <p className="font-semibold text-[#2F2823]">まだ提案履歴がありません</p>
            <p className="mt-2 text-sm text-[#8B7360]">最初の写真から、収納の余白を探しましょう。</p>
            <Link
              href="/demo"
              className="mt-5 inline-flex rounded-lg bg-[#D96B2D] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#C85A20]"
            >
              写真を撮る
            </Link>
          </div>
        ) : (
          <ul className="space-y-3">
            {suggestions.map((suggestion) => {
              const firstSuggestion = getFirstSuggestion(suggestion.storage_options);

              return (
                <li
                  key={suggestion.id}
                  className="rounded-lg border border-[#E8D8C7] bg-white/70 p-4 shadow-sm"
                >
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <p className="rounded-full bg-[#F5C842]/25 px-3 py-1 text-xs font-semibold text-[#8A5A10]">
                      しまい先候補
                    </p>
                    <p className="text-xs text-[#9B806C]">
                      {new Date(suggestion.created_at).toLocaleString("ja-JP")}
                    </p>
                  </div>
                  <p className="text-lg font-bold text-[#2F2823]">
                    {firstSuggestion.target ?? "提案内容なし"}
                  </p>
                  <p className="mt-1 text-sm text-[#6E5A4B]">
                    {firstSuggestion.location ?? "収納先を確認しましょう"}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}
