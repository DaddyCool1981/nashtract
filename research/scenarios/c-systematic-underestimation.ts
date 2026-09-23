/**
 * SPEC.md §16.C — Systematic underestimation. Fixed T/M ratios 1.1,
 * 1.25, 1.5, 2 (the provider consistently under-quotes and overruns).
 * Measures the provider-absorbed overrun and the beta trajectory.
 */
import type { MilestoneSpec } from "../simulations/engine.js";

export const NARRATIVE =
  "A provider whose estimates are consistently too optimistic — every milestone " +
  "overruns by a fixed factor. Persistent underestimation (T > M) should push " +
  "adaptive beta toward 0 (fixed estimate), protecting the client from paying " +
  "full reference rate for every overrun (SPEC.md §1).";

export const RATIOS = [1.1, 1.25, 1.5, 2] as const;
export const OBSERVATIONS_PER_RATIO = 16;
export const BASE_ESTIMATE_DAYS = 5;

export function buildSpecs(ratio: number): MilestoneSpec[] {
  return Array.from({ length: OBSERVATIONS_PER_RATIO }, (_, i) => ({
    estimateDays: BASE_ESTIMATE_DAYS,
    // Boundary must accommodate the largest overrun (ratio up to 2x) without
    // relying on the engine's automatic continuation, so this scenario is
    // purely about calibration, not boundary mechanics (that's Scenario G).
    boundaryDays: BASE_ESTIMATE_DAYS * 3,
    actualRatio: ratio,
    label: `C.ratio${ratio}.${i}`,
  }));
}
