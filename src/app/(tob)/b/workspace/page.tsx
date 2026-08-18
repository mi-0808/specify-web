import { createClient } from "@/lib/supabase/server"
import Link from "next/link"

export default async function BWorkspacePage() {
  const supabase = await createClient()

  const db = supabase
  const { data: scans } = await db
    .from("b_scans")
    .select("id, area_name, status, created_at")
    .order("created_at", { ascending: false })

  const rows = (scans ?? []) as Array<{
    id: string
    area_name: string
    status: string
    created_at: string
  }>

  return (
    <main className="min-h-[calc(100vh-49px)] px-4 py-6">
      <div className="mx-auto max-w-2xl space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">エリア一覧</h1>
            <p className="text-sm text-slate-500">撮影・送信したエリアとレポートを確認できます</p>
          </div>
          <Link
            href="/b/scan"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
          >
            + 新しいエリアを追加
          </Link>
        </div>

        {rows.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-slate-200 py-20 text-center space-y-4">
            <div className="text-4xl">📷</div>
            <div>
              <p className="font-semibold text-slate-700">まず現場のエリアを撮影してみましょう</p>
              <p className="mt-1 text-sm text-slate-600">工具棚・作業台などのエリアを撮影して送信するだけです</p>
            </div>
            <Link
              href="/b/scan"
              className="inline-block rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
            >
              最初のエリアを撮影する
            </Link>
          </div>
        ) : (
          <ul className="space-y-3">
            {rows.map((scan) => (
              <li key={scan.id}>
                <Link
                  href={`/b/report/${scan.id}`}
                  className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:border-blue-300 hover:shadow-md transition-all"
                >
                  <div className="space-y-0.5">
                    <p className="font-semibold text-slate-900">{scan.area_name}</p>
                    <p className="text-xs text-slate-600">
                      {new Date(scan.created_at).toLocaleString("ja-JP", {
                        month: "numeric",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        scan.status === "done"
                          ? "bg-green-100 text-green-700"
                          : "bg-yellow-100 text-yellow-700"
                      }`}
                    >
                      {scan.status === "done" ? "レポート完了" : "確認中"}
                    </span>
                    <span className="text-slate-300">›</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  )
}
