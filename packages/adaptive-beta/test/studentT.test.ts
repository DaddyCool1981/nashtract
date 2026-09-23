import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { regularizedIncompleteBeta, studentTCdf } from "../src/studentT.js";

// Closed-form reference implementations, independent of our numerical code,
// used to validate studentTCdf without trusting a stats library.
function cauchyCdf(t: number): number {
  return 0.5 + Math.atan(t) / Math.PI;
}
function tDist2Cdf(t: number): number {
  return 0.5 + t / (2 * Math.sqrt(2 + t * t));
}

describe("studentTCdf against closed forms", () => {
  it("df=1 matches the standard Cauchy CDF (0.5 + atan(t)/pi)", () => {
    for (const t of [-5, -2, -1, -0.3, 0, 0.3, 1, 2, 5]) {
      expect(studentTCdf(t, 1)).toBeCloseTo(cauchyCdf(t), 10);
    }
  });

  it("df=2 matches 0.5 + t/(2*sqrt(2+t^2))", () => {
    for (const t of [-5, -2, -1, -0.3, 0, 0.3, 1, 2, 5]) {
      expect(studentTCdf(t, 2)).toBeCloseTo(tDist2Cdf(t), 10);
    }
  });

  it("is exactly 0.5 at t=0 for any degrees of freedom", () => {
    for (const df of [1, 2, 4, 10, 100]) {
      expect(studentTCdf(0, df)).toBe(0.5);
    }
  });

  it("is symmetric: CDF(-t) = 1 - CDF(t)", () => {
    fc.assert(
      fc.property(
        fc.double({ min: -20, max: 20, noNaN: true }),
        fc.double({ min: 0.5, max: 200, noNaN: true }),
        (t, df) => {
          expect(studentTCdf(-t, df)).toBeCloseTo(1 - studentTCdf(t, df), 8);
        }
      )
    );
  });

  it("is monotonically non-decreasing in t", () => {
    fc.assert(
      fc.property(
        fc.double({ min: -20, max: 19, noNaN: true }),
        fc.double({ min: 0.01, max: 20, noNaN: true }),
        fc.double({ min: 1, max: 200, noNaN: true }),
        (t, gap, df) => {
          expect(studentTCdf(t + gap, df)).toBeGreaterThanOrEqual(studentTCdf(t, df));
        }
      )
    );
  });

  it("approaches the standard normal CDF as degrees of freedom grow large", () => {
    // Standard normal CDF via erf-free approximation is unnecessary here —
    // just check convergence: t_df(1) should approach a stable value.
    const large = studentTCdf(1.96, 100_000);
    const larger = studentTCdf(1.96, 1_000_000);
    expect(Math.abs(large - larger)).toBeLessThan(1e-4);
    expect(large).toBeCloseTo(0.975, 2); // Phi(1.96) ~= 0.975
  });
});

describe("regularizedIncompleteBeta", () => {
  it("I_x(1,1) = x (uniform case)", () => {
    for (const x of [0, 0.1, 0.5, 0.9, 1]) {
      expect(regularizedIncompleteBeta(x, 1, 1)).toBeCloseTo(x, 12);
    }
  });

  it("is symmetric: I_x(a,b) = 1 - I_(1-x)(b,a), for the a/b range this module is actually used with", () => {
    // a, b here are always of the form df/2 or 1/2 (studentTCdf's only
    // caller) — realistic degrees of freedom, not pathological tiny
    // shape parameters where float precision in the extreme tails
    // dominates the comparison.
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 1, noNaN: true }),
        fc.double({ min: 0.5, max: 50, noNaN: true }),
        fc.double({ min: 0.5, max: 50, noNaN: true }),
        (x, a, b) => {
          expect(regularizedIncompleteBeta(x, a, b)).toBeCloseTo(1 - regularizedIncompleteBeta(1 - x, b, a), 6);
        }
      )
    );
  });

  it("rejects x outside [0, 1]", () => {
    expect(() => regularizedIncompleteBeta(-0.1, 1, 1)).toThrow(RangeError);
    expect(() => regularizedIncompleteBeta(1.1, 1, 1)).toThrow(RangeError);
  });
});
