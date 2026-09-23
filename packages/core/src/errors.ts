/** Base class for all domain errors raised by @nashtract/core. */
export class NashTractDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

/** Accepted terms violate a core invariant (e.g. `0 < M <= U` or `0 <= beta <= 1`). */
export class InvalidAcceptedTermsError extends NashTractDomainError {}

/**
 * An operation would require, or report on, effort beyond the frozen
 * exposure boundary `U`. Per SPEC.md §5 and §21, the system MUST NOT
 * authorize automatic effort beyond `U` — this error is the core-level
 * enforcement of that guardrail: `calculateSettlement` refuses to
 * settle a milestone against effort greater than its own boundary.
 */
export class ExposureBoundaryExceededError extends NashTractDomainError {}

/** Attempted milestone state transition is not allowed from the current state. */
export class InvalidMilestoneTransitionError extends NashTractDomainError {
  constructor(
    public readonly state: string,
    public readonly event: string
  ) {
    super(`Milestone: cannot apply event "${event}" from state "${state}"`);
  }
}
