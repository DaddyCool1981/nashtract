# NashTract

**Status:** experimental — Core 0.2 draft, Phase 4 (reference web UX) in progress. Adaptive beta is not enabled by default: the spec requires the Phase 5 attack suite to be reviewed first.

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

Fixed-price estimates punish freelancers for genuine efficiency and
expose clients to unbounded scope creep. Pure time-and-materials does
the opposite. NashTract shares the deviation between estimate and
actual effort according to a frozen factor (β), bounds the client's
automatic exposure at acceptance time, and — experimentally — lets that
factor drift toward fairness when a provider's estimates show
persistent, statistically significant bias, without ever penalizing a
single unlucky milestone.

## Repository structure

```text
packages/
  core/           deterministic settlement/exposure/state-machine primitives — no UI, DB, or framework deps
  adaptive-beta/  experimental statistical calibration policy (Phase 3)
  ledger/         append-only domain event log (Phase 2)
apps/
  web/            reference web UX (Phase 4)
research/
  simulations/    reproducible attack/simulation scenarios (Phase 5)
```

## Status

| Phase | Scope | Status |
| --- | --- | --- |
| 1 | Pure core: types, exact-decimal money, settlement equation, exposure, state machine, property tests | done |
| 2 | Ledger: append-only events, deterministic replay, milestone lineage, calibration eligibility | done |
| 3 | Adaptive beta: Normal-Inverse-Gamma posterior, fixed-beta fallback | done (not enabled by default — pending Phase 5) |
| 4 | Reference web UX | in progress |
| 5 | Attack/simulation suite | not started |

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
