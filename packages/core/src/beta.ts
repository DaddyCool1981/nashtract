/**
 * Beta (β), the deviation-sharing factor, is a plain `number` in
 * [0, 1] in the public API (SPEC.md §3, §6). Whether it comes from a
 * fixed product default or from the adaptive-beta policy (a posterior
 * probability computed with floating point — that's a statistical
 * model, not currency, so floats are appropriate there), it is
 * normalized to an exact Rational before entering the settlement
 * equation, at a fixed, documented precision.
 *
 * Precision: 9 decimal places. This comfortably exceeds the precision
 * any realistic beta policy (fixed 0.5, or the adaptive posterior of
 * §8) will ever carry, so normalization never discards meaningful
 * signal — it only fixes a canonical decimal representation before
 * exact conversion.
 */

import { type Rational, fromNumber } from "./rational.js";

export const BETA_DECIMAL_PRECISION = 9;

export function betaToRational(beta: number): Rational {
  if (!Number.isFinite(beta)) {
    throw new RangeError(`Beta: not finite: ${beta}`);
  }
  if (beta < 0 || beta > 1) {
    throw new RangeError(`Beta: must be within [0, 1], got ${beta}`);
  }
  return fromNumber(beta, BETA_DECIMAL_PRECISION);
}
