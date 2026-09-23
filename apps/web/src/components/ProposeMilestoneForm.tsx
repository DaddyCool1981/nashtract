"use client";

import { useMemo, useState, type FormEvent } from "react";
import {
  calculateMaximumExposure,
  calculateSettlement,
  FixedBetaPolicy,
  type AcceptedTerms,
  type BetaPolicy,
  type MoneyAmount,
} from "@nashtract/core";
import { deriveEligibleCalibrationHistory } from "@nashtract/ledger";
import { AdaptiveBetaPolicyV1 } from "@nashtract/adaptive-beta";
import { useStore } from "@/lib/store";
import { formatDays, formatMoney } from "@/lib/format";
import { Card } from "./ui/Card";
import { Button } from "./ui/Button";
import { TextField, TextAreaField } from "./ui/Field";
import { Stat } from "./ui/Stat";

type Preview = {
  beta: number;
  policyVersion: string;
  centralBudget: MoneyAmount;
  maximumExposure: MoneyAmount;
};

export function ProposeMilestoneForm({ onDone }: { onDone: () => void }) {
  const { project, proposeMilestone, adaptiveBetaEnabled } = useStore();
  const [description, setDescription] = useState("");
  const [estimateDays, setEstimateDays] = useState("5");
  const [boundaryDays, setBoundaryDays] = useState("8");
  const [error, setError] = useState<string | null>(null);

  const parsed = useMemo(() => {
    const m = Number(estimateDays);
    const u = Number(boundaryDays);
    if (!Number.isFinite(m) || !Number.isFinite(u) || m <= 0 || u < m) return null;
    return { m, u };
  }, [estimateDays, boundaryDays]);

  const preview = useMemo<Preview | null>(() => {
    if (!project || !parsed) return null;
    try {
      const history = deriveEligibleCalibrationHistory(project);
      const policy: BetaPolicy = adaptiveBetaEnabled ? new AdaptiveBetaPolicyV1() : new FixedBetaPolicy();
      const decision = policy.decide(history);
      const draftTerms: AcceptedTerms = {
        result: { description },
        estimateDays: parsed.m,
        boundaryDays: parsed.u,
        referenceRate: project.referenceRate,
        beta: decision.beta,
        betaPolicyVersion: decision.policyVersion,
        acceptedAt: new Date().toISOString(),
      };
      return {
        beta: decision.beta,
        policyVersion: decision.policyVersion,
        centralBudget: calculateSettlement(draftTerms, parsed.m).estimatedBudget,
        maximumExposure: calculateMaximumExposure(draftTerms).maximumPayment,
      };
    } catch {
      return null;
    }
  }, [project, parsed, description, adaptiveBetaEnabled]);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!description.trim()) {
      setError("Describe the expected, objectively verifiable result.");
      return;
    }
    if (!parsed) {
      setError("The boundary (U) must be at least the estimate (M), and both must be positive.");
      return;
    }
    proposeMilestone({ description: description.trim(), estimateDays: parsed.m, boundaryDays: parsed.u });
    onDone();
  }

  return (
    <Card>
      <h2 className="text-lg font-semibold tracking-tight">Propose a milestone</h2>
      <p className="mt-1 text-sm text-ink-soft">
        The result is an objective acceptance criterion, not a promise about how the work will be done.
      </p>
      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <TextAreaField
          label="Expected result"
          placeholder="Legacy synchronization API operational and passing agreed tests."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <div className="grid grid-cols-2 gap-4">
          <TextField
            label="Normal estimate (days)"
            inputMode="decimal"
            value={estimateDays}
            onChange={(e) => setEstimateDays(e.target.value)}
          />
          <TextField
            label="Automatic stop / revalidation (days)"
            inputMode="decimal"
            value={boundaryDays}
            onChange={(e) => setBoundaryDays(e.target.value)}
          />
        </div>

        {preview ? (
          <div className="grid grid-cols-1 gap-4 rounded-xl border border-line-2 bg-bg-2/60 p-4 sm:grid-cols-3">
            <Stat label="Central budget" value={formatMoney(preview.centralBudget)} />
            <Stat label="Maximum automatic exposure" value={formatMoney(preview.maximumExposure)} tone="warn" />
            <Stat label="Automatic revalidation" value={`at ${formatDays(parsed!.u)}`} />
          </div>
        ) : null}

        {error ? <p className="text-sm text-danger">{error}</p> : null}

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="ghost" onClick={onDone}>
            Cancel
          </Button>
          <Button type="submit" variant="primary">
            Propose milestone
          </Button>
        </div>
      </form>
    </Card>
  );
}
