import Link from "next/link"

export default function ToBLanding() {
  return (
    <main className="flex flex-col items-center justify-center min-h-[calc(100dvh-49px)] px-4 py-10 text-center">
      <div className="max-w-xl w-full space-y-8">
        <div className="space-y-4">
          <span className="inline-block rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
            製造業・工場向け
          </span>
          <h1 className="text-balance text-[26px] font-bold tracking-tight text-slate-900 leading-tight sm:text-4xl">
            現場の写真を撮るだけで<br />
            <span className="text-blue-600">動線と安全の問題</span>が見える
          </h1>
          <p className="text-balance text-sm text-slate-500 leading-6 sm:text-base sm:leading-7">
            工具棚・作業台・フロアを撮影して送信するだけ。
            動線改善・安全確認・新人研修・設備変更前後の確認に。
          </p>
        </div>

        <div className="grid grid-cols-3 gap-4 text-sm">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-1.5">
            <div className="text-xl">🏃</div>
            <div className="font-semibold text-slate-800">動線改善</div>
            <div className="text-xs text-slate-500">無駄な移動を減らし作業効率を上げる</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-1.5">
            <div className="text-xl">🦺</div>
            <div className="font-semibold text-slate-800">安全確認</div>
            <div className="text-xs text-slate-500">危険物・通路障害を見える化</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-1.5">
            <div className="text-xl">📋</div>
            <div className="font-semibold text-slate-800">新人研修</div>
            <div className="text-xs text-slate-500">配置の理由をレポートで教材化</div>
          </div>
        </div>

        <Link
          href="/b/workspace"
          className="inline-block w-full rounded-xl bg-blue-600 py-4 text-base font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"
        >
          無料で試してみる
        </Link>

        <p className="text-xs text-slate-600">
          クレジットカード不要・登録から即利用可能
        </p>
      </div>
    </main>
  )
}
