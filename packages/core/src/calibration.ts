/**
 * Calibration signal (SPEC.md §7): e = ln(T / M).
 *
 * Unlike settlement, this is a statistical signal, not currency — the
 * spec's "no binary floating point" constraint (§13) is scoped to
 * money. `Math.log` is the right tool here; the adaptive-beta package
 * (Phase 3) consumes these log-errors inside a Normal-Inverse-Gamma
 * posterior, which is itself a floating-point statistical model.
 */

import { InvalidAcceptedTermsError } from "./errors.js";
import type { CalibrationObservation } from "./types.js";

export function calculateCalibrationObservation(
  estimateDays: number,
  actualDays: number
): CalibrationObservation {
  if (!Number.isFinite(estimateDays) || estimateDays <= 0) {
    throw new InvalidAcceptedTermsError(`estimateDays (M) must be > 0, got ${estimateDays}`);
  }
  if (!Number.isFinite(actualDays) || actualDays <= 0) {
    throw new InvalidAcceptedTermsError(`actualDays (T) must be > 0, got ${actualDays}`);
  }

  return {
    estimateDays,
    actualDays,
    logError: Math.log(actualDays / estimateDays),
  };
}
