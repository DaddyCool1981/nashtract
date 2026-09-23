export * as Money from "./money.js";
export * as Rational from "./rational.js";
/** The `Money` value type (as opposed to the `Money` namespace of functions above). */
export type { Money as MoneyAmount } from "./money.js";
/** The `Rational` value type (as opposed to the `Rational` namespace of functions above). */
export type { Rational as RationalNumber } from "./rational.js";

export { EFFORT_DECIMAL_PRECISION, effortToRational } from "./effort.js";
export { BETA_DECIMAL_PRECISION, betaToRational } from "./beta.js";

export {
  NashTractDomainError,
  InvalidAcceptedTermsError,
  ExposureBoundaryExceededError,
  InvalidMilestoneTransitionError,
} from "./errors.js";

export type {
  ResultDefinition,
  AcceptedTerms,
  Settlement,
  Exposure,
  CalibrationObservation,
  EligibleCalibrationObservation,
  BetaDecision,
  BetaPolicy,
} from "./types.js";

export { calculateSettlement, calculateMaximumExposure } from "./settlement.js";
export { calculateCalibrationObservation } from "./calibration.js";

export type { MilestoneState, MilestoneEvent } from "./stateMachine.js";
export {
  TERMINAL_STATES,
  transitionMilestoneState,
  isTerminalMilestoneState,
  allowedMilestoneEvents,
} from "./stateMachine.js";
