/**
 * Exact rational arithmetic on bigint numerator/denominator pairs.
 *
 * Money and effort in NashTract MUST NOT rely on binary floating point
 * (SPEC.md §13). Rational is the shared exact-arithmetic primitive that
 * `money.ts` (currency) and the settlement equation build on. Every
 * operation returns an exact result; no operation ever rounds — rounding
 * only happens at the boundary back to a fixed-point representation
 * (see `RoundingMode` and `Money.fromRational`).
 */

export type Rational = {
  readonly num: bigint;
  readonly den: bigint; // always > 0
};

export type RoundingMode = "HALF_EVEN" | "HALF_UP" | "DOWN" | "UP";

function gcd(a: bigint, b: bigint): bigint {
  let x = a < 0n ? -a : a;
  let y = b < 0n ? -b : b;
  while (y !== 0n) {
    [x, y] = [y, x % y];
  }
  return x === 0n ? 1n : x;
}

export function rational(num: bigint, den: bigint): Rational {
  if (den === 0n) {
    throw new RangeError("Rational: denominator must not be zero");
  }
  let n = num;
  let d = den;
  if (d < 0n) {
    n = -n;
    d = -d;
  }
  const g = gcd(n, d);
  return { num: n / g, den: d / g };
}

export const ZERO: Rational = { num: 0n, den: 1n };
export const ONE: Rational = { num: 1n, den: 1n };

export function fromInt(value: number | bigint): Rational {
  const n = typeof value === "bigint" ? value : BigInt(value);
  return rational(n, 1n);
}

/**
 * Parses an exact decimal string (e.g. "1500", "-7.25", "0.010") into a
 * Rational. No scientific notation. Every decimal digit contributes
 * exactly — this is how external decimal input (money amounts, days,
 * beta) enters exact arithmetic without passing through a binary float.
 */
export function fromDecimalString(input: string): Rational {
  const trimmed = input.trim();
  const match = /^([+-]?)(\d+)(?:\.(\d+))?$/.exec(trimmed);
  if (!match) {
    throw new RangeError(`Rational.fromDecimalString: not a plain decimal: "${input}"`);
  }
  const [, sign, intPart, fracPart = ""] = match;
  const digits = intPart + fracPart;
  const magnitude = BigInt(digits);
  const den = 10n ** BigInt(fracPart.length);
  const num = sign === "-" ? -magnitude : magnitude;
  return rational(num, den);
}

/**
 * Normalizes a JS number to an exact decimal string with at most
 * `maxDecimals` fractional digits, then parses it. This is the
 * documented boundary between "the outside world hands us a float" and
 * "everything downstream is exact": we fix a precision once, in one
 * place, instead of letting binary float noise leak into the ledger.
 */
export function fromNumber(value: number, maxDecimals: number): Rational {
  if (!Number.isFinite(value)) {
    throw new RangeError(`Rational.fromNumber: not finite: ${value}`);
  }
  return fromDecimalString(value.toFixed(maxDecimals));
}

export function add(a: Rational, b: Rational): Rational {
  return rational(a.num * b.den + b.num * a.den, a.den * b.den);
}

export function subtract(a: Rational, b: Rational): Rational {
  return rational(a.num * b.den - b.num * a.den, a.den * b.den);
}

export function multiply(a: Rational, b: Rational): Rational {
  return rational(a.num * b.num, a.den * b.den);
}

export function divide(a: Rational, b: Rational): Rational {
  if (b.num === 0n) {
    throw new RangeError("Rational.divide: division by zero");
  }
  return rational(a.num * b.den, a.den * b.num);
}

export function negate(a: Rational): Rational {
  return { num: -a.num, den: a.den };
}

export function compare(a: Rational, b: Rational): -1 | 0 | 1 {
  const lhs = a.num * b.den;
  const rhs = b.num * a.den;
  if (lhs < rhs) return -1;
  if (lhs > rhs) return 1;
  return 0;
}

export function isZero(a: Rational): boolean {
  return a.num === 0n;
}

export function isNegative(a: Rational): boolean {
  return a.num < 0n;
}

/**
 * Rounds an exact rational to an integer using the given mode.
 * Default consumers use HALF_EVEN ("banker's rounding"): it is the
 * conventional choice for financial settlement because it does not
 * systematically bias sums up or down across many roundings.
 */
export function roundToInt(value: Rational, mode: RoundingMode = "HALF_EVEN"): bigint {
  const { num, den } = value;
  if (den === 1n) return num;

  const quotient = num / den; // truncates toward zero
  const remainder = num - quotient * den; // same sign as num, |remainder| < den

  if (remainder === 0n) return quotient;

  const absRemainderTimes2 = (remainder < 0n ? -remainder : remainder) * 2n;
  const isNegativeValue = num < 0n;

  switch (mode) {
    case "DOWN":
      return quotient;
    case "UP":
      return isNegativeValue ? quotient - 1n : quotient + 1n;
    case "HALF_UP": {
      if (absRemainderTimes2 >= den) {
        return isNegativeValue ? quotient - 1n : quotient + 1n;
      }
      return quotient;
    }
    case "HALF_EVEN": {
      if (absRemainderTimes2 > den) {
        return isNegativeValue ? quotient - 1n : quotient + 1n;
      }
      if (absRemainderTimes2 < den) {
        return quotient;
      }
      // Exactly halfway: round to the even neighbor.
      const isQuotientEven = quotient % 2n === 0n;
      if (isQuotientEven) return quotient;
      return isNegativeValue ? quotient - 1n : quotient + 1n;
    }
  }
}

/** Renders an exact rational as a fixed-decimal string, e.g. for debugging/logs. */
export function toDecimalString(value: Rational, decimals: number): string {
  const scale = 10n ** BigInt(decimals);
  const scaled = roundToInt(multiply(value, rational(scale, 1n)), "HALF_EVEN");
  const negative = scaled < 0n;
  const abs = (negative ? -scaled : scaled).toString().padStart(decimals + 1, "0");
  const intPart = abs.slice(0, abs.length - decimals) || "0";
  const fracPart = decimals > 0 ? "." + abs.slice(abs.length - decimals) : "";
  return `${negative ? "-" : ""}${intPart}${fracPart}`;
}
