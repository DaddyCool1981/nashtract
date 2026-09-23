/**
 * Append-only ledger store (SPEC.md §11, invariants 24-25 of §15).
 * `InMemoryLedgerStore` is a reference implementation: one project's
 * chain is a plain array that only ever grows, sequence numbers are
 * contiguous starting at 1, and each envelope's `previousHash` commits
 * to the prior envelope — so any external tampering with a persisted
 * copy is detectable via `verifyLedgerChain`.
 *
 * There is deliberately no `remove`/`update` method on this class.
 */

import { randomUUID } from "node:crypto";
import { computeEnvelopeHash, type HashableEnvelopeFields, type LedgerEnvelope } from "./envelope.js";
import { HashChainMismatchError, NonMonotonicSequenceError } from "./errors.js";
import type { NashTractEvent } from "./events.js";

export type AppendInput<E extends NashTractEvent = NashTractEvent> = {
  readonly id?: string;
  readonly projectId: string;
  readonly milestoneId?: string;
  readonly eventType: E["eventType"];
  readonly payload: E["payload"];
  readonly occurredAt: string;
  readonly actorId: string;
};

/**
 * Recomputes and checks every hash and sequence number in an ordered
 * envelope list. Throws on the first inconsistency. Use this before
 * trusting a chain that was loaded from outside this process (e.g.
 * deserialized from storage) — `InMemoryLedgerStore.append` already
 * guarantees a chain it built itself is valid.
 */
export function verifyLedgerChain(envelopes: readonly LedgerEnvelope[]): void {
  let previous: LedgerEnvelope | undefined;
  for (const envelope of envelopes) {
    const expectedSequence = previous ? previous.sequence + 1 : 1;
    if (envelope.sequence !== expectedSequence) {
      throw new NonMonotonicSequenceError(
        `expected sequence ${expectedSequence} after ${previous?.sequence ?? "start"}, got ${envelope.sequence} (envelope ${envelope.id})`
      );
    }
    if (envelope.previousHash !== previous?.hash) {
      throw new HashChainMismatchError(
        `envelope ${envelope.id} (sequence ${envelope.sequence}): previousHash does not match the prior envelope's hash`
      );
    }
    const { hash, ...fields } = envelope;
    const expectedHash = computeEnvelopeHash(fields as HashableEnvelopeFields);
    if (hash !== expectedHash) {
      throw new HashChainMismatchError(`envelope ${envelope.id} (sequence ${envelope.sequence}): hash does not match its content`);
    }
    previous = envelope;
  }
}

export class InMemoryLedgerStore {
  private readonly chainsByProject = new Map<string, LedgerEnvelope[]>();

  append<E extends NashTractEvent>(input: AppendInput<E>): LedgerEnvelope<E> {
    const chain = this.chainsByProject.get(input.projectId) ?? [];
    const previous = chain[chain.length - 1];

    const fields: HashableEnvelopeFields = {
      id: input.id ?? randomUUID(),
      projectId: input.projectId,
      ...(input.milestoneId !== undefined ? { milestoneId: input.milestoneId } : {}),
      sequence: previous ? previous.sequence + 1 : 1,
      eventType: input.eventType,
      payload: input.payload,
      occurredAt: input.occurredAt,
      actorId: input.actorId,
      ...(previous ? { previousHash: previous.hash } : {}),
    };
    const envelope = Object.freeze({
      ...fields,
      hash: computeEnvelopeHash(fields),
    }) as LedgerEnvelope<E>;

    this.chainsByProject.set(input.projectId, [...chain, envelope]);
    return envelope;
  }

  /** Returns a snapshot (safe to hold onto) of every envelope appended for a project, in sequence order. */
  list(projectId: string): readonly LedgerEnvelope[] {
    return (this.chainsByProject.get(projectId) ?? []).slice();
  }

  projectIds(): readonly string[] {
    return [...this.chainsByProject.keys()];
  }
}
