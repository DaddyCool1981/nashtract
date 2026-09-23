/**
 * Derives calibration history from replayed project state (SPEC.md §9,
 * invariants 22-23 of §15). A settled milestone's observation is never
 * deleted, even when excluded — exclusion only flags it as ineligible
 * for the adaptive-beta posterior, and the reason stays attached and
 * visible.
 *
 * History is ordered by settlement time (not proposal time), because
 * that is the order in which observations actually became available —
 * this is what makes it safe for `@nashtract/adaptive-beta`'s
 * no-look-ahead invariant (SPEC.md §8: beta_i = F(H_{i-1})) to consume
 * a prefix of this list.
 */

import { calculateCalibrationObservation, type EligibleCalibrationObservation } from "@nashtract/core";
import type { ProjectState } from "./replay.js";

export type CalibrationHistoryEntry = EligibleCalibrationObservation & {
  readonly eligible: boolean;
  readonly exclusionReason?: string;
};

export function deriveCalibrationHistory(state: ProjectState): readonly CalibrationHistoryEntry[] {
  const entries: (CalibrationHistoryEntry & { settledAt: string })[] = [];

  for (const m of state.milestones.values()) {
    if (m.state !== "SETTLED" || !m.acceptedTerms || !m.settledAt) continue;
    const observation = calculateCalibrationObservation(m.acceptedTerms.estimateDays, m.consumedEffortDays);
    entries.push(
      m.calibrationExclusion
        ? {
            ...observation,
            milestoneId: m.milestoneId,
            eligible: false,
            exclusionReason: m.calibrationExclusion.reason,
            settledAt: m.settledAt,
          }
        : { ...observation, milestoneId: m.milestoneId, eligible: true, settledAt: m.settledAt }
    );
  }

  entries.sort((a, b) => (a.settledAt < b.settledAt ? -1 : a.settledAt > b.settledAt ? 1 : 0));
  return entries.map(({ settledAt: _settledAt, ...rest }) => rest);
}

/** The subset of `deriveCalibrationHistory` that a `BetaPolicy` (SPEC.md §8) may see. */
export function deriveEligibleCalibrationHistory(state: ProjectState): readonly EligibleCalibrationObservation[] {
  return deriveCalibrationHistory(state)
    .filter((entry) => entry.eligible)
    .map(({ eligible: _eligible, exclusionReason: _exclusionReason, ...observation }) => observation);
}
