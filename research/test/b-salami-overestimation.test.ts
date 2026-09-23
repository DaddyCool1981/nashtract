import { describe, expect, it } from "vitest";
import { Money, FixedBetaPolicy } from "@nashtract/core";
import { AdaptiveBetaPolicyV1 } from "@nashtract/adaptive-beta";
import { simulateMilestoneSeries } from "../simulations/engine.js";
import { evaluatePolicy } from "../simulations/metrics.js";
import { buildSpecs, NARRATIVE, RATIOS } from "../scenarios/b-salami-overestimation.js";

describe(`Scenario B — salami overestimation`, () => {
  it(NARRATIVE, () => {
    for (const ratio of RATIOS) {
      const specs = buildSpecs(ratio);

      const adaptive = simulateMilestoneSeries({ policy: new AdaptiveBetaPolicyV1(), specs });
      const fixed = simulateMilestoneSeries({ policy: new FixedBetaPolicy(0.5), specs });

      const adaptiveEval = evaluatePolicy(adaptive.steps);
      const fixedEval = evaluatePolicy(fixed.steps);

      // 17/19: strong persistent overestimation should push beta toward the upper bound.
      const finalBeta = adaptive.steps.at(-1)!.beta;
      if (ratio <= 0.75) {
        expect(finalBeta).toBeGreaterThan(0.8);
      } else {
        expect(finalBeta).toBeGreaterThan(0.5);
      }

      // The residual salami profitability is explicitly measured (SPEC.md §17's
      // research question), not hidden: fixed beta grants an unbounded,
      // constant-rate premium every milestone; adaptive should grant materially
      // less cumulative premium over the same series because it converges
      // toward beta=1 (pure T&M, no premium at all) as evidence accumulates.
      const adaptivePremium = Number(
        Money.toDecimalString(adaptiveEval.cumulativeProviderDeltaVsTimeAndMaterials)
      );
      const fixedPremium = Number(Money.toDecimalString(fixedEval.cumulativeProviderDeltaVsTimeAndMaterials));
      expect(adaptivePremium).toBeLessThan(fixedPremium);

      // Never negative for the provider under either policy at 0<=beta<=1, T<M
      // (SPEC.md §4: 0<beta<1, T<M => rT<P<rM, so provider premium over T&M is >= 0).
      expect(adaptivePremium).toBeGreaterThanOrEqual(-1e-6);
      expect(fixedPremium).toBeGreaterThanOrEqual(-1e-6);
    }
  });
});
