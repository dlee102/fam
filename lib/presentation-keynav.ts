/**
 * 웹 PPT 슬라이드: 화살표 등이 입력·IME에 먹히지 않도록 할 때,
 * 키보드 단축키를 무시해야 하는 포커스 대상인지 판별.
 */
export function isEditableKeyTarget(t: EventTarget | null): boolean {
  const el = t instanceof Element ? t : null;
  if (!el) return false;
  return !!el.closest("input, textarea, select, [contenteditable='true']");
}

/** Space로 페이지 이동·클릭해야 하는 링크면 슬라이드용 Space 처리 금지 */
export function isAnchorSpaceTarget(t: EventTarget | null): boolean {
  const el = t instanceof Element ? t : null;
  if (!el) return false;
  return !!el.closest("a[href]");
}
