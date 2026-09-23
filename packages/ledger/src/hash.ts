/**
 * Deterministic hashing for ledger tamper evidence (SPEC.md §11).
 * Hash chaining is recommended as tamper evidence, not as a substitute
 * for access control/signatures — it lets a replay detect that a past
 * envelope was altered, it does not authorize who may append.
 */

import { createHash } from "node:crypto";

/**
 * Canonical JSON serialization: object keys sorted recursively, so the
 * same logical payload hashes identically regardless of the order its
 * fields were constructed in. Handles `bigint` (used by `Money`), which
 * `JSON.stringify` cannot serialize on its own.
 */
export function canonicalStringify(value: unknown): string {
  return stringify(value);
}

function stringify(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value === "bigint") return `"bigint:${value.toString()}"`;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new RangeError(`canonicalStringify: non-finite number cannot be hashed: ${value}`);
    }
    return JSON.stringify(value);
  }
  if (typeof value === "string" || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stringify).join(",")}]`;
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stringify(v)}`).join(",")}}`;
  }
  throw new TypeError(`canonicalStringify: unsupported value type: ${typeof value}`);
}

export function sha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

export function hashOf(value: unknown): string {
  return sha256Hex(canonicalStringify(value));
}
