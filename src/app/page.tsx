import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex flex-col items-center justify-center min-h-screen bg-gray-50 px-4">
      <div className="max-w-md w-full text-center space-y-8">
        <div>
          <h1 className="text-4xl font-bold text-gray-900">Specify</h1>
          <p className="mt-2 text-gray-600">
            ARで収納スペースを計測し、AIが最適な整理術を提案
          </p>
        </div>
        <div className="flex flex-col gap-3">
          <Link
            href="/ar-test"
            className="w-full py-3.5 px-4 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors shadow-md"
          >
            今すぐARを体験する（登録不要）
          </Link>
          <Link
            href="/login"
            className="w-full py-3 px-4 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-100 transition-colors"
          >
            ログイン / 新規登録
          </Link>
        </div>
        <p className="text-xs text-gray-400">
          登録すると計測データを保存・AI提案が利用できます
        </p>
      </div>
    </main>
  );
}
