/**
 * SPEC.md §16.B — Salami overestimation. Fixed T/M ratios 0.9, 0.75,
 * 0.6, 0.5 (the provider pads estimates and consistently delivers
 * faster than promised). Measures cumulative efficiency premium, beta
 * trajectory, evidence accumulation, and the maximum client excess vs.
 * pure time-and-materials (rT) before the policy reacts.
 */
import type { MilestoneSpec } from "../simulations/engine.js";

export const NARRATIVE =
  "A provider systematically pads estimates and delivers at a fixed fraction of " +
  "the padded estimate, milestone after milestone. Persistent overestimation " +
  "(T < M) should push adaptive beta toward 1 (pure time-and-materials), " +
  "eliminating the padding premium over time — this is exactly SPEC.md §1's " +
  "'make artificial delay/padding economically unattractive' goal.";

export const RATIOS = [0.9, 0.75, 0.6, 0.5] as const;
export const OBSERVATIONS_PER_RATIO = 16;
export const BASE_ESTIMATE_DAYS = 5;

export function buildSpecs(ratio: number): MilestoneSpec[] {
  return Array.from({ length: OBSERVATIONS_PER_RATIO }, (_, i) => ({
    estimateDays: BASE_ESTIMATE_DAYS,
    actualRatio: ratio,
    label: `B.ratio${ratio}.${i}`,
  }));
}
