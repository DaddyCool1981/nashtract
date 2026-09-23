import { hashOf } from "./hash.js";
import type { NashTractEvent } from "./events.js";

/** SPEC.md §11 recommended envelope, specialized to NashTract's event union. */
export type LedgerEnvelope<E extends NashTractEvent = NashTractEvent> = {
  readonly id: string;
  readonly projectId: string;
  readonly milestoneId?: string;
  readonly sequence: number;
  readonly eventType: E["eventType"];
  readonly payload: E["payload"];
  readonly occurredAt: string;
  readonly actorId: string;
  readonly previousHash?: string;
  readonly hash: string;
};

/** The subset of an envelope's fields that its hash commits to. */
export type HashableEnvelopeFields = Omit<LedgerEnvelope, "hash">;

export function computeEnvelopeHash(fields: HashableEnvelopeFields): string {
  return hashOf(fields);
}
