import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "家系図作成ツール - Family Tree Creator",
  description: "無料で使えるオンライン家系図作成ツール。JSON形式で保存・読み込み可能。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=BIZ+UDPGothic:wght@400;700&family=Noto+Sans+JP:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
