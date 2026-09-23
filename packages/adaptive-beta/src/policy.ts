/**
 * AdaptiveBetaPolicyV1 (SPEC.md §8): converts a posterior belief about
 * persistent estimation bias into a deviation-sharing beta. Weak or
 * symmetric evidence keeps beta near 0.5; strong, persistent bias moves
 * it toward 0 or 1. One surprising milestone should not swing it.
 *
 * `core.BetaDecision` (SPEC.md §13) is intentionally minimal — it's
 * part of `@nashtract/core`'s dependency-free contract and has to work
 * for a trivial fixed-beta policy too. `AdaptiveBetaDecision` here is
 * the full shape from SPEC.md §8 (including the statistical detail for
 * the calibration screen's "expandable technical details", SPEC.md
 * §14) and is structurally assignable to `core.BetaDecision`.
 */

import type { BetaDecision, BetaPolicy, EligibleCalibrationObservation } from "@nashtract/core";
import { computePosterior } from "./posterior.js";
import { DEFAULT_PRIOR_V1, type AdaptiveBetaPriorV1 } from "./prior.js";
import { studentTCdf } from "./studentT.js";

export const POLICY_VERSION_V1 = "adaptive-beta-v1" as const;

/** ~ +/-10% multiplicative calibration band. Product hypothesis, versioned (SPEC.md §8). */
export const EQUIVALENCE_MARGIN_V1 = Math.log(1.1);

/** SPEC.md §8: reference product policy uses beta=0.5 for the first 3 eligible observations. */
export const MIN_OBSERVATIONS_V1 = 3;

/** SPEC.md §8: Core supports [0,1]; product experiments MAY narrow this. Policy, not mathematics. */
export const DEFAULT_BOUNDS_V1: readonly [number, number] = [0, 1];

export type AdaptiveBetaDecision = BetaDecision & {
  readonly policyVersion: typeof POLICY_VERSION_V1;
  readonly posteriorMeanLogError: number;
  readonly posteriorStdLogError: number;
  readonly probabilityOverestimating: number;
  readonly probabilityUnderestimating: number;
  readonly equivalenceMargin: number;
};

export type AdaptiveBetaPolicyV1Options = {
  readonly prior?: AdaptiveBetaPriorV1;
  readonly equivalenceMargin?: number;
  readonly minObservations?: number;
  readonly bounds?: readonly [number, number];
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export class AdaptiveBetaPolicyV1 implements BetaPolicy {
  readonly version = POLICY_VERSION_V1;

  private readonly prior: AdaptiveBetaPriorV1;
  private readonly equivalenceMargin: number;
  private readonly minObservations: number;
  private readonly bounds: readonly [number, number];

  constructor(options: AdaptiveBetaPolicyV1Options = {}) {
    this.prior = options.prior ?? DEFAULT_PRIOR_V1;
    this.equivalenceMargin = options.equivalenceMargin ?? EQUIVALENCE_MARGIN_V1;
    this.minObservations = options.minObservations ?? MIN_OBSERVATIONS_V1;
    this.bounds = options.bounds ?? DEFAULT_BOUNDS_V1;
    if (!(this.equivalenceMargin > 0)) {
      throw new RangeError(`AdaptiveBetaPolicyV1: equivalenceMargin must be > 0, got ${this.equivalenceMargin}`);
    }
    const [lower, upper] = this.bounds;
    if (!(lower >= 0 && upper <= 1 && lower < upper)) {
      throw new RangeError(`AdaptiveBetaPolicyV1: bounds must satisfy 0 <= lower < upper <= 1, got [${lower}, ${upper}]`);
    }
  }

  /** beta_i = F(H_{i-1}): a pure function of exactly the history it is given — no other input can influence it. */
  decide(history: readonly EligibleCalibrationObservation[]): AdaptiveBetaDecision {
    const logErrors = history.map((observation) => observation.logError);
    const posterior = computePosterior(this.prior, logErrors);

    const probabilityOverestimating = studentTCdf(
      (-this.equivalenceMargin - posterior.mu) / posterior.scale,
      posterior.degreesOfFreedom
    );
    const probabilityUnderestimating =
      1 - studentTCdf((this.equivalenceMargin - posterior.mu) / posterior.scale, posterior.degreesOfFreedom);

    const rawBeta = 0.5 + 0.5 * probabilityOverestimating - 0.5 * probabilityUnderestimating;
    const hasEnoughHistory = history.length >= this.minObservations;
    const beta = hasEnoughHistory ? clamp(rawBeta, this.bounds[0], this.bounds[1]) : 0.5;

    return {
      beta,
      policyVersion: this.version,
      eligibleObservations: history.length,
      posteriorMeanLogError: posterior.mu,
      posteriorStdLogError: posterior.stdOfMu,
      probabilityOverestimating,
      probabilityUnderestimating,
      equivalenceMargin: this.equivalenceMargin,
    };
  }
}
