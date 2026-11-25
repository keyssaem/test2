import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

// 갈무리(Galmuri) 픽셀 폰트 — SIL OFL 1.1, 외부 CDN 없이 자체 호스팅
const galmuri = localFont({
  src: [
    { path: "../../node_modules/galmuri/dist/Galmuri11.woff2", weight: "400" },
    { path: "../../node_modules/galmuri/dist/Galmuri11-Bold.woff2", weight: "700" },
  ],
  variable: "--font-pixel",
  display: "swap",
});

export const metadata: Metadata = {
  title: "프롬프트 퀘스트",
  description: "그림을 보고 보이는 대로 말해 보는 초등 프롬프트 연습",
};

export const viewport: Viewport = { themeColor: "#2b1b4d" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body className={`${galmuri.variable} antialiased`}>{children}</body>
    </html>
  );
}
