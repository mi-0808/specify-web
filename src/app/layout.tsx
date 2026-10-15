import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Specify – 理想の部屋を、今買える家具のレシピに",
  description: "SNSで見た理想の部屋の雰囲気から、予算に合わせて実際に買える家具の組み合わせ（店・価格・総額）を出すWebアプリ",
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
