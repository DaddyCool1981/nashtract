"use client";

import type { MilestoneAggregate } from "@nashtract/ledger";
import { effectiveBoundaryDays } from "@nashtract/ledger";
import { Badge } from "./ui/Badge";
import { STATE_LABEL, STATE_TONE } from "@/lib/milestoneUi";
import { formatDays, formatMoney } from "@/lib/format";

export function MilestoneCard({ milestone, onClick }: { milestone: MilestoneAggregate; onClick: () => void }) {
  const terms = milestone.acceptedTerms ?? milestone.proposedTerms;
  const boundary = milestone.acceptedTerms ? effectiveBoundaryDays(milestone) : terms.boundaryDays;

  return (
    <button
      onClick={onClick}
      className="group flex w-full items-center justify-between gap-4 rounded-xl border border-line bg-panel/40 px-5 py-4
        text-left transition-colors duration-150 hover:border-ink-soft"
    >
      <div className="min-w-0">
        <p className="truncate text-sm text-ink">{terms.result.description || "Untitled milestone"}</p>
        <p className="tabular mt-1 font-mono text-xs text-ink-faint">
          M={formatDays(terms.estimateDays)} · U={formatDays(boundary)} · {formatMoney(terms.referenceRate)}/d
          {milestone.state === "ACTIVE" ? ` · ${formatDays(milestone.consumedEffortDays)} used` : ""}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        {milestone.cancellation ? <Badge tone="danger">Cancelled</Badge> : null}
        <Badge tone={STATE_TONE[milestone.state]}>{STATE_LABEL[milestone.state]}</Badge>
        <span className="text-ink-faint transition-transform duration-150 group-hover:translate-x-0.5">→</span>
      </div>
    </button>
  );
}
