import { Money } from "@nashtract/core";
import { InMemoryLedgerStore } from "../src/store.js";
import type { NashTractEventPayloadMap, NashTractEventType } from "../src/events.js";

export const RATE = Money.money("1500", "EUR");

let clock = Date.parse("2026-01-01T00:00:00.000Z");
export function nextTimestamp(): string {
  clock += 24 * 60 * 60 * 1000; // +1 day per call, deterministic & strictly increasing
  return new Date(clock).toISOString();
}

export function resetClock(): void {
  clock = Date.parse("2026-01-01T00:00:00.000Z");
}

type Actor = "provider-1" | "client-1" | "system";

export function appendEvent<E extends NashTractEventType>(
  store: InMemoryLedgerStore,
  projectId: string,
  eventType: E,
  payload: NashTractEventPayloadMap[E],
  actorId: Actor = "system",
  occurredAt: string = nextTimestamp()
) {
  const milestoneId = (payload as { milestoneId?: string }).milestoneId;
  return store.append({
    projectId,
    ...(milestoneId !== undefined ? { milestoneId } : {}),
    eventType,
    payload,
    occurredAt,
    actorId,
  });
}

export type ScenarioOptions = {
  readonly estimateDays: number;
  readonly boundaryDays: number;
  readonly beta: number;
};

/** Builds a store with a project and one proposed-but-not-yet-accepted milestone. */
export function proposedMilestoneScenario(opts: ScenarioOptions) {
  resetClock();
  const store = new InMemoryLedgerStore();
  const projectId = "proj-1";
  const milestoneId = "ms-1";

  appendEvent(store, projectId, "ProjectCreated", { projectId, referenceRate: RATE }, "provider-1");
  appendEvent(
    store,
    projectId,
    "MilestoneProposed",
    {
      milestoneId,
      projectId,
      result: { description: "Legacy synchronization API operational and passing agreed tests." },
      estimateDays: opts.estimateDays,
      boundaryDays: opts.boundaryDays,
      referenceRate: RATE,
      beta: opts.beta,
      betaPolicyVersion: "fixed-beta-v0",
    },
    "provider-1"
  );

  return { store, projectId, milestoneId };
}

/** Builds a store with a milestone bilaterally accepted and activated. */
export function activeMilestoneScenario(opts: ScenarioOptions) {
  const { store, projectId, milestoneId } = proposedMilestoneScenario(opts);
  appendEvent(store, projectId, "MilestoneAcceptedByProvider", { milestoneId }, "provider-1");
  appendEvent(store, projectId, "MilestoneAcceptedByClient", { milestoneId }, "client-1");
  appendEvent(store, projectId, "MilestoneActivated", { milestoneId }, "system");
  return { store, projectId, milestoneId };
}

/** Builds a store with a milestone fully settled after `actualDays` of recorded effort. */
export function settledMilestoneScenario(opts: ScenarioOptions & { actualDays: number }) {
  const { store, projectId, milestoneId } = activeMilestoneScenario(opts);
  appendEvent(store, projectId, "EffortRecorded", { milestoneId, days: opts.actualDays }, "provider-1");
  appendEvent(store, projectId, "ResultSubmitted", { milestoneId }, "provider-1");
  appendEvent(store, projectId, "ResultAccepted", { milestoneId }, "client-1");
  appendEvent(store, projectId, "MilestoneSettled", { milestoneId }, "system");
  return { store, projectId, milestoneId };
}
