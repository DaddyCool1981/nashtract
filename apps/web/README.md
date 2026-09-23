# @nashtract/web

Reference web UX for NashTract (Phase 4) — see the [repository root README](../../README.md)
for the protocol, the package layout, and how to run everything.

```bash
pnpm --filter @nashtract/web dev
```

This app runs the whole protocol client-side, in the browser: it holds
an `@nashtract/ledger` `InMemoryLedgerStore` in memory, persists its
envelopes to `localStorage` (verifying the hash chain on load), and
replays them through `@nashtract/core` for every settlement and
exposure figure shown. There is no backend and no database — that is
intentional for a reference demo, not a limitation of the protocol
packages themselves.
