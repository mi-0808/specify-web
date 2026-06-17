"use client"

import { useEffect, useRef, useState } from "react"

type Phase = "init" | "scanning" | "detected" | "error"

export default function ARTestScene() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)
  const [phase, setPhase] = useState<Phase>("init")
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let stopped = false

    async function start() {
      // カメラ取得
      let stream: MediaStream
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        })
      } catch {
        setError("カメラへのアクセスが拒否されました。\nブラウザの設定を確認してください。")
        setPhase("error")
        return
      }
      if (stopped) { stream.getTracks().forEach(t => t.stop()); return }

      const video = videoRef.current
      if (!video) return
      video.srcObject = stream
      await video.play()

      setPhase("scanning")

      // 2秒後に「検出」
      const timer = setTimeout(() => {
        if (!stopped) setPhase("detected")
      }, 2000)

      // 2D Canvas でマーカー描画
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext("2d")
      if (!ctx) return

      let tick = 0

      function draw() {
        if (stopped || !ctx || !canvas) return
        animRef.current = requestAnimationFrame(draw)
        tick++

        const w = canvas.width
        const h = canvas.height

        ctx.clearRect(0, 0, w, h)

        if (phase !== "detected" && tick < 60) {
          // まだ検出前 — スキャンラインだけ
          const scanY = h * 0.5 + Math.sin(tick * 0.05) * h * 0.15
          ctx.strokeStyle = "rgba(255,140,0,0.4)"
          ctx.lineWidth = 1.5
          ctx.beginPath()
          ctx.moveTo(0, scanY)
          ctx.lineTo(w, scanY)
          ctx.stroke()
        }

        // 検出後 or 60フレーム経過 — 床面マーカーを描画
        if (tick >= 60) {
          drawFloorMarker(ctx, w, h, tick)
        }
      }

      draw()

      return () => {
        clearTimeout(timer)
        stream.getTracks().forEach(t => t.stop())
      }
    }

    const cleanup = start()
    return () => {
      stopped = true
      cancelAnimationFrame(animRef.current)
      cleanup.then(fn => fn?.())
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // phase が変わったら検出状態を canvas の描画に伝える別 effect
  useEffect(() => {
    if (phase !== "detected") return
    const canvas = canvasRef.current
    if (!canvas) return
    // detected フラグをデータ属性で共有
    canvas.dataset.detected = "true"
  }, [phase])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    function resize() {
      if (!canvas) return
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener("resize", resize)
    return () => window.removeEventListener("resize", resize)
  }, [])

  return (
    <div className="relative overflow-hidden bg-black" style={{ width: "100vw", height: "100dvh" }}>
      {/* カメラ映像 */}
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover"
        playsInline
        muted
        autoPlay
      />

      {/* 2D オーバーレイ Canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 pointer-events-none"
        style={{ width: "100%", height: "100%" }}
      />

      {/* ヘッダー */}
      <div className="absolute top-safe-top left-0 right-0 flex justify-center pt-4 pointer-events-none">
        <span className="bg-black/50 text-white text-xs px-3 py-1 rounded-full">
          AR検証モード（登録不要）
        </span>
      </div>

      {/* フェーズインジケーター */}
      <div className="absolute bottom-10 left-0 right-0 flex justify-center pointer-events-none">
        <div className="bg-black/60 text-white text-sm px-4 py-2 rounded-full flex items-center gap-2">
          {phase === "scanning" && (
            <span className="inline-block w-3 h-3 rounded-full bg-orange-400 animate-pulse" />
          )}
          {phase === "detected" && (
            <span className="inline-block w-3 h-3 rounded-full bg-green-400" />
          )}
          <span>
            {phase === "init" && "初期化中..."}
            {phase === "scanning" && "スキャン中..."}
            {phase === "detected" && "平面を検出しました"}
            {phase === "error" && "エラー"}
          </span>
        </div>
      </div>

      {/* エラー */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center p-6">
          <div className="bg-black/80 text-white text-sm rounded-xl p-5 text-center max-w-xs whitespace-pre-line">
            <p className="text-red-400 font-bold mb-2">カメラエラー</p>
            <p>{error}</p>
          </div>
        </div>
      )}
    </div>
  )
}

// 遠近感のある床面マーカーを Canvas 2D で描画
function drawFloorMarker(ctx: CanvasRenderingContext2D, w: number, h: number, tick: number) {
  // 台形（遠近感のある床面矩形）の頂点を定義
  const cx = w * 0.5               // 中心X
  const horizonY = h * 0.52        // 地平線Y（画面中央よりやや下）
  const nearY = h * 0.82           // 手前の辺のY
  const nearHalf = w * 0.32        // 手前の辺の幅の半分
  const farHalf = w * 0.12         // 奥の辺の幅の半分

  // 呼吸アニメーション
  const breathe = 1 + Math.sin(tick * 0.04) * 0.015

  const tl = { x: cx - farHalf * breathe,  y: horizonY }
  const tr = { x: cx + farHalf * breathe,  y: horizonY }
  const br = { x: cx + nearHalf * breathe, y: nearY }
  const bl = { x: cx - nearHalf * breathe, y: nearY }

  // 半透明オレンジ塗り
  ctx.beginPath()
  ctx.moveTo(tl.x, tl.y)
  ctx.lineTo(tr.x, tr.y)
  ctx.lineTo(br.x, br.y)
  ctx.lineTo(bl.x, bl.y)
  ctx.closePath()
  ctx.fillStyle = "rgba(255, 140, 0, 0.35)"
  ctx.fill()

  // オレンジ枠線
  ctx.strokeStyle = "rgba(255, 120, 0, 0.9)"
  ctx.lineWidth = 2.5
  ctx.stroke()

  // グリッド線（奥行き感）
  ctx.strokeStyle = "rgba(255, 160, 0, 0.4)"
  ctx.lineWidth = 1

  // 縦方向の消失線 × 3本
  for (let i = 1; i <= 3; i++) {
    const t = i / 4
    const topX = tl.x + (tr.x - tl.x) * t
    const botX = bl.x + (br.x - bl.x) * t
    ctx.beginPath()
    ctx.moveTo(topX, horizonY)
    ctx.lineTo(botX, nearY)
    ctx.stroke()
  }

  // 横方向の水平線 × 2本
  for (let i = 1; i <= 2; i++) {
    const t = i / 3
    const lx = tl.x + (bl.x - tl.x) * t
    const rx = tr.x + (br.x - tr.x) * t
    const y  = horizonY + (nearY - horizonY) * t
    ctx.beginPath()
    ctx.moveTo(lx, y)
    ctx.lineTo(rx, y)
    ctx.stroke()
  }

  // 四隅のコーナーマーカー
  const corners = [tl, tr, br, bl]
  corners.forEach(pt => {
    ctx.beginPath()
    ctx.arc(pt.x, pt.y, 5, 0, Math.PI * 2)
    ctx.fillStyle = "rgba(255, 200, 0, 0.95)"
    ctx.fill()
  })
}
