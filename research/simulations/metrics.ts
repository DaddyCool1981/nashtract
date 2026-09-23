/**
 * SPEC.md §17 `PolicyEvaluation`. "Do not judge a policy because a
 * graph 'looks good'" — these are the numbers the research question
 * ("does adaptive beta materially reduce the profitability of
 * persistent estimation bias while preserving rewards for genuine
 * efficiency and avoiding overreaction to noise?") actually turns on.
 */

import { Money, type MoneyAmount } from "@nashtract/core";
import type { StepRecord } from "./engine.js";

export type PolicyEvaluation = {
  readonly cumulativeClientDeltaVsTimeAndMaterials: MoneyAmount;
  readonly cumulativeProviderDeltaVsTimeAndMaterials: MoneyAmount;
  readonly cumulativeClientDeltaVsAcceptedEstimates: MoneyAmount;
  readonly meanBeta: number;
  readonly betaVolatility: number;
  readonly maxSingleStepBetaChange: number;
  readonly observationsToDetectPersistentBias?: number;
  readonly effortToDetectPersistentBias?: number;
  readonly recoveryObservationsAfterRecalibration?: number;
};

function sumMoney(values: readonly MoneyAmount[]): MoneyAmount {
  if (values.length === 0) {
    throw new RangeError("sumMoney: at least one value is required (to know currency/exponent)");
  }
  return values.reduce((acc, v) => Money.add(acc, v), Money.zero(values[0]!.currency, values[0]!.exponent));
}

function mean(values: readonly number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** Population standard deviation — this is a descriptive statistic over an observed run, not an inference target. */
function stdDev(values: readonly number[]): number {
  const m = mean(values);
  return Math.sqrt(mean(values.map((v) => (v - m) ** 2)));
}

export type DetectionOptions = {
  /** |beta - 0.5| threshold counted as "bias detected". A reporting convention, not a tuned model parameter — SPEC.md §21. */
  readonly detectionThreshold?: number;
  /** Step index (0-based) after which "recovery toward neutral" is measured (e.g. after a mid-run recalibration). */
  readonly recalibrationStepIndex?: number;
  /** |beta - 0.5| threshold counted as "recovered". */
  readonly recoveryThreshold?: number;
};

export function evaluatePolicy(steps: readonly StepRecord[], options: DetectionOptions = {}): PolicyEvaluation {
  if (steps.length === 0) {
    throw new RangeError("evaluatePolicy: at least one step is required");
  }
  const detectionThreshold = options.detectionThreshold ?? 0.2;
  const recoveryThreshold = options.recoveryThreshold ?? 0.1;

  const betas = steps.map((s) => s.beta);
  const betaChanges = betas.slice(1).map((b, i) => Math.abs(b - betas[i]!));

  const detectedStep = steps.find((s) => Math.abs(s.beta - 0.5) >= detectionThreshold);
  let effortToDetect: number | undefined;
  if (detectedStep) {
    effortToDetect = 0;
    for (const s of steps) {
      effortToDetect += s.actualDays;
      if (s.index === detectedStep.index) break;
    }
  }

  let recoveryObservations: number | undefined;
  if (options.recalibrationStepIndex !== undefined) {
    const after = steps.filter((s) => s.index > options.recalibrationStepIndex!);
    const recovered = after.find((s) => Math.abs(s.beta - 0.5) <= recoveryThreshold);
    if (recovered) {
      recoveryObservations = recovered.index - options.recalibrationStepIndex!;
    }
  }

  return {
    cumulativeClientDeltaVsTimeAndMaterials: sumMoney(steps.map((s) => s.clientDeltaVsTimeAndMaterials)),
    cumulativeProviderDeltaVsTimeAndMaterials: sumMoney(steps.map((s) => s.providerDeltaVsTimeAndMaterials)),
    cumulativeClientDeltaVsAcceptedEstimates: sumMoney(steps.map((s) => s.clientDeltaVsEstimate)),
    meanBeta: mean(betas),
    betaVolatility: stdDev(betas),
    maxSingleStepBetaChange: betaChanges.length > 0 ? Math.max(...betaChanges) : 0,
    ...(detectedStep ? { observationsToDetectPersistentBias: detectedStep.index + 1 } : {}),
    ...(effortToDetect !== undefined ? { effortToDetectPersistentBias: effortToDetect } : {}),
    ...(recoveryObservations !== undefined ? { recoveryObservationsAfterRecalibration: recoveryObservations } : {}),
  };
}
