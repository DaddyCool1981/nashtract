/**
 * Conjugate Normal-Inverse-Gamma update (SPEC.md §8): given a prior and
 * a batch of eligible log-error observations `e_i ~ N(mu, sigma^2)`,
 * produces the posterior over (mu, sigma^2) and the derived Student's t
 * distribution for the marginal posterior of mu (sigma^2 integrated
 * out) — the standard NIG-conjugacy result:
 *
 *   mu | data ~ t_{2*alpha_n}( mu_n, beta_n / (alpha_n * kappa_n) )
 *
 * Pure function of `(prior, logErrors)` — no look-ahead, no hidden
 * state, so this is exactly the `H_{i-1}` history the caller passes,
 * nothing more (SPEC.md §8's `beta_i = F(H_{i-1})` invariant).
 */

import type { AdaptiveBetaPriorV1 } from "./prior.js";

export type NormalInverseGammaPosterior = {
  readonly observations: number;
  /** mu_n: posterior mean of the bias signal mu. */
  readonly mu: number;
  readonly kappa: number;
  readonly alpha: number;
  /** beta_n: posterior NIG scale (not the settlement deviation-sharing beta). */
  readonly beta: number;
  /** Degrees of freedom of mu's marginal Student's t posterior: 2*alpha_n. */
  readonly degreesOfFreedom: number;
  /** Scale of mu's marginal Student's t posterior: sqrt(beta_n / (alpha_n * kappa_n)). */
  readonly scale: number;
  /** Actual standard deviation of that t-distribution (finite because alpha0=2 already guarantees df>2). */
  readonly stdOfMu: number;
};

export function computePosterior(
  prior: AdaptiveBetaPriorV1,
  logErrors: readonly number[]
): NormalInverseGammaPosterior {
  const n = logErrors.length;
  const mean = n === 0 ? prior.mu0 : logErrors.reduce((sum, e) => sum + e, 0) / n;
  const sumSquaredDeviations = logErrors.reduce((sum, e) => sum + (e - mean) * (e - mean), 0);

  const kappaN = prior.kappa0 + n;
  const muN = (prior.kappa0 * prior.mu0 + n * mean) / kappaN;
  const alphaN = prior.alpha0 + n / 2;
  const betaN = prior.beta0 + 0.5 * sumSquaredDeviations + (prior.kappa0 * n * (mean - prior.mu0) ** 2) / (2 * kappaN);

  const degreesOfFreedom = 2 * alphaN;
  const scale = Math.sqrt(betaN / (alphaN * kappaN));
  const stdOfMu =
    degreesOfFreedom > 2 ? scale * Math.sqrt(degreesOfFreedom / (degreesOfFreedom - 2)) : Number.POSITIVE_INFINITY;

  return {
    observations: n,
    mu: muN,
    kappa: kappaN,
    alpha: alphaN,
    beta: betaN,
    degreesOfFreedom,
    scale,
    stdOfMu,
  };
}
