import { describe, expect, it } from "vitest";
import { AdaptiveBetaPolicyV1 } from "@nashtract/adaptive-beta";
import { simulateMilestoneSeries } from "../simulations/engine.js";
import { evaluatePolicy } from "../simulations/metrics.js";
import { buildSpecs, NARRATIVE, SEED } from "../scenarios/a-calibrated-provider.js";

describe(`Scenario A — calibrated provider (seed=${SEED})`, () => {
  it(NARRATIVE, () => {
    const specs = buildSpecs();
    const result = simulateMilestoneSeries({ policy: new AdaptiveBetaPolicyV1(), specs });
    const evaluation = evaluatePolicy(result.steps);

    // 16. symmetric/no-bias evidence keeps beta near .5.
    expect(evaluation.meanBeta).toBeGreaterThan(0.35);
    expect(evaluation.meanBeta).toBeLessThan(0.65);

    // No systematic drift: first-half vs second-half mean beta should be close.
    const half = Math.floor(result.steps.length / 2);
    const firstHalfMean = evaluatePolicy(result.steps.slice(0, half)).meanBeta;
    const secondHalfMean = evaluatePolicy(result.steps.slice(half)).meanBeta;
    expect(Math.abs(firstHalfMean - secondHalfMean)).toBeLessThan(0.25);

    // A single early reading crossing the detection threshold on pure noise
    // (wide posterior, few observations) is expected and fine — what would
    // be wrong is *staying* detected. By the end of the run, with the full
    // history informing the posterior, beta must have settled back near 0.5.
    const finalBeta = result.steps.at(-1)!.beta;
    expect(Math.abs(finalBeta - 0.5)).toBeLessThan(0.15);
  });
});
