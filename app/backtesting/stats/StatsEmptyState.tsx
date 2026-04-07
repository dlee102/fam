import { backtestingPanelCard } from "../lib/ui-styles";

export function StatsEmptyState() {
  return (
    <section
      style={{
        ...backtestingPanelCard,
        color: "var(--color-text-muted)",
        fontSize: "0.875rem",
        lineHeight: 1.6,
      }}
    >
      <p style={{ marginBottom: "0.75rem" }}>
        아직 <code style={{ fontSize: "0.8rem" }}>data/publish_horizon_curve.json</code> 이 없습니다.
      </p>
      <p>
        저장소 루트에서{" "}
        <code style={{ fontSize: "0.8rem" }}>python3 scripts/entry_hold_analysis.py</code> 를 실행하면
        생성됩니다.
      </p>
    </section>
  );
}
