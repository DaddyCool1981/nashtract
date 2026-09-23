/**
 * SPEC.md §8: the Normal-Inverse-Gamma prior over (mu, sigma^2), where
 * mu is the persistent estimation-bias signal this policy is trying to
 * detect. "Recommended experimental engineering prior, not a canonical
 * mathematical constant" — versioned, not hidden.
 *
 * Naming note: `beta0` here is the NIG prior's *scale* parameter, not
 * the settlement deviation-sharing β (SPEC.md §3, §4). The collision is
 * inherited verbatim from SPEC.md §8's own type — kept as-is for spec
 * fidelity, but nowhere else in this codebase does `beta0` mean
 * anything other than this NIG parameter.
 */
export type AdaptiveBetaPriorV1 = {
  readonly mu0: number;
  readonly kappa0: number;
  readonly alpha0: number;
  readonly beta0: number;
};

export const DEFAULT_PRIOR_V1: AdaptiveBetaPriorV1 = Object.freeze({
  mu0: 0,
  kappa0: 1,
  alpha0: 2,
  beta0: 0.25,
});
