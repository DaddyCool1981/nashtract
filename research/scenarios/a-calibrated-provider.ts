/**
 * SPEC.md §16.A — Calibrated provider. Generate e_i ~ Normal(0, sigma^2).
 * Beta should fluctuate around .5 without systematic drift.
 */
import type { MilestoneSpec } from "../simulations/engine.js";
import { gaussianSampler } from "../simulations/prng.js";

export const NARRATIVE =
  "A calibrated provider whose estimates carry only symmetric, zero-mean noise. " +
  "Adaptive beta should stay close to 0.5 throughout, with no systematic drift " +
  "in either direction as evidence accumulates.";

export const SEED = 20260101;
export const OBSERVATION_COUNT = 40;
export const LOG_ERROR_STD_DEV = 0.25;
export const BASE_ESTIMATE_DAYS = 5;

export function buildSpecs(): MilestoneSpec[] {
  const sampleLogError = gaussianSampler(SEED, 0, LOG_ERROR_STD_DEV);
  return Array.from({ length: OBSERVATION_COUNT }, (_, i) => ({
    estimateDays: BASE_ESTIMATE_DAYS,
    actualRatio: Math.exp(sampleLogError()),
    label: `A.${i}`,
  }));
}
