import type { ReactNode } from "react";

export function Stat({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: "default" | "good" | "warn" | "danger";
}) {
  const toneClass =
    tone === "good" ? "text-good" : tone === "warn" ? "text-warn" : tone === "danger" ? "text-danger" : "text-ink";
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-ink-faint">{label}</div>
      <div className={`tabular mt-1 font-mono text-lg ${toneClass}`}>{value}</div>
      {hint ? <div className="mt-0.5 text-xs text-ink-faint">{hint}</div> : null}
    </div>
  );
}
