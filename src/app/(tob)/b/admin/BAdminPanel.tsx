"use client"

import { useRef, useState } from "react"

type Category = "safety" | "flow" | "suggestion"

type Marker = {
  id: string
  x: number
  y: number
  category: Category
  comment: string
}

type Scan = {
  id: string
  area_name: string
  image_url: string | null
  status: string
  created_at: string
}

const CATEGORY_CONFIG: Record<Category, { label: string; bg: string; border: string }> = {
  safety: { label: "🔴 安全", bg: "bg-red-500", border: "border-red-300" },
  flow: { label: "🟡 動線", bg: "bg-yellow-400", border: "border-yellow-300" },
  suggestion: { label: "🔵 改善提案", bg: "bg-blue-500", border: "border-blue-300" },
}

function isCategory(value: unknown): value is Category {
  return value === "safety" || value === "flow" || value === "suggestion"
}

const TEMPLATES: Record<Category, string[]> = {
  safety: [
    "通路に物が出ており、緊急時の避難経路を妨げる可能性があります",
    "危険物・重量物が不安定な場所に置かれています",
    "消火器・AEDへのアクセスが遮られています",
  ],
  flow: [
    "この工具の使用頻度に対して、取り出し位置が遠すぎます",
    "作業手順の順番と工具の配置順が逆になっています",
    "頻繁に使う工具と使わない工具が混在しています",
  ],
  suggestion: [
    "定位置を決めてラベリングすると管理が楽になります",
    "高さを揃えると視認性が上がります",
    "使用頻度の高い工具を手前・低い位置に移動することを推奨します",
  ],
}

export default function BAdminPanel({
  pendingScans,
  doneScans,
}: {
  pendingScans: Scan[]
  doneScans: Scan[]
}) {
  const [selectedScan, setSelectedScan] = useState<Scan | null>(pendingScans[0] ?? null)
  const [markers, setMarkers] = useState<Marker[]>([])
  const [sending, setSending] = useState(false)
  const [suggesting, setSuggesting] = useState(false)
  const [sentIds, setSentIds] = useState<Set<string>>(new Set())
  const [error, setError] = useState("")
  const imageRef = useRef<HTMLDivElement>(null)

  function handleImageClick(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width
    const y = (e.clientY - rect.top) / rect.height
    const id = crypto.randomUUID()
    setMarkers((prev) => [
      ...prev,
      { id, x, y, category: "flow", comment: "" },
    ])
  }

  function updateMarker(id: string, patch: Partial<Omit<Marker, "id">>) {
    setMarkers((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)))
  }

  function removeMarker(id: string) {
    setMarkers((prev) => prev.filter((m) => m.id !== id))
  }

  function selectScan(scan: Scan) {
    setSelectedScan(scan)
    setMarkers([])
    setError("")
  }

  async function handleSuggest() {
    if (!selectedScan?.image_url) return
    setSuggesting(true)
    setError("")
    try {
      const res = await fetch("/api/ai/suggest-b", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image_url: selectedScan.image_url, area_name: selectedScan.area_name }),
      })
      const data = await res.json()
      if (data.markers?.length) {
        setMarkers(data.markers.map((m: { x: number; y: number; category?: string; comment: string }) => ({
          id: crypto.randomUUID(),
          x: m.x,
          y: m.y,
          // AIが未知のカテゴリを返すとCATEGORY_CONFIGの参照でクラッシュするため許可リストで丸める
          category: isCategory(m.category) ? m.category : "suggestion",
          comment: m.comment,
        })))
      } else {
        setError("AI提案を生成できませんでした")
      }
    } catch {
      setError("AI提案の取得に失敗しました")
    } finally {
      setSuggesting(false)
    }
  }

  async function handleSend() {
    if (!selectedScan) return
    if (markers.length === 0) {
      setError("マーカーを1つ以上追加してください")
      return
    }
    const incomplete = markers.some((m) => !m.comment.trim())
    if (incomplete) {
      setError("すべてのマーカーにコメントを入力してください")
      return
    }

    setSending(true)
    setError("")

    try {
      const res = await fetch("/api/b/admin/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scan_id: selectedScan.id,
          markers: markers.map((m) => ({
            x: m.x,
            y: m.y,
            category: m.category,
            comment: m.comment,
          })),
        }),
      })
      if (!res.ok) throw new Error("送信失敗")

      setSentIds((prev) => new Set([...prev, selectedScan.id]))
      setMarkers([])
      const next = pendingScans.find((s) => s.id !== selectedScan.id && !sentIds.has(s.id))
      setSelectedScan(next ?? null)
    } catch {
      setError("送信に失敗しました")
    } finally {
      setSending(false)
    }
  }

  const visiblePending = pendingScans.filter((s) => !sentIds.has(s.id))

  return (
    <div className="flex flex-col h-[calc(100vh-49px)]">
      {/* ヘッダー */}
      <div className="border-b border-slate-200 bg-white px-4 py-2 flex items-center gap-3">
        <h1 className="text-sm font-bold text-slate-700">管理画面</h1>
        {visiblePending.length > 0 && (
          <span className="rounded-full bg-red-500 px-2 py-0.5 text-xs font-bold text-white">
            未対応 {visiblePending.length}
          </span>
        )}
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* 左ペイン：一覧 */}
        <aside className="w-56 shrink-0 border-r border-slate-200 bg-white overflow-y-auto">
          {visiblePending.length > 0 && (
            <div className="p-3 space-y-1">
              <p className="text-xs font-semibold text-slate-600 px-1">未対応</p>
              {visiblePending.map((scan) => (
                <button
                  key={scan.id}
                  onClick={() => selectScan(scan)}
                  className={`w-full text-left rounded-lg px-3 py-2.5 transition-colors ${
                    selectedScan?.id === scan.id
                      ? "bg-blue-50 border border-blue-200"
                      : "hover:bg-slate-50 border border-transparent"
                  }`}
                >
                  <p className="text-sm font-medium text-slate-800 truncate">{scan.area_name}</p>
                  <p className="text-xs text-slate-600">
                    {new Date(scan.created_at).toLocaleString("ja-JP", {
                      month: "numeric",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </button>
              ))}
            </div>
          )}

          {doneScans.length > 0 && (
            <div className="p-3 space-y-1 border-t border-slate-100">
              <p className="text-xs font-semibold text-slate-600 px-1">対応済み</p>
              {doneScans.filter((s) => !sentIds.has(s.id)).map((scan) => (
                <div
                  key={scan.id}
                  className="rounded-lg px-3 py-2.5 opacity-50"
                >
                  <p className="text-sm font-medium text-slate-700 truncate">{scan.area_name}</p>
                  <p className="text-xs text-slate-600">
                    {new Date(scan.created_at).toLocaleString("ja-JP", {
                      month: "numeric",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              ))}
            </div>
          )}

          {visiblePending.length === 0 && doneScans.length === 0 && (
            <div className="p-6 text-center text-xs text-slate-600">
              スキャンはありません
            </div>
          )}
        </aside>

        {/* 右ペイン：詳細＋マーカーUI */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {selectedScan ? (
            <>
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* スキャン情報 */}
                <div>
                  <h2 className="text-base font-bold text-slate-900">{selectedScan.area_name}</h2>
                  <p className="text-xs text-slate-600">
                    {new Date(selectedScan.created_at).toLocaleString("ja-JP")}
                  </p>
                </div>

                {/* 画像＋マーカー */}
                {selectedScan.image_url ? (
                  <div>
                    <div className="mb-1.5 flex items-center justify-between">
                      <p className="text-xs text-slate-500">📍 写真をクリックしてマーカーを追加</p>
                      <button
                        onClick={handleSuggest}
                        disabled={suggesting}
                        className="rounded-lg bg-violet-600 px-3 py-1 text-xs font-semibold text-white hover:bg-violet-700 disabled:opacity-50 transition-colors"
                      >
                        {suggesting ? "AI生成中..." : "✨ AIに提案させる"}
                      </button>
                    </div>
                    <div
                      ref={imageRef}
                      onClick={handleImageClick}
                      className="relative cursor-crosshair rounded-xl overflow-hidden border border-slate-200 bg-slate-900 select-none"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={selectedScan.image_url}
                        alt={selectedScan.area_name}
                        className="w-full object-contain max-h-[50vh]"
                        draggable={false}
                      />
                      {markers.map((marker, i) => (
                        <div
                          key={marker.id}
                          className={`pointer-events-none absolute flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-xs font-bold text-white shadow-lg ring-2 ring-white ${CATEGORY_CONFIG[marker.category].bg}`}
                          style={{ left: `${marker.x * 100}%`, top: `${marker.y * 100}%` }}
                        >
                          {i + 1}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-slate-200 py-12 text-center text-sm text-slate-600">
                    画像がありません
                  </div>
                )}

                {/* マーカー入力一覧 */}
                {markers.length > 0 && (
                  <div className="space-y-3">
                    <p className="text-xs font-semibold text-slate-500">マーカー一覧</p>
                    {markers.map((marker, i) => (
                      <MarkerInput
                        key={marker.id}
                        index={i + 1}
                        marker={marker}
                        onChange={(patch) => updateMarker(marker.id, patch)}
                        onRemove={() => removeMarker(marker.id)}
                      />
                    ))}
                  </div>
                )}

                {markers.length === 0 && selectedScan.image_url && (
                  <p className="text-center text-xs text-slate-600 py-4">
                    写真上をクリックしてマーカーを追加してください
                  </p>
                )}
              </div>

              {/* 固定フッター */}
              <div className="border-t border-slate-200 bg-white px-4 py-3 flex items-center gap-3">
                {error && <p role="alert" className="flex-1 text-xs text-red-700">{error}</p>}
                {!error && <div className="flex-1" />}
                <button
                  onClick={() => { setSelectedScan(null); setMarkers([]) }}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-500 hover:bg-slate-50 transition-colors"
                >
                  スキップ
                </button>
                <button
                  onClick={handleSend}
                  disabled={sending}
                  className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {sending ? "送信中..." : "レポートを送信 ✓"}
                </button>
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center text-sm text-slate-600">
              {visiblePending.length === 0 ? "未対応のスキャンはありません" : "左の一覧からスキャンを選択してください"}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function MarkerInput({
  index,
  marker,
  onChange,
  onRemove,
}: {
  index: number
  marker: Marker
  onChange: (patch: Partial<Omit<Marker, "id">>) => void
  onRemove: () => void
}) {
  const cfg = CATEGORY_CONFIG[marker.category]
  const templates = TEMPLATES[marker.category]
  const [showTemplates, setShowTemplates] = useState(false)

  return (
    <div className={`rounded-xl border p-3 space-y-2.5 ${cfg.border}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white ${cfg.bg}`}>
            {index}
          </span>
          <select
            aria-label={`指摘${index}のカテゴリ`}
            value={marker.category}
            onChange={(e) => onChange({ category: e.target.value as Category })}
            className="rounded border border-slate-200 px-2 py-1 text-xs font-medium text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            {(Object.entries(CATEGORY_CONFIG) as [Category, typeof CATEGORY_CONFIG[Category]][]).map(
              ([key, { label }]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              )
            )}
          </select>
        </div>
        <button
          onClick={onRemove}
          className="text-xs text-slate-600 hover:text-red-700 transition-colors"
        >
          削除
        </button>
      </div>

      <textarea
        aria-label={`指摘${index}のコメント`}
        value={marker.comment}
        onChange={(e) => onChange({ comment: e.target.value })}
        placeholder="コメントを入力..."
        rows={2}
        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm resize-none focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
      />

      <div>
        <button
          onClick={() => setShowTemplates(!showTemplates)}
          className="text-xs text-blue-700 hover:underline"
        >
          {showTemplates ? "テンプレートを閉じる" : "テンプレートから選ぶ"}
        </button>
        {showTemplates && (
          <div className="mt-1.5 space-y-1">
            {templates.map((t) => (
              <button
                key={t}
                onClick={() => { onChange({ comment: t }); setShowTemplates(false) }}
                className="block w-full text-left rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-700 hover:bg-blue-50 hover:text-blue-700 transition-colors"
              >
                {t}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
