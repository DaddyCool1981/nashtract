import { describe, expect, it } from "vitest";
import { Money } from "@nashtract/core";
import { appendEvent, settledMilestoneScenario } from "./fixtures.js";
import { replayProject } from "../src/replay.js";
import { deriveCalibrationHistory, deriveEligibleCalibrationHistory } from "../src/calibration.js";

describe("calibration eligibility (SPEC.md §9, invariants 22-23)", () => {
  it("22/23. an excluded milestone is absent from the eligible history but stays visible", () => {
    const { store, projectId, milestoneId } = settledMilestoneScenario({
      estimateDays: 5,
      boundaryDays: 8,
      beta: 0.5,
      actualDays: 7,
    });
    appendEvent(
      store,
      projectId,
      "ScopeChangeDeclared",
      { milestoneId, reason: "client changed required third-party behavior mid-flight" },
      "provider-1"
    );
    appendEvent(
      store,
      projectId,
      "CalibrationExcluded",
      { milestoneId, reason: "client changed required third-party behavior mid-flight" },
      "provider-1"
    );

    const state = replayProject(store.list(projectId));
    const full = deriveCalibrationHistory(state);
    const eligible = deriveEligibleCalibrationHistory(state);

    expect(full).toHaveLength(1);
    expect(full[0]!.eligible).toBe(false);
    expect(full[0]!.exclusionReason).toMatch(/third-party/);
    expect(eligible).toHaveLength(0);
  });

  it("a milestone with no exclusion is eligible and carries the correct log-error", () => {
    const { store, projectId } = settledMilestoneScenario({
      estimateDays: 5,
      boundaryDays: 8,
      beta: 0.5,
      actualDays: 5,
    });
    const state = replayProject(store.list(projectId));
    const eligible = deriveEligibleCalibrationHistory(state);
    expect(eligible).toHaveLength(1);
    expect(eligible[0]!.logError).toBeCloseTo(0, 12); // T = M
  });

  it("history is ordered by settlement time, not proposal time", () => {
    const { store, projectId, milestoneId: firstId } = settledMilestoneScenario({
      estimateDays: 5,
      boundaryDays: 8,
      beta: 0.5,
      actualDays: 5,
    });
    // Propose+accept+activate+settle a second milestone entirely after the first.
    appendEvent(
      store,
      projectId,
      "MilestoneProposed",
      {
        milestoneId: "ms-2",
        projectId,
        result: { description: "Second milestone" },
        estimateDays: 4,
        boundaryDays: 6,
        referenceRate: Money.money("1500", "EUR"),
        beta: 0.5,
        betaPolicyVersion: "fixed-beta-v0",
      },
      "provider-1"
    );
    appendEvent(store, projectId, "MilestoneAcceptedByProvider", { milestoneId: "ms-2" }, "provider-1");
    appendEvent(store, projectId, "MilestoneAcceptedByClient", { milestoneId: "ms-2" }, "client-1");
    appendEvent(store, projectId, "MilestoneActivated", { milestoneId: "ms-2" }, "system");
    appendEvent(store, projectId, "EffortRecorded", { milestoneId: "ms-2", days: 4 }, "provider-1");
    appendEvent(store, projectId, "ResultSubmitted", { milestoneId: "ms-2" }, "provider-1");
    appendEvent(store, projectId, "ResultAccepted", { milestoneId: "ms-2" }, "client-1");
    appendEvent(store, projectId, "MilestoneSettled", { milestoneId: "ms-2" }, "system");

    const state = replayProject(store.list(projectId));
    const history = deriveEligibleCalibrationHistory(state);
    expect(history.map((h) => h.milestoneId)).toEqual([firstId, "ms-2"]);
  });
});
