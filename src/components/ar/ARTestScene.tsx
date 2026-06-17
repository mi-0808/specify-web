"use client"

import { useEffect, useRef, useState } from "react"

const CORNER_LABELS = ["左前", "右前", "右奥", "左奥"]
type Point = { x: number; y: number }

export default function ARTestScene() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [corners, setCorners] = useState<Point[]>([])
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  // カメラ起動
  useEffect(() => {
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" }, audio: false })
      .then((stream) => {
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.play()
        }
      })
      .catch(() => setError("カメラへのアクセスが拒否されました"))

    return () => streamRef.current?.getTracks().forEach((t) => t.stop())
  }, [])

  // Canvas リサイズ
  useEffect(() => {
    const resize = () => {
      const c = canvasRef.current
      if (!c) return
      c.width = c.offsetWidth
      c.height = c.offsetHeight
      redraw(corners, done, c)
    }
    resize()
    window.addEventListener("resize", resize)
    return () => window.removeEventListener("resize", resize)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // コーナーが変わるたびに再描画
  useEffect(() => {
    const c = canvasRef.current
    if (c) redraw(corners, done, c)
  }, [corners, done])

  const handleTap = (e: React.TouchEvent<HTMLCanvasElement> | React.MouseEvent<HTMLCanvasElement>) => {
    if (done) return
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const clientX = "touches" in e ? e.changedTouches[0].clientX : e.clientX
    const clientY = "touches" in e ? e.changedTouches[0].clientY : e.clientY
    const pt: Point = {
      x: (clientX - rect.left) * (canvas.width / rect.width),
      y: (clientY - rect.top) * (canvas.height / rect.height),
    }

    const next = [...corners, pt]
    if (next.length === 4) setDone(true)
    setCorners(next)
  }

  const reset = () => {
    setCorners([])
    setDone(false)
  }

  const nextLabel = corners.length < 4 ? CORNER_LABELS[corners.length] : null

  return (
    <div
      className="relative bg-black overflow-hidden"
      style={{ width: "100vw", height: "100svh" }}
    >
      {/* カメラ映像 — object-contain でアスペクト比を保持 */}
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-contain"
        playsInline
        muted
        autoPlay
      />

      {/* タップ・描画用 Canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ touchAction: "none" }}
        onTouchEnd={handleTap}
        onClick={handleTap}
      />

      {/* ヘッダー */}
      <div className="absolute top-4 inset-x-0 flex justify-center pointer-events-none">
        <span className="bg-black/50 text-white text-xs px-3 py-1 rounded-full">
          収納スペース計測（タップで計測）
        </span>
      </div>

      {/* 指示バナー */}
      {!done && (
        <div className="absolute top-14 inset-x-0 flex justify-center pointer-events-none">
          <div className="bg-blue-600/90 text-white text-base font-semibold px-5 py-2.5 rounded-2xl shadow-lg">
            {nextLabel}をタップ（{corners.length + 1} / 4）
          </div>
        </div>
      )}

      {/* コーナー達成インジケーター */}
      <div className="absolute top-28 inset-x-0 flex justify-center gap-2 pointer-events-none">
        {CORNER_LABELS.map((label, i) => (
          <div
            key={label}
            className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
              i < corners.length ? "bg-green-500 text-white scale-110" : "bg-white/30 text-white"
            }`}
          >
            {i + 1}
          </div>
        ))}
      </div>

      {/* 完了バナー */}
      {done && (
        <div className="absolute bottom-0 inset-x-0 bg-white rounded-t-3xl p-6 shadow-2xl">
          <h2 className="text-lg font-bold text-gray-900 mb-1">枠組み完成！</h2>
          <p className="text-sm text-gray-500 mb-4">4コーナーをマーキングしました</p>
          <div className="flex gap-3">
            <button
              onClick={reset}
              className="flex-1 py-3 border border-gray-300 rounded-xl text-gray-700 font-medium"
            >
              やり直す
            </button>
            <button
              onClick={() => alert("この枠でAI計測へ送信（未実装）")}
              className="flex-1 py-3 bg-blue-600 rounded-xl text-white font-medium"
            >
              この枠で計測
            </button>
          </div>
        </div>
      )}

      {/* エラー */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center p-6">
          <div className="bg-black/80 text-white text-sm rounded-xl p-5 text-center max-w-xs">
            <p className="text-red-400 font-bold mb-2">エラー</p>
            <p>{error}</p>
          </div>
        </div>
      )}
    </div>
  )
}

// Canvas 2D 描画
function redraw(corners: Point[], done: boolean, canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d")
  if (!ctx) return
  ctx.clearRect(0, 0, canvas.width, canvas.height)

  if (corners.length === 0) return

  // 打ったコーナーをつなぐ線
  ctx.beginPath()
  corners.forEach((pt, i) => {
    if (i === 0) ctx.moveTo(pt.x, pt.y)
    else ctx.lineTo(pt.x, pt.y)
  })
  if (done) ctx.closePath()
  ctx.strokeStyle = done ? "rgba(255,140,0,0.95)" : "rgba(255,255,255,0.7)"
  ctx.lineWidth = 2.5
  ctx.setLineDash(done ? [] : [8, 5])
  ctx.stroke()
  ctx.setLineDash([])

  // 塗り（完了時のみ）
  if (done) {
    ctx.beginPath()
    corners.forEach((pt, i) => {
      if (i === 0) ctx.moveTo(pt.x, pt.y)
      else ctx.lineTo(pt.x, pt.y)
    })
    ctx.closePath()
    ctx.fillStyle = "rgba(255,140,0,0.2)"
    ctx.fill()
  }

  // 各コーナーのドット + ラベル
  corners.forEach((pt, i) => {
    // ドット
    ctx.beginPath()
    ctx.arc(pt.x, pt.y, 8, 0, Math.PI * 2)
    ctx.fillStyle = done ? "rgba(255,140,0,1)" : "rgba(255,255,255,0.95)"
    ctx.fill()
    ctx.strokeStyle = done ? "#cc6600" : "#999"
    ctx.lineWidth = 1.5
    ctx.stroke()

    // ラベル
    ctx.font = "bold 13px sans-serif"
    ctx.fillStyle = "white"
    ctx.textAlign = "center"
    ctx.shadowColor = "rgba(0,0,0,0.8)"
    ctx.shadowBlur = 4
    ctx.fillText(CORNER_LABELS[i], pt.x, pt.y - 14)
    ctx.shadowBlur = 0
  })
}
