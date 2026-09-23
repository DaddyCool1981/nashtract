import { describe, expect, it } from "vitest";
import fc from "fast-check";
import * as R from "../src/rational.js";

describe("Rational.fromDecimalString", () => {
  it("parses exact decimals without float noise", () => {
    expect(R.toDecimalString(R.fromDecimalString("0.1"), 10)).toBe("0.1000000000");
    expect(R.toDecimalString(R.fromDecimalString("-7.25"), 4)).toBe("-7.2500");
    expect(R.toDecimalString(R.fromDecimalString("1500"), 2)).toBe("1500.00");
  });

  it("rejects scientific notation and garbage", () => {
    expect(() => R.fromDecimalString("1e10")).toThrow();
    expect(() => R.fromDecimalString("abc")).toThrow();
    expect(() => R.fromDecimalString("")).toThrow();
  });
});

describe("Rational arithmetic", () => {
  it("0.1 + 0.2 is exactly 0.3 (unlike binary float)", () => {
    const a = R.fromDecimalString("0.1");
    const b = R.fromDecimalString("0.2");
    const sum = R.add(a, b);
    expect(R.compare(sum, R.fromDecimalString("0.3"))).toBe(0);
    // Sanity check this is a real distinction, not a redundant test:
    expect(0.1 + 0.2 === 0.3).toBe(false);
  });

  it("is commutative and associative for add/multiply (property)", () => {
    const arb = fc.tuple(fc.bigInt({ min: -1000n, max: 1000n }), fc.bigInt({ min: 1n, max: 1000n })).map(
      ([num, den]) => R.rational(num, den)
    );
    fc.assert(
      fc.property(arb, arb, arb, (a, b, c) => {
        expect(R.compare(R.add(a, b), R.add(b, a))).toBe(0);
        expect(R.compare(R.add(R.add(a, b), c), R.add(a, R.add(b, c)))).toBe(0);
        expect(R.compare(R.multiply(a, b), R.multiply(b, a))).toBe(0);
      })
    );
  });

  it("subtract is the inverse of add", () => {
    fc.assert(
      fc.property(
        fc.bigInt({ min: -10_000n, max: 10_000n }),
        fc.bigInt({ min: -10_000n, max: 10_000n }),
        (x, y) => {
          const a = R.rational(x, 7n);
          const b = R.rational(y, 11n);
          expect(R.compare(R.subtract(R.add(a, b), b), a)).toBe(0);
        }
      )
    );
  });

  it("divide is the inverse of multiply for non-zero divisors", () => {
    fc.assert(
      fc.property(
        fc.bigInt({ min: -1000n, max: 1000n }),
        fc.bigInt({ min: 1n, max: 1000n }).filter((n) => n !== 0n),
        (x, y) => {
          const a = R.rational(x, 13n);
          const b = R.rational(y, 17n);
          expect(R.compare(R.divide(R.multiply(a, b), b), a)).toBe(0);
        }
      )
    );
  });
});

describe("roundToInt", () => {
  it("HALF_EVEN rounds exact halves to the even neighbor", () => {
    expect(R.roundToInt(R.rational(5n, 2n), "HALF_EVEN")).toBe(2n); // 2.5 -> 2
    expect(R.roundToInt(R.rational(7n, 2n), "HALF_EVEN")).toBe(4n); // 3.5 -> 4
    expect(R.roundToInt(R.rational(-5n, 2n), "HALF_EVEN")).toBe(-2n); // -2.5 -> -2
  });

  it("HALF_UP always rounds halves away from zero", () => {
    expect(R.roundToInt(R.rational(5n, 2n), "HALF_UP")).toBe(3n);
    expect(R.roundToInt(R.rational(-5n, 2n), "HALF_UP")).toBe(-3n);
  });

  it("DOWN truncates toward zero, UP away from zero", () => {
    expect(R.roundToInt(R.rational(7n, 2n), "DOWN")).toBe(3n);
    expect(R.roundToInt(R.rational(-7n, 2n), "DOWN")).toBe(-3n);
    expect(R.roundToInt(R.rational(7n, 2n), "UP")).toBe(4n);
    expect(R.roundToInt(R.rational(-7n, 2n), "UP")).toBe(-4n);
  });

  it("exact integers round to themselves under every mode", () => {
    const modes: R.RoundingMode[] = ["HALF_EVEN", "HALF_UP", "DOWN", "UP"];
    for (const mode of modes) {
      expect(R.roundToInt(R.rational(42n, 1n), mode)).toBe(42n);
    }
  });
});
