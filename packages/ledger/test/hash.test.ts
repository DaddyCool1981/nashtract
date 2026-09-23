import { describe, expect, it } from "vitest";
import { canonicalStringify, hashOf } from "../src/hash.js";

describe("canonicalStringify", () => {
  it("is independent of key insertion order", () => {
    const a = { b: 1, a: 2, c: { z: 1, y: 2 } };
    const b = { a: 2, c: { y: 2, z: 1 }, b: 1 };
    expect(canonicalStringify(a)).toBe(canonicalStringify(b));
  });

  it("serializes bigint deterministically (Money.minorUnits)", () => {
    expect(canonicalStringify({ minorUnits: 750000n, currency: "EUR" })).toBe(
      '{"currency":"EUR","minorUnits":"bigint:750000"}'
    );
  });

  it("drops undefined fields (so an omitted optional field hashes like a never-present one)", () => {
    expect(canonicalStringify({ a: 1, b: undefined })).toBe(canonicalStringify({ a: 1 }));
  });

  it("preserves array order", () => {
    expect(canonicalStringify([1, 2, 3])).not.toBe(canonicalStringify([3, 2, 1]));
  });
});

describe("hashOf", () => {
  it("is deterministic for equivalent structures", () => {
    expect(hashOf({ x: 1, y: 2 })).toBe(hashOf({ y: 2, x: 1 }));
  });

  it("differs for different content", () => {
    expect(hashOf({ x: 1 })).not.toBe(hashOf({ x: 2 }));
  });

  it("produces a 64-character hex sha256 digest", () => {
    expect(hashOf({ x: 1 })).toMatch(/^[0-9a-f]{64}$/);
  });
});
