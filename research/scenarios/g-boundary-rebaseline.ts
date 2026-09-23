/**
 * SPEC.md §16.G — Boundary/rebaseline attack. Repeatedly hit U and
 * request continuation on the *same* milestone. Exposure must never
 * continue automatically, and lineage/history must never reset — an
 * attacker repeatedly "just asking for a bit more" cannot launder a
 * blown estimate into a fresh one.
 *
 * Driven directly with @nashtract/ledger primitives (not the generic
 * simulation engine) because it needs fine control over several
 * discrete continuation rounds on one milestone, not a series of
 * independent milestones.
 */
import { Money } from "@nashtract/core";
import {
  InMemoryLedgerStore,
  effectiveBoundaryDays,
  replayProject,
  type MilestoneAggregate,
} from "@nashtract/ledger";

export const NARRATIVE =
  "A provider blows through the boundary, gets a small bounded continuation, " +
  "blows through that too, and repeats several times. At every step the original " +
  "estimate, beta, and already-consumed effort must remain exactly what was " +
  "frozen at acceptance — only the effective boundary grows, by exactly the sum " +
  "of accepted extensions, never more.";

export const ESTIMATE_DAYS = 5;
export const INITIAL_BOUNDARY_DAYS = 6;
export const BETA = 0.5;
export const REFERENCE_RATE = Money.money("1500", "EUR");
export const CONTINUATION_ROUNDS = 4;
export const CONTINUATION_STEP_DAYS = 1;

export type RebaselineRoundSnapshot = {
  readonly round: number;
  readonly consumedEffortDays: number;
  readonly effectiveBoundaryDays: number;
  readonly acceptedEstimateDays: number;
  readonly acceptedBoundaryDays: number;
  readonly acceptedBeta: number;
};

export type RebaselineResult = {
  readonly snapshots: readonly RebaselineRoundSnapshot[];
  readonly rejectedOversizedEffortRecording: boolean;
  readonly finalMilestone: MilestoneAggregate;
};

/**
 * Forks the store's current envelopes into a throwaway store, appends
 * a wildly oversized EffortRecorded to it, and reports whether replay
 * rejects it — without ever touching the real `store`.
 */
function attemptOversizedEffortRecording(
  store: InMemoryLedgerStore,
  projectId: string,
  milestoneId: string
): boolean {
  const fork = new InMemoryLedgerStore();
  for (const envelope of store.list(projectId)) {
    fork.append({
      id: envelope.id,
      projectId: envelope.projectId,
      ...(envelope.milestoneId !== undefined ? { milestoneId: envelope.milestoneId } : {}),
      eventType: envelope.eventType,
      payload: envelope.payload,
      occurredAt: envelope.occurredAt,
      actorId: envelope.actorId,
    });
  }
  fork.append({
    projectId,
    milestoneId,
    eventType: "EffortRecorded",
    payload: { milestoneId, days: 100 },
    occurredAt: new Date().toISOString(),
    actorId: "provider-1",
  });
  try {
    replayProject(fork.list(projectId));
    return false; // it was NOT rejected — the attack would have succeeded
  } catch {
    return true;
  }
}

export function runBoundaryRebaselineAttack(): RebaselineResult {
  const projectId = "g-attack";
  const milestoneId = "g-attack-m0";
  const store = new InMemoryLedgerStore();
  let clock = Date.parse("2026-01-01T00:00:00.000Z");
  const nextTimestamp = () => new Date((clock += 86_400_000)).toISOString();
  const append = (
    eventType: string,
    payload: Record<string, unknown>,
    actorId: string,
    milestone = true
  ) =>
    store.append({
      projectId,
      ...(milestone ? { milestoneId } : {}),
      eventType: eventType as never,
      payload: payload as never,
      occurredAt: nextTimestamp(),
      actorId,
    });

  append("ProjectCreated", { projectId, referenceRate: REFERENCE_RATE }, "provider-1", false);
  append(
    "MilestoneProposed",
    {
      milestoneId,
      projectId,
      result: { description: "Boundary/rebaseline attack target" },
      estimateDays: ESTIMATE_DAYS,
      boundaryDays: INITIAL_BOUNDARY_DAYS,
      referenceRate: REFERENCE_RATE,
      beta: BETA,
      betaPolicyVersion: "fixed-beta-v0",
    },
    "provider-1"
  );
  append("MilestoneAcceptedByProvider", { milestoneId }, "provider-1");
  append("MilestoneAcceptedByClient", { milestoneId }, "client-1");
  append("MilestoneActivated", { milestoneId }, "system");

  const snapshots: RebaselineRoundSnapshot[] = [];
  const snapshot = (round: number) => {
    const m = replayProject(store.list(projectId)).milestones.get(milestoneId)!;
    snapshots.push({
      round,
      consumedEffortDays: m.consumedEffortDays,
      effectiveBoundaryDays: effectiveBoundaryDays(m),
      acceptedEstimateDays: m.acceptedTerms!.estimateDays,
      acceptedBoundaryDays: m.acceptedTerms!.boundaryDays,
      acceptedBeta: m.acceptedTerms!.beta,
    });
  };

  // Round 0: consume exactly up to the initial boundary.
  append("EffortRecorded", { milestoneId, days: INITIAL_BOUNDARY_DAYS }, "provider-1");
  append("BoundaryReached", { milestoneId }, "system");
  snapshot(0);

  // Attack attempt (round 1 only, replayed on a throwaway fork so a
  // rejected event never poisons the real ledger driving the rest of
  // this scenario — InMemoryLedgerStore.append itself does no business
  // validation at all, only replayProject does, so this is the correct
  // way to "try before you commit").
  const attemptRejected = attemptOversizedEffortRecording(store, projectId, milestoneId);

  for (let round = 1; round <= CONTINUATION_ROUNDS; round++) {
    append("ContinuationProposed", { milestoneId, additionalBoundaryDays: CONTINUATION_STEP_DAYS }, "provider-1");
    append("ContinuationAccepted", { milestoneId }, "client-1");
    append("EffortRecorded", { milestoneId, days: CONTINUATION_STEP_DAYS }, "provider-1");
    if (round < CONTINUATION_ROUNDS) {
      append("BoundaryReached", { milestoneId }, "system");
    }
    snapshot(round);
  }

  append("ResultSubmitted", { milestoneId }, "provider-1");
  append("ResultAccepted", { milestoneId }, "client-1");
  append("MilestoneSettled", { milestoneId }, "system");

  const finalMilestone = replayProject(store.list(projectId)).milestones.get(milestoneId)!;

  return { snapshots, rejectedOversizedEffortRecording: attemptRejected, finalMilestone };
}
