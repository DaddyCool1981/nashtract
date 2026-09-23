/**
 * Effort (M, U, T) is expressed as plain JS `number` of effort-days in
 * the public API (SPEC.md §6, §13), matching how it's entered by a
 * non-technical client/provider. Before it enters settlement arithmetic
 * it is normalized to an exact Rational at a fixed, documented
 * precision — this is the "effort precision" the spec requires us to
 * document.
 *
 * Precision: 6 decimal places of an effort-day, i.e. one
 * millionth of a day (~0.0864 seconds). This is far finer than any
 * realistic effort-tracking granularity, so it never truncates a real
 * input; it exists only to give the binary `number` a single, fixed
 * decimal representation before conversion to an exact fraction, so two
 * equal-looking inputs never diverge by float noise inside the
 * settlement equation.
 */

import { type Rational, fromNumber } from "./rational.js";

export const EFFORT_DECIMAL_PRECISION = 6;

export function effortToRational(days: number): Rational {
  if (!Number.isFinite(days)) {
    throw new RangeError(`Effort: not finite: ${days}`);
  }
  if (days < 0) {
    throw new RangeError(`Effort: must be >= 0, got ${days}`);
  }
  return fromNumber(days, EFFORT_DECIMAL_PRECISION);
}
