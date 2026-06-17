"use client"

import { useEffect, useRef, useState } from "react"

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    THREE: any
  }
}

type Phase = "init" | "scanning" | "detected" | "error"

export default function ARTestScene() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [phase, setPhase] = useState<Phase>("init")
  const [error, setError] = useState<string | null>(null)
  const animFrameRef = useRef<number>(0)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const threeRef = useRef<any>(null)

  useEffect(() => {
    let stopped = false

    async function setup() {
      // Three.js を CDN から動的ロード
      if (!window.THREE) {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement("script")
          script.src = "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"
          script.onload = () => resolve()
          script.onerror = () => reject(new Error("Three.js の読み込みに失敗しました"))
          document.head.appendChild(script)
        })
      }
      if (stopped) return

      const THREE = window.THREE

      // カメラ映像取得
      let stream: MediaStream
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        })
      } catch {
        setError("カメラへのアクセスが拒否されました。ブラウザの設定を確認してください。")
        setPhase("error")
        return
      }
      if (stopped) { stream.getTracks().forEach(t => t.stop()); return }

      const video = videoRef.current
      if (!video) return
      video.srcObject = stream
      await video.play()

      // Three.js セットアップ
      const canvas = canvasRef.current
      if (!canvas) return

      const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true })
      renderer.setPixelRatio(window.devicePixelRatio)
      renderer.setSize(window.innerWidth, window.innerHeight)
      renderer.setClearColor(0x000000, 0)

      const scene = new THREE.Scene()
      const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.01, 100)
      camera.position.set(0, 1.5, 0)

      // 半透明オレンジ矩形マーカー
      const geometry = new THREE.PlaneGeometry(0.6, 0.4)
      const material = new THREE.MeshBasicMaterial({
        color: 0xff8c00,
        transparent: true,
        opacity: 0.55,
        side: THREE.DoubleSide,
      })
      const marker = new THREE.Mesh(geometry, material)
      marker.rotation.x = -Math.PI / 2
      marker.position.set(0, 0, -0.8)
      scene.add(marker)

      // 枠線
      const edges = new THREE.EdgesGeometry(geometry)
      const lineMat = new THREE.LineBasicMaterial({ color: 0xff6600, linewidth: 2 })
      const wireframe = new THREE.LineSegments(edges, lineMat)
      wireframe.rotation.x = -Math.PI / 2
      wireframe.position.set(0, 0, -0.8)
      scene.add(wireframe)

      threeRef.current = { scene, camera, renderer, marker }

      // DeviceOrientation 許可（iOS 13+）
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const DevOrEv = DeviceOrientationEvent as any
      if (typeof DevOrEv.requestPermission === "function") {
        try {
          await DevOrEv.requestPermission()
        } catch {
          // 許可なしでも継続
        }
      }

      const orient = { alpha: 0, beta: 0, gamma: 0 }
      const handleOrientation = (e: DeviceOrientationEvent) => {
        orient.alpha = e.alpha ?? 0
        orient.beta = e.beta ?? 0
        orient.gamma = e.gamma ?? 0
      }
      window.addEventListener("deviceorientation", handleOrientation)

      setPhase("scanning")

      // スキャン中インジケーター → 2秒後に「検出」
      const timer = setTimeout(() => {
        if (!stopped) setPhase("detected")
      }, 2000)

      const euler = new THREE.Euler() // eslint-disable-line @typescript-eslint/no-unsafe-call
      const quaternion = new THREE.Quaternion()

      function animate() {
        if (stopped) return
        animFrameRef.current = requestAnimationFrame(animate)

        // デバイス傾きをカメラに反映（簡易）
        const beta = (orient.beta * Math.PI) / 180
        const gamma = (orient.gamma * Math.PI) / 180
        euler.set(beta - Math.PI / 2, 0, -gamma, "YXZ")
        quaternion.setFromEuler(euler)
        camera.quaternion.slerp(quaternion, 0.1)

        renderer.render(scene, camera)
      }
      animate()

      const handleResize = () => {
        renderer.setSize(window.innerWidth, window.innerHeight)
        camera.aspect = window.innerWidth / window.innerHeight
        camera.updateProjectionMatrix()
      }
      window.addEventListener("resize", handleResize)

      return () => {
        clearTimeout(timer)
        window.removeEventListener("deviceorientation", handleOrientation)
        window.removeEventListener("resize", handleResize)
        stream.getTracks().forEach(t => t.stop())
        renderer.dispose()
      }
    }

    const cleanup = setup()
    return () => {
      stopped = true
      cancelAnimationFrame(animFrameRef.current)
      cleanup.then(fn => fn?.())
    }
  }, [])

  const phaseLabel: Record<Phase, string> = {
    init: "初期化中...",
    scanning: "スキャン中...",
    detected: "平面を検出しました",
    error: "エラー",
  }

  return (
    <div className="relative w-full h-full bg-black overflow-hidden">
      {/* カメラ映像 */}
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover"
        playsInline
        muted
        autoPlay
      />

      {/* Three.js オーバーレイ */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
      />

      {/* ヘッダー */}
      <div className="absolute top-4 left-0 right-0 flex justify-center pointer-events-none">
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
          <span>{phaseLabel[phase]}</span>
        </div>
      </div>

      {/* エラー表示 */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center p-6">
          <div className="bg-black/80 text-white text-sm rounded-xl p-5 text-center max-w-xs">
            <p className="text-red-400 font-bold mb-2">カメラエラー</p>
            <p>{error}</p>
          </div>
        </div>
      )}
    </div>
  )
}
