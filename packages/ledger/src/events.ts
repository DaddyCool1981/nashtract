/**
 * Domain events (SPEC.md §11). Each payload is intentionally minimal —
 * the ledger stores facts, not derived state. `MilestoneSettled`, for
 * instance, does not carry a computed `Settlement`: replay recomputes
 * it deterministically from `@nashtract/core` given the frozen terms
 * and the accumulated effort, which is the single source of truth for
 * the settlement math (SPEC.md §13) and avoids a stored figure ever
 * going stale relative to the code that produced it.
 */

import type { AcceptedTerms, MoneyAmount, ResultDefinition } from "@nashtract/core";

export type ProjectCreated = {
  readonly projectId: string;
  readonly referenceRate: MoneyAmount;
};

/**
 * Proposes a milestone. `beta`/`betaPolicyVersion` are computed by a
 * `BetaPolicy` from ledger history *before* this event is created
 * (SPEC.md §8's no-look-ahead invariant) and are carried here so that,
 * once bilaterally accepted, they freeze exactly as proposed — nothing
 * about acceptance can change them.
 *
 * `linkedPredecessorMilestoneId` is optional traceability for the
 * "result materially changed, new independent milestone" case
 * (SPEC.md §10) — it does not affect settlement math or calibration.
 */
export type MilestoneProposed = {
  readonly milestoneId: string;
  readonly projectId: string;
  readonly result: ResultDefinition;
  readonly estimateDays: number;
  readonly boundaryDays: number;
  readonly referenceRate: MoneyAmount;
  readonly beta: number;
  readonly betaPolicyVersion: string;
  readonly linkedPredecessorMilestoneId?: string;
};

export type MilestoneAcceptedByProvider = {
  readonly milestoneId: string;
};

export type MilestoneAcceptedByClient = {
  readonly milestoneId: string;
};

/** Appended once bilateral acceptance is established; moves ACCEPTED -> ACTIVE. */
export type MilestoneActivated = {
  readonly milestoneId: string;
};

/** An increment of effort (not cumulative). */
export type EffortRecorded = {
  readonly milestoneId: string;
  readonly days: number;
};

export type ResultSubmitted = {
  readonly milestoneId: string;
};

export type ResultAccepted = {
  readonly milestoneId: string;
};

export type ResultRejected = {
  readonly milestoneId: string;
  readonly reason: string;
};

/** Recorded when consumed effort reaches the (effective) boundary without a validated result. */
export type BoundaryReached = {
  readonly milestoneId: string;
};

/**
 * Proposes bounded additional exposure on the *same* milestone whose
 * boundary was reached (SPEC.md §5, §10, §12: the state diagram loops
 * BOUNDARY_REACHED -> CONTINUATION_PENDING -> ACTIVE on one milestone,
 * not a new one). `additionalBoundaryDays` extends the effective U;
 * the original `estimateDays`/`boundaryDays`/`beta` are never mutated
 * (SPEC.md §10: "MUST NOT erase original M, consumed effort, original
 * beta, boundary event or history").
 */
export type ContinuationProposed = {
  readonly milestoneId: string;
  readonly additionalBoundaryDays: number;
};

export type ContinuationAccepted = {
  readonly milestoneId: string;
};

/**
 * Declares an external, material scope change (SPEC.md §9). This by
 * itself does not exclude the milestone from calibration — it is a
 * documented fact. Exclusion is a separate, explicit `CalibrationExcluded`.
 */
export type ScopeChangeDeclared = {
  readonly milestoneId: string;
  readonly reason: string;
};

/**
 * Explicitly excludes a settled milestone's observation from the
 * calibration posterior (SPEC.md §9). The observation itself is never
 * deleted — only flagged. Exclusion MUST be visible to both parties;
 * `deriveEligibleCalibrationHistory` (calibration.ts) reflects this.
 */
export type CalibrationExcluded = {
  readonly milestoneId: string;
  readonly reason: string;
};

export type MilestoneSettled = {
  readonly milestoneId: string;
};

export type MilestoneCancelled = {
  readonly milestoneId: string;
  readonly reason: string;
};

export type NashTractEventPayloadMap = {
  ProjectCreated: ProjectCreated;
  MilestoneProposed: MilestoneProposed;
  MilestoneAcceptedByProvider: MilestoneAcceptedByProvider;
  MilestoneAcceptedByClient: MilestoneAcceptedByClient;
  MilestoneActivated: MilestoneActivated;
  EffortRecorded: EffortRecorded;
  ResultSubmitted: ResultSubmitted;
  ResultAccepted: ResultAccepted;
  ResultRejected: ResultRejected;
  BoundaryReached: BoundaryReached;
  ContinuationProposed: ContinuationProposed;
  ContinuationAccepted: ContinuationAccepted;
  ScopeChangeDeclared: ScopeChangeDeclared;
  CalibrationExcluded: CalibrationExcluded;
  MilestoneSettled: MilestoneSettled;
  MilestoneCancelled: MilestoneCancelled;
};

export type NashTractEventType = keyof NashTractEventPayloadMap;

/** A discriminated union over every domain event, tagged by `eventType`. */
export type NashTractEvent = {
  [K in NashTractEventType]: { readonly eventType: K; readonly payload: NashTractEventPayloadMap[K] };
}[NashTractEventType];

// Re-exported so `AcceptedTerms` derivation in replay.ts has a name for
// "the subset of AcceptedTerms known at proposal time, before acceptedAt exists".
export type ProposedTerms = Omit<AcceptedTerms, "acceptedAt">;
