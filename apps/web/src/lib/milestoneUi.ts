import type { MilestoneState } from "@nashtract/core";

type Tone = "neutral" | "accent" | "good" | "warn" | "danger";

export const STATE_LABEL: Record<MilestoneState, string> = {
  DRAFT: "Draft",
  PROPOSED: "Awaiting acceptance",
  REFUSED: "Refused",
  ACCEPTED: "Accepted",
  ACTIVE: "Active",
  BOUNDARY_REACHED: "Boundary reached",
  RESULT_SUBMITTED: "Result submitted",
  VALIDATED: "Validated",
  CONTINUATION_PENDING: "Continuation proposed",
  STOPPED: "Stopped",
  SETTLED: "Settled",
};

export const STATE_TONE: Record<MilestoneState, Tone> = {
  DRAFT: "neutral",
  PROPOSED: "accent",
  REFUSED: "danger",
  ACCEPTED: "accent",
  ACTIVE: "accent",
  BOUNDARY_REACHED: "warn",
  RESULT_SUBMITTED: "accent",
  VALIDATED: "good",
  CONTINUATION_PENDING: "warn",
  STOPPED: "danger",
  SETTLED: "good",
};
