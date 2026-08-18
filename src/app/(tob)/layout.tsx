import type { ReactNode } from "react"
import { createClient } from "@/lib/supabase/server"
import { isAdminEmail } from "@/lib/supabase/admin"

export default async function ToBLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const isAdmin = isAdminEmail(user?.email)

  return (
    <div className="min-h-dvh bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white px-4 py-3 flex items-center justify-between">
        <a href="/b" className="text-sm font-bold tracking-tight text-slate-900">
          Specify <span className="font-normal text-slate-600">for Business</span>
        </a>
        <div className="flex items-center gap-3">
          {isAdmin && (
            <a href="/b/admin" className="-my-2 inline-flex min-h-11 items-center px-2 text-sm font-medium text-slate-500 hover:text-slate-800">
              管理画面
            </a>
          )}
          {user ? (
            <a href="/b/workspace" className="-my-2 inline-flex min-h-11 items-center px-2 text-sm font-medium text-blue-600 hover:underline">
              エリア一覧
            </a>
          ) : (
            <a
              href="/login?next=/b/workspace"
              className="rounded-lg bg-blue-600 px-3 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
            >
              ログイン
            </a>
          )}
        </div>
      </header>
      {children}
    </div>
  )
}
