import { describe, expect, it } from "vitest";
import {
  allowedMilestoneEvents,
  isTerminalMilestoneState,
  transitionMilestoneState,
  type MilestoneEvent,
  type MilestoneState,
} from "../src/stateMachine.js";
import { InvalidMilestoneTransitionError } from "../src/errors.js";

const ALL_STATES: MilestoneState[] = [
  "DRAFT",
  "PROPOSED",
  "REFUSED",
  "ACCEPTED",
  "ACTIVE",
  "BOUNDARY_REACHED",
  "RESULT_SUBMITTED",
  "VALIDATED",
  "CONTINUATION_PENDING",
  "STOPPED",
  "SETTLED",
];

const ALL_EVENTS: MilestoneEvent[] = [
  "PROPOSE",
  "REFUSE",
  "ACCEPT",
  "ACTIVATE",
  "REACH_BOUNDARY",
  "SUBMIT_RESULT",
  "ACCEPT_RESULT",
  "REJECT_RESULT",
  "PROPOSE_CONTINUATION",
  "ACCEPT_CONTINUATION",
  "STOP",
  "SETTLE",
];

describe("milestone state machine (SPEC.md §12)", () => {
  it("follows the happy path DRAFT -> ... -> SETTLED", () => {
    let state: MilestoneState = "DRAFT";
    state = transitionMilestoneState(state, "PROPOSE");
    expect(state).toBe("PROPOSED");
    state = transitionMilestoneState(state, "ACCEPT");
    expect(state).toBe("ACCEPTED");
    state = transitionMilestoneState(state, "ACTIVATE");
    expect(state).toBe("ACTIVE");
    state = transitionMilestoneState(state, "SUBMIT_RESULT");
    expect(state).toBe("RESULT_SUBMITTED");
    state = transitionMilestoneState(state, "ACCEPT_RESULT");
    expect(state).toBe("VALIDATED");
    state = transitionMilestoneState(state, "SETTLE");
    expect(state).toBe("SETTLED");
  });

  it("a rejected result returns the milestone to ACTIVE, not SETTLED", () => {
    let state: MilestoneState = "ACTIVE";
    state = transitionMilestoneState(state, "SUBMIT_RESULT");
    state = transitionMilestoneState(state, "REJECT_RESULT");
    expect(state).toBe("ACTIVE");
  });

  it("10. boundary prevents automatic continuation: BOUNDARY_REACHED never auto-transitions to ACTIVE", () => {
    const allowed = allowedMilestoneEvents("BOUNDARY_REACHED");
    expect(allowed).toEqual(["PROPOSE_CONTINUATION"]);
    for (const event of allowed) {
      expect(transitionMilestoneState("BOUNDARY_REACHED", event)).not.toBe("ACTIVE");
    }
  });

  it("11. continuation requires an explicit bilateral ACCEPT_CONTINUATION event", () => {
    const state = transitionMilestoneState("BOUNDARY_REACHED", "PROPOSE_CONTINUATION");
    expect(state).toBe("CONTINUATION_PENDING");
    // No event other than ACCEPT_CONTINUATION leads to ACTIVE from here.
    for (const event of allowedMilestoneEvents("CONTINUATION_PENDING")) {
      const next = transitionMilestoneState("CONTINUATION_PENDING", event);
      if (next === "ACTIVE") {
        expect(event).toBe("ACCEPT_CONTINUATION");
      }
    }
  });

  it("rejects every event not explicitly allowed from a state", () => {
    for (const state of ALL_STATES) {
      const allowed = new Set(allowedMilestoneEvents(state));
      for (const event of ALL_EVENTS) {
        if (!allowed.has(event)) {
          expect(() => transitionMilestoneState(state, event)).toThrow(InvalidMilestoneTransitionError);
        }
      }
    }
  });

  it("terminal states (REFUSED, STOPPED, SETTLED) accept no further events", () => {
    for (const state of ["REFUSED", "STOPPED", "SETTLED"] as const) {
      expect(isTerminalMilestoneState(state)).toBe(true);
      expect(allowedMilestoneEvents(state)).toEqual([]);
    }
  });
});
