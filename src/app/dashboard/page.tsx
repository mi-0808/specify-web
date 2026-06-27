import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import type { Database, Json } from "@/types/database";

type SuggestionRow = Database["public"]["Tables"]["suggestions"]["Row"];
type SuggestionItem = { target?: string };

function getFirstTarget(storageOptions: Json | null): string {
  if (!Array.isArray(storageOptions) || storageOptions.length === 0) {
    return "提案内容なし";
  }

  const firstOption = storageOptions[0] as SuggestionItem;
  return firstOption.target ?? "提案内容なし";
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
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-4 py-3 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">Specify</h1>
        <span className="text-sm text-gray-500">{user.email}</span>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">提案履歴</h2>
          <Link
            href="/demo"
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
          >
            新しく撮影する
          </Link>
        </div>

        {!suggestions || suggestions.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <p>まだ提案履歴がありません</p>
            <p className="text-sm mt-1">写真を撮って収納の改善案を作成しましょう</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {suggestions.map((suggestion) => (
              <li
                key={suggestion.id}
                className="bg-white rounded-xl p-4 shadow-sm"
              >
                <p className="font-medium text-gray-900">
                  {getFirstTarget(suggestion.storage_options)}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {new Date(suggestion.created_at).toLocaleString("ja-JP")}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
