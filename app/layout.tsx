import type { Metadata } from "next";
import "./globals.css";
import { AppSidebar } from "./components/PrimaryNav";
import { FirebaseAnalyticsInit } from "./components/FirebaseAnalyticsInit";

export const metadata: Metadata = {
  title: "PHARM 뉴스",
  description: "뉴스 기사 사이트",
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" data-theme="dark" suppressHydrationWarning>
      <body>
        <FirebaseAnalyticsInit />
        <div className="site-root">
          <div className="site-header-sticky">
            <header className="site-header site-header--brand">
              <div className="site-header__edge site-header__edge--split">
                <a href="/" className="logo-link site-logo">
                  Qraft AI quant indicator
                </a>
              </div>
            </header>
          </div>
          <div className="site-body">
            <AppSidebar />
            <div className="site-main-wrap">
              <div className="site-main">{children}</div>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
