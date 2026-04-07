type Props = {
  label: string;
  value: string;
  sub?: string;
  color?: string;
};

export function BacktestingStatCard({ label, value, sub, color }: Props) {
  return (
    <div
      style={{
        padding: "0.75rem 1rem",
        borderRadius: "var(--radius-md)",
        border: "1px solid var(--color-border-subtle)",
        backgroundColor: "var(--color-surface)",
        minWidth: 0,
      }}
    >
      <div
        style={{ fontSize: "0.75rem", color: "var(--color-text-faint)", marginBottom: "0.25rem" }}
      >
        {label}
      </div>
      <div style={{ fontSize: "1.125rem", fontWeight: 700, color: color ?? "var(--color-text)" }}>
        {value}
      </div>
      {sub ? (
        <div style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", marginTop: "0.15rem" }}>
          {sub}
        </div>
      ) : null}
    </div>
  );
}
