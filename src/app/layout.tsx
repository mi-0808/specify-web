import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Suspense } from "react";
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
        <TabBar />
      </body>
    </html>
  );
}
