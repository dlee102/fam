"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "fam-theme";

export type ThemePreference = "light" | "dark" | "system";

function getResolvedTheme(pref: ThemePreference): "light" | "dark" {
  if (pref === "light") return "light";
  if (pref === "dark") return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeToggle() {
  const [pref, setPref] = useState<ThemePreference>("system");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === "light" || raw === "dark" || raw === "system") {
      setPref(raw);
    }
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    document.documentElement.setAttribute("data-theme", getResolvedTheme(pref));
    localStorage.setItem(STORAGE_KEY, pref);
  }, [pref, mounted]);

  useEffect(() => {
    if (!mounted || pref !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const sync = () => {
      document.documentElement.setAttribute("data-theme", mq.matches ? "dark" : "light");
    };
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, [mounted, pref]);

  const cycle = useCallback(() => {
    setPref((p) => (p === "light" ? "dark" : p === "dark" ? "system" : "light"));
  }, []);

  const label = pref === "light" ? "라이트" : pref === "dark" ? "다크" : "자동";

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={cycle}
      aria-label={`현재 테마: ${label}. 클릭하면 라이트, 다크, 자동 순으로 바뀝니다.`}
    >
      {label}
    </button>
  );
}
