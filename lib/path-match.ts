/** trailing slash·쿼리 차이 흡수 — 사이드바·서브탭 활성 상태 공통 */
export function pathMatches(pathname: string, href: string): boolean {
  const p = pathname.split("?")[0].replace(/\/$/, "") || "/";
  const h = href.replace(/\/$/, "") || "/";
  if (p === h) return true;
  if (h === "/") return p === "/";
  return p === h || p.startsWith(`${h}/`);
}
