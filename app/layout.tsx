import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "縁図 Enzu — 人と人の関係を、1枚に",
  description: "人と人の関係を1枚の図にする関係図ツール。医療のジェノグラムから相続関係図まで、表示を切り替えて業種を問わず使えます。",
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
