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
            href="/login"
            className="w-full py-3 px-4 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors"
          >
            はじめる
          </Link>
          <Link
            href="/dashboard"
            className="w-full py-3 px-4 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-100 transition-colors"
          >
            ダッシュボードへ
          </Link>
        </div>
      </div>
    </main>
  );
}
