import { describe, expect, it } from "vitest";
import { FixedBetaPolicy, Money } from "@nashtract/core";
import { evaluatePolicy, simulateMilestoneSeries } from "../simulations/index.js";

describe("simulateMilestoneSeries: engine smoke tests", () => {
  it("matches the canonical example (SPEC.md §23) for a single on-target milestone", () => {
    const result = simulateMilestoneSeries({
      policy: new FixedBetaPolicy(0.5),
      specs: [{ estimateDays: 5, boundaryDays: 8, actualRatio: 3 / 5 }],
    });
    expect(result.steps).toHaveLength(1);
    expect(Money.toDecimalString(result.steps[0]!.payment)).toBe("6000.00");
    expect(result.steps[0]!.continuationsUsed).toBe(0);
  });

  it("handles effort exceeding the initial boundary via an automatic continuation round", () => {
    const result = simulateMilestoneSeries({
      policy: new FixedBetaPolicy(0.5),
      specs: [{ estimateDays: 5, boundaryDays: 6, actualRatio: 2 }], // T = 10, U0 = 6
    });
    const step = result.steps[0]!;
    expect(step.actualDays).toBe(10);
    expect(step.continuationsUsed).toBe(1);
    expect(step.boundaryDays).toBe(6); // original boundary on the record, unchanged
    const milestone = result.finalState.milestones.get(step.milestoneId)!;
    expect(milestone.state).toBe("SETTLED");
    expect(milestone.acceptedTerms!.boundaryDays).toBe(6); // frozen original, never mutated
  });

  it("feeds no-look-ahead history across milestones: beta_i excludes milestone i's own outcome", () => {
    const result = simulateMilestoneSeries({
      policy: new FixedBetaPolicy(0.5), // fixed policy makes eligibleObservationsAtDecision easy to check regardless of beta math
      specs: [
        { estimateDays: 5, actualRatio: 1 },
        { estimateDays: 5, actualRatio: 1 },
        { estimateDays: 5, actualRatio: 1 },
      ],
    });
    expect(result.steps.map((s) => s.eligibleObservationsAtDecision)).toEqual([0, 1, 2]);
  });

  it("evaluatePolicy computes sane cumulative deltas for a calibrated series", () => {
    const result = simulateMilestoneSeries({
      policy: new FixedBetaPolicy(0.5),
      specs: Array.from({ length: 5 }, () => ({ estimateDays: 5, actualRatio: 1 })),
    });
    const evaluation = evaluatePolicy(result.steps);
    expect(evaluation.meanBeta).toBe(0.5);
    expect(evaluation.betaVolatility).toBe(0);
    // T = M every time, so nobody has a delta vs. anything.
    expect(Money.isZero(evaluation.cumulativeClientDeltaVsTimeAndMaterials)).toBe(true);
    expect(Money.isZero(evaluation.cumulativeProviderDeltaVsTimeAndMaterials)).toBe(true);
    expect(Money.isZero(evaluation.cumulativeClientDeltaVsAcceptedEstimates)).toBe(true);
  });
});
