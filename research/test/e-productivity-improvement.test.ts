import { describe, expect, it } from "vitest";
import { AdaptiveBetaPolicyV1 } from "@nashtract/adaptive-beta";
import { simulateMilestoneSeries } from "../simulations/engine.js";
import { buildScenario, NARRATIVE } from "../scenarios/e-productivity-improvement.js";

describe("Scenario E — genuine productivity improvement", () => {
  it(NARRATIVE, () => {
    const { specs, endOfCalibratedPhase, endOfImprovedPhase } = buildScenario();
    const result = simulateMilestoneSeries({ policy: new AdaptiveBetaPolicyV1(), specs });

    const firstImprovedStep = result.steps[endOfCalibratedPhase + 1]!;
    // Decided purely from the calibrated history before it — no look-ahead
    // onto its own (as yet unknown) outcome — so it must still read ~0.5.
    expect(Math.abs(firstImprovedStep.beta - 0.5)).toBeLessThan(0.15);

    const betaAtEndOfImprovedPhase = result.steps[endOfImprovedPhase]!.beta;
    // By the end of a long run of genuine (but unquoted) improvement,
    // beta should have moved meaningfully toward 1 (the provider is
    // reliably faster than the estimate, same signature as overestimation).
    expect(betaAtEndOfImprovedPhase).toBeGreaterThan(0.65);

    const finalBeta = result.steps.at(-1)!.beta;
    // Once the provider recalibrates M and estimates land on target again,
    // beta should drift back toward neutral — not stay pinned at its
    // most-reactive value forever.
    expect(Math.abs(finalBeta - 0.5)).toBeLessThan(Math.abs(betaAtEndOfImprovedPhase - 0.5));
  });
});
