/**
 * SPEC.md §16.D — Single extreme outlier. Mostly calibrated history
 * plus one T/M = 0.25 milestone, then separately one T/M = 4 milestone.
 * Beta must not react as though persistent bias were established.
 */
import type { MilestoneSpec } from "../simulations/engine.js";

export const NARRATIVE =
  "A calibrated provider has one wildly atypical milestone — once far too fast " +
  "(T/M = 0.25), once far too slow (T/M = 4) — surrounded by otherwise normal " +
  "estimates. A single surprise, however extreme, must not be treated as " +
  "persistent bias: adaptive beta should barely move.";

export const CALIBRATED_BEFORE = 15;
export const CALIBRATED_AFTER = 5;
export const BASE_ESTIMATE_DAYS = 5;

export function buildSpecs(outlierRatio: number): MilestoneSpec[] {
  const calibrated = (label: string): MilestoneSpec => ({
    estimateDays: BASE_ESTIMATE_DAYS,
    actualRatio: 1,
    label,
  });
  return [
    ...Array.from({ length: CALIBRATED_BEFORE }, (_, i) => calibrated(`D.before.${i}`)),
    {
      estimateDays: BASE_ESTIMATE_DAYS,
      boundaryDays: BASE_ESTIMATE_DAYS * Math.max(3, outlierRatio + 1),
      actualRatio: outlierRatio,
      label: "D.outlier",
    },
    ...Array.from({ length: CALIBRATED_AFTER }, (_, i) => calibrated(`D.after.${i}`)),
  ];
}

/** For comparison: the same length series, but the outlier is actually persistent. */
export function buildPersistentComparisonSpecs(ratio: number): MilestoneSpec[] {
  const total = CALIBRATED_BEFORE + 1 + CALIBRATED_AFTER;
  return Array.from({ length: total }, (_, i) => ({
    estimateDays: BASE_ESTIMATE_DAYS,
    boundaryDays: BASE_ESTIMATE_DAYS * Math.max(3, ratio + 1),
    actualRatio: ratio,
    label: `D.persistent.${i}`,
  }));
}
