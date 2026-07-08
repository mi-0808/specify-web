"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"

type Category = "safety" | "flow" | "suggestion"

type Marker = {
  id: string
  x: number
  y: number
  category: Category
  comment: string
  sort_order: number
}

type Report = {
  status: "done"
  area_name: string
  image_url: string
  markers: Marker[]
}

const categoryConfig: Record<Category, { label: string; color: string; bg: string }> = {
  safety: { label: "安全", color: "text-red-700", bg: "bg-red-500" },
  flow: { label: "動線", color: "text-yellow-700", bg: "bg-yellow-400" },
  suggestion: { label: "改善提案", color: "text-blue-700", bg: "bg-blue-500" },
}

export default function BReportPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [report, setReport] = useState<Report | null>(null)
  const [pending, setPending] = useState(false)
  const [activeMarker, setActiveMarker] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/b/report?scan_id=${id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.status === "done") {
          setReport(data)
        } else {
          setPending(true)
        }
      })
      .catch(() => setPending(true))
  }, [id])

  if (pending) {
    return (
      <main className="flex flex-col items-center justify-center min-h-[calc(100vh-49px)] px-4 text-center">
        <div className="max-w-sm w-full space-y-4">
          <div className="text-4xl">⏳</div>
          <h1 className="text-xl font-bold text-slate-900">レポートを作成中です</h1>
          <p className="text-sm text-slate-500">完成次第、登録メールアドレスにお知らせします。</p>
          <Link href="/b/workspace" className="text-sm text-blue-600 hover:underline">
            エリア一覧に戻る
          </Link>
        </div>
      </main>
    )
  }

  if (!report) {
    return (
      <main className="flex items-center justify-center min-h-[calc(100vh-49px)]">
        <div className="text-sm text-slate-400">読み込み中...</div>
      </main>
    )
  }

  return (
    <main className="min-h-[calc(100vh-49px)] px-4 py-6">
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400">現場レポート</p>
            <h1 className="text-xl font-bold text-slate-900">{report.area_name}</h1>
          </div>
          <div className="flex gap-2 text-xs">
            {(["safety", "flow", "suggestion"] as Category[]).map((cat) => (
              <span
                key={cat}
                className={`flex items-center gap-1 rounded-full px-2 py-1 font-medium ${categoryConfig[cat].color} bg-opacity-10`}
                style={{ backgroundColor: cat === "safety" ? "#fee2e2" : cat === "flow" ? "#fef9c3" : "#dbeafe" }}
              >
                <span className={`inline-block h-2 w-2 rounded-full ${categoryConfig[cat].bg}`} />
                {categoryConfig[cat].label}
              </span>
            ))}
          </div>
        </div>

        {/* 画像マーカービュー */}
        <div className="relative w-full rounded-xl overflow-hidden border border-slate-200 shadow-sm bg-slate-900">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={report.image_url}
            alt={report.area_name}
            className="w-full object-contain max-h-[60vh]"
          />
          {report.markers.map((marker, i) => (
            <button
              key={marker.id}
              onClick={() => setActiveMarker(activeMarker === marker.id ? null : marker.id)}
              className={`absolute flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-xs font-bold text-white shadow-lg ring-2 ring-white transition-transform hover:scale-110 ${categoryConfig[marker.category].bg}`}
              style={{ left: `${marker.x * 100}%`, top: `${marker.y * 100}%` }}
              title={marker.comment}
            >
              {i + 1}
            </button>
          ))}
        </div>

        {/* コメント一覧 */}
        {report.markers.length > 0 ? (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-slate-700">指摘一覧</h2>
            {report.markers.map((marker, i) => {
              const cfg = categoryConfig[marker.category]
              const isActive = activeMarker === marker.id
              return (
                <button
                  key={marker.id}
                  onClick={() => setActiveMarker(isActive ? null : marker.id)}
                  className={`w-full text-left rounded-xl border p-4 transition-colors ${
                    isActive ? "border-blue-300 bg-blue-50" : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${cfg.bg}`}>
                      {i + 1}
                    </span>
                    <div className="space-y-1">
                      <span className={`text-xs font-semibold ${cfg.color}`}>
                        {cfg.label}
                      </span>
                      <p className="text-sm text-slate-800">{marker.comment}</p>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-slate-200 py-10 text-center text-sm text-slate-400">
            指摘事項はありませんでした
          </p>
        )}

        <div className="flex gap-3 pt-2">
          <button
            onClick={() => router.push("/b/scan")}
            className="flex-1 rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
          >
            このエリアをもう一度撮影
          </button>
          <Link
            href="/b/workspace"
            className="flex-1 rounded-xl border border-slate-200 py-3 text-center text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
          >
            エリア一覧に戻る
          </Link>
        </div>
      </div>
    </main>
  )
}
