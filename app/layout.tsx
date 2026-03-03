import type { Metadata } from "next";
import { Noto_Sans_KR } from "next/font/google";
import "./globals.css";

const notoSansKr = Noto_Sans_KR({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "FAM 뉴스",
  description: "뉴스 기사 사이트",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className={notoSansKr.className}>
        <div className="layout-center" style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
          <header
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "1rem 2rem",
              backgroundColor: "#fff",
              borderBottom: "1px solid #e5e5e5",
            }}
          >
            <span
              style={{
                fontSize: "1.25rem",
                fontWeight: 300,
                color: "#1a1a1a",
                letterSpacing: "-0.01em",
              }}
            >
              Qraft AI quant indicator
            </span>
          </header>
          <div style={{ flex: 1, width: "100%" }}>
            {children}
          </div>
        </div>
      </body>
    </html>
  );
}
