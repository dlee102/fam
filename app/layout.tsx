import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import { AppSidebar } from "./components/PrimaryNav";
import { ThemeToggle } from "./components/ThemeToggle";

const themeInitScript = `(function(){try{var p=localStorage.getItem("fam-theme");var d;if(p==="light")d=!1;else if(p==="dark")d=!0;else d=window.matchMedia("(prefers-color-scheme: dark)").matches;document.documentElement.setAttribute("data-theme",d?"dark":"light");}catch(e){}})();`;

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
    <html lang="ko" suppressHydrationWarning>
      <body>
        <Script
          id="fam-theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: themeInitScript }}
        />
        <div className="site-root">
          <div className="site-header-sticky">
            <header className="site-header site-header--brand">
              <div className="site-header__edge site-header__edge--split">
                <a href="/" className="logo-link site-logo">
                  Qraft AI quant indicator
                </a>
                <ThemeToggle />
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
