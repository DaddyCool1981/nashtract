/**
 * SPEC.md §16.E — Genuine productivity improvement. Start calibrated,
 * then permanently reduce T/M (the provider got faster, but keeps
 * quoting the old estimate). Beta should react only once enough
 * evidence has accumulated — not on the very next milestone. Then the
 * provider recalibrates future M downward until T/M is back near 1;
 * beta should drift back toward 0.5.
 *
 * Note (documented, not hidden — SPEC.md §21): this implementation's
 * Normal-Inverse-Gamma posterior accumulates evidence over the whole
 * eligible history with no forgetting/windowing (SPEC.md §8 does not
 * specify one). So "recovery toward neutral" here means the posterior
 * mean is progressively pulled toward the new, well-calibrated data as
 * it accumulates — not an instant reset. That is a real, load-bearing
 * characteristic of this V1 policy, not a simulation artifact.
 */
import type { MilestoneSpec } from "../simulations/engine.js";

export const NARRATIVE =
  "Phase 1: calibrated (T/M = 1). Phase 2: the provider gets genuinely faster " +
  "(T/M = 0.7) but keeps quoting the old estimate. Phase 3: the provider " +
  "recalibrates the estimate itself, so T/M returns to ~1 under the new, " +
  "smaller M.";

export const BASE_ESTIMATE_DAYS = 5;
export const IMPROVED_RATIO = 0.7;
export const CALIBRATED_COUNT = 10;
export const IMPROVED_COUNT = 15;
export const RECALIBRATED_COUNT = 15;

export type ProductivityScenario = {
  readonly specs: readonly MilestoneSpec[];
  /** Index of the last Phase 1 (calibrated) step. */
  readonly endOfCalibratedPhase: number;
  /** Index of the last Phase 2 (improved-but-unquoted) step — this is the recalibration point for §17's recovery metric. */
  readonly endOfImprovedPhase: number;
};

export function buildScenario(): ProductivityScenario {
  const calibrated: MilestoneSpec[] = Array.from({ length: CALIBRATED_COUNT }, (_, i) => ({
    estimateDays: BASE_ESTIMATE_DAYS,
    actualRatio: 1,
    label: `E.calibrated.${i}`,
  }));
  const improved: MilestoneSpec[] = Array.from({ length: IMPROVED_COUNT }, (_, i) => ({
    estimateDays: BASE_ESTIMATE_DAYS, // estimate NOT yet adjusted
    actualRatio: IMPROVED_RATIO,
    label: `E.improved.${i}`,
  }));
  const recalibrated: MilestoneSpec[] = Array.from({ length: RECALIBRATED_COUNT }, (_, i) => ({
    estimateDays: BASE_ESTIMATE_DAYS * IMPROVED_RATIO, // provider now quotes tighter
    actualRatio: 1, // and delivers on it: T/M back to ~1
    label: `E.recalibrated.${i}`,
  }));

  return {
    specs: [...calibrated, ...improved, ...recalibrated],
    endOfCalibratedPhase: calibrated.length - 1,
    endOfImprovedPhase: calibrated.length + improved.length - 1,
  };
}
