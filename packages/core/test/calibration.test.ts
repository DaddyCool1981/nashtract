import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { calculateCalibrationObservation } from "../src/calibration.js";
import { InvalidAcceptedTermsError } from "../src/errors.js";

describe("calculateCalibrationObservation (SPEC.md §7, §15.13-14)", () => {
  it("13. T = M gives log-error 0", () => {
    fc.assert(
      fc.property(fc.double({ min: 0.01, max: 1000, noNaN: true }), (m) => {
        expect(calculateCalibrationObservation(m, m).logError).toBeCloseTo(0, 12);
      })
    );
  });

  it("14. T=2M and T=M/2 give equal and opposite log-errors", () => {
    fc.assert(
      fc.property(fc.double({ min: 0.01, max: 1000, noNaN: true }), (m) => {
        const over = calculateCalibrationObservation(m, m * 2);
        const under = calculateCalibrationObservation(m, m / 2);
        expect(over.logError).toBeCloseTo(-under.logError, 9);
        expect(over.logError).toBeGreaterThan(0);
        expect(under.logError).toBeLessThan(0);
      })
    );
  });

  it("rejects non-positive estimate or actual effort", () => {
    expect(() => calculateCalibrationObservation(0, 5)).toThrow(InvalidAcceptedTermsError);
    expect(() => calculateCalibrationObservation(5, 0)).toThrow(InvalidAcceptedTermsError);
    expect(() => calculateCalibrationObservation(-1, 5)).toThrow(InvalidAcceptedTermsError);
  });
});
