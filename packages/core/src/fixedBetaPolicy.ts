/**
 * The trivial `BetaPolicy` (SPEC.md §4: at constant beta, `P = r[M + beta(T-M)]`
 * with no statistical machinery at all). This is the fallback the
 * product uses until an adaptive policy's attack simulations have been
 * reviewed (SPEC.md §20: "Do not enable adaptive beta by default until
 * attack tests are reviewed").
 */

import type { BetaDecision, BetaPolicy, EligibleCalibrationObservation } from "./types.js";

export const FIXED_BETA_POLICY_VERSION_V0 = "fixed-beta-v0" as const;

export class FixedBetaPolicy implements BetaPolicy {
  readonly version = FIXED_BETA_POLICY_VERSION_V0;

  constructor(private readonly beta: number = 0.5) {
    if (!(beta >= 0 && beta <= 1)) {
      throw new RangeError(`FixedBetaPolicy: beta must be within [0, 1], got ${beta}`);
    }
  }

  decide(history: readonly EligibleCalibrationObservation[]): BetaDecision {
    return {
      beta: this.beta,
      policyVersion: this.version,
      eligibleObservations: history.length,
    };
  }
}
