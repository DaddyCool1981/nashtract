import { describe, expect, it } from "vitest";
import { AdaptiveBetaPolicyV1 } from "@nashtract/adaptive-beta";
import { deriveCalibrationHistory, deriveEligibleCalibrationHistory } from "@nashtract/ledger";
import { simulateMilestoneSeries } from "../simulations/engine.js";
import { buildSpecs, CALIBRATED_BEFORE, NARRATIVE, SCOPE_CHANGE_REASON } from "../scenarios/f-scope-change.js";

describe("Scenario F — scope change", () => {
  it(NARRATIVE, () => {
    const excludedRun = simulateMilestoneSeries({
      policy: new AdaptiveBetaPolicyV1(),
      specs: buildSpecs({ excluded: true }),
    });
    const notExcludedRun = simulateMilestoneSeries({
      policy: new AdaptiveBetaPolicyV1(),
      specs: buildSpecs({ excluded: false }),
    });

    // 22/23: the observation stays visible in full history either way...
    const excludedFullHistory = deriveCalibrationHistory(excludedRun.finalState);
    const scopeChangeEntry = excludedFullHistory.find((e) => e.milestoneId.endsWith(`-m${CALIBRATED_BEFORE}`));
    expect(scopeChangeEntry).toBeDefined();
    expect(scopeChangeEntry!.eligible).toBe(false);
    expect(scopeChangeEntry!.exclusionReason).toBe(SCOPE_CHANGE_REASON);

    // ...but is absent from what a BetaPolicy actually sees.
    const eligibleAfterExclusion = deriveEligibleCalibrationHistory(excludedRun.finalState);
    expect(eligibleAfterExclusion.some((o) => o.milestoneId.endsWith(`-m${CALIBRATED_BEFORE}`))).toBe(false);

    // Explicit exclusion keeps beta stable; leaving the anomaly in pulls it away from 0.5.
    const finalBetaExcluded = excludedRun.steps.at(-1)!.beta;
    const finalBetaNotExcluded = notExcludedRun.steps.at(-1)!.beta;
    expect(Math.abs(finalBetaExcluded - 0.5)).toBeLessThan(Math.abs(finalBetaNotExcluded - 0.5));
    expect(Math.abs(finalBetaExcluded - 0.5)).toBeLessThan(0.15);
  });
});
