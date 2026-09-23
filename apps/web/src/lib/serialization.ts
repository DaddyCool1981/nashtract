import type { LedgerEnvelope } from "@nashtract/ledger";

/**
 * localStorage persistence for the demo ledger. `Money.minorUnits` is a
 * bigint, which `JSON.stringify`/`parse` don't support natively — this
 * is the one place that bridges it, everywhere else stays bigint-safe
 * by never touching JSON directly (see @nashtract/ledger's own
 * `canonicalStringify`, which this deliberately does not reuse: that
 * one is a one-way hashing format, this one has to round-trip).
 */
const BIGINT_MARKER = "__bigint__";

export function serializeEnvelopes(envelopes: readonly LedgerEnvelope[]): string {
  return JSON.stringify(envelopes, (_key, value) =>
    typeof value === "bigint" ? { [BIGINT_MARKER]: value.toString() } : value
  );
}

export function deserializeEnvelopes(json: string): LedgerEnvelope[] {
  return JSON.parse(json, (_key, value) => {
    if (value && typeof value === "object" && typeof value[BIGINT_MARKER] === "string") {
      return BigInt(value[BIGINT_MARKER]);
    }
    return value;
  });
}
