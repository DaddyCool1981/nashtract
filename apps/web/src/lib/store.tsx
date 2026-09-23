"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { FixedBetaPolicy, Money, type BetaPolicy, type ResultDefinition } from "@nashtract/core";
import {
  InMemoryLedgerStore,
  deriveEligibleCalibrationHistory,
  effectiveBoundaryDays,
  replayProject,
  verifyLedgerChain,
  type LedgerEnvelope,
  type ProjectState,
} from "@nashtract/ledger";
import { AdaptiveBetaPolicyV1 } from "@nashtract/adaptive-beta";
import { deserializeEnvelopes, serializeEnvelopes } from "./serialization";

export type Role = "provider" | "client";

const PROJECT_ID = "proj-1";
const ACTOR: Record<Role, string> = { provider: "provider-1", client: "client-1" };
const SYSTEM_ACTOR = "system";
const STORAGE_KEY = "nashtract:v1:envelopes";
const ADAPTIVE_BETA_KEY = "nashtract:v1:adaptiveBeta";

type ProposeMilestoneInput = {
  readonly description: string;
  readonly estimateDays: number;
  readonly boundaryDays: number;
};

type StoreContextValue = {
  role: Role;
  setRole: (role: Role) => void;
  adaptiveBetaEnabled: boolean;
  setAdaptiveBetaEnabled: (enabled: boolean) => void;
  project: ProjectState | null;
  createProject: (referenceRate: Money.Money) => void;
  proposeMilestone: (input: ProposeMilestoneInput) => void;
  acceptMilestone: (milestoneId: string) => void;
  recordEffort: (milestoneId: string, days: number) => void;
  submitResult: (milestoneId: string) => void;
  acceptResult: (milestoneId: string) => void;
  rejectResult: (milestoneId: string, reason: string) => void;
  proposeContinuation: (milestoneId: string, additionalDays: number) => void;
  acceptContinuation: (milestoneId: string) => void;
  stopContinuation: (milestoneId: string) => void;
  settleMilestone: (milestoneId: string) => void;
  cancelMilestone: (milestoneId: string, reason: string) => void;
  excludeFromCalibration: (milestoneId: string, reason: string) => void;
  resetDemo: () => void;
};

const StoreContext = createContext<StoreContextValue | null>(null);

function readAdaptiveBetaPreference(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(ADAPTIVE_BETA_KEY) === "1";
  } catch {
    return false;
  }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  // A stable, mutable instance — like a ref, but obtained via useState so
  // nothing ever reads `.current` during render. We never call the
  // setter; `version` below is the render trigger after each mutation.
  const [store] = useState(() => new InMemoryLedgerStore());

  const [version, setVersion] = useState(0);
  const [role, setRole] = useState<Role>("provider");
  const [adaptiveBetaEnabled, setAdaptiveBetaEnabledState] = useState(readAdaptiveBetaPreference);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // Idempotent by construction (not just a StrictMode workaround): if
    // this effect ever fires twice against the same store instance —
    // React StrictMode's dev-only double-invoke does exactly this —
    // re-importing already-present envelopes would violate the
    // ledger's own append-only/immutability invariants. Guard instead
    // of relying on effects running exactly once.
    try {
      const raw = store.list(PROJECT_ID).length === 0 ? window.localStorage.getItem(STORAGE_KEY) : null;
      if (raw) {
        const envelopes = deserializeEnvelopes(raw);
        verifyLedgerChain(envelopes);
        for (const envelope of envelopes) {
          store.append({
            id: envelope.id,
            projectId: envelope.projectId,
            ...(envelope.milestoneId !== undefined ? { milestoneId: envelope.milestoneId } : {}),
            eventType: envelope.eventType,
            payload: envelope.payload,
            occurredAt: envelope.occurredAt,
            actorId: envelope.actorId,
          });
        }
      }
    } catch (error) {
      console.warn("NashTract: could not restore saved ledger, starting fresh.", error);
    } finally {
      setHydrated(true);
      setVersion((v) => v + 1);
    }
  }, [store]);

  const persist = useCallback(() => {
    try {
      const envelopes = store.list(PROJECT_ID);
      window.localStorage.setItem(STORAGE_KEY, serializeEnvelopes(envelopes));
    } catch (error) {
      console.warn("NashTract: could not persist ledger to localStorage.", error);
    }
  }, [store]);

  const bump = useCallback(() => {
    setVersion((v) => v + 1);
  }, []);

  const setAdaptiveBetaEnabled = useCallback((enabled: boolean) => {
    setAdaptiveBetaEnabledState(enabled);
    try {
      window.localStorage.setItem(ADAPTIVE_BETA_KEY, enabled ? "1" : "0");
    } catch {
      // best-effort only
    }
  }, []);

  const project = useMemo<ProjectState | null>(() => {
    if (!hydrated) return null;
    const envelopes = store.list(PROJECT_ID);
    if (envelopes.length === 0) return null;
    return replayProject(envelopes);
    // `version` is the actual dependency (it changes on every mutation);
    // `store`'s identity never changes, so including it is redundant but harmless.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, hydrated, store]);

  const append = useCallback(
    (input: {
      eventType: LedgerEnvelope["eventType"];
      payload: LedgerEnvelope["payload"];
      milestoneId?: string;
      actorId: string;
    }) => {
      store.append({
        projectId: PROJECT_ID,
        ...(input.milestoneId !== undefined ? { milestoneId: input.milestoneId } : {}),
        eventType: input.eventType,
        payload: input.payload,
        occurredAt: new Date().toISOString(),
        actorId: input.actorId,
      });
      bump();
      persist();
    },
    [store, bump, persist]
  );

  const createProject = useCallback(
    (referenceRate: Money.Money) => {
      append({
        eventType: "ProjectCreated",
        payload: { projectId: PROJECT_ID, referenceRate },
        actorId: ACTOR[role],
      });
    },
    [append, role]
  );

  const proposeMilestone = useCallback(
    (input: ProposeMilestoneInput) => {
      if (!project) return;
      const milestoneId = crypto.randomUUID();
      const result: ResultDefinition = { description: input.description };

      const history = deriveEligibleCalibrationHistory(project);
      const policy: BetaPolicy = adaptiveBetaEnabled ? new AdaptiveBetaPolicyV1() : new FixedBetaPolicy();
      const decision = policy.decide(history);

      append({
        eventType: "MilestoneProposed",
        milestoneId,
        payload: {
          milestoneId,
          projectId: PROJECT_ID,
          result,
          estimateDays: input.estimateDays,
          boundaryDays: input.boundaryDays,
          referenceRate: project.referenceRate,
          beta: decision.beta,
          betaPolicyVersion: decision.policyVersion,
        },
        actorId: ACTOR[role],
      });
    },
    [append, project, role, adaptiveBetaEnabled]
  );

  const acceptMilestone = useCallback(
    (milestoneId: string) => {
      const eventType = role === "provider" ? "MilestoneAcceptedByProvider" : "MilestoneAcceptedByClient";
      append({ eventType, milestoneId, payload: { milestoneId }, actorId: ACTOR[role] });

      // Activation follows acceptance automatically once both parties
      // have accepted — @nashtract/ledger deliberately leaves *when* to
      // activate to the application layer; this demo activates
      // immediately rather than adding a pointless extra click. The
      // append above already committed to the store, so replaying its
      // real, current envelope list (not a synthetic preview) tells us
      // whether both parties have now accepted.
      const state = replayProject(store.list(PROJECT_ID));
      if (state.milestones.get(milestoneId)?.state === "ACCEPTED") {
        append({ eventType: "MilestoneActivated", milestoneId, payload: { milestoneId }, actorId: SYSTEM_ACTOR });
      }
    },
    [store, append, role]
  );

  const recordEffort = useCallback(
    (milestoneId: string, days: number) => {
      append({ eventType: "EffortRecorded", milestoneId, payload: { milestoneId, days }, actorId: ACTOR[role] });

      const envelopes = store.list(PROJECT_ID);
      const state = replayProject(envelopes);
      const milestone = state.milestones.get(milestoneId);
      if (milestone && milestone.state === "ACTIVE" && milestone.consumedEffortDays >= effectiveBoundaryDays(milestone)) {
        append({ eventType: "BoundaryReached", milestoneId, payload: { milestoneId }, actorId: SYSTEM_ACTOR });
      }
    },
    [store, append, role]
  );

  const submitResult = useCallback(
    (milestoneId: string) => append({ eventType: "ResultSubmitted", milestoneId, payload: { milestoneId }, actorId: ACTOR[role] }),
    [append, role]
  );
  const acceptResult = useCallback(
    (milestoneId: string) => append({ eventType: "ResultAccepted", milestoneId, payload: { milestoneId }, actorId: ACTOR[role] }),
    [append, role]
  );
  const rejectResult = useCallback(
    (milestoneId: string, reason: string) =>
      append({ eventType: "ResultRejected", milestoneId, payload: { milestoneId, reason }, actorId: ACTOR[role] }),
    [append, role]
  );
  const proposeContinuation = useCallback(
    (milestoneId: string, additionalDays: number) =>
      append({
        eventType: "ContinuationProposed",
        milestoneId,
        payload: { milestoneId, additionalBoundaryDays: additionalDays },
        actorId: ACTOR[role],
      }),
    [append, role]
  );
  const acceptContinuation = useCallback(
    (milestoneId: string) =>
      append({ eventType: "ContinuationAccepted", milestoneId, payload: { milestoneId }, actorId: ACTOR[role] }),
    [append, role]
  );
  const stopContinuation = useCallback(
    (milestoneId: string) => append({ eventType: "MilestoneCancelled", milestoneId, payload: { milestoneId, reason: "continuation declined" }, actorId: ACTOR[role] }),
    [append, role]
  );
  const settleMilestone = useCallback(
    (milestoneId: string) => append({ eventType: "MilestoneSettled", milestoneId, payload: { milestoneId }, actorId: ACTOR[role] }),
    [append, role]
  );
  const cancelMilestone = useCallback(
    (milestoneId: string, reason: string) =>
      append({ eventType: "MilestoneCancelled", milestoneId, payload: { milestoneId, reason }, actorId: ACTOR[role] }),
    [append, role]
  );
  const excludeFromCalibration = useCallback(
    (milestoneId: string, reason: string) => {
      append({ eventType: "ScopeChangeDeclared", milestoneId, payload: { milestoneId, reason }, actorId: ACTOR[role] });
      append({ eventType: "CalibrationExcluded", milestoneId, payload: { milestoneId, reason }, actorId: ACTOR[role] });
    },
    [append, role]
  );

  const resetDemo = useCallback(() => {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    window.location.reload();
  }, []);

  const value: StoreContextValue = {
    role,
    setRole,
    adaptiveBetaEnabled,
    setAdaptiveBetaEnabled,
    project,
    createProject,
    proposeMilestone,
    acceptMilestone,
    recordEffort,
    submitResult,
    acceptResult,
    rejectResult,
    proposeContinuation,
    acceptContinuation,
    stopContinuation,
    settleMilestone,
    cancelMilestone,
    excludeFromCalibration,
    resetDemo,
  };

  return <StoreContext.Provider value={value}>{hydrated ? children : null}</StoreContext.Provider>;
}

export function useStore(): StoreContextValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}
