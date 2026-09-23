import type { ReactNode } from "react";

export function Disclosure({ summary, children }: { summary: string; children: ReactNode }) {
  return (
    <details className="group rounded-xl border border-line-2 open:bg-white/[0.02]">
      <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm text-ink-soft transition-colors hover:text-ink">
        {summary}
        <span className="text-ink-faint transition-transform duration-200 ease-out group-open:rotate-45">+</span>
      </summary>
      <div className="border-t border-line-2 px-4 py-4">{children}</div>
    </details>
  );
}
