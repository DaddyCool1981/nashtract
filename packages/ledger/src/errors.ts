export class LedgerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

/** Ledger append-only invariant violated: sequence numbers must be strictly monotonic per project. */
export class NonMonotonicSequenceError extends LedgerError {}

/** Hash chain broken: an envelope's `previousHash` does not match the prior envelope's `hash`. */
export class HashChainMismatchError extends LedgerError {}

/** An event referenced a milestone/project that replay has no record of, or in an invalid order. */
export class UnknownReferenceError extends LedgerError {}

/** An event tried to change something replay treats as frozen (e.g. accepted terms). */
export class ImmutabilityViolationError extends LedgerError {}

/** An event is not valid given the current derived state (wraps the core FSM's own rejection, or ledger-level ordering rules). */
export class InvalidLedgerEventError extends LedgerError {}
