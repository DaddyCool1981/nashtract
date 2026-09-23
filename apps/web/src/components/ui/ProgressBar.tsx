export function ProgressBar({ fraction, tone = "accent" }: { fraction: number; tone?: "accent" | "warn" }) {
  const clamped = Math.max(0, Math.min(1, fraction));
  const barColor = tone === "warn" ? "bg-warn" : "bg-accent";
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
      <div
        className={`h-full rounded-full ${barColor} transition-[width] duration-500 ease-out`}
        style={{ width: `${clamped * 100}%` }}
      />
    </div>
  );
}
