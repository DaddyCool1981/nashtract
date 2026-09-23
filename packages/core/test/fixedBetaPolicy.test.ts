import { describe, expect, it } from "vitest";
import { FixedBetaPolicy } from "../src/fixedBetaPolicy.js";

describe("FixedBetaPolicy", () => {
  it("always returns the configured beta regardless of history", () => {
    const policy = new FixedBetaPolicy(0.5);
    expect(policy.decide([]).beta).toBe(0.5);
    expect(
      policy.decide([{ milestoneId: "m1", estimateDays: 5, actualDays: 50, logError: Math.log(10) }]).beta
    ).toBe(0.5);
  });

  it("defaults to 0.5 and rejects out-of-range values", () => {
    expect(new FixedBetaPolicy().decide([]).beta).toBe(0.5);
    expect(() => new FixedBetaPolicy(1.5)).toThrow(RangeError);
    expect(() => new FixedBetaPolicy(-0.1)).toThrow(RangeError);
  });

  it("reports eligibleObservations from the history length", () => {
    const policy = new FixedBetaPolicy(0.5);
    const history = [
      { milestoneId: "m1", estimateDays: 5, actualDays: 5, logError: 0 },
      { milestoneId: "m2", estimateDays: 4, actualDays: 4, logError: 0 },
    ];
    expect(policy.decide(history).eligibleObservations).toBe(2);
  });
});
