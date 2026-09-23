# NashTract

**Status:** experimental — Core 0.2 draft, all five spec-defined phases implemented. Adaptive beta is still not enabled by default in the reference web app pending a closer read of the Phase 5 findings below — see [`research/README.md`](./research/README.md) for what the attack suite actually found, including a real, documented limitation it did not hide.

NashTract is a milestone-based commercial settlement protocol for
client–freelancer / consulting work. It freezes an expected effort, an
exposure boundary, a reference rate and a deviation-sharing factor for
each mutually accepted milestone, so that actual effort deviations are
shared predictably instead of either party bearing the full risk of an
estimate being wrong.

It does **not** try to score honesty, trust, or competence. The full
protocol specification — product intent, non-goals, the settlement
equation, the exposure boundary, the adaptive calibration model, and
the guardrails this implementation follows — is `SPEC.md`, kept as a
local working reference and not published in this repository; the
sections cited below (§N) refer to it.

> Core principle: bounded exposure builds trust; trust is not an input
> used to justify unbounded exposure.

## Why

Client–freelancer work almost always gets priced one of two ways, and
both quietly dump the risk on one side.

**Fixed price.** Client and freelancer agree on a number upfront. If
the work turns out harder than expected, the freelancer eats the
difference — their genuine competence gets punished by someone else's
bad estimate. If the freelancer overestimated the complexity, the
client pays full price for work that didn't need it, with no way to
tell padding from real difficulty after the fact — the estimate was
never wrong enough to get caught.

**Time and materials.** The client pays for hours worked. If the
freelancer is fast, that skill isn't rewarded — it just means a
smaller invoice, so there's no upside to being good at the job. And
the client takes on a different risk: nothing but trust stops the
clock from running a little longer than it needs to, milestone after
milestone.

NashTract doesn't pick a side between these two failure modes; it
splits the difference, deliberately. Its settlement equation —
`P(T) = r[M + β(T−M)]` — shares the gap between the agreed estimate
(M) and the actual effort (T) according to a factor (β) frozen the
moment both parties accept the milestone:

- finish early, and part of that upside stays with the freelancer
  instead of just shrinking the invoice;
- run over, and the client isn't on the hook for the full cost of
  every overrun the freelancer didn't fully see coming either;
- and exposure is never open-ended either way — a hard boundary (U)
  stops the milestone cold at a number both sides agreed to in
  advance, and going further needs a fresh, explicit yes from both,
  not an assumption.

Over time, if a freelancer's estimates show a *persistent,
statistically significant* pattern — not one unlucky milestone — the
sharing factor can adapt to reflect that. The point isn't to catch
anyone lying; NashTract never scores honesty, trust, or competence. It
just tries to make silent padding and silent overrun economically
uninteresting, for whichever side might otherwise be tempted, while
leaving real collaboration and real efficiency worth exactly what they
are.

## Repository structure

```text
packages/
  core/           deterministic settlement/exposure/state-machine primitives — no UI, DB, or framework deps
  adaptive-beta/  experimental statistical calibration policy (Phase 3)
  ledger/         append-only domain event log (Phase 2)
apps/
  web/            reference web UX (Phase 4)
research/
  simulations/    the simulation engine, evaluation metrics, and JSON report generator
  scenarios/      SPEC.md §16's seven attack/simulation scenario definitions (A-G)
  results/        regenerated, reproducible JSON output — not hand-picked screenshots
```

## Status

| Phase | Scope | Status |
| --- | --- | --- |
| 1 | Pure core: types, exact-decimal money, settlement equation, exposure, state machine, property tests | done |
| 2 | Ledger: append-only events, deterministic replay, milestone lineage, calibration eligibility | done |
| 3 | Adaptive beta: Normal-Inverse-Gamma posterior, fixed-beta fallback | done (not enabled by default — pending Phase 5) |
| 4 | Reference web UX | done |
| 5 | Attack/simulation suite | done — see [`research/README.md`](./research/README.md) |

## Getting started

```bash
pnpm install
pnpm test
pnpm typecheck
pnpm build
```

Each package under `packages/` is independently testable and has no
dependency on UI, a database, or a payment provider — `@nashtract/core`
in particular is pure and deterministic (SPEC.md §13).

To run the reference web app:

```bash
pnpm --filter @nashtract/web dev
```

## Known open items

The implementation surfaces spec gaps rather than silently resolving
them:

- [`packages/core/src/stateMachine.ts`](./packages/core/src/stateMachine.ts):
  SPEC.md §11 lists a `MilestoneCancelled` ledger event, but §12's
  state diagram has no `CANCELLED` state. The pure core state machine
  intentionally does not invent one.
- [`packages/ledger/src/replay.ts`](./packages/ledger/src/replay.ts):
  the ledger layer resolves that gap, and two related ones — §12 shows
  `PROPOSED -> REFUSED` and `CONTINUATION_PENDING -> STOPPED` but §11
  has no dedicated events for either — with documented, revisable
  choices. Read the module docstring for the reasoning.
- SPEC.md §10's "open item" on same-result continuation economics is
  implemented as lineage (a boundary extension on the *same* milestone,
  per §12's diagram) — deliberately not as new-milestone economics,
  pending the Phase 5 attack suite.

- `packages/adaptive-beta`'s Normal-Inverse-Gamma posterior accumulates
  evidence over the whole eligible history with no forgetting or
  windowing (SPEC.md §8 does not specify one). Phase 5's scenario E
  found this makes recovery toward neutral slow after a provider
  recalibrates their estimates — see
  [`research/README.md`](./research/README.md#a-documented-limitation-not-a-hidden-one-specmd-21)
  for the measured numbers. Whether V1 needs a windowed/decayed variant
  is now an explicit, evidenced open question, not a guess.

SPEC.md §18 lists the protocol's own unresolved questions. This is a
research implementation: if the attack-simulation suite (Phase 5) shows
the adaptive-beta policy introduces worse incentives than it removes,
it is documented and reverted, not hidden.

## License

MIT — see [LICENSE](./LICENSE).

---

Built and maintained by [Cyrille Lecroq](https://ytechnology.eu),
[Y Technology](https://ytechnology.eu) — engineering consulting,
complexity to evidence.
