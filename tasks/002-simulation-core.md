# Task 002 — Deterministic core

**Goal:** Seeded versioned PRNG, 100ms tick engine, command validation/ordering, immutable snapshots, event log, canonical serialization/hash, 10x10 map fixture.

**Acceptance:** repeated runs with same seed+commands match hash; command order is stable; terminal state halts ticking; invalid commands rejected with typed errors; Node tests require no browser. Include golden trace fixture and document PRNG algorithm/version.

**Agent prompt:** Implement only Task 002 following the docs. Add tests for deterministic replay and command validation. No graphics, AI or combat.
