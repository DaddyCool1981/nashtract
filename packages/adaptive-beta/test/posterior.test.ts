import { describe, expect, it } from "vitest";
import { computePosterior } from "../src/posterior.js";
import { DEFAULT_PRIOR_V1 } from "../src/prior.js";

describe("computePosterior", () => {
  it("with zero observations, returns the prior unchanged", () => {
    const posterior = computePosterior(DEFAULT_PRIOR_V1, []);
    expect(posterior.observations).toBe(0);
    expect(posterior.mu).toBe(DEFAULT_PRIOR_V1.mu0);
    expect(posterior.kappa).toBe(DEFAULT_PRIOR_V1.kappa0);
    expect(posterior.alpha).toBe(DEFAULT_PRIOR_V1.alpha0);
    expect(posterior.beta).toBe(DEFAULT_PRIOR_V1.beta0);
    expect(posterior.degreesOfFreedom).toBe(2 * DEFAULT_PRIOR_V1.alpha0);
  });

  it("matches a hand-computed conjugate update", () => {
    // prior mu0=0, kappa0=1, alpha0=2, beta0=0.25; data = [1, -1] (mean 0, sumSq=2)
    const posterior = computePosterior(DEFAULT_PRIOR_V1, [1, -1]);
    // kappa_n = 1 + 2 = 3
    expect(posterior.kappa).toBe(3);
    // mu_n = (1*0 + 2*0) / 3 = 0
    expect(posterior.mu).toBeCloseTo(0, 12);
    // alpha_n = 2 + 2/2 = 3
    expect(posterior.alpha).toBe(3);
    // beta_n = 0.25 + 0.5*2 + (1*2*(0-0)^2)/(2*3) = 0.25 + 1 + 0 = 1.25
    expect(posterior.beta).toBeCloseTo(1.25, 12);
    expect(posterior.degreesOfFreedom).toBe(6);
  });

  it("a persistent negative bias shifts the posterior mean below zero", () => {
    const logErrors = Array.from({ length: 10 }, () => Math.log(0.7)); // T consistently 70% of M
    const posterior = computePosterior(DEFAULT_PRIOR_V1, logErrors);
    expect(posterior.mu).toBeLessThan(0);
    expect(posterior.mu).toBeCloseTo(Math.log(0.7), 1); // pulled close to the data as n grows
  });

  it("a persistent positive bias shifts the posterior mean above zero", () => {
    const logErrors = Array.from({ length: 10 }, () => Math.log(1.5)); // T consistently 150% of M
    const posterior = computePosterior(DEFAULT_PRIOR_V1, logErrors);
    expect(posterior.mu).toBeGreaterThan(0);
  });

  it("stdOfMu is finite given alpha0=2 (df starts at 4, always > 2)", () => {
    expect(Number.isFinite(computePosterior(DEFAULT_PRIOR_V1, []).stdOfMu)).toBe(true);
  });
});
