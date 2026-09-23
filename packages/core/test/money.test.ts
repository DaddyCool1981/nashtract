import { describe, expect, it } from "vitest";
import * as Money from "../src/money.js";
import * as R from "../src/rational.js";

describe("money()", () => {
  it("parses whole and fractional amounts into minor units", () => {
    expect(Money.money("7500", "EUR").minorUnits).toBe(750000n);
    expect(Money.money("7500.00", "EUR").minorUnits).toBe(750000n);
    expect(Money.money("7500.5", "EUR").minorUnits).toBe(750050n);
    expect(Money.money(9750, "EUR").minorUnits).toBe(975000n);
  });

  it("rounds amounts finer than the exponent using HALF_EVEN", () => {
    expect(Money.money("1.005", "EUR").minorUnits).toBe(100n); // 1.005 -> 1.00 (even)
    expect(Money.money("1.015", "EUR").minorUnits).toBe(102n); // 1.015 -> 1.02 (even)
  });

  it("round-trips through toDecimalString", () => {
    expect(Money.toDecimalString(Money.money("7500", "EUR"))).toBe("7500.00");
    expect(Money.toDecimalString(Money.money("-3.5", "EUR"))).toBe("-3.50");
    expect(Money.toDecimalString(Money.zero("EUR"))).toBe("0.00");
  });
});

describe("Money arithmetic", () => {
  it("add/subtract require matching currency and exponent", () => {
    const a = Money.money("10", "EUR");
    const b = Money.money("10", "USD");
    expect(() => Money.add(a, b)).toThrow();
  });

  it("add/subtract are exact", () => {
    const a = Money.money("7500.33", "EUR");
    const b = Money.money("2250.67", "EUR");
    expect(Money.toDecimalString(Money.add(a, b))).toBe("9751.00");
    expect(Money.toDecimalString(Money.subtract(a, b))).toBe("5249.66");
  });

  it("multiplyByRational rounds once, at the end", () => {
    const rate = Money.money("1500", "EUR");
    const third = R.rational(1n, 3n);
    // 1500 / 3 = 500 exactly.
    expect(Money.toDecimalString(Money.multiplyByRational(rate, third))).toBe("500.00");
  });

  it("compare and equals respect denomination", () => {
    const a = Money.money("10.00", "EUR");
    const b = Money.money("10.00", "EUR");
    const c = Money.money("10.01", "EUR");
    expect(Money.equals(a, b)).toBe(true);
    expect(Money.compare(a, c)).toBe(-1);
    expect(Money.compare(c, a)).toBe(1);
  });
});
