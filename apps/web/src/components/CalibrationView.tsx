"use client";

import { FixedBetaPolicy, type BetaPolicy } from "@nashtract/core";
import { deriveCalibrationHistory, deriveEligibleCalibrationHistory, type ProjectState } from "@nashtract/ledger";
import { AdaptiveBetaPolicyV1, type AdaptiveBetaDecision } from "@nashtract/adaptive-beta";
import { useStore } from "@/lib/store";
import { formatDays, formatPercent } from "@/lib/format";
import { Card } from "./ui/Card";
import { Disclosure } from "./ui/Disclosure";
import { Stat } from "./ui/Stat";

export function CalibrationView({ project }: { project: ProjectState }) {
  const { adaptiveBetaEnabled, setAdaptiveBetaEnabled } = useStore();
  const history = deriveCalibrationHistory(project);
  const eligible = deriveEligibleCalibrationHistory(project);

  const fixedDecision = new FixedBetaPolicy().decide(eligible);
  const adaptivePolicy: BetaPolicy = new AdaptiveBetaPolicyV1();
  const adaptiveDecision = adaptivePolicy.decide(eligible) as AdaptiveBetaDecision;
  const activeDecision = adaptiveBetaEnabled ? adaptiveDecision : fixedDecision;

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Calibration</h2>
            <p className="mt-1 text-sm text-ink-soft">
              Secondary information — this never scores honesty, trust, or competence. It only tracks whether
              estimates have a persistent, statistically significant direction of error.
            </p>
          </div>
          <label className="flex shrink-0 items-center gap-2 text-xs text-ink-soft">
            <input
              type="checkbox"
              checked={adaptiveBetaEnabled}
              onChange={(e) => setAdaptiveBetaEnabled(e.target.checked)}
              className="accent-accent"
            />
            Experimental: adaptive β
          </label>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-6 sm:grid-cols-4">
          <Stat label="Eligible milestones" value={eligible.length} />
          <Stat
            label="Estimated effort total"
            value={formatDays(eligible.reduce((s, o) => s + o.estimateDays, 0))}
          />
          <Stat label="Actual effort total" value={formatDays(eligible.reduce((s, o) => s + o.actualDays, 0))} />
          <Stat
            label="Current sharing factor"
            value={`${formatPercent(activeDecision.beta, 0)} / ${formatPercent(1 - activeDecision.beta, 0)}`}
            hint={adaptiveBetaEnabled ? adaptiveDecision.policyVersion : fixedDecision.policyVersion}
          />
        </div>

        <p className="mt-4 text-sm text-ink-soft">{evidenceSentence(activeDecision.beta, eligible.length)}</p>

        {adaptiveBetaEnabled ? (
          <div className="mt-6">
            <Disclosure summary="Expandable technical details">
              <dl className="tabular grid grid-cols-2 gap-y-2 font-mono text-xs text-ink-soft">
                <dt>Posterior mean log-error</dt>
                <dd className="text-right text-ink">{adaptiveDecision.posteriorMeanLogError.toFixed(4)}</dd>
                <dt>Posterior std log-error</dt>
                <dd className="text-right text-ink">{adaptiveDecision.posteriorStdLogError.toFixed(4)}</dd>
                <dt>P(overestimating)</dt>
                <dd className="text-right text-ink">{formatPercent(adaptiveDecision.probabilityOverestimating, 1)}</dd>
                <dt>P(underestimating)</dt>
                <dd className="text-right text-ink">{formatPercent(adaptiveDecision.probabilityUnderestimating, 1)}</dd>
                <dt>Equivalence margin (ε)</dt>
                <dd className="text-right text-ink">±{formatPercent(Math.expm1(adaptiveDecision.equivalenceMargin), 0)}</dd>
                <dt>Eligible observations</dt>
                <dd className="text-right text-ink">{adaptiveDecision.eligibleObservations}</dd>
                <dt>Policy version</dt>
                <dd className="text-right text-ink">{adaptiveDecision.policyVersion}</dd>
              </dl>
            </Disclosure>
          </div>
        ) : null}
      </Card>

      <Card>
        <h3 className="text-sm font-medium text-ink-soft">History</h3>
        {history.length === 0 ? (
          <p className="mt-3 text-sm text-ink-faint">No settled milestones yet.</p>
        ) : (
          <table className="tabular mt-4 w-full border-collapse text-left font-mono text-xs">
            <thead>
              <tr className="text-ink-faint">
                <th className="border-b border-line-2 pb-2 font-normal">Estimate</th>
                <th className="border-b border-line-2 pb-2 font-normal">Actual</th>
                <th className="border-b border-line-2 pb-2 font-normal">Log-error</th>
                <th className="border-b border-line-2 pb-2 font-normal">Status</th>
              </tr>
            </thead>
            <tbody>
              {history.map((entry) => (
                <tr key={entry.milestoneId} className="text-ink-soft">
                  <td className="border-b border-line-2 py-2">{formatDays(entry.estimateDays)}</td>
                  <td className="border-b border-line-2 py-2">{formatDays(entry.actualDays)}</td>
                  <td className="border-b border-line-2 py-2">{entry.logError.toFixed(3)}</td>
                  <td className="border-b border-line-2 py-2">
                    {entry.eligible ? (
                      <span className="text-good">eligible</span>
                    ) : (
                      <span className="text-warn" title={entry.exclusionReason}>
                        excluded — {entry.exclusionReason}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

function evidenceSentence(beta: number, n: number): string {
  if (n === 0) return "No calibration evidence yet.";
  if (Math.abs(beta - 0.5) < 0.05) return "No convincing bias — estimates look calibrated.";
  if (beta > 0.5) return "Estimates have recently tended to be higher than actual effort.";
  return "Estimates have recently tended to be lower than actual effort.";
}
