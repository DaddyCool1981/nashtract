/**
 * SPEC.md §16.F — Scope change. An externally caused scope change
 * blows up one milestone's effort. Explicit exclusion (CalibrationExcluded)
 * must prevent that milestone from corrupting the calibration posterior,
 * while its ledger record stays visible (SPEC.md §9, invariants 22-23).
 */
import type { MilestoneSpec } from "../simulations/engine.js";

export const NARRATIVE =
  "A calibrated provider hits one milestone where the client changed a required " +
  "third-party integration mid-flight, tripling the effort. Declared and excluded " +
  "from calibration, it should not move beta the way an unexplained 3x overrun " +
  "would.";

export const BASE_ESTIMATE_DAYS = 5;
export const CALIBRATED_BEFORE = 10;
export const CALIBRATED_AFTER = 10;
export const SCOPE_CHANGE_RATIO = 3;
export const SCOPE_CHANGE_REASON = "client changed a required third-party integration mid-flight";

function calibratedSeries(prefix: string, count: number): MilestoneSpec[] {
  return Array.from({ length: count }, (_, i) => ({
    estimateDays: BASE_ESTIMATE_DAYS,
    actualRatio: 1,
    label: `${prefix}.${i}`,
  }));
}

export function buildSpecs(options: { excluded: boolean }): MilestoneSpec[] {
  const scopeChangeMilestone: MilestoneSpec = {
    estimateDays: BASE_ESTIMATE_DAYS,
    boundaryDays: BASE_ESTIMATE_DAYS * (SCOPE_CHANGE_RATIO + 1),
    actualRatio: SCOPE_CHANGE_RATIO,
    label: "F.scope-change",
    ...(options.excluded ? { excludeFromCalibration: { reason: SCOPE_CHANGE_REASON } } : {}),
  };
  return [
    ...calibratedSeries("F.before", CALIBRATED_BEFORE),
    scopeChangeMilestone,
    ...calibratedSeries("F.after", CALIBRATED_AFTER),
  ];
}
