# Phase 5 — the mandatory simulation/attack suite

SPEC.md §16-§17. Every scenario below runs the *actual* protocol —
a real `@nashtract/ledger` project driven through its real event
lifecycle, settled with the real `@nashtract/core` equation — not a
separate model of the math that could drift from the implementation.

```bash
pnpm --filter @nashtract/research test     # the assertions (this is what CI runs)
pnpm --filter @nashtract/research report   # regenerates research/results/*.json
```

Every stochastic scenario's seed is a literal constant in its own
module under `scenarios/`, per §16 ("All stochastic tests MUST store
random seeds"). `results/*.json` is regenerated output, not hand-picked
screenshots (§19) — rerunning `report` reproduces it byte-for-byte.

## Research question (§17)

> Does adaptive beta materially reduce the profitability of persistent
> estimation bias while preserving meaningful rewards for genuine
> efficiency and avoiding excessive reaction to normal estimation
> noise?

**Provisional yes, with a measured, non-zero residual — not hidden.**
See `results/` for the exact numbers; summary below.

| Scenario | Finding |
| --- | --- |
| A — calibrated provider | Beta stays within [0.35, 0.65] throughout a 40-milestone run of pure noise (σ=0.25) and settles within 0.15 of neutral by the end. No systematic drift between the first and second half of the run. |
| B — salami overestimation | Persistent T/M ∈ {0.9, 0.75, 0.6, 0.5} pushes beta toward 1, as intended. But it is **not free**: at T/M=0.9 the provider still extracted a cumulative premium of ~€3,696 over 16 milestones under adaptive beta before/while it converges, versus an unbounded ~€6,000-and-growing under a fixed β=0.5 that never reacts. That residual is the real, measured cost of requiring evidence before reacting — see `results/b-salami-overestimation.json` for all four ratios. |
| C — systematic underestimation | Mirror image: persistent overruns push beta toward 0, capping the client's cumulative overpayment versus the accepted estimate well below what a fixed policy would have permitted. |
| D — single extreme outlier | One T/M=0.25 or T/M=4 milestone moves beta by ≈0.2-0.3 at most; the *same* ratio held persistently has already saturated beta to ≈0 or ≈1 by the same point in the series. A surprise is not treated as a pattern. |
| E — genuine productivity improvement | Beta does not react on the very next milestone after a real speed-up (still reads exactly 0.5, because it is decided from history *before* that milestone — no look-ahead). It climbs toward 1 as evidence accumulates, then drifts back down once the provider requotes and re-delivers on target. |
| F — scope change | An excluded, externally-caused 3x overrun leaves beta within 0.15 of neutral; the same event left un-excluded pulls beta measurably further away. The excluded observation stays visible in `deriveCalibrationHistory` with its reason — nothing is silently dropped. |
| G — boundary/rebaseline attack | Four consecutive boundary-hit → continuation rounds on one milestone never touch the original M, β, or already-consumed effort, and an attempt to record effort past the current boundary without a continuation is rejected outright, every time. |

## A documented limitation, not a hidden one (SPEC.md §21)

Scenario E's recovery is slower than a naive reading of "adaptive"
might suggest: after 15 well-calibrated milestones following the
recalibration, beta had only returned from ≈0.995 to ≈0.94 — nowhere
near neutral yet. This is a real, load-bearing property of
`AdaptiveBetaPolicyV1`, not a bug: the Normal-Inverse-Gamma posterior
(SPEC.md §8) accumulates evidence over the *entire* eligible history
with no forgetting or windowing, because the spec does not define one.
Old evidence is diluted by new evidence, never discarded. Whether that
is the right product behavior, or whether V1 needs a windowed/decayed
variant, is exactly the kind of question this suite exists to surface
— see `results/e-productivity-improvement.json`.

## What this suite does not settle

- It measures *this* prior (`DEFAULT_PRIOR_V1`) and *this* equivalence
  margin (`EQUIVALENCE_MARGIN_V1 = ln(1.1)`). Different engineering
  defaults would move every number above; SPEC.md §8 is explicit that
  these are "engineering defaults, not universal."
- IID-Normal log-errors are an approximation (SPEC.md §18);
  correlated successive errors are not modeled here.
- This is not a claim of game-theoretic incentive-compatibility
  (SPEC.md §21 explicitly forbids claiming that).
