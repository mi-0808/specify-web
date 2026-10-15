import Link from "next/link"

// ログイン状態を読まずに済むよう「マイページ」1つにしている（未ログインなら proxy がログイン画面へ送る）
export function SiteHeader() {
  return (
    <header className="flex items-center justify-between">
      <Link href="/" className="focus-ring rounded text-lg font-bold tracking-tight">
        Specify
      </Link>
      <Link
        href="/home"
        className="focus-ring rounded-full border border-outline px-4 py-3 text-sm font-medium text-primary transition-colors hover:bg-surface-container-lowest"
      >
        マイページ
      </Link>
    </header>
  )
}

export const primaryButton =
  "focus-ring block w-full rounded-full bg-primary px-6 py-3.5 text-center text-base font-semibold text-on-primary transition-colors hover:bg-primary-hover"

export const pageShell = "mx-auto flex min-h-screen w-full max-w-md flex-col gap-10 px-5 py-8"
