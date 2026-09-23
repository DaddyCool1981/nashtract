import { describe, expect, it } from "vitest";
import { Money, FixedBetaPolicy } from "@nashtract/core";
import { AdaptiveBetaPolicyV1 } from "@nashtract/adaptive-beta";
import { simulateMilestoneSeries } from "../simulations/engine.js";
import { evaluatePolicy } from "../simulations/metrics.js";
import { buildSpecs, NARRATIVE, RATIOS } from "../scenarios/c-systematic-underestimation.js";

describe(`Scenario C — systematic underestimation`, () => {
  it(NARRATIVE, () => {
    for (const ratio of RATIOS) {
      const specs = buildSpecs(ratio);

      const adaptive = simulateMilestoneSeries({ policy: new AdaptiveBetaPolicyV1(), specs });
      const fixed = simulateMilestoneSeries({ policy: new FixedBetaPolicy(0.5), specs });

      // 18/20: strong persistent underestimation should push beta toward the lower bound.
      const finalBeta = adaptive.steps.at(-1)!.beta;
      if (ratio >= 1.25) {
        expect(finalBeta).toBeLessThan(0.2);
      } else {
        expect(finalBeta).toBeLessThan(0.5);
      }

      // The client is protected from paying full reference rate for every
      // overrun (SPEC.md §1.3): cumulative client cost beyond the accepted
      // estimate should be smaller (less negative) under adaptive beta than
      // under a fixed 0.5 that never reacts.
      const adaptiveDelta = Number(
        Money.toDecimalString(evaluatePolicy(adaptive.steps).cumulativeClientDeltaVsAcceptedEstimates)
      );
      const fixedDelta = Number(
        Money.toDecimalString(evaluatePolicy(fixed.steps).cumulativeClientDeltaVsAcceptedEstimates)
      );
      expect(adaptiveDelta).toBeGreaterThan(fixedDelta);
    }
  });
});
