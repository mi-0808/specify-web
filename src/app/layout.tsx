import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Suspense } from "react";
import Link from "next/link";
import { TabBar } from "./_components/TabBar";
import { NavProgress } from "./_components/NavProgress";

export const metadata: Metadata = {
  title: "Specify – 見つけた部屋の家具を、自分に合う買い方で",
  description: "ネットで見たおしゃれな部屋から家具を特定して、安い版・本物・中古まで比べて選べるWebアプリ",
};

// 画面の端（iPhone の角や下のバー）まで描き、セーフエリアは env(safe-area-inset-*) で空ける
export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FBF5EE" },
    { media: "(prefers-color-scheme: dark)", color: "#16130B" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className="h-full antialiased">
      {/* スマホは下のタブバーの分だけ下を空ける */}
      <body className="min-h-full flex flex-col pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-0">
        <Suspense fallback={null}>
          <NavProgress />
        </Suspense>
        {children}
        {/* 全ページの一番下。規約はアプリの中からいつでも開けるようにする（App Store 審査 5.1.1） */}
        <footer className="border-t border-outline-variant/70 bg-surface px-5 pb-5 pt-3 text-center text-[0.8125rem] text-on-surface-variant">
          <ul className="flex justify-center gap-x-4">
            <li>
              <Link href="/terms" className="focus-ring inline-flex min-h-11 items-center rounded underline underline-offset-4">利用規約</Link>
            </li>
            <li>
              <Link href="/privacy" className="focus-ring inline-flex min-h-11 items-center rounded underline underline-offset-4">プライバシーポリシー</Link>
            </li>
          </ul>
          {/* Amazon アソシエイト・プログラム運営規約 第5条で決まっている一文 */}
          <p className="mb-1.5 text-balance leading-[1.6]">Amazonのアソシエイトとして、Specify は適格販売により収入を得ています。</p>
          <p>© 2026 Specify</p>
        </footer>
        <TabBar />
      </body>
    </html>
  );
}
