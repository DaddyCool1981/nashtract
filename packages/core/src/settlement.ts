/**
 * The core settlement equation (SPEC.md §4):
 *
 *   P(T) = r [ M + β(T − M) ]
 *
 * and the maximum-exposure boundary (SPEC.md §5):
 *
 *   P_max = r [ M + β(U − M) ]
 *   E_Y   = r (1 − β)(U − M)     (provider proxy exposure, explanatory only)
 *
 * All monetary computation happens in exact Rational space and is
 * rounded back to Money exactly once, at the end (SPEC.md §13:
 * money MUST NOT use binary floating point).
 */

import { betaToRational } from "./beta.js";
import { effortToRational } from "./effort.js";
import { ExposureBoundaryExceededError, InvalidAcceptedTermsError } from "./errors.js";
import * as Money from "./money.js";
import * as R from "./rational.js";
import type { AcceptedTerms, Exposure, Settlement } from "./types.js";

function assertValidTerms(terms: AcceptedTerms): void {
  if (!(terms.estimateDays > 0)) {
    throw new InvalidAcceptedTermsError(`estimateDays (M) must be > 0, got ${terms.estimateDays}`);
  }
  if (!(terms.boundaryDays >= terms.estimateDays)) {
    throw new InvalidAcceptedTermsError(
      `boundaryDays (U) must be >= estimateDays (M): U=${terms.boundaryDays}, M=${terms.estimateDays}`
    );
  }
  if (!(terms.beta >= 0 && terms.beta <= 1)) {
    throw new InvalidAcceptedTermsError(`beta must be within [0, 1], got ${terms.beta}`);
  }
  if (Money.isNegative(terms.referenceRate)) {
    throw new InvalidAcceptedTermsError(`referenceRate (r) must not be negative`);
  }
}

/** r * effortDays, as an exact Rational (currency-denominated, unrounded). */
function rateTimesEffort(rate: R.Rational, days: R.Rational): R.Rational {
  return R.multiply(rate, days);
}

export function calculateSettlement(terms: AcceptedTerms, actualDays: number): Settlement {
  assertValidTerms(terms);

  if (!Number.isFinite(actualDays) || actualDays <= 0) {
    throw new InvalidAcceptedTermsError(`actualDays (T) must be > 0, got ${actualDays}`);
  }
  if (actualDays > terms.boundaryDays) {
    throw new ExposureBoundaryExceededError(
      `actualDays (T=${actualDays}) exceeds boundaryDays (U=${terms.boundaryDays}); ` +
        `no automatic settlement beyond the exposure boundary. Use a continuation milestone.`
    );
  }

  const currency = terms.referenceRate.currency;
  const exponent = terms.referenceRate.exponent;
  const r = Money.toRational(terms.referenceRate);
  const m = effortToRational(terms.estimateDays);
  const t = effortToRational(actualDays);
  const beta = betaToRational(terms.beta);

  // P(T) = r [ M + β(T - M) ]
  const deviation = R.subtract(t, m);
  const shared = R.multiply(beta, deviation);
  const paymentExact = rateTimesEffort(r, R.add(m, shared));
  const payment = Money.fromRational(paymentExact, currency, exponent);

  const estimatedBudgetExact = rateTimesEffort(r, m);
  const estimatedBudget = Money.fromRational(estimatedBudgetExact, currency, exponent);

  const timeAndMaterialsExact = rateTimesEffort(r, t);
  const timeAndMaterialsEquivalent = Money.fromRational(timeAndMaterialsExact, currency, exponent);

  const clientDeltaVsEstimate = Money.subtract(estimatedBudget, payment);
  const providerDeltaVsTimeAndMaterials = Money.subtract(payment, timeAndMaterialsEquivalent);

  const effectiveDailyRate = Money.fromRational(R.divide(paymentExact, t), currency, exponent);

  return {
    payment,
    actualDays,
    effectiveDailyRate,
    estimatedBudget,
    timeAndMaterialsEquivalent,
    clientDeltaVsEstimate,
    providerDeltaVsTimeAndMaterials,
    beta: terms.beta,
  };
}

export function calculateMaximumExposure(terms: AcceptedTerms): Exposure {
  assertValidTerms(terms);

  const currency = terms.referenceRate.currency;
  const exponent = terms.referenceRate.exponent;
  const r = Money.toRational(terms.referenceRate);
  const m = effortToRational(terms.estimateDays);
  const u = effortToRational(terms.boundaryDays);
  const beta = betaToRational(terms.beta);

  const headroom = R.subtract(u, m); // (U - M), always >= 0 given assertValidTerms

  // P_max = r [ M + β(U - M) ]
  const maximumPaymentExact = rateTimesEffort(r, R.add(m, R.multiply(beta, headroom)));
  const maximumPayment = Money.fromRational(maximumPaymentExact, currency, exponent);

  // E_Y = r (1 - β)(U - M)  — explanatory proxy exposure, not accounting.
  const oneMinusBeta = R.subtract(R.ONE, beta);
  const providerProxyExposureExact = rateTimesEffort(r, R.multiply(oneMinusBeta, headroom));
  const providerProxyExposure = Money.fromRational(providerProxyExposureExact, currency, exponent);

  return {
    maximumPayment,
    providerProxyExposure,
    boundaryDays: terms.boundaryDays,
  };
}
