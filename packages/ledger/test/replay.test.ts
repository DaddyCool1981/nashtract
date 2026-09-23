import { describe, expect, it } from "vitest";
import { Money } from "@nashtract/core";
import {
  activeMilestoneScenario,
  appendEvent,
  proposedMilestoneScenario,
  settledMilestoneScenario,
} from "./fixtures.js";
import { effectiveBoundaryDays, replayProject } from "../src/replay.js";
import { computeMilestoneSettlement, computeMilestoneExposure } from "../src/settlementView.js";
import { InvalidLedgerEventError } from "../src/errors.js";

describe("replayProject: happy path", () => {
  it("walks DRAFT..SETTLED and settlement matches the canonical example (SPEC.md §23)", () => {
    const { store, projectId, milestoneId } = settledMilestoneScenario({
      estimateDays: 5,
      boundaryDays: 8,
      beta: 0.5,
      actualDays: 3,
    });
    const state = replayProject(store.list(projectId));
    const milestone = state.milestones.get(milestoneId)!;

    expect(milestone.state).toBe("SETTLED");
    expect(milestone.consumedEffortDays).toBe(3);
    expect(Money.toDecimalString(computeMilestoneSettlement(milestone).payment)).toBe("6000.00");
  });

  it("bilateral acceptance only completes once BOTH parties have accepted", () => {
    const { store, projectId, milestoneId } = proposedMilestoneScenario({
      estimateDays: 5,
      boundaryDays: 8,
      beta: 0.5,
    });
    appendEvent(store, projectId, "MilestoneAcceptedByProvider", { milestoneId }, "provider-1");

    const afterOne = replayProject(store.list(projectId));
    expect(afterOne.milestones.get(milestoneId)!.state).toBe("PROPOSED");
    expect(afterOne.milestones.get(milestoneId)!.acceptedTerms).toBeUndefined();

    appendEvent(store, projectId, "MilestoneAcceptedByClient", { milestoneId }, "client-1");
    const afterBoth = replayProject(store.list(projectId));
    expect(afterBoth.milestones.get(milestoneId)!.state).toBe("ACCEPTED");
    expect(afterBoth.milestones.get(milestoneId)!.acceptedTerms).toBeDefined();
  });
});

describe("26. accepted beta/policy version cannot change retroactively", () => {
  it("a milestone's frozen terms are unaffected by a later milestone proposed with a different beta", () => {
    const { store, projectId, milestoneId: firstId } = activeMilestoneScenario({
      estimateDays: 5,
      boundaryDays: 8,
      beta: 0.5,
    });
    const beforeSecondProposal = replayProject(store.list(projectId)).milestones.get(firstId)!.acceptedTerms!;

    appendEvent(
      store,
      projectId,
      "MilestoneProposed",
      {
        milestoneId: "ms-2",
        projectId,
        result: { description: "Second milestone" },
        estimateDays: 3,
        boundaryDays: 6,
        referenceRate: beforeSecondProposal.referenceRate,
        beta: 0.9, // a very different, more recent policy decision
        betaPolicyVersion: "adaptive-beta-v1",
      },
      "provider-1"
    );

    const afterSecondProposal = replayProject(store.list(projectId)).milestones.get(firstId)!.acceptedTerms!;
    expect(afterSecondProposal.beta).toBe(0.5);
    expect(afterSecondProposal.betaPolicyVersion).toBe("fixed-beta-v0");
    expect(afterSecondProposal).toEqual(beforeSecondProposal);
  });
});

describe("27/10. continuation is lineage on the same milestone, not a history reset", () => {
  it("boundary reached -> continuation proposed -> accepted extends U without touching M, beta, or consumed effort", () => {
    const { store, projectId, milestoneId } = activeMilestoneScenario({
      estimateDays: 5,
      boundaryDays: 8,
      beta: 0.5,
    });
    appendEvent(store, projectId, "EffortRecorded", { milestoneId, days: 8 }, "provider-1");
    appendEvent(store, projectId, "BoundaryReached", { milestoneId }, "system");

    const atBoundary = replayProject(store.list(projectId)).milestones.get(milestoneId)!;
    expect(atBoundary.state).toBe("BOUNDARY_REACHED");
    expect(atBoundary.acceptedTerms!.estimateDays).toBe(5);
    expect(atBoundary.acceptedTerms!.boundaryDays).toBe(8); // original U, never mutated
    expect(atBoundary.consumedEffortDays).toBe(8);

    appendEvent(store, projectId, "ContinuationProposed", { milestoneId, additionalBoundaryDays: 4 }, "provider-1");
    appendEvent(store, projectId, "ContinuationAccepted", { milestoneId }, "client-1");

    const continued = replayProject(store.list(projectId)).milestones.get(milestoneId)!;
    expect(continued.state).toBe("ACTIVE");
    expect(continued.acceptedTerms!.boundaryDays).toBe(8); // still original, untouched
    expect(effectiveBoundaryDays(continued)).toBe(12); // 8 + 4
    expect(continued.consumedEffortDays).toBe(8); // preserved, not reset
    expect(continued.boundaryExtensions).toEqual([
      expect.objectContaining({ additionalDays: 4 }),
    ]);

    // More effort can now be recorded up to the *extended* boundary.
    appendEvent(store, projectId, "EffortRecorded", { milestoneId, days: 3 }, "provider-1");
    const withMoreEffort = replayProject(store.list(projectId)).milestones.get(milestoneId)!;
    expect(withMoreEffort.consumedEffortDays).toBe(11);
    expect(computeMilestoneExposure(withMoreEffort).boundaryDays).toBe(12);
  });

  it("11. continuation requires an explicit ContinuationAccepted — proposing alone does not resume execution", () => {
    const { store, projectId, milestoneId } = activeMilestoneScenario({
      estimateDays: 5,
      boundaryDays: 8,
      beta: 0.5,
    });
    appendEvent(store, projectId, "EffortRecorded", { milestoneId, days: 8 }, "provider-1");
    appendEvent(store, projectId, "BoundaryReached", { milestoneId }, "system");
    appendEvent(store, projectId, "ContinuationProposed", { milestoneId, additionalBoundaryDays: 4 }, "provider-1");

    const pending = replayProject(store.list(projectId)).milestones.get(milestoneId)!;
    expect(pending.state).toBe("CONTINUATION_PENDING");
  });
});

describe("8. effort beyond U is never automatically authorized (ledger level)", () => {
  it("BoundaryReached is rejected if consumed effort has not actually reached the effective boundary", () => {
    const { store, projectId, milestoneId } = activeMilestoneScenario({
      estimateDays: 5,
      boundaryDays: 8,
      beta: 0.5,
    });
    appendEvent(store, projectId, "EffortRecorded", { milestoneId, days: 2 }, "provider-1");
    appendEvent(store, projectId, "BoundaryReached", { milestoneId }, "system");
    expect(() => replayProject(store.list(projectId))).toThrow(InvalidLedgerEventError);
  });

  it("EffortRecorded itself is rejected once it would push consumed effort past the effective boundary", () => {
    const { store, projectId, milestoneId } = activeMilestoneScenario({
      estimateDays: 5,
      boundaryDays: 8,
      beta: 0.5,
    });
    appendEvent(store, projectId, "EffortRecorded", { milestoneId, days: 8 }, "provider-1");
    appendEvent(store, projectId, "EffortRecorded", { milestoneId, days: 0.1 }, "provider-1");
    expect(() => replayProject(store.list(projectId))).toThrow(InvalidLedgerEventError);
  });
});

describe("28. replaying a ledger produces identical domain state", () => {
  it("is idempotent: replaying the same envelopes twice yields deep-equal state", () => {
    const { store, projectId } = settledMilestoneScenario({
      estimateDays: 5,
      boundaryDays: 8,
      beta: 0.5,
      actualDays: 6,
    });
    const envelopes = store.list(projectId);
    const state1 = replayProject(envelopes);
    const state2 = replayProject(envelopes);
    expect([...state1.milestones.entries()]).toEqual([...state2.milestones.entries()]);
  });
});

describe("documented gap resolutions", () => {
  it("gap #1: MilestoneCancelled on a PROPOSED milestone refuses it (SPEC.md §12 PROPOSED -> REFUSED)", () => {
    const { store, projectId, milestoneId } = proposedMilestoneScenario({
      estimateDays: 5,
      boundaryDays: 8,
      beta: 0.5,
    });
    appendEvent(store, projectId, "MilestoneCancelled", { milestoneId, reason: "client declined" }, "client-1");
    const state = replayProject(store.list(projectId));
    expect(state.milestones.get(milestoneId)!.state).toBe("REFUSED");
  });

  it("gap #2: MilestoneCancelled on an ACTIVE milestone sets an orthogonal cancellation flag and freezes it", () => {
    const { store, projectId, milestoneId } = activeMilestoneScenario({
      estimateDays: 5,
      boundaryDays: 8,
      beta: 0.5,
    });
    appendEvent(store, projectId, "MilestoneCancelled", { milestoneId, reason: "project ended early" }, "client-1");
    const state = replayProject(store.list(projectId));
    const milestone = state.milestones.get(milestoneId)!;
    expect(milestone.state).toBe("ACTIVE"); // FSM state untouched, per §12 having no CANCELLED state
    expect(milestone.cancellation).toEqual({ reason: "project ended early", cancelledAt: expect.any(String) });

    appendEvent(store, projectId, "EffortRecorded", { milestoneId, days: 1 }, "provider-1");
    expect(() => replayProject(store.list(projectId))).toThrow(InvalidLedgerEventError);
  });

  it("a VALIDATED milestone cannot be cancelled", () => {
    const { store, projectId, milestoneId } = activeMilestoneScenario({
      estimateDays: 5,
      boundaryDays: 8,
      beta: 0.5,
    });
    appendEvent(store, projectId, "EffortRecorded", { milestoneId, days: 5 }, "provider-1");
    appendEvent(store, projectId, "ResultSubmitted", { milestoneId }, "provider-1");
    appendEvent(store, projectId, "ResultAccepted", { milestoneId }, "client-1");
    appendEvent(store, projectId, "MilestoneCancelled", { milestoneId, reason: "too late" }, "client-1");
    expect(() => replayProject(store.list(projectId))).toThrow(InvalidLedgerEventError);
  });
});
