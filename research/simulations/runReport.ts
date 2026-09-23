#!/usr/bin/env tsx
/**
 * Runs every SPEC.md §16 scenario and writes reproducible JSON results
 * to `research/results/` — the actual evidence behind README claims,
 * not a hand-picked screenshot (SPEC.md §19). Every stochastic run's
 * seed is a literal constant in its scenario module; rerunning this
 * script reproduces byte-identical output.
 *
 *   pnpm --filter @nashtract/research report
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { FixedBetaPolicy } from "@nashtract/core";
import { AdaptiveBetaPolicyV1 } from "@nashtract/adaptive-beta";
import { deriveCalibrationHistory } from "@nashtract/ledger";

import { simulateMilestoneSeries } from "./engine.js";
import { evaluatePolicy } from "./metrics.js";
import { toReportJson } from "./report.js";

import * as A from "../scenarios/a-calibrated-provider.js";
import * as B from "../scenarios/b-salami-overestimation.js";
import * as C from "../scenarios/c-systematic-underestimation.js";
import * as D from "../scenarios/d-single-outlier.js";
import * as E from "../scenarios/e-productivity-improvement.js";
import * as F from "../scenarios/f-scope-change.js";
import * as G from "../scenarios/g-boundary-rebaseline.js";

const RESULTS_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "results");
mkdirSync(RESULTS_DIR, { recursive: true });

function write(name: string, data: unknown): void {
  const path = join(RESULTS_DIR, `${name}.json`);
  writeFileSync(path, toReportJson(data) + "\n", "utf8");
  console.log(`wrote ${path}`);
}

// A — calibrated provider
{
  const specs = A.buildSpecs();
  const result = simulateMilestoneSeries({ policy: new AdaptiveBetaPolicyV1(), specs });
  write("a-calibrated-provider", {
    narrative: A.NARRATIVE,
    seed: A.SEED,
    observationCount: A.OBSERVATION_COUNT,
    logErrorStdDev: A.LOG_ERROR_STD_DEV,
    steps: result.steps,
    evaluation: evaluatePolicy(result.steps),
  });
}

// B — salami overestimation
{
  const perRatio = Object.fromEntries(
    B.RATIOS.map((ratio) => {
      const specs = B.buildSpecs(ratio);
      const adaptive = simulateMilestoneSeries({ policy: new AdaptiveBetaPolicyV1(), specs });
      const fixed = simulateMilestoneSeries({ policy: new FixedBetaPolicy(0.5), specs });
      return [
        ratio,
        {
          adaptive: { finalBeta: adaptive.steps.at(-1)!.beta, evaluation: evaluatePolicy(adaptive.steps) },
          fixed: { finalBeta: fixed.steps.at(-1)!.beta, evaluation: evaluatePolicy(fixed.steps) },
        },
      ];
    })
  );
  write("b-salami-overestimation", { narrative: B.NARRATIVE, observationsPerRatio: B.OBSERVATIONS_PER_RATIO, perRatio });
}

// C — systematic underestimation
{
  const perRatio = Object.fromEntries(
    C.RATIOS.map((ratio) => {
      const specs = C.buildSpecs(ratio);
      const adaptive = simulateMilestoneSeries({ policy: new AdaptiveBetaPolicyV1(), specs });
      const fixed = simulateMilestoneSeries({ policy: new FixedBetaPolicy(0.5), specs });
      return [
        ratio,
        {
          adaptive: { finalBeta: adaptive.steps.at(-1)!.beta, evaluation: evaluatePolicy(adaptive.steps) },
          fixed: { finalBeta: fixed.steps.at(-1)!.beta, evaluation: evaluatePolicy(fixed.steps) },
        },
      ];
    })
  );
  write("c-systematic-underestimation", { narrative: C.NARRATIVE, observationsPerRatio: C.OBSERVATIONS_PER_RATIO, perRatio });
}

// D — single extreme outlier
{
  const perRatio = Object.fromEntries(
    [0.25, 4].map((ratio) => {
      const checkIndex = D.CALIBRATED_BEFORE + 1;
      const outlier = simulateMilestoneSeries({ policy: new AdaptiveBetaPolicyV1(), specs: D.buildSpecs(ratio) });
      const persistent = simulateMilestoneSeries({
        policy: new AdaptiveBetaPolicyV1(),
        specs: D.buildPersistentComparisonSpecs(ratio),
      });
      return [
        ratio,
        {
          outlierBetaAfter: outlier.steps[checkIndex]!.beta,
          persistentBetaAtSameIndex: persistent.steps[checkIndex]!.beta,
        },
      ];
    })
  );
  write("d-single-outlier", { narrative: D.NARRATIVE, calibratedBefore: D.CALIBRATED_BEFORE, perRatio });
}

// E — genuine productivity improvement
{
  const { specs, endOfCalibratedPhase, endOfImprovedPhase } = E.buildScenario();
  const result = simulateMilestoneSeries({ policy: new AdaptiveBetaPolicyV1(), specs });
  write("e-productivity-improvement", {
    narrative: E.NARRATIVE,
    endOfCalibratedPhase,
    endOfImprovedPhase,
    steps: result.steps,
    evaluation: evaluatePolicy(result.steps, { recalibrationStepIndex: endOfImprovedPhase }),
  });
}

// F — scope change
{
  const excluded = simulateMilestoneSeries({ policy: new AdaptiveBetaPolicyV1(), specs: F.buildSpecs({ excluded: true }) });
  const notExcluded = simulateMilestoneSeries({
    policy: new AdaptiveBetaPolicyV1(),
    specs: F.buildSpecs({ excluded: false }),
  });
  write("f-scope-change", {
    narrative: F.NARRATIVE,
    excluded: {
      finalBeta: excluded.steps.at(-1)!.beta,
      fullHistory: deriveCalibrationHistory(excluded.finalState),
    },
    notExcluded: {
      finalBeta: notExcluded.steps.at(-1)!.beta,
      fullHistory: deriveCalibrationHistory(notExcluded.finalState),
    },
  });
}

// G — boundary/rebaseline attack
{
  const result = G.runBoundaryRebaselineAttack();
  write("g-boundary-rebaseline", { narrative: G.NARRATIVE, ...result });
}

console.log("\nDone. See research/results/*.json — rerun this script any time to reproduce byte-identical output.");
