/**
 * The simulation engine every scenario in `research/scenarios/` runs
 * on. It drives a real `@nashtract/ledger` project through its actual
 * event lifecycle (propose, bilateral accept, activate, record effort,
 * submit/accept result, settle) via the real `@nashtract/core` math —
 * there is no separate "simulation model" of the settlement equation
 * that could quietly drift from the implementation under test.
 *
 * Beta for milestone i is decided from `deriveEligibleCalibrationHistory`
 * computed *before* milestone i is proposed, preserving the no-look-ahead
 * invariant (SPEC.md §8) structurally: milestone i's own outcome cannot
 * exist yet when its beta is chosen.
 */

import {
  calculateCalibrationObservation,
  Money,
  type BetaPolicy,
  type MoneyAmount,
} from "@nashtract/core";
import {
  InMemoryLedgerStore,
  deriveEligibleCalibrationHistory,
  computeMilestoneSettlement,
  effectiveBoundaryDays,
  replayProject,
  type ProjectState,
} from "@nashtract/ledger";

const PROVIDER = "provider-1";
const CLIENT = "client-1";
const SYSTEM = "system";

export type MilestoneSpec = {
  /** Central effort estimate (M), in effort-days. */
  readonly estimateDays: number;
  /** Initial exposure boundary (U), in effort-days. Defaults to estimateDays * 3 if omitted. */
  readonly boundaryDays?: number;
  /** Actual effort as a multiple of estimateDays — e.g. 0.75 means T = 0.75 * M. */
  readonly actualRatio: number;
  /** If set, the settled milestone is declared out-of-scope and excluded from calibration. */
  readonly excludeFromCalibration?: { readonly reason: string };
  /** Free-form label carried onto the step record, for readable reports. */
  readonly label?: string;
};

export type StepRecord = {
  readonly index: number;
  readonly label?: string;
  readonly milestoneId: string;
  readonly estimateDays: number;
  readonly boundaryDays: number;
  readonly actualDays: number;
  readonly continuationsUsed: number;
  readonly beta: number;
  readonly betaPolicyVersion: string;
  readonly eligibleObservationsAtDecision: number;
  readonly excludedFromCalibration: boolean;
  readonly logError: number;
  readonly payment: MoneyAmount;
  readonly estimatedBudget: MoneyAmount;
  readonly timeAndMaterialsEquivalent: MoneyAmount;
  readonly clientDeltaVsEstimate: MoneyAmount;
  readonly providerDeltaVsTimeAndMaterials: MoneyAmount;
  readonly clientDeltaVsTimeAndMaterials: MoneyAmount;
};

export type SimulationResult = {
  readonly policyVersion: string;
  readonly referenceRate: MoneyAmount;
  readonly steps: readonly StepRecord[];
  readonly finalState: ProjectState;
};

export type SimulateOptions = {
  readonly policy: BetaPolicy;
  readonly specs: readonly MilestoneSpec[];
  readonly referenceRate?: MoneyAmount;
  readonly projectId?: string;
};

const DEFAULT_RATE = Money.money("1500", "EUR");
const DEFAULT_BOUNDARY_MULTIPLIER = 3;

export function simulateMilestoneSeries(options: SimulateOptions): SimulationResult {
  const referenceRate = options.referenceRate ?? DEFAULT_RATE;
  const projectId = options.projectId ?? `sim-${Math.random().toString(36).slice(2)}`;
  const store = new InMemoryLedgerStore();
  let clock = Date.parse("2026-01-01T00:00:00.000Z");
  const nextTimestamp = () => new Date((clock += 86_400_000)).toISOString();

  store.append({
    projectId,
    eventType: "ProjectCreated",
    payload: { projectId, referenceRate },
    occurredAt: nextTimestamp(),
    actorId: PROVIDER,
  });

  const steps: StepRecord[] = [];
  let policyVersion = options.policy.version;

  options.specs.forEach((spec, index) => {
    const stateBefore = replayProject(store.list(projectId));
    const history = deriveEligibleCalibrationHistory(stateBefore);
    const decision = options.policy.decide(history);
    policyVersion = decision.policyVersion;

    const milestoneId = `${projectId}-m${index}`;
    const boundaryDays = spec.boundaryDays ?? spec.estimateDays * DEFAULT_BOUNDARY_MULTIPLIER;
    const actualDays = spec.estimateDays * spec.actualRatio;

    store.append({
      projectId,
      milestoneId,
      eventType: "MilestoneProposed",
      payload: {
        milestoneId,
        projectId,
        result: { description: spec.label ?? `Simulated milestone ${index}` },
        estimateDays: spec.estimateDays,
        boundaryDays,
        referenceRate,
        beta: decision.beta,
        betaPolicyVersion: decision.policyVersion,
      },
      occurredAt: nextTimestamp(),
      actorId: PROVIDER,
    });
    store.append({
      projectId,
      milestoneId,
      eventType: "MilestoneAcceptedByProvider",
      payload: { milestoneId },
      occurredAt: nextTimestamp(),
      actorId: PROVIDER,
    });
    store.append({
      projectId,
      milestoneId,
      eventType: "MilestoneAcceptedByClient",
      payload: { milestoneId },
      occurredAt: nextTimestamp(),
      actorId: CLIENT,
    });
    store.append({
      projectId,
      milestoneId,
      eventType: "MilestoneActivated",
      payload: { milestoneId },
      occurredAt: nextTimestamp(),
      actorId: SYSTEM,
    });

    // Record effort, transparently handling boundary/continuation
    // rounds if actualDays exceeds the then-current effective boundary
    // (SPEC.md §5: nothing beyond U is ever automatic — every round
    // here is an explicit, bilaterally-accepted continuation).
    let remaining = actualDays;
    let continuationsUsed = 0;
    for (;;) {
      const current = replayProject(store.list(projectId)).milestones.get(milestoneId)!;
      const headroom = effectiveBoundaryDays(current) - current.consumedEffortDays;
      const toRecord = Math.min(remaining, headroom);
      if (toRecord > 0) {
        store.append({
          projectId,
          milestoneId,
          eventType: "EffortRecorded",
          payload: { milestoneId, days: toRecord },
          occurredAt: nextTimestamp(),
          actorId: PROVIDER,
        });
        remaining -= toRecord;
      }
      if (remaining <= 1e-9) break;

      store.append({
        projectId,
        milestoneId,
        eventType: "BoundaryReached",
        payload: { milestoneId },
        occurredAt: nextTimestamp(),
        actorId: SYSTEM,
      });
      const additional = remaining; // "just enough" continuation to finish
      store.append({
        projectId,
        milestoneId,
        eventType: "ContinuationProposed",
        payload: { milestoneId, additionalBoundaryDays: additional },
        occurredAt: nextTimestamp(),
        actorId: PROVIDER,
      });
      store.append({
        projectId,
        milestoneId,
        eventType: "ContinuationAccepted",
        payload: { milestoneId },
        occurredAt: nextTimestamp(),
        actorId: CLIENT,
      });
      continuationsUsed += 1;
    }

    store.append({
      projectId,
      milestoneId,
      eventType: "ResultSubmitted",
      payload: { milestoneId },
      occurredAt: nextTimestamp(),
      actorId: PROVIDER,
    });
    store.append({
      projectId,
      milestoneId,
      eventType: "ResultAccepted",
      payload: { milestoneId },
      occurredAt: nextTimestamp(),
      actorId: CLIENT,
    });
    store.append({
      projectId,
      milestoneId,
      eventType: "MilestoneSettled",
      payload: { milestoneId },
      occurredAt: nextTimestamp(),
      actorId: SYSTEM,
    });

    if (spec.excludeFromCalibration) {
      store.append({
        projectId,
        milestoneId,
        eventType: "ScopeChangeDeclared",
        payload: { milestoneId, reason: spec.excludeFromCalibration.reason },
        occurredAt: nextTimestamp(),
        actorId: PROVIDER,
      });
      store.append({
        projectId,
        milestoneId,
        eventType: "CalibrationExcluded",
        payload: { milestoneId, reason: spec.excludeFromCalibration.reason },
        occurredAt: nextTimestamp(),
        actorId: PROVIDER,
      });
    }

    const settledState = replayProject(store.list(projectId));
    const milestone = settledState.milestones.get(milestoneId)!;
    const settlement = computeMilestoneSettlement(milestone);
    const observation = calculateCalibrationObservation(spec.estimateDays, actualDays);

    steps.push({
      index,
      ...(spec.label !== undefined ? { label: spec.label } : {}),
      milestoneId,
      estimateDays: spec.estimateDays,
      boundaryDays,
      actualDays,
      continuationsUsed,
      beta: decision.beta,
      betaPolicyVersion: decision.policyVersion,
      eligibleObservationsAtDecision: history.length,
      excludedFromCalibration: Boolean(spec.excludeFromCalibration),
      logError: observation.logError,
      payment: settlement.payment,
      estimatedBudget: settlement.estimatedBudget,
      timeAndMaterialsEquivalent: settlement.timeAndMaterialsEquivalent,
      clientDeltaVsEstimate: settlement.clientDeltaVsEstimate,
      providerDeltaVsTimeAndMaterials: settlement.providerDeltaVsTimeAndMaterials,
      clientDeltaVsTimeAndMaterials: Money.subtract(settlement.timeAndMaterialsEquivalent, settlement.payment),
    });
  });

  return {
    policyVersion,
    referenceRate,
    steps,
    finalState: replayProject(store.list(projectId)),
  };
}
