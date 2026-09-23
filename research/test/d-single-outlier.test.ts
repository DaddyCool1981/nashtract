import { describe, expect, it } from "vitest";
import { AdaptiveBetaPolicyV1 } from "@nashtract/adaptive-beta";
import { simulateMilestoneSeries } from "../simulations/engine.js";
import {
  buildPersistentComparisonSpecs,
  buildSpecs,
  CALIBRATED_BEFORE,
  NARRATIVE,
} from "../scenarios/d-single-outlier.js";

describe("Scenario D — single extreme outlier", () => {
  it.each([0.25, 4])(`${NARRATIVE} (ratio=%s)`, (outlierRatio) => {
    const outlierRun = simulateMilestoneSeries({
      policy: new AdaptiveBetaPolicyV1(),
      specs: buildSpecs(outlierRatio),
    });
    const persistentRun = simulateMilestoneSeries({
      policy: new AdaptiveBetaPolicyV1(),
      specs: buildPersistentComparisonSpecs(outlierRatio),
    });

    // The first decision informed by the outlier (i.e. the milestone
    // right after it — beta is decided from history *before* it, per
    // the no-look-ahead invariant, so this is the earliest point the
    // outlier could possibly move beta).
    const checkIndex = CALIBRATED_BEFORE + 1;
    const outlierBeta = outlierRun.steps[checkIndex]!.beta;
    const persistentBeta = persistentRun.steps[checkIndex]!.beta;

    const outlierDeviation = Math.abs(outlierBeta - 0.5);
    const persistentDeviation = Math.abs(persistentBeta - 0.5);

    // 21. one isolated outlier has limited effect versus persistent same-sign evidence.
    expect(outlierDeviation).toBeLessThan(persistentDeviation * 0.5);
    expect(outlierDeviation).toBeLessThan(0.3);
  });
});
