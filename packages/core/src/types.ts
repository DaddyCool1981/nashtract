import type { Money } from "./money.js";

/**
 * The objectively verifiable acceptance criterion for a milestone.
 * Core deliberately does not model *how* a result is verified —
 * semantic acceptance automation is out of scope (SPEC.md §2).
 */
export type ResultDefinition = {
  readonly description: string;
};

/**
 * Terms frozen at bilateral acceptance (SPEC.md §6). After acceptance
 * these MUST NOT mutate — every function in this package treats
 * `AcceptedTerms` as an immutable value and returns new values rather
 * than mutating.
 */
export type AcceptedTerms = {
  readonly result: ResultDefinition;
  /** M: provider's central effort estimate, in effort-days. Not a guarantee. */
  readonly estimateDays: number;
  /** U: maximum effort authorized before automatic exposure stops, in effort-days. */
  readonly boundaryDays: number;
  /** r: reference rate per effort-day. */
  readonly referenceRate: Money;
  /** β: deviation-sharing factor, in [0, 1]. */
  readonly beta: number;
  readonly betaPolicyVersion: string;
  /** ISO 8601 timestamp. */
  readonly acceptedAt: string;
};

export type Settlement = {
  readonly payment: Money;
  readonly actualDays: number;
  readonly effectiveDailyRate: Money;
  readonly estimatedBudget: Money;
  readonly timeAndMaterialsEquivalent: Money;
  readonly clientDeltaVsEstimate: Money;
  readonly providerDeltaVsTimeAndMaterials: Money;
  readonly beta: number;
};

/**
 * Maximum automatic exposure for a milestone, computable before
 * execution starts (SPEC.md §5). `providerProxyExposure` is explanatory
 * — a model property under the reference-cost convention `c = r` — not
 * an accounting figure.
 */
export type Exposure = {
  readonly maximumPayment: Money;
  readonly providerProxyExposure: Money;
  readonly boundaryDays: number;
};

/** SPEC.md §7: a single milestone's log-error calibration signal. */
export type CalibrationObservation = {
  readonly estimateDays: number;
  readonly actualDays: number;
  /** e = ln(T / M). 0 = calibrated, <0 = overestimated, >0 = underestimated. */
  readonly logError: number;
};

/** A calibration observation admitted into the eligible history (SPEC.md §9). */
export type EligibleCalibrationObservation = CalibrationObservation & {
  readonly milestoneId: string;
};

/** Output of a beta policy decision (SPEC.md §8). Defined here so Core's */
/** BetaPolicy interface can reference it without depending on adaptive-beta. */
export type BetaDecision = {
  readonly beta: number;
  readonly policyVersion: string;
  readonly eligibleObservations: number;
};

/**
 * A pluggable beta policy. `@nashtract/core` ships no implementation —
 * fixed beta is just "always return the same BetaDecision" — adaptive
 * policies live in `@nashtract/adaptive-beta` (SPEC.md §8, §13).
 */
export interface BetaPolicy {
  readonly version: string;
  decide(history: readonly EligibleCalibrationObservation[]): BetaDecision;
}
