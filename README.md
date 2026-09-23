# NashTract

**Status:** experimental — Core 0.2 draft, Phase 1 (pure core) in progress.

NashTract is a milestone-based commercial settlement protocol for
client–freelancer / consulting work. It freezes an expected effort, an
exposure boundary, a reference rate and a deviation-sharing factor for
each mutually accepted milestone, so that actual effort deviations are
shared predictably instead of either party bearing the full risk of an
estimate being wrong.

It does **not** try to score honesty, trust, or competence. See
[SPEC.md](./SPEC.md) for the full protocol specification — the product
intent, non-goals, the settlement equation, the exposure boundary, the
adaptive calibration model, and the guardrails this implementation
follows.

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
| 1 | Pure core: types, exact-decimal money, settlement equation, exposure, state machine, property tests | in progress |
| 2 | Ledger: append-only events, deterministic replay, milestone lineage | not started |
| 3 | Adaptive beta: Normal-Inverse-Gamma posterior, fixed-beta fallback | not started |
| 4 | Reference web UX | not started |
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
in particular is pure and deterministic (see [SPEC.md §13](./SPEC.md)).

## Known open items

The implementation surfaces spec gaps rather than silently resolving
them — see inline `// Note (open item...)` comments (e.g.
`packages/core/src/stateMachine.ts`) and [SPEC.md §18](./SPEC.md) for
the protocol's own list of unresolved questions. This is a research
implementation: if the attack-simulation suite (Phase 5) shows the
adaptive-beta policy introduces worse incentives than it removes, it is
documented and reverted, not hidden.

## License

MIT — see [LICENSE](./LICENSE).
