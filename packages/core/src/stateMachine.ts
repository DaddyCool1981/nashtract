/**
 * Milestone state machine (SPEC.md §12):
 *
 *   DRAFT -> PROPOSED -> REFUSED
 *   PROPOSED -> ACCEPTED -> ACTIVE
 *   ACTIVE -> BOUNDARY_REACHED
 *   ACTIVE -> RESULT_SUBMITTED -> VALIDATED -> SETTLED
 *   RESULT_SUBMITTED -> ACTIVE                      (result rejected)
 *   BOUNDARY_REACHED -> CONTINUATION_PENDING -> ACTIVE  (continuation accepted)
 *   CONTINUATION_PENDING -> STOPPED
 *
 * This is a pure reducer: it does not know *who* accepted or how many
 * parties are required. SPEC.md §6 requires acceptance/continuation to
 * be bilateral; that aggregation (has the provider ack'd? has the
 * client ack'd?) belongs to the ledger layer (Phase 2), which only
 * dispatches ACCEPT / ACCEPT_CONTINUATION once bilateral consent is
 * established. `@nashtract/core` enforces the *shape* of the lifecycle,
 * not who authorized each edge.
 *
 * Note (open item, not silently resolved): SPEC.md §11 lists a
 * `MilestoneCancelled` ledger event, but the §12 diagram has no
 * CANCELLED state or transition. This module intentionally does not
 * invent one — the diagram is authoritative for Phase 1. Cancellation
 * semantics are deferred to the ledger package (Phase 2).
 */

import { InvalidMilestoneTransitionError } from "./errors.js";

export type MilestoneState =
  | "DRAFT"
  | "PROPOSED"
  | "REFUSED"
  | "ACCEPTED"
  | "ACTIVE"
  | "BOUNDARY_REACHED"
  | "RESULT_SUBMITTED"
  | "VALIDATED"
  | "CONTINUATION_PENDING"
  | "STOPPED"
  | "SETTLED";

export type MilestoneEvent =
  | "PROPOSE"
  | "REFUSE"
  | "ACCEPT"
  | "ACTIVATE"
  | "REACH_BOUNDARY"
  | "SUBMIT_RESULT"
  | "ACCEPT_RESULT"
  | "REJECT_RESULT"
  | "PROPOSE_CONTINUATION"
  | "ACCEPT_CONTINUATION"
  | "STOP"
  | "SETTLE";

export const TERMINAL_STATES: ReadonlySet<MilestoneState> = new Set([
  "REFUSED",
  "STOPPED",
  "SETTLED",
]);

type TransitionTable = {
  readonly [S in MilestoneState]?: {
    readonly [E in MilestoneEvent]?: MilestoneState;
  };
};

const TRANSITIONS: TransitionTable = {
  DRAFT: {
    PROPOSE: "PROPOSED",
  },
  PROPOSED: {
    REFUSE: "REFUSED",
    ACCEPT: "ACCEPTED",
  },
  ACCEPTED: {
    ACTIVATE: "ACTIVE",
  },
  ACTIVE: {
    REACH_BOUNDARY: "BOUNDARY_REACHED",
    SUBMIT_RESULT: "RESULT_SUBMITTED",
  },
  RESULT_SUBMITTED: {
    ACCEPT_RESULT: "VALIDATED",
    REJECT_RESULT: "ACTIVE",
  },
  VALIDATED: {
    SETTLE: "SETTLED",
  },
  BOUNDARY_REACHED: {
    PROPOSE_CONTINUATION: "CONTINUATION_PENDING",
  },
  CONTINUATION_PENDING: {
    ACCEPT_CONTINUATION: "ACTIVE",
    STOP: "STOPPED",
  },
};

export function transitionMilestoneState(
  state: MilestoneState,
  event: MilestoneEvent
): MilestoneState {
  const next = TRANSITIONS[state]?.[event];
  if (next === undefined) {
    throw new InvalidMilestoneTransitionError(state, event);
  }
  return next;
}

export function isTerminalMilestoneState(state: MilestoneState): boolean {
  return TERMINAL_STATES.has(state);
}

export function allowedMilestoneEvents(state: MilestoneState): readonly MilestoneEvent[] {
  const table = TRANSITIONS[state];
  return table ? (Object.keys(table) as MilestoneEvent[]) : [];
}
