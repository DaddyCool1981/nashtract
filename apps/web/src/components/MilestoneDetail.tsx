"use client";

import { useState } from "react";
import { calculateMaximumExposure, calculateSettlement, type AcceptedTerms } from "@nashtract/core";
import {
  computeMilestoneSettlement,
  effectiveBoundaryDays,
  type MilestoneAggregate,
} from "@nashtract/ledger";
import { useStore } from "@/lib/store";
import { formatDate, formatDateTime, formatDays, formatMoney, formatPercent } from "@/lib/format";
import { STATE_LABEL, STATE_TONE } from "@/lib/milestoneUi";
import { Badge } from "./ui/Badge";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";
import { Disclosure } from "./ui/Disclosure";
import { ProgressBar } from "./ui/ProgressBar";
import { Stat } from "./ui/Stat";
import { TextField } from "./ui/Field";

export function MilestoneDetail({ milestone, onBack }: { milestone: MilestoneAggregate; onBack: () => void }) {
  const terms = milestone.acceptedTerms ?? milestone.proposedTerms;

  return (
    <div>
      <button onClick={onBack} className="mb-6 text-sm text-ink-soft transition-colors hover:text-ink">
        ← All milestones
      </button>

      <div className="mb-6 flex items-start justify-between gap-4">
        <h1 className="text-xl font-semibold tracking-tight text-ink">{terms.result.description}</h1>
        <Badge tone={STATE_TONE[milestone.state]}>{STATE_LABEL[milestone.state]}</Badge>
      </div>

      {milestone.cancellation ? (
        <Card className="mb-6 border-danger/30 bg-danger-dim/40">
          <p className="text-sm text-danger">
            Cancelled — {milestone.cancellation.reason} ({formatDate(milestone.cancellation.cancelledAt)}). No
            further action is possible on this milestone.
          </p>
        </Card>
      ) : null}

      <ByState milestone={milestone} />

      {milestone.boundaryExtensions.length > 0 ? (
        <Card className="mt-6">
          <h3 className="text-sm font-medium text-ink-soft">Continuation lineage</h3>
          <p className="mt-1 text-xs text-ink-faint">
            The original estimate, beta, and consumed effort were never rewritten — each continuation only widened
            the boundary.
          </p>
          <ul className="mt-3 space-y-1.5 text-sm">
            {milestone.boundaryExtensions.map((ext, i) => (
              <li key={i} className="tabular font-mono text-xs text-ink-soft">
                +{formatDays(ext.additionalDays)} accepted {formatDate(ext.acceptedAt)}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}

function ByState({ milestone }: { milestone: MilestoneAggregate }) {
  switch (milestone.state) {
    case "PROPOSED":
      return <ProposedView milestone={milestone} />;
    case "ACCEPTED":
      return <AcceptedView />;
    case "ACTIVE":
      return <ActiveView milestone={milestone} />;
    case "RESULT_SUBMITTED":
      return <ResultSubmittedView milestone={milestone} />;
    case "BOUNDARY_REACHED":
      return <BoundaryReachedView milestone={milestone} />;
    case "CONTINUATION_PENDING":
      return <ContinuationPendingView milestone={milestone} />;
    case "VALIDATED":
      return <ValidatedView milestone={milestone} />;
    case "SETTLED":
      return <SettledView milestone={milestone} />;
    case "REFUSED":
      return <TerminalView message="This proposal was refused before any exposure existed." />;
    case "STOPPED":
      return <TerminalView message="The continuation was declined. The milestone stopped at its last accepted boundary." />;
    case "DRAFT":
      return null;
  }
}

function TerminalView({ message }: { message: string }) {
  return (
    <Card>
      <p className="text-sm text-ink-soft">{message}</p>
    </Card>
  );
}

function ProposedView({ milestone }: { milestone: MilestoneAggregate }) {
  const { role, acceptMilestone, cancelMilestone } = useStore();
  const terms = milestone.proposedTerms;
  const previewTerms: AcceptedTerms = { ...terms, acceptedAt: new Date().toISOString() };
  const exposure = calculateMaximumExposure(previewTerms);
  const centralBudget = calculateSettlement(previewTerms, terms.estimateDays).estimatedBudget;
  const acceptedByMe = role === "provider" ? milestone.acceptedByProvider : milestone.acceptedByClient;
  const acceptedByOther = role === "provider" ? milestone.acceptedByClient : milestone.acceptedByProvider;

  return (
    <Card>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <Stat label="Estimate" value={formatDays(terms.estimateDays)} />
        <Stat label="Central budget" value={formatMoney(centralBudget)} hint="reference, at T = M" />
        <Stat label="Maximum automatic exposure" value={formatMoney(exposure.maximumPayment)} tone="warn" />
        <Stat label="Automatic stop / revalidation" value={`at ${formatDays(terms.boundaryDays)}`} />
      </div>

      <p className="mt-6 text-sm leading-relaxed text-ink-soft">
        If work is completed faster, the economic benefit is shared. If work exceeds the estimate, the provider
        absorbs part of the overrun. No work beyond the boundary is automatically authorized.
      </p>

      <div className="mt-6 flex items-center gap-4 text-xs text-ink-faint">
        <span>Provider {milestone.acceptedByProvider ? "✓ accepted" : "— pending"}</span>
        <span>Client {milestone.acceptedByClient ? "✓ accepted" : "— pending"}</span>
      </div>

      <div className="mt-6 flex justify-end gap-3">
        {!acceptedByMe && (
          <Button
            variant="danger"
            onClick={() => {
              const reason = window.prompt("Reason for refusing (visible in the ledger):", "not a fit right now");
              if (reason !== null) cancelMilestone(milestone.milestoneId, reason);
            }}
          >
            Refuse
          </Button>
        )}
        {acceptedByMe ? (
          <span className="self-center text-sm text-ink-faint">Waiting for the other party to accept…</span>
        ) : (
          <Button variant="primary" onClick={() => acceptMilestone(milestone.milestoneId)}>
            Accept as {role}
          </Button>
        )}
      </div>
      {acceptedByOther && !acceptedByMe ? (
        <p className="mt-3 text-right text-xs text-good">The other party has already accepted.</p>
      ) : null}
    </Card>
  );
}

function AcceptedView() {
  return (
    <Card>
      <p className="text-sm text-ink-soft">Both parties have accepted. Activating…</p>
    </Card>
  );
}

function ActiveView({ milestone }: { milestone: MilestoneAggregate }) {
  const { role, recordEffort, submitResult, cancelMilestone } = useStore();
  const [days, setDays] = useState("0.5");
  const boundary = effectiveBoundaryDays(milestone);
  const fraction = boundary > 0 ? milestone.consumedEffortDays / boundary : 0;
  const settlementPreview = milestone.consumedEffortDays > 0 ? computeMilestoneSettlement(milestone) : null;

  return (
    <Card>
      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between text-sm">
          <span className="text-ink-soft">Effort used</span>
          <span className="tabular font-mono">
            {formatDays(milestone.consumedEffortDays)} / {formatDays(milestone.acceptedTerms!.estimateDays)} estimated
          </span>
        </div>
        <ProgressBar fraction={fraction} tone={fraction > 0.85 ? "warn" : "accent"} />
        <div className="flex items-baseline justify-between text-xs text-ink-faint">
          <span>Boundary {formatDays(boundary)}</span>
          <span>{formatPercent(fraction, 0)} consumed</span>
        </div>
      </div>

      {settlementPreview ? (
        <p className="mt-4 text-sm text-ink-soft">
          If settled right now: <span className="tabular font-mono text-ink">{formatMoney(settlementPreview.payment)}</span>
        </p>
      ) : null}

      {role === "provider" ? (
        <div className="mt-6 flex flex-wrap items-end gap-3 border-t border-line-2 pt-6">
          <TextField
            label="Record effort (days)"
            inputMode="decimal"
            value={days}
            onChange={(e) => setDays(e.target.value)}
            className="w-40"
          />
          <Button
            onClick={() => {
              const n = Number(days);
              if (Number.isFinite(n) && n > 0) recordEffort(milestone.milestoneId, n);
            }}
          >
            Record effort
          </Button>
          <div className="ml-auto">
            <Button variant="primary" onClick={() => submitResult(milestone.milestoneId)}>
              Submit result
            </Button>
          </div>
        </div>
      ) : (
        <p className="mt-6 border-t border-line-2 pt-6 text-sm text-ink-faint">
          Waiting on the provider to record effort and submit the result.
        </p>
      )}

      <div className="mt-4 flex justify-end">
        <Button
          variant="ghost"
          className="text-xs"
          onClick={() => {
            const reason = window.prompt("Reason for cancelling (visible in the ledger):");
            if (reason !== null) cancelMilestone(milestone.milestoneId, reason);
          }}
        >
          Cancel milestone
        </Button>
      </div>
    </Card>
  );
}

function ResultSubmittedView({ milestone }: { milestone: MilestoneAggregate }) {
  const { role, acceptResult, rejectResult } = useStore();
  return (
    <Card>
      <p className="text-sm text-ink-soft">
        The provider submitted the result after {formatDays(milestone.consumedEffortDays)} of recorded effort.
      </p>
      {role === "client" ? (
        <div className="mt-6 flex justify-end gap-3">
          <Button
            variant="danger"
            onClick={() => {
              const reason = window.prompt("Why isn't this result acceptable?", "doesn't meet the criterion");
              if (reason !== null) rejectResult(milestone.milestoneId, reason);
            }}
          >
            Reject
          </Button>
          <Button variant="primary" onClick={() => acceptResult(milestone.milestoneId)}>
            Accept result
          </Button>
        </div>
      ) : (
        <p className="mt-4 text-xs text-ink-faint">Waiting for the client to review the result.</p>
      )}
    </Card>
  );
}

function BoundaryReachedView({ milestone }: { milestone: MilestoneAggregate }) {
  const { role, proposeContinuation } = useStore();
  const [extra, setExtra] = useState("2");
  return (
    <Card>
      <p className="text-sm text-ink-soft">
        The boundary was reached at {formatDays(effectiveBoundaryDays(milestone))} without a validated result.
        Automatic exposure has stopped — nothing continues without a new bilateral acceptance.
      </p>
      {role === "provider" ? (
        <div className="mt-6 flex flex-wrap items-end gap-3 border-t border-line-2 pt-6">
          <TextField
            label="Propose additional days"
            inputMode="decimal"
            value={extra}
            onChange={(e) => setExtra(e.target.value)}
            className="w-40"
          />
          <Button
            variant="primary"
            onClick={() => {
              const n = Number(extra);
              if (Number.isFinite(n) && n > 0) proposeContinuation(milestone.milestoneId, n);
            }}
          >
            Propose continuation
          </Button>
        </div>
      ) : (
        <p className="mt-4 text-xs text-ink-faint">Waiting for the provider to propose a bounded continuation.</p>
      )}
    </Card>
  );
}

function ContinuationPendingView({ milestone }: { milestone: MilestoneAggregate }) {
  const { role, acceptContinuation, stopContinuation } = useStore();
  const pending = milestone.pendingContinuation!;
  return (
    <Card>
      <p className="text-sm text-ink-soft">
        The provider proposed <span className="tabular font-mono text-ink">+{formatDays(pending.additionalDays)}</span> of
        additional bounded exposure.
      </p>
      {role === "client" ? (
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="danger" onClick={() => stopContinuation(milestone.milestoneId)}>
            Decline &amp; stop
          </Button>
          <Button variant="primary" onClick={() => acceptContinuation(milestone.milestoneId)}>
            Accept continuation
          </Button>
        </div>
      ) : (
        <p className="mt-4 text-xs text-ink-faint">Waiting for the client to accept or decline.</p>
      )}
    </Card>
  );
}

function ValidatedView({ milestone }: { milestone: MilestoneAggregate }) {
  const { settleMilestone } = useStore();
  const settlement = computeMilestoneSettlement(milestone);
  return (
    <Card>
      <p className="text-sm text-ink-soft">Result validated. Ready to settle.</p>
      <div className="mt-4 grid grid-cols-2 gap-4">
        <Stat label="Actual effort" value={formatDays(milestone.consumedEffortDays)} />
        <Stat label="Settlement" value={formatMoney(settlement.payment)} tone="good" />
      </div>
      <div className="mt-6 flex justify-end">
        <Button variant="primary" onClick={() => settleMilestone(milestone.milestoneId)}>
          Mark settled
        </Button>
      </div>
    </Card>
  );
}

function SettledView({ milestone }: { milestone: MilestoneAggregate }) {
  const { excludeFromCalibration } = useStore();
  const settlement = computeMilestoneSettlement(milestone);
  const terms = milestone.acceptedTerms!;
  const faster = milestone.consumedEffortDays < terms.estimateDays;

  return (
    <Card>
      <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
        <Stat label="Estimated effort" value={formatDays(terms.estimateDays)} />
        <Stat label="Actual effort" value={formatDays(milestone.consumedEffortDays)} />
        <Stat label="Reference budget" value={formatMoney(settlement.estimatedBudget)} />
        <Stat label="Final settlement" value={formatMoney(settlement.payment)} tone="good" />
      </div>

      <p className="mt-6 text-sm leading-relaxed text-ink-soft">
        {faster
          ? "Completed faster than estimated. The economic benefit was shared according to the calibration policy frozen when this milestone was accepted."
          : milestone.consumedEffortDays > terms.estimateDays
            ? "Completed slower than estimated. The provider absorbed part of the overrun, according to the calibration policy frozen when this milestone was accepted."
            : "Completed exactly on estimate."}
      </p>

      <div className="mt-6">
        <Disclosure summary="How was this calculated?">
          <dl className="tabular grid grid-cols-2 gap-y-2 font-mono text-xs text-ink-soft">
            <dt>Equation</dt>
            <dd className="text-right text-ink">P(T) = r[M + β(T − M)]</dd>
            <dt>r (reference rate)</dt>
            <dd className="text-right text-ink">{formatMoney(terms.referenceRate)}</dd>
            <dt>M (estimate)</dt>
            <dd className="text-right text-ink">{formatDays(terms.estimateDays)}</dd>
            <dt>T (actual effort)</dt>
            <dd className="text-right text-ink">{formatDays(milestone.consumedEffortDays)}</dd>
            <dt>β (deviation sharing)</dt>
            <dd className="text-right text-ink">
              {terms.beta.toFixed(3)} ({terms.betaPolicyVersion})
            </dd>
            <dt>Time &amp; materials equivalent (rT)</dt>
            <dd className="text-right text-ink">{formatMoney(settlement.timeAndMaterialsEquivalent)}</dd>
            <dt>Client delta vs. estimate</dt>
            <dd className="text-right text-ink">{formatMoney(settlement.clientDeltaVsEstimate)}</dd>
            <dt>Provider delta vs. T&amp;M</dt>
            <dd className="text-right text-ink">{formatMoney(settlement.providerDeltaVsTimeAndMaterials)}</dd>
            <dt>Effective daily rate paid</dt>
            <dd className="text-right text-ink">{formatMoney(settlement.effectiveDailyRate)}</dd>
            <dt>Accepted</dt>
            <dd className="text-right text-ink">{formatDateTime(terms.acceptedAt)}</dd>
          </dl>
        </Disclosure>
      </div>

      <div className="mt-6 flex items-center justify-between border-t border-line-2 pt-6">
        {milestone.calibrationExclusion ? (
          <p className="text-xs text-ink-faint">
            Excluded from calibration — {milestone.calibrationExclusion.reason}
          </p>
        ) : (
          <Button
            variant="ghost"
            className="text-xs"
            onClick={() => {
              const reason = window.prompt(
                "Why should this observation be excluded from calibration? (e.g. external scope change)"
              );
              if (reason) excludeFromCalibration(milestone.milestoneId, reason);
            }}
          >
            Exclude from calibration history
          </Button>
        )}
      </div>
    </Card>
  );
}
