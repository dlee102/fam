import type { Metadata } from "next";
import { Noto_Sans_KR } from "next/font/google";
import "./globals.css";
import NavTabs from "./components/NavTabs";

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
            className="header-main"
            style={{
              padding: "1.25rem 2rem",
              backgroundColor: "var(--color-surface)",
              borderBottom: "1px solid var(--color-border)",
              boxShadow: "var(--shadow-sm)",
            }}
          >
            <a
              href="/"
              className="logo-link"
              style={{
                fontSize: "1.35rem",
                fontWeight: 600,
                color: "var(--color-text)",
                letterSpacing: "-0.02em",
                textDecoration: "none",
              }}
            >
              Qraft AI quant indicator
            </a>
          </header>
          <header
            className="header-nav"
            style={{
              padding: "0.625rem 2rem",
              backgroundColor: "var(--color-surface)",
              borderBottom: "1px solid var(--color-border)",
            }}
          >
            <NavTabs />
          </header>
          <div style={{ flex: 1, width: "100%" }}>
            {children}
          </div>
        </div>
      </body>
    </html>
  );
}
