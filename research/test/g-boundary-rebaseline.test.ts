import { describe, expect, it } from "vitest";
import { Money } from "@nashtract/core";
import {
  BETA,
  CONTINUATION_ROUNDS,
  CONTINUATION_STEP_DAYS,
  ESTIMATE_DAYS,
  INITIAL_BOUNDARY_DAYS,
  NARRATIVE,
  runBoundaryRebaselineAttack,
} from "../scenarios/g-boundary-rebaseline.js";

describe("Scenario G — boundary/rebaseline attack", () => {
  it(NARRATIVE, () => {
    const result = runBoundaryRebaselineAttack();

    // 8. Effort beyond U is never automatically authorized — the attempt to
    // record 100 days without a continuation was rejected outright.
    expect(result.rejectedOversizedEffortRecording).toBe(true);

    // 27/10. Repeated continuations extend the effective boundary by exactly
    // the sum of accepted extensions, and never touch the original terms or
    // already-consumed effort — round after round, not just once.
    for (const snapshot of result.snapshots) {
      expect(snapshot.acceptedEstimateDays).toBe(ESTIMATE_DAYS);
      expect(snapshot.acceptedBoundaryDays).toBe(INITIAL_BOUNDARY_DAYS);
      expect(snapshot.acceptedBeta).toBe(BETA);
      expect(snapshot.effectiveBoundaryDays).toBe(INITIAL_BOUNDARY_DAYS + snapshot.round * CONTINUATION_STEP_DAYS);
      expect(snapshot.consumedEffortDays).toBe(INITIAL_BOUNDARY_DAYS + snapshot.round * CONTINUATION_STEP_DAYS);
    }
    expect(result.snapshots).toHaveLength(CONTINUATION_ROUNDS + 1); // round 0 + N continuation rounds

    // The final settlement still uses the ORIGINAL M and beta — repeated
    // rebaselining cannot be used to launder a blown estimate into a fresh
    // one, and the consumed effort accumulated across all rounds is exactly
    // what settlement is computed against.
    expect(result.finalMilestone.state).toBe("SETTLED");
    expect(result.finalMilestone.acceptedTerms!.estimateDays).toBe(ESTIMATE_DAYS);
    expect(result.finalMilestone.acceptedTerms!.beta).toBe(BETA);
    const expectedTotalEffort = INITIAL_BOUNDARY_DAYS + CONTINUATION_ROUNDS * CONTINUATION_STEP_DAYS;
    expect(result.finalMilestone.consumedEffortDays).toBe(expectedTotalEffort);
    expect(result.finalMilestone.boundaryExtensions).toHaveLength(CONTINUATION_ROUNDS);
    expect(Money.isZero(result.finalMilestone.acceptedTerms!.referenceRate)).toBe(false);
  });
});
