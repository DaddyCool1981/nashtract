/**
 * JSON-safe rendering for report output. Money values serialize to
 * their decimal string (human-readable in a report file, unlike the
 * bigint-marker round-trip format `apps/web` uses for localStorage) —
 * this is one-way, for writing `research/results/*.json`, not parsing
 * it back.
 */
import { Money } from "@nashtract/core";

function isMoneyLike(value: unknown): value is Money.Money {
  return (
    typeof value === "object" &&
    value !== null &&
    "minorUnits" in value &&
    typeof (value as { minorUnits: unknown }).minorUnits === "bigint" &&
    "currency" in value
  );
}

export function toReportSafe(value: unknown): unknown {
  if (isMoneyLike(value)) {
    return `${Money.toDecimalString(value)} ${value.currency}`;
  }
  if (typeof value === "bigint") {
    return value.toString();
  }
  if (Array.isArray(value)) {
    return value.map(toReportSafe);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, toReportSafe(v)]));
  }
  return value;
}

export function toReportJson(value: unknown): string {
  return JSON.stringify(toReportSafe(value), null, 2);
}
