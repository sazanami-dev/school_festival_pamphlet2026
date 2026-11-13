import type { Metadata } from "next";
import { Geist_Mono, Noto_Sans_JP, Roboto } from "next/font/google";
import BottomNav from "@/components/BottomNav";
import "./globals.css";

// Android の標準フォント（英数字は Roboto、日本語は Noto Sans JP）に全端末でそろえる
const roboto = Roboto({
  variable: "--font-roboto",
  subsets: ["latin"],
});

const notoSansJP = Noto_Sans_JP({
  variable: "--font-noto-sans-jp",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "トライデント学園祭2026 デジタルパンフレット",
  description: "さざなみ開発が制作した公式デジタルパンフレットです！！",
  openGraph: {
    images: [{ url: "/favicon.ico", width: 1200, height: 630, alt: "さざなみ開発 アイコン" }],
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ja"
      className={`${roboto.variable} ${notoSansJP.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <BottomNav />
      </body>
    </html>
  );
}
