"use client"

import { useEffect, useRef, useState } from "react"

const CORNER_LABELS = ["左前", "右前", "右奥", "左奥"]
type Point = { x: number; y: number } // normalized 0–1

export default function ARTestScene() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [corners, setCorners] = useState<Point[]>([])
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [analyzing, setAnalyzing] = useState(false)
  const [isUltraWide, setIsUltraWide] = useState(false)
  const streamRef = useRef<MediaStream | null>(null)

  // カメラ起動（超広角優先）
  useEffect(() => {
    let active = true

    const startCamera = async () => {
      try {
        const constraints = {
          video: {
            facingMode: { ideal: "environment" as const },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            aspectRatio: { ideal: 16 / 9 },
          },
        }
        const stream = await navigator.mediaDevices.getUserMedia(constraints)
        if (!active) { stream.getTracks().forEach((t) => t.stop()); return }

        const devices = await navigator.mediaDevices.enumerateDevices()
        const videoDevices = devices.filter((d) => d.kind === "videoinput")
        const ultraWide = videoDevices.find(
          (d) =>
            d.label.toLowerCase().includes("ultra") ||
            d.label.toLowerCase().includes("wide") ||
            d.label.toLowerCase().includes("0.5")
        )

        if (ultraWide) {
          stream.getTracks().forEach((t) => t.stop())
          const wideStream = await navigator.mediaDevices.getUserMedia({
            video: { deviceId: { exact: ultraWide.deviceId }, aspectRatio: { ideal: 16 / 9 } },
          })
          if (!active) { wideStream.getTracks().forEach((t) => t.stop()); return }
          streamRef.current = wideStream
          if (videoRef.current) {
            videoRef.current.srcObject = wideStream
            videoRef.current.play()
          }
          setIsUltraWide(true)
        } else {
          streamRef.current = stream
          if (videoRef.current) {
            videoRef.current.srcObject = stream
            videoRef.current.play()
          }
          setIsUltraWide(false)
        }
      } catch {
        if (active) setError("カメラへのアクセスが拒否されました")
      }
    }

    startCamera()
    return () => {
      active = false
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  // Canvas リサイズ
  useEffect(() => {
    const resize = () => {
      const c = canvasRef.current
      if (!c) return
      c.width = window.innerWidth
      c.height = window.innerHeight
    }
    resize()
    window.addEventListener("resize", resize)
    return () => window.removeEventListener("resize", resize)
  }, [])

  // コーナーが変わるたびに再描画
  useEffect(() => {
    const c = canvasRef.current
    if (c) redraw(corners, done, c)
  }, [corners, done])

  const handleTap = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault()
    if (done) return

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()

    const clientX =
      "touches" in e
        ? (e.touches[0]?.clientX ?? e.changedTouches[0]?.clientX)
        : e.clientX
    const clientY =
      "touches" in e
        ? (e.touches[0]?.clientY ?? e.changedTouches[0]?.clientY)
        : e.clientY

    if (clientX == null || clientY == null) return

    const x = (clientX - rect.left) / rect.width
    const y = (clientY - rect.top) / rect.height

    setCorners((prev) => {
      const next = [...prev, { x, y }]
      if (next.length === 4) setDone(true)
      return next
    })
  }

  const handleAnalyze = async (base64: string) => {
    setAnalyzing(true)
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageData: base64 }),
      })
      const data = await res.json()
      setSuggestions(data.suggestions)
    } catch (e) {
      console.error(e)
    } finally {
      setAnalyzing(false)
    }
  }

  const handleCapture = () => {
    const video = videoRef.current
    if (!video) return
    const tmp = document.createElement("canvas")
    tmp.width = video.videoWidth || window.innerWidth
    tmp.height = video.videoHeight || window.innerHeight
    tmp.getContext("2d")?.drawImage(video, 0, 0)
    const dataUrl = tmp.toDataURL("image/jpeg", 0.8)
    const base64 = dataUrl.replace("data:image/jpeg;base64,", "")
    handleAnalyze(base64)
  }

  const reset = () => {
    setCorners([])
    setDone(false)
    setSuggestions([])
  }

  const nextLabel = corners.length < 4 ? CORNER_LABELS[corners.length] : null

  return (
    <div
      className="relative bg-black overflow-hidden"
      style={{ width: "100vw", height: "100svh" }}
    >
      <style>{`
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html, body {
          width: 100%;
          height: 100%;
          overflow: hidden;
          background: #000;
        }
      `}</style>

      {/* カメラ映像 */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100vw",
          height: "100vh",
          objectFit: "cover",
          objectPosition: "center",
          zIndex: 0,
          backgroundColor: "#000",
        }}
      />

      {/* 線描画用 Canvas（zIndex: 5） */}
      <canvas
        ref={canvasRef}
        style={{
          position: "fixed",
          inset: 0,
          width: "100vw",
          height: "100vh",
          zIndex: 5,
          pointerEvents: "none",
        }}
      />

      {/* タップ受付オーバーレイ（zIndex: 10） */}
      <div
        style={{ position: "fixed", inset: 0, zIndex: 10 }}
        onTouchEnd={handleTap}
        onMouseDown={handleTap}
      />

      {/* 角マーカー（zIndex: 20） */}
      {corners.map((corner, i) => (
        <div
          key={i}
          style={{
            position: "fixed",
            left: `${corner.x * 100}%`,
            top: `${corner.y * 100}%`,
            transform: "translate(-50%, -50%)",
            width: 20,
            height: 20,
            borderRadius: "50%",
            backgroundColor: done ? "orange" : "white",
            border: "2px solid rgba(0,0,0,0.5)",
            zIndex: 20,
            pointerEvents: "none",
          }}
        />
      ))}

      {/* ヘッダー（zIndex: 30） */}
      <div
        className="absolute top-4 inset-x-0 flex justify-center pointer-events-none"
        style={{ zIndex: 30 }}
      >
        <span className="bg-black/50 text-white text-xs px-3 py-1 rounded-full">
          収納スペース計測（タップで計測）
        </span>
      </div>

      {/* カメラ種別バッジ（右上、zIndex: 30） */}
      <div
        className="absolute top-4 right-4 pointer-events-none"
        style={{ zIndex: 30 }}
      >
        {isUltraWide ? (
          <span className="bg-black/60 text-white text-xs px-2 py-1 rounded-full">
            🔭 超広角
          </span>
        ) : (
          <span className="bg-black/60 text-white text-xs px-2 py-1 rounded-full">
            📷 標準
          </span>
        )}
      </div>

      {/* 指示バナー（zIndex: 30） */}
      {!done && (
        <div
          className="absolute top-14 inset-x-0 flex justify-center pointer-events-none"
          style={{ zIndex: 30 }}
        >
          <div className="bg-blue-600/90 text-white text-base font-semibold px-5 py-2.5 rounded-2xl shadow-lg">
            {nextLabel}をタップ（{corners.length + 1} / 4）
          </div>
        </div>
      )}

      {/* コーナー達成インジケーター（zIndex: 30） */}
      <div
        className="absolute top-28 inset-x-0 flex justify-center gap-2 pointer-events-none"
        style={{ zIndex: 30 }}
      >
        {CORNER_LABELS.map((label, i) => (
          <div
            key={label}
            className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
              i < corners.length
                ? "bg-green-500 text-white scale-110"
                : "bg-white/30 text-white"
            }`}
          >
            {i + 1}
          </div>
        ))}
      </div>

      {/* 分析中スピナー（zIndex: 40） */}
      {analyzing && (
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ zIndex: 40, background: "rgba(0,0,0,0.5)" }}
        >
          <div className="bg-white rounded-2xl px-8 py-6 flex flex-col items-center gap-3 shadow-2xl">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-medium text-gray-700">🤖 AIが分析中...</p>
          </div>
        </div>
      )}

      {/* 提案カード（zIndex: 35） */}
      {suggestions.length > 0 && (
        <div
          className="absolute bottom-0 inset-x-0 bg-white rounded-t-3xl p-6 shadow-2xl"
          style={{ zIndex: 35 }}
        >
          <h2 className="text-lg font-bold text-gray-900 mb-3">AI改善提案</h2>
          <div className="flex flex-col gap-2 mb-4">
            {suggestions.map((s, i) => (
              <div key={i} className="bg-blue-50 rounded-xl px-4 py-3 text-sm text-gray-800">
                💡 {s}
              </div>
            ))}
          </div>
          <button
            onClick={reset}
            className="w-full py-3 bg-blue-600 rounded-xl text-white font-medium"
          >
            もう一度スキャン
          </button>
        </div>
      )}

      {/* 完了バナー（zIndex: 30） */}
      {done && suggestions.length === 0 && !analyzing && (
        <div
          className="absolute bottom-0 inset-x-0 bg-white rounded-t-3xl p-6 shadow-2xl"
          style={{ zIndex: 30 }}
        >
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
              onClick={handleCapture}
              className="flex-1 py-3 bg-blue-600 rounded-xl text-white font-medium"
            >
              この枠で計測
            </button>
          </div>
        </div>
      )}

      {/* エラー（zIndex: 30） */}
      {error && (
        <div
          className="absolute inset-0 flex items-center justify-center p-6"
          style={{ zIndex: 30 }}
        >
          <div role="alert" className="bg-black/80 text-white text-sm rounded-xl p-5 text-center max-w-xs">
            <p className="text-red-400 font-bold mb-2">エラー</p>
            <p>{error}</p>
          </div>
        </div>
      )}
    </div>
  )
}

// Canvas 2D 描画（正規化座標 → ピクセル変換）
function redraw(corners: Point[], done: boolean, canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d")
  if (!ctx) return
  const w = canvas.width
  const h = canvas.height
  ctx.clearRect(0, 0, w, h)

  if (corners.length === 0) return

  const px = corners.map((p) => ({ x: p.x * w, y: p.y * h }))

  ctx.beginPath()
  px.forEach((pt, i) => {
    if (i === 0) ctx.moveTo(pt.x, pt.y)
    else ctx.lineTo(pt.x, pt.y)
  })
  if (done) ctx.closePath()
  ctx.strokeStyle = done ? "rgba(255,140,0,0.95)" : "rgba(255,255,255,0.7)"
  ctx.lineWidth = 2.5
  ctx.setLineDash(done ? [] : [8, 5])
  ctx.stroke()
  ctx.setLineDash([])

  if (done) {
    ctx.beginPath()
    px.forEach((pt, i) => {
      if (i === 0) ctx.moveTo(pt.x, pt.y)
      else ctx.lineTo(pt.x, pt.y)
    })
    ctx.closePath()
    ctx.fillStyle = "rgba(255,140,0,0.2)"
    ctx.fill()
  }
}
