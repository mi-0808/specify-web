import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import type { Database } from "@/types/database";

type Space = Database["public"]["Tables"]["spaces"]["Row"];

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: spaces } = await supabase
    .from("spaces")
    .select("*")
    .order("created_at", { ascending: false }) as { data: Space[] | null };

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-4 py-3 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">Specify</h1>
        <span className="text-sm text-gray-500">{user.email}</span>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">収納スペース一覧</h2>
          <Link
            href="/spaces/new"
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
          >
            + 新しいスペース
          </Link>
        </div>

        {!spaces || spaces.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <p>まだスペースがありません</p>
            <p className="text-sm mt-1">ARカメラでスキャンして計測しましょう</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {spaces.map((space) => (
              <li key={space.id}>
                <Link
                  href={`/spaces/${space.id}`}
                  className="block bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow"
                >
                  <p className="font-medium text-gray-900">{space.name}</p>
                  {space.volume_cm3 && (
                    <p className="text-sm text-gray-500 mt-1">
                      {space.width_cm}cm × {space.height_cm}cm × {space.depth_cm}cm
                      （{(space.volume_cm3 / 1_000_000).toFixed(2)} m³）
                    </p>
                  )}
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(space.created_at).toLocaleDateString("ja-JP")}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
