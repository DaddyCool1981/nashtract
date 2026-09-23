export type { AdaptiveBetaPriorV1 } from "./prior.js";
export { DEFAULT_PRIOR_V1 } from "./prior.js";

export { logGamma, regularizedIncompleteBeta, studentTCdf } from "./studentT.js";

export type { NormalInverseGammaPosterior } from "./posterior.js";
export { computePosterior } from "./posterior.js";

export type { AdaptiveBetaDecision, AdaptiveBetaPolicyV1Options } from "./policy.js";
export {
  AdaptiveBetaPolicyV1,
  POLICY_VERSION_V1,
  EQUIVALENCE_MARGIN_V1,
  MIN_OBSERVATIONS_V1,
  DEFAULT_BOUNDS_V1,
} from "./policy.js";

// Re-exported for ergonomics: SPEC.md §20 groups "AdaptiveBetaPolicyV1,
// fixed-beta fallback" as one Phase 3 deliverable. The fallback itself
// lives in @nashtract/core (it has no statistical machinery at all).
export { FixedBetaPolicy, FIXED_BETA_POLICY_VERSION_V0 } from "@nashtract/core";
