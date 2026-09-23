import { describe, expect, it } from "vitest";
import { InMemoryLedgerStore, verifyLedgerChain } from "../src/store.js";
import { HashChainMismatchError, NonMonotonicSequenceError } from "../src/errors.js";
import { Money } from "@nashtract/core";

const { money } = Money;

describe("InMemoryLedgerStore (SPEC.md §15 invariants 24-25)", () => {
  it("24. is append-only: list() returns a snapshot, not a live mutable reference", () => {
    const store = new InMemoryLedgerStore();
    store.append({
      projectId: "p1",
      eventType: "ProjectCreated",
      payload: { projectId: "p1", referenceRate: money("1500", "EUR") },
      occurredAt: "2026-01-01T00:00:00.000Z",
      actorId: "provider-1",
    });
    const snapshot = store.list("p1") as unknown[];
    snapshot.push({ intruder: true });
    expect(store.list("p1")).toHaveLength(1);
  });

  it("25. sequence numbers are monotonic and contiguous, starting at 1", () => {
    const store = new InMemoryLedgerStore();
    for (let i = 0; i < 3; i++) {
      store.append({
        projectId: "p1",
        eventType: "ProjectCreated",
        payload: { projectId: "p1", referenceRate: money("1500", "EUR") },
        occurredAt: "2026-01-01T00:00:00.000Z",
        actorId: "provider-1",
      });
    }
    const sequences = store.list("p1").map((e) => e.sequence);
    expect(sequences).toEqual([1, 2, 3]);
  });

  it("chains each envelope's previousHash to the prior envelope's hash", () => {
    const store = new InMemoryLedgerStore();
    store.append({
      projectId: "p1",
      eventType: "ProjectCreated",
      payload: { projectId: "p1", referenceRate: money("1500", "EUR") },
      occurredAt: "2026-01-01T00:00:00.000Z",
      actorId: "provider-1",
    });
    const second = store.append({
      projectId: "p1",
      eventType: "ScopeChangeDeclared",
      milestoneId: "m1",
      payload: { milestoneId: "m1", reason: "test" },
      occurredAt: "2026-01-02T00:00:00.000Z",
      actorId: "provider-1",
    });
    const [first] = store.list("p1");
    expect(second.previousHash).toBe(first!.hash);
    expect(first!.previousHash).toBeUndefined();
  });

  it("envelopes are frozen (cannot be mutated after append)", () => {
    const store = new InMemoryLedgerStore();
    const envelope = store.append({
      projectId: "p1",
      eventType: "ProjectCreated",
      payload: { projectId: "p1", referenceRate: money("1500", "EUR") },
      occurredAt: "2026-01-01T00:00:00.000Z",
      actorId: "provider-1",
    });
    expect(() => {
      (envelope as { sequence: number }).sequence = 999;
    }).toThrow();
  });

  it("different projects have independent chains", () => {
    const store = new InMemoryLedgerStore();
    store.append({
      projectId: "p1",
      eventType: "ProjectCreated",
      payload: { projectId: "p1", referenceRate: money("1500", "EUR") },
      occurredAt: "2026-01-01T00:00:00.000Z",
      actorId: "provider-1",
    });
    store.append({
      projectId: "p2",
      eventType: "ProjectCreated",
      payload: { projectId: "p2", referenceRate: money("2000", "EUR") },
      occurredAt: "2026-01-01T00:00:00.000Z",
      actorId: "provider-2",
    });
    expect(store.list("p1")).toHaveLength(1);
    expect(store.list("p2")).toHaveLength(1);
    expect(store.projectIds().sort()).toEqual(["p1", "p2"]);
  });
});

describe("verifyLedgerChain (tamper evidence)", () => {
  function buildChain() {
    const store = new InMemoryLedgerStore();
    store.append({
      projectId: "p1",
      eventType: "ProjectCreated",
      payload: { projectId: "p1", referenceRate: money("1500", "EUR") },
      occurredAt: "2026-01-01T00:00:00.000Z",
      actorId: "provider-1",
    });
    store.append({
      projectId: "p1",
      eventType: "ScopeChangeDeclared",
      milestoneId: "m1",
      payload: { milestoneId: "m1", reason: "test" },
      occurredAt: "2026-01-02T00:00:00.000Z",
      actorId: "provider-1",
    });
    return store.list("p1");
  }

  it("accepts a valid chain", () => {
    expect(() => verifyLedgerChain(buildChain())).not.toThrow();
  });

  it("detects a tampered payload", () => {
    const chain = buildChain();
    const tampered = chain.map((e, i) =>
      i === 1 ? { ...e, payload: { ...e.payload, reason: "tampered" } } : e
    );
    expect(() => verifyLedgerChain(tampered)).toThrow(HashChainMismatchError);
  });

  it("detects a broken hash chain (previousHash mismatch)", () => {
    const chain = buildChain();
    const tampered = chain.map((e, i) => (i === 1 ? { ...e, previousHash: "deadbeef" } : e));
    expect(() => verifyLedgerChain(tampered)).toThrow(HashChainMismatchError);
  });

  it("detects a non-monotonic / skipped sequence", () => {
    const chain = buildChain();
    const tampered = chain.map((e, i) => (i === 1 ? { ...e, sequence: 5 } : e));
    expect(() => verifyLedgerChain(tampered)).toThrow(NonMonotonicSequenceError);
  });

  it("detects a reordered (replayed out of order) chain", () => {
    const chain = buildChain();
    expect(() => verifyLedgerChain([...chain].reverse())).toThrow();
  });
});
