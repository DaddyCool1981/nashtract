/**
 * Deterministic replay: folds an ordered, verified envelope chain into
 * domain state (SPEC.md §15 invariant 28: replaying a ledger produces
 * identical domain state). This module is pure — no I/O, no clock, no
 * randomness — so the same envelopes always produce the same state.
 *
 * Two documented gaps between SPEC.md §11 (the ledger event union) and
 * §12 (the milestone state diagram) are resolved here rather than left
 * silently unhandled:
 *
 * 1. §12 shows `PROPOSED -> REFUSED`, but §11's event union has no
 *    "refused" event. §11 *does* list `MilestoneCancelled`. Refusing an
 *    unaccepted proposal and cancelling are economically identical (no
 *    exposure has ever existed), so a `MilestoneCancelled` observed
 *    while a milestone is still `PROPOSED` is treated as that refusal:
 *    the core FSM's `REFUSE` transition fires, landing on `REFUSED`.
 * 2. §11 lists `MilestoneCancelled` for milestones *beyond* proposal,
 *    but §12's diagram has no `CANCELLED` state at all. For those
 *    (ACCEPTED, ACTIVE, BOUNDARY_REACHED, CONTINUATION_PENDING,
 *    RESULT_SUBMITTED) this module does not force an invented FSM
 *    state — it layers an orthogonal `cancellation` flag on the
 *    aggregate instead, and refuses any further event on that
 *    milestone. `VALIDATED`/`SETTLED` milestones cannot be cancelled.
 *
 * Both are called out in README.md's "known open items" and should be
 * revisited once the ledger/product layer has real usage to learn from.
 */

import {
  isTerminalMilestoneState,
  transitionMilestoneState,
  type AcceptedTerms,
  type MoneyAmount,
  type MilestoneState,
} from "@nashtract/core";
import { InvalidLedgerEventError, ImmutabilityViolationError, UnknownReferenceError } from "./errors.js";
import { verifyLedgerChain } from "./store.js";
import type { LedgerEnvelope } from "./envelope.js";
import type { ProposedTerms } from "./events.js";

export type EffortLogEntry = { readonly days: number; readonly recordedAt: string };
export type BoundaryExtension = {
  readonly additionalDays: number;
  readonly proposedAt: string;
  readonly acceptedAt: string;
};
export type ScopeChangeRecord = { readonly reason: string; readonly declaredAt: string };
export type ResultRejectionRecord = { readonly reason: string; readonly occurredAt: string };
export type CalibrationExclusion = { readonly reason: string; readonly excludedAt: string };
export type Cancellation = { readonly reason: string; readonly cancelledAt: string };
type PendingContinuation = { readonly additionalDays: number; readonly proposedAt: string };

export type MilestoneAggregate = {
  readonly milestoneId: string;
  readonly projectId: string;
  readonly state: MilestoneState;
  readonly proposedTerms: ProposedTerms;
  readonly acceptedTerms?: AcceptedTerms;
  readonly acceptedByProvider: boolean;
  readonly acceptedByClient: boolean;
  readonly consumedEffortDays: number;
  readonly effortLog: readonly EffortLogEntry[];
  readonly boundaryExtensions: readonly BoundaryExtension[];
  readonly pendingContinuation?: PendingContinuation;
  readonly linkedPredecessorMilestoneId?: string;
  readonly scopeChanges: readonly ScopeChangeRecord[];
  readonly resultRejections: readonly ResultRejectionRecord[];
  readonly calibrationExclusion?: CalibrationExclusion;
  readonly cancellation?: Cancellation;
  readonly settledAt?: string;
};

export type ProjectState = {
  readonly projectId: string;
  readonly referenceRate: MoneyAmount;
  readonly milestones: ReadonlyMap<string, MilestoneAggregate>;
};

/** M + all bilaterally-accepted continuations, never the mutated original boundaryDays. */
export function effectiveBoundaryDays(milestone: MilestoneAggregate): number {
  const base = milestone.acceptedTerms?.boundaryDays ?? milestone.proposedTerms.boundaryDays;
  return milestone.boundaryExtensions.reduce((sum, ext) => sum + ext.additionalDays, base);
}

/** The frozen terms, with `boundaryDays` widened by accepted continuations — everything else untouched. */
export function effectiveAcceptedTerms(milestone: MilestoneAggregate): AcceptedTerms {
  if (!milestone.acceptedTerms) {
    throw new UnknownReferenceError(`milestone ${milestone.milestoneId} has no accepted terms yet`);
  }
  return { ...milestone.acceptedTerms, boundaryDays: effectiveBoundaryDays(milestone) };
}

function withMilestone(
  state: ProjectState,
  milestoneId: string,
  update: (m: MilestoneAggregate) => MilestoneAggregate
): ProjectState {
  const current = state.milestones.get(milestoneId);
  if (!current) {
    throw new UnknownReferenceError(`event references unknown milestone ${milestoneId}`);
  }
  if (current.cancellation) {
    throw new InvalidLedgerEventError(`milestone ${milestoneId} is cancelled; no further events accepted`);
  }
  const next = new Map(state.milestones);
  next.set(milestoneId, update(current));
  return { ...state, milestones: next };
}

function fsm(
  milestone: MilestoneAggregate,
  event: Parameters<typeof transitionMilestoneState>[1],
  envelope: LedgerEnvelope
): MilestoneState {
  try {
    return transitionMilestoneState(milestone.state, event);
  } catch (cause) {
    throw new InvalidLedgerEventError(
      `envelope ${envelope.id} (sequence ${envelope.sequence}, ${envelope.eventType}) on milestone ${milestone.milestoneId}: ${(cause as Error).message}`
    );
  }
}

export function replayProject(envelopes: readonly LedgerEnvelope[]): ProjectState {
  verifyLedgerChain(envelopes);

  const first = envelopes[0];
  if (!first || first.eventType !== "ProjectCreated") {
    throw new UnknownReferenceError("a project's envelope chain must begin with ProjectCreated");
  }
  const seed = first.payload as import("./events.js").ProjectCreated;

  let state: ProjectState = {
    projectId: seed.projectId,
    referenceRate: seed.referenceRate,
    milestones: new Map(),
  };

  for (const envelope of envelopes) {
    state = applyEnvelope(state, envelope);
  }
  return state;
}

function applyEnvelope(state: ProjectState, envelope: LedgerEnvelope): ProjectState {
  const eventType = envelope.eventType;
  const payload = envelope.payload;

  switch (eventType) {
    case "ProjectCreated": {
      return state; // consumed as the seed in replayProject
    }

    case "MilestoneProposed": {
      const p = payload as import("./events.js").MilestoneProposed;
      if (state.milestones.has(p.milestoneId)) {
        throw new ImmutabilityViolationError(`milestone ${p.milestoneId} was already proposed once`);
      }
      const proposedTerms: ProposedTerms = {
        result: p.result,
        estimateDays: p.estimateDays,
        boundaryDays: p.boundaryDays,
        referenceRate: p.referenceRate,
        beta: p.beta,
        betaPolicyVersion: p.betaPolicyVersion,
      };
      const aggregate: MilestoneAggregate = {
        milestoneId: p.milestoneId,
        projectId: p.projectId,
        state: transitionMilestoneState("DRAFT", "PROPOSE"),
        proposedTerms,
        acceptedByProvider: false,
        acceptedByClient: false,
        consumedEffortDays: 0,
        effortLog: [],
        boundaryExtensions: [],
        scopeChanges: [],
        resultRejections: [],
        ...(p.linkedPredecessorMilestoneId !== undefined
          ? { linkedPredecessorMilestoneId: p.linkedPredecessorMilestoneId }
          : {}),
      };
      const next = new Map(state.milestones);
      next.set(p.milestoneId, aggregate);
      return { ...state, milestones: next };
    }

    case "MilestoneAcceptedByProvider": {
      const p = payload as import("./events.js").MilestoneAcceptedByProvider;
      return withMilestone(state, p.milestoneId, (m) => completeAcceptance({ ...m, acceptedByProvider: true }, envelope));
    }

    case "MilestoneAcceptedByClient": {
      const p = payload as import("./events.js").MilestoneAcceptedByClient;
      return withMilestone(state, p.milestoneId, (m) => completeAcceptance({ ...m, acceptedByClient: true }, envelope));
    }

    case "MilestoneActivated": {
      const p = payload as import("./events.js").MilestoneActivated;
      return withMilestone(state, p.milestoneId, (m) => ({ ...m, state: fsm(m, "ACTIVATE", envelope) }));
    }

    case "EffortRecorded": {
      const p = payload as import("./events.js").EffortRecorded;
      if (!Number.isFinite(p.days) || p.days <= 0) {
        throw new InvalidLedgerEventError(`EffortRecorded: days must be > 0, got ${p.days}`);
      }
      return withMilestone(state, p.milestoneId, (m) => {
        if (m.state !== "ACTIVE") {
          throw new InvalidLedgerEventError(`EffortRecorded requires an ACTIVE milestone, got ${m.state}`);
        }
        const total = m.consumedEffortDays + p.days;
        // SPEC.md §5/§21: the system MUST NOT authorize automatic effort
        // beyond U. Enforced here, not only at BoundaryReached, so the
        // ledger itself cannot accumulate more than the effective boundary.
        if (total > effectiveBoundaryDays(m)) {
          throw new InvalidLedgerEventError(
            `EffortRecorded on milestone ${m.milestoneId}: ${total} days would exceed the effective boundary of ${effectiveBoundaryDays(m)}`
          );
        }
        return {
          ...m,
          consumedEffortDays: total,
          effortLog: [...m.effortLog, { days: p.days, recordedAt: envelope.occurredAt }],
        };
      });
    }

    case "ResultSubmitted": {
      const p = payload as import("./events.js").ResultSubmitted;
      return withMilestone(state, p.milestoneId, (m) => ({ ...m, state: fsm(m, "SUBMIT_RESULT", envelope) }));
    }

    case "ResultAccepted": {
      const p = payload as import("./events.js").ResultAccepted;
      return withMilestone(state, p.milestoneId, (m) => ({ ...m, state: fsm(m, "ACCEPT_RESULT", envelope) }));
    }

    case "ResultRejected": {
      const p = payload as import("./events.js").ResultRejected;
      return withMilestone(state, p.milestoneId, (m) => ({
        ...m,
        state: fsm(m, "REJECT_RESULT", envelope),
        resultRejections: [...m.resultRejections, { reason: p.reason, occurredAt: envelope.occurredAt }],
      }));
    }

    case "BoundaryReached": {
      const p = payload as import("./events.js").BoundaryReached;
      return withMilestone(state, p.milestoneId, (m) => {
        if (m.consumedEffortDays < effectiveBoundaryDays(m)) {
          throw new InvalidLedgerEventError(
            `BoundaryReached on milestone ${m.milestoneId}: consumed effort ${m.consumedEffortDays} has not reached the boundary ${effectiveBoundaryDays(m)}`
          );
        }
        return { ...m, state: fsm(m, "REACH_BOUNDARY", envelope) };
      });
    }

    case "ContinuationProposed": {
      const p = payload as import("./events.js").ContinuationProposed;
      if (!Number.isFinite(p.additionalBoundaryDays) || p.additionalBoundaryDays <= 0) {
        throw new InvalidLedgerEventError(
          `ContinuationProposed: additionalBoundaryDays must be > 0, got ${p.additionalBoundaryDays}`
        );
      }
      return withMilestone(state, p.milestoneId, (m) => ({
        ...m,
        state: fsm(m, "PROPOSE_CONTINUATION", envelope),
        pendingContinuation: { additionalDays: p.additionalBoundaryDays, proposedAt: envelope.occurredAt },
      }));
    }

    case "ContinuationAccepted": {
      const p = payload as import("./events.js").ContinuationAccepted;
      return withMilestone(state, p.milestoneId, (m) => {
        if (!m.pendingContinuation) {
          throw new InvalidLedgerEventError(`ContinuationAccepted on milestone ${m.milestoneId}: no pending continuation`);
        }
        const extension: BoundaryExtension = {
          additionalDays: m.pendingContinuation.additionalDays,
          proposedAt: m.pendingContinuation.proposedAt,
          acceptedAt: envelope.occurredAt,
        };
        const { pendingContinuation, ...rest } = m;
        return {
          ...rest,
          state: fsm(m, "ACCEPT_CONTINUATION", envelope),
          boundaryExtensions: [...m.boundaryExtensions, extension],
        };
      });
    }

    case "ScopeChangeDeclared": {
      const p = payload as import("./events.js").ScopeChangeDeclared;
      return withMilestone(state, p.milestoneId, (m) => ({
        ...m,
        scopeChanges: [...m.scopeChanges, { reason: p.reason, declaredAt: envelope.occurredAt }],
      }));
    }

    case "CalibrationExcluded": {
      const p = payload as import("./events.js").CalibrationExcluded;
      return withMilestone(state, p.milestoneId, (m) => {
        if (m.state !== "SETTLED") {
          throw new InvalidLedgerEventError(
            `CalibrationExcluded requires a SETTLED (closed) milestone, got ${m.state}`
          );
        }
        if (m.calibrationExclusion) {
          throw new ImmutabilityViolationError(`milestone ${m.milestoneId} is already excluded from calibration`);
        }
        return { ...m, calibrationExclusion: { reason: p.reason, excludedAt: envelope.occurredAt } };
      });
    }

    case "MilestoneSettled": {
      const p = payload as import("./events.js").MilestoneSettled;
      return withMilestone(state, p.milestoneId, (m) => ({
        ...m,
        state: fsm(m, "SETTLE", envelope),
        settledAt: envelope.occurredAt,
      }));
    }

    case "MilestoneCancelled": {
      const p = payload as import("./events.js").MilestoneCancelled;
      return withMilestone(state, p.milestoneId, (m) => {
        // Gap resolution #1: refusing a still-PROPOSED milestone.
        if (m.state === "PROPOSED") {
          return { ...m, state: fsm(m, "REFUSE", envelope) };
        }
        // Gap resolution #2: orthogonal cancellation flag for everything
        // past proposal but before a validated/settled result.
        if (isTerminalMilestoneState(m.state) || m.state === "VALIDATED") {
          throw new InvalidLedgerEventError(
            `milestone ${m.milestoneId} cannot be cancelled from state ${m.state}`
          );
        }
        return { ...m, cancellation: { reason: p.reason, cancelledAt: envelope.occurredAt } };
      });
    }

    default: {
      const exhaustive: never = eventType;
      throw new InvalidLedgerEventError(`unknown event type: ${String(exhaustive)}`);
    }
  }
}

function completeAcceptance(milestone: MilestoneAggregate, envelope: LedgerEnvelope): MilestoneAggregate {
  if (milestone.state !== "PROPOSED") {
    throw new InvalidLedgerEventError(
      `envelope ${envelope.id}: milestone ${milestone.milestoneId} must be PROPOSED to accept, got ${milestone.state}`
    );
  }
  if (!milestone.acceptedByProvider || !milestone.acceptedByClient) {
    return milestone; // waiting on the other party
  }
  const acceptedTerms: AcceptedTerms = { ...milestone.proposedTerms, acceptedAt: envelope.occurredAt };
  return { ...milestone, acceptedTerms, state: fsm(milestone, "ACCEPT", envelope) };
}
