import { describe, expect, it } from "vitest";
import type { EligibleCalibrationObservation } from "@nashtract/core";
import { AdaptiveBetaPolicyV1 } from "../src/policy.js";
import { gaussianSampler } from "./prng.js";

function observation(logError: number, milestoneId = "m"): EligibleCalibrationObservation {
  const estimateDays = 5;
  return { milestoneId, estimateDays, actualDays: estimateDays * Math.exp(logError), logError };
}

function repeat(logError: number, n: number): EligibleCalibrationObservation[] {
  return Array.from({ length: n }, (_, i) => observation(logError, `m${i}`));
}

describe("AdaptiveBetaPolicyV1", () => {
  it("uses beta=0.5 for the first minObservations (default 3), regardless of content", () => {
    const policy = new AdaptiveBetaPolicyV1();
    expect(policy.decide([]).beta).toBe(0.5);
    expect(policy.decide(repeat(Math.log(0.1), 1)).beta).toBe(0.5); // extreme single outlier, still gated
    expect(policy.decide(repeat(Math.log(0.1), 2)).beta).toBe(0.5);
    // still reports the underlying statistics even while gated
    const gated = policy.decide(repeat(Math.log(0.1), 2));
    expect(gated.eligibleObservations).toBe(2);
    expect(gated.policyVersion).toBe("adaptive-beta-v1");
  });

  it("15. beta_i = F(H_{i-1}): decide() is a pure function of exactly the history passed in", () => {
    const policy = new AdaptiveBetaPolicyV1();
    const history = repeat(Math.log(0.8), 5);
    const first = policy.decide(history);
    const second = policy.decide(history);
    expect(second).toEqual(first);
    // A milestone's own (not-yet-settled) outcome is, by construction,
    // never part of `history` — appending it would be a caller bug, and
    // exactly demonstrates the point: it visibly changes the decision.
    const withCurrentMilestoneLeakedIn = policy.decide([...history, observation(Math.log(5), "current")]);
    expect(withCurrentMilestoneLeakedIn.beta).not.toBe(first.beta);
  });

  it("16. calibrated provider (symmetric noise, seed=42): beta stays near 0.5, no systematic drift", () => {
    const sample = gaussianSampler(42, 0, 0.3);
    const history = Array.from({ length: 40 }, (_, i) => observation(sample(), `m${i}`));
    const decision = new AdaptiveBetaPolicyV1().decide(history);
    expect(decision.beta).toBeGreaterThan(0.3);
    expect(decision.beta).toBeLessThan(0.7);
  });

  it("17/19. persistent overestimation (T<M) moves beta upward, strongly with enough evidence", () => {
    const policy = new AdaptiveBetaPolicyV1();
    const mild = policy.decide(repeat(Math.log(0.85), 5));
    expect(mild.beta).toBeGreaterThan(0.5);

    const strong = policy.decide(repeat(Math.log(0.6), 20));
    expect(strong.beta).toBeGreaterThan(0.9); // tends toward the upper bound
    expect(strong.probabilityOverestimating).toBeGreaterThan(strong.probabilityUnderestimating);
  });

  it("18/20. persistent underestimation (T>M) moves beta downward, strongly with enough evidence", () => {
    const policy = new AdaptiveBetaPolicyV1();
    const mild = policy.decide(repeat(Math.log(1.2), 5));
    expect(mild.beta).toBeLessThan(0.5);

    const strong = policy.decide(repeat(Math.log(1.7), 20));
    expect(strong.beta).toBeLessThan(0.1); // tends toward the lower bound
    expect(strong.probabilityUnderestimating).toBeGreaterThan(strong.probabilityOverestimating);
  });

  it("21. one isolated outlier moves beta far less than the same signal repeated persistently", () => {
    const policy = new AdaptiveBetaPolicyV1();
    const calibrated = repeat(0, 14);

    const withOneOutlier = policy.decide([...calibrated, observation(Math.log(4), "outlier")]);
    const allExtreme = policy.decide(repeat(Math.log(4), 15));

    const outlierDeviation = Math.abs(withOneOutlier.beta - 0.5);
    const persistentDeviation = Math.abs(allExtreme.beta - 0.5);

    // The isolated outlier still nudges beta (it is evidence), but far
    // less than the same magnitude signal repeated across the whole
    // history — that gap is the actual invariant, not either number
    // in isolation.
    expect(outlierDeviation).toBeLessThan(persistentDeviation * 0.6);
    expect(persistentDeviation).toBeGreaterThan(0.35);
  });

  it("operational bounds narrow beta away from the [0,1] extremes when configured", () => {
    const bounded = new AdaptiveBetaPolicyV1({ bounds: [0.1, 0.9] });
    const decision = bounded.decide(repeat(Math.log(0.1), 50)); // overwhelming persistent evidence
    expect(decision.beta).toBeLessThanOrEqual(0.9);
    expect(decision.beta).toBeGreaterThanOrEqual(0.1);
  });

  it("rejects invalid construction options", () => {
    expect(() => new AdaptiveBetaPolicyV1({ equivalenceMargin: 0 })).toThrow(RangeError);
    expect(() => new AdaptiveBetaPolicyV1({ bounds: [0.5, 0.5] })).toThrow(RangeError);
    expect(() => new AdaptiveBetaPolicyV1({ bounds: [-0.1, 1] })).toThrow(RangeError);
  });
});
