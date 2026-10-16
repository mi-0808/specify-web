import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Specify – 見つけた部屋の家具を、自分に合う買い方で",
  description: "ネットで見たおしゃれな部屋から家具を特定して、安い版・本物・中古まで比べて選べるWebアプリ",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
