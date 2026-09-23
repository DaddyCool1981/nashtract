import type { ReactNode } from "react";

type Tone = "neutral" | "accent" | "good" | "warn" | "danger";

const TONE_CLASSES: Record<Tone, string> = {
  neutral: "bg-white/5 text-ink-soft",
  accent: "bg-accent-dim text-accent-ink",
  good: "bg-good-dim text-good",
  warn: "bg-warn-dim text-warn",
  danger: "bg-danger-dim text-danger",
};

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium tracking-wide ${TONE_CLASSES[tone]}`}>
      {children}
    </span>
  );
}
