import { describe, expect, it } from "vitest";
import fc from "fast-check";
import * as Money from "../src/money.js";
import { calculateMaximumExposure, calculateSettlement } from "../src/settlement.js";
import { ExposureBoundaryExceededError, InvalidAcceptedTermsError } from "../src/errors.js";
import type { AcceptedTerms } from "../src/types.js";

function terms(overrides: Partial<AcceptedTerms> = {}): AcceptedTerms {
  return {
    result: { description: "Legacy synchronization API operational and passing agreed tests." },
    estimateDays: 5,
    boundaryDays: 8,
    referenceRate: Money.money("1500", "EUR"),
    beta: 0.5,
    betaPolicyVersion: "fixed-beta-v0",
    acceptedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

// SPEC.md §23 canonical example: r=1500, M=5, U=8, beta=.5
describe("canonical example (SPEC.md §23)", () => {
  const t = terms();

  it("fast completion T=3 settles at €6,000", () => {
    const s = calculateSettlement(t, 3);
    expect(Money.toDecimalString(s.payment)).toBe("6000.00");
    expect(Money.toDecimalString(s.timeAndMaterialsEquivalent)).toBe("4500.00");
    expect(Money.toDecimalString(s.estimatedBudget)).toBe("7500.00");
    expect(Money.toDecimalString(s.providerDeltaVsTimeAndMaterials)).toBe("1500.00");
    expect(Money.toDecimalString(s.clientDeltaVsEstimate)).toBe("1500.00");
  });

  it("on-estimate completion T=5 settles at €7,500", () => {
    expect(Money.toDecimalString(calculateSettlement(t, 5).payment)).toBe("7500.00");
  });

  it("boundary completion T=8 settles at €9,750", () => {
    const s = calculateSettlement(t, 8);
    expect(Money.toDecimalString(s.payment)).toBe("9750.00");
  });

  it("maximum exposure matches P(U) and displays before acceptance", () => {
    const exposure = calculateMaximumExposure(t);
    expect(Money.toDecimalString(exposure.maximumPayment)).toBe("9750.00");
  });
});

// SPEC.md §15 required invariants (numbering follows the spec list).
describe("required invariants (SPEC.md §15)", () => {
  const effortArb = fc.double({ min: 0.01, max: 5, noNaN: true, noDefaultInfinity: true });
  const betaArb = fc.double({ min: 0, max: 1, noNaN: true, noDefaultInfinity: true });

  it("1. T = M => P = rM for every beta", () => {
    fc.assert(
      fc.property(effortArb, betaArb, (m, beta) => {
        const t = terms({ estimateDays: m, boundaryDays: m + 1, beta });
        const s = calculateSettlement(t, m);
        expect(Money.equals(s.payment, s.estimatedBudget)).toBe(true);
      })
    );
  });

  it("2. beta = 0 => P = rM (fixed estimate)", () => {
    fc.assert(
      fc.property(effortArb, fc.double({ min: 0.01, max: 10, noNaN: true }), (m, extra) => {
        const boundary = m + extra;
        const t = terms({ estimateDays: m, boundaryDays: boundary, beta: 0 });
        const s = calculateSettlement(t, boundary);
        expect(Money.equals(s.payment, s.estimatedBudget)).toBe(true);
      })
    );
  });

  it("3. beta = 1 => P = rT (time and materials)", () => {
    fc.assert(
      fc.property(effortArb, fc.double({ min: 0.01, max: 10, noNaN: true }), (m, extra) => {
        const boundary = m + extra;
        const t = terms({ estimateDays: m, boundaryDays: boundary, beta: 1 });
        const s = calculateSettlement(t, boundary);
        expect(Money.equals(s.payment, s.timeAndMaterialsEquivalent)).toBe(true);
      })
    );
  });

  it("4. beta = .5 => P = r(M+T)/2", () => {
    const t = terms({ estimateDays: 5, boundaryDays: 20, beta: 0.5 });
    const s = calculateSettlement(t, 11);
    // r(M+T)/2 = 1500 * (5+11)/2 = 1500 * 8 = 12000
    expect(Money.toDecimalString(s.payment)).toBe("12000.00");
  });

  it("5. 0<beta<1, T<M => rT < P < rM", () => {
    const t = terms({ estimateDays: 10, boundaryDays: 10, beta: 0.5 });
    const s = calculateSettlement(t, 4);
    expect(Money.compare(s.timeAndMaterialsEquivalent, s.payment)).toBe(-1);
    expect(Money.compare(s.payment, s.estimatedBudget)).toBe(-1);
  });

  it("6. 0<beta<1, T>M => rM < P < rT", () => {
    const t = terms({ estimateDays: 4, boundaryDays: 10, beta: 0.5 });
    const s = calculateSettlement(t, 9);
    expect(Money.compare(s.estimatedBudget, s.payment)).toBe(-1);
    expect(Money.compare(s.payment, s.timeAndMaterialsEquivalent)).toBe(-1);
  });

  it("7. marginal settlement slope is r*beta", () => {
    const t = terms({ estimateDays: 5, boundaryDays: 20, beta: 0.3 });
    const s1 = calculateSettlement(t, 6);
    const s2 = calculateSettlement(t, 7);
    // (P(7) - P(6)) / 1 day == r * beta == 1500 * 0.3 == 450
    expect(Money.toDecimalString(Money.subtract(s2.payment, s1.payment))).toBe("450.00");
  });

  it("8. effort beyond U is never automatically authorized", () => {
    const t = terms({ estimateDays: 5, boundaryDays: 8 });
    expect(() => calculateSettlement(t, 8.0001)).toThrow(ExposureBoundaryExceededError);
  });

  it("9. Pmax = P(U)", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0.1, max: 20, noNaN: true }),
        fc.double({ min: 0, max: 30, noNaN: true }),
        betaArb,
        (m, extra, beta) => {
          const u = m + extra;
          const t = terms({ estimateDays: m, boundaryDays: u, beta });
          const exposure = calculateMaximumExposure(t);
          const atBoundary = calculateSettlement(t, u);
          expect(Money.equals(exposure.maximumPayment, atBoundary.payment)).toBe(true);
        }
      )
    );
  });

  it("rejects invalid terms (0 < M <= U, 0 <= beta <= 1)", () => {
    expect(() => calculateSettlement(terms({ estimateDays: 0 }), 1)).toThrow(InvalidAcceptedTermsError);
    expect(() => calculateSettlement(terms({ estimateDays: 5, boundaryDays: 4 }), 1)).toThrow(
      InvalidAcceptedTermsError
    );
    expect(() => calculateSettlement(terms({ beta: 1.1 }), 1)).toThrow(InvalidAcceptedTermsError);
    expect(() => calculateSettlement(terms({ beta: -0.1 }), 1)).toThrow(InvalidAcceptedTermsError);
  });

  it("12. accepted terms are never mutated", () => {
    const t = Object.freeze(terms());
    expect(() => calculateSettlement(t, 5)).not.toThrow();
    expect(() => calculateMaximumExposure(t)).not.toThrow();
  });
});
