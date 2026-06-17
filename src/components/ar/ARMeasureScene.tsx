"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { calcDimensions, type Point3D, type SpaceDimensions } from "@/lib/webxr/measure"

// XR8 グローバル型（バイナリ読み込み後にwindowに追加される）
declare global {
  interface Window {
    XR8: any
    XRExtras: any
  }
}

type Phase = "loading" | "scanning" | "tapping" | "done" | "error"

interface ARMeasureSceneProps {
  onMeasured: (dimensions: SpaceDimensions) => void
}

const CORNER_LABELS = ["左前", "右前", "右奥", "左奥"]

export default function ARMeasureScene({ onMeasured }: ARMeasureSceneProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [phase, setPhase] = useState<Phase>("loading")
  const [corners, setCorners] = useState<Point3D[]>([])
  const [error, setError] = useState<string | null>(null)
  const [dimensions, setDimensions] = useState<SpaceDimensions | null>(null)
  const [tapFeedback, setTapFeedback] = useState<{ x: number; y: number } | null>(null)
  const xrStartedRef = useRef(false)

  const handleTap = useCallback((e: CustomEvent) => {
    const { worldPosition } = e.detail as { worldPosition: Point3D }
    if (!worldPosition) return

    setCorners((prev) => {
      const next = [...prev, worldPosition]
      if (next.length === 4) {
        const dims = calcDimensions(next as [Point3D, Point3D, Point3D, Point3D])
        setDimensions(dims)
        setPhase("done")
        onMeasured(dims)
      }
      return next
    })
  }, [onMeasured])

  useEffect(() => {
    // すでに開始済みなら重複起動しない
    if (xrStartedRef.current) return
    xrStartedRef.current = true

    // XR8バイナリ + ECSSを動的に読み込む
    const loadScripts = async () => {
      try {
        await Promise.all([
          loadScript("https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js"),
        ])
        await loadScript(
          "https://cdn.jsdelivr.net/npm/@8thwall/engine-binary@1/dist/xr.js",
          { async: true, "data-preload-chunks": "slam" }
        )

        // XR8が読み込まれるまで待機
        await waitForXR8()

        const canvas = canvasRef.current
        if (!canvas) throw new Error("Canvas not found")

        // XR8セットアップ
        window.XR8.XrController.configure({ enableLighting: false })
        window.XR8.addCameraPipelineModules([
          window.XR8.GlTextureRenderer.pipelineModule(),
          window.XR8.XrController.pipelineModule(),
          {
            name: "specify-tap",
            onStart: () => setPhase("tapping"),
          },
        ])

        // タップイベントをCanvasで受け取る
        canvas.addEventListener("touchstart", (e: TouchEvent) => {
          e.preventDefault()
          const touch = e.touches[0]
          const rect = canvas.getBoundingClientRect()
          const x = (touch.clientX - rect.left) / rect.width
          const y = (touch.clientY - rect.top) / rect.height

          // タップ位置フィードバック（必ず表示）
          setTapFeedback({ x: touch.clientX, y: touch.clientY })
          setTimeout(() => setTapFeedback(null), 600)

          const hitResult = window.XR8.XrController.hitTest(x, y, {
            floorOnly: false,
            preferredSurfaces: ["planes", "feature-points"],
          })

          if (hitResult) {
            const synth = new CustomEvent("xr-tap", {
              detail: { worldPosition: hitResult.position },
            })
            canvas.dispatchEvent(synth)
          } else {
            // hitTest失敗時は画面座標をそのまま仮3D座標として使う（フォールバック）
            const fallbackPos: Point3D = { x: (x - 0.5) * 2, y: 0, z: -(1 - y) * 2 }
            const synth = new CustomEvent("xr-tap", {
              detail: { worldPosition: fallbackPos },
            })
            canvas.dispatchEvent(synth)
          }
        }, { passive: false })

        canvas.addEventListener("xr-tap", handleTap as EventListener)

        window.XR8.run({ canvas, allowedDevices: window.XR8.XrConfig.device().ANY })
        setPhase("scanning")
      } catch (err) {
        console.error(err)
        setError(err instanceof Error ? err.message : "AR起動に失敗しました")
        setPhase("error")
      }
    }

    loadScripts()

    return () => {
      try { window.XR8?.stop() } catch {}
    }
  }, [handleTap])

  const reset = () => {
    setCorners([])
    setDimensions(null)
    setPhase("tapping")
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full bg-black overflow-hidden"
      style={{ height: "100dvh" }}
    >
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        style={{ touchAction: "none", display: "block" }}
      />

      {/* タップ位置フィードバック */}
      {tapFeedback && (
        <div
          className="absolute pointer-events-none"
          style={{
            left: tapFeedback.x - 24,
            top: tapFeedback.y - 24,
            width: 48,
            height: 48,
          }}
        >
          <div className="w-full h-full rounded-full border-2 border-white bg-white/30 animate-ping" />
        </div>
      )}

      {/* ステータスUI */}
      <div className="absolute inset-x-0 top-0 flex flex-col items-center pointer-events-none">
        {phase === "loading" && (
          <div className="mt-8 px-4 py-2 bg-black/60 rounded-full text-white text-sm">
            ARを起動中...
          </div>
        )}

        {phase === "scanning" && (
          <div className="mt-8 px-4 py-2 bg-black/60 rounded-full text-white text-sm">
            床・棚を映してください（平面を検出中）
          </div>
        )}

        {phase === "tapping" && (
          <div className="mt-8 px-4 py-3 bg-blue-600/90 rounded-2xl text-white text-center shadow-lg">
            <p className="font-semibold">
              {corners.length < 4
                ? `${CORNER_LABELS[corners.length]}をタップ（${corners.length + 1}/4）`
                : "計算中..."}
            </p>
          </div>
        )}

        {phase === "error" && (
          <div className="mt-8 mx-4 px-4 py-3 bg-red-600/90 rounded-2xl text-white text-center">
            <p className="font-semibold">エラー</p>
            <p className="text-sm mt-1">{error}</p>
          </div>
        )}
      </div>

      {/* 隅インジケーター */}
      {phase === "tapping" && corners.length > 0 && (
        <div className="absolute bottom-40 inset-x-0 flex justify-center gap-2 pointer-events-none">
          {CORNER_LABELS.map((label, i) => (
            <div
              key={label}
              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                i < corners.length
                  ? "bg-green-500 text-white"
                  : "bg-white/40 text-white"
              }`}
            >
              {i + 1}
            </div>
          ))}
        </div>
      )}

      {/* 結果表示 */}
      {phase === "done" && dimensions && (
        <div className="absolute inset-x-0 bottom-0 bg-white rounded-t-3xl p-6 shadow-2xl">
          <h2 className="text-lg font-bold text-gray-900 mb-4">計測結果</h2>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-gray-50 rounded-xl p-3 text-center">
              <p className="text-xs text-gray-500">幅</p>
              <p className="text-2xl font-bold text-blue-600">{dimensions.width_cm}</p>
              <p className="text-xs text-gray-500">cm</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 text-center">
              <p className="text-xs text-gray-500">奥行き</p>
              <p className="text-2xl font-bold text-blue-600">{dimensions.depth_cm}</p>
              <p className="text-xs text-gray-500">cm</p>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={reset}
              className="flex-1 py-3 border border-gray-300 rounded-xl text-gray-700 font-medium"
            >
              やり直す
            </button>
            <button
              onClick={() => onMeasured(dimensions)}
              className="flex-1 py-3 bg-blue-600 rounded-xl text-white font-medium"
            >
              この値で保存
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// --- ユーティリティ ---

function loadScript(src: string, attrs: Record<string, string | boolean> = {}): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve()
      return
    }
    const s = document.createElement("script")
    s.src = src
    Object.entries(attrs).forEach(([k, v]) => {
      if (typeof v === "boolean") {
        if (v) s.setAttribute(k, "")
      } else {
        s.setAttribute(k, v)
      }
    })
    s.onload = () => resolve()
    s.onerror = () => reject(new Error(`Failed to load: ${src}`))
    document.head.appendChild(s)
  })
}

function waitForXR8(timeout = 10000): Promise<void> {
  return new Promise((resolve, reject) => {
    const start = Date.now()
    const check = () => {
      if (window.XR8) {
        resolve()
      } else if (Date.now() - start > timeout) {
        reject(new Error("XR8 load timeout"))
      } else {
        setTimeout(check, 100)
      }
    }
    check()
  })
}
