/**
 * Fixed-point money: an integer count of minor currency units (e.g.
 * cents for EUR/USD at exponent 2), never a binary float (SPEC.md §13).
 *
 * Arithmetic that needs fractional factors (the settlement equation)
 * goes through `Rational` and only rounds back to minor units at the
 * end, via `fromRational`, with an explicit, documented rounding mode.
 */

import {
  type Rational,
  type RoundingMode,
  divide,
  fromDecimalString,
  multiply,
  rational,
  roundToInt,
} from "./rational.js";

export type Money = {
  readonly minorUnits: bigint;
  readonly currency: string;
  /** Number of decimal digits a minor unit represents, e.g. 2 for EUR cents. */
  readonly exponent: number;
};

export const DEFAULT_MONEY_EXPONENT = 2;

/** Default rounding mode for converting exact rational amounts back to Money. */
export const DEFAULT_MONEY_ROUNDING: RoundingMode = "HALF_EVEN";

function assertSameDenomination(a: Money, b: Money, op: string): void {
  if (a.currency !== b.currency || a.exponent !== b.exponent) {
    throw new RangeError(
      `Money.${op}: currency/exponent mismatch (${a.currency}@${a.exponent} vs ${b.currency}@${b.exponent})`
    );
  }
}

/**
 * Builds a Money value from a decimal amount. The amount is rounded to
 * `exponent` decimal places using `DEFAULT_MONEY_ROUNDING` if it carries
 * more precision than the currency supports.
 */
export function money(
  amount: number | string,
  currency: string,
  exponent: number = DEFAULT_MONEY_EXPONENT
): Money {
  const asRational = typeof amount === "number" ? fromDecimalString(amount.toFixed(exponent + 6)) : fromDecimalString(amount);
  const scale = 10n ** BigInt(exponent);
  const minorUnits = roundToInt(multiply(asRational, rational(scale, 1n)), DEFAULT_MONEY_ROUNDING);
  return { minorUnits, currency, exponent };
}

export function zero(currency: string, exponent: number = DEFAULT_MONEY_EXPONENT): Money {
  return { minorUnits: 0n, currency, exponent };
}

export function toRational(m: Money): Rational {
  return rational(m.minorUnits, 10n ** BigInt(m.exponent));
}

export function fromRational(
  value: Rational,
  currency: string,
  exponent: number = DEFAULT_MONEY_EXPONENT,
  roundingMode: RoundingMode = DEFAULT_MONEY_ROUNDING
): Money {
  const scale = 10n ** BigInt(exponent);
  const minorUnits = roundToInt(multiply(value, rational(scale, 1n)), roundingMode);
  return { minorUnits, currency, exponent };
}

export function add(a: Money, b: Money): Money {
  assertSameDenomination(a, b, "add");
  return { minorUnits: a.minorUnits + b.minorUnits, currency: a.currency, exponent: a.exponent };
}

export function subtract(a: Money, b: Money): Money {
  assertSameDenomination(a, b, "subtract");
  return { minorUnits: a.minorUnits - b.minorUnits, currency: a.currency, exponent: a.exponent };
}

/** Multiplies a Money amount by an exact rational factor (e.g. beta), rounding once at the end. */
export function multiplyByRational(
  m: Money,
  factor: Rational,
  roundingMode: RoundingMode = DEFAULT_MONEY_ROUNDING
): Money {
  return fromRational(multiply(toRational(m), factor), m.currency, m.exponent, roundingMode);
}

export function divideExact(m: Money, divisor: Rational): Rational {
  return divide(toRational(m), divisor);
}

export function compare(a: Money, b: Money): -1 | 0 | 1 {
  assertSameDenomination(a, b, "compare");
  if (a.minorUnits < b.minorUnits) return -1;
  if (a.minorUnits > b.minorUnits) return 1;
  return 0;
}

export function equals(a: Money, b: Money): boolean {
  return a.currency === b.currency && a.exponent === b.exponent && a.minorUnits === b.minorUnits;
}

export function isZero(m: Money): boolean {
  return m.minorUnits === 0n;
}

export function isNegative(m: Money): boolean {
  return m.minorUnits < 0n;
}

export function toDecimalString(m: Money): string {
  const negative = m.minorUnits < 0n;
  const abs = (negative ? -m.minorUnits : m.minorUnits).toString().padStart(m.exponent + 1, "0");
  const intPart = abs.slice(0, abs.length - m.exponent) || "0";
  const fracPart = m.exponent > 0 ? "." + abs.slice(abs.length - m.exponent) : "";
  return `${negative ? "-" : ""}${intPart}${fracPart}`;
}
