# Architecture — v1.0

## Design boundaries
- `simulation/`: pure TypeScript, no React/Phaser/browser globals, deterministic with injected PRNG and logical clock.
- `content/`: versioned declarative mission/operator/equipment definitions, validated at load.
- `game/`: Phaser isometric view, input, camera, event presenter. Rendering never changes simulation truth.
- `ui/`: React HUD, orders, planning, pause dialogs, event log and inspector.
- `app/`: orchestration, lifecycle, input-to-command adapter, save/load.
- `campaign/`: future persistence, roster, progression and training.

## Proposed tree
```
src/
  app/
  simulation/{core,world,perception,knowledge,operators,orders,decisions,combat,events,objectives}/
  game/{rendering,camera,input,presentation}/
  ui/{hud,planning,orders,decisions,debug}/
  content/{missions,operators,equipment}/
  campaign/
  shared/
tests/{unit,integration,e2e,fixtures}/
```

## Tick and clock
Fixed logical step = 100 ms. The render loop may interpolate at display refresh rate. Pause freezes logical clock and presentation. Command acceptance occurs at the start of a tick; assign stable IDs and stable sort orders. No `Math.random`, `Date.now`, nonstable iteration, or asynchronous decisions in simulation.

## Tick pipeline
1. Apply timestamped commands.
2. Advance environment/NPC state.
3. Evaluate sensing/occlusion.
4. Update individual knowledge and communication.
5. Validate and update orders.
6. Enumerate permitted actions and compute utility.
7. Advance movement and timed actions.
8. Resolve interactions/combat consequences.
9. Evaluate objectives and terminal conditions.
10. Aggregate events, select pause points, publish immutable snapshot.

## Determinism
Seeded PRNG (explicit algorithm and version), fixed-point/integer values for core calculations where possible, stable tie breakers by IDs, sorted command queues, serializable snapshots, periodic canonical state hashes. Replay fails fast on version mismatch. Effects consume logged events; they never draw from simulation PRNG.

The prototype uses `xorshift32-v1` (shifts 13, 17, 5), unsigned 32-bit
seeds, and substitutes `0x6d2b79f5` for seed zero to avoid the absorbing state.
Canonical JSON sorts object keys using code-unit order, preserves array order,
and its UTF-16 code units are hashed with 32-bit FNV-1a for regression checks
(not cryptographic use).
Commands are ordered by issued tick then command ID. Controls apply before
advancing logical time; pausing does not increment the tick.

## Runtime flow
UI map/context menu -> validated `SimulationCommand` -> engine.dispatch -> engine.step -> immutable snapshot and event list -> React/Phaser render. Debug inspector reads decision traces but cannot mutate engine.

## Storage
Prototype: in-memory; vertical slice: IndexedDB for save/replay with schema version and migration policy. No backend required initially.

## Testing
Vitest for pure simulation, fixtures for golden traces, property/invariant tests, Playwright for basic end-to-end interactions. CI runs typecheck, lint, unit, integration and build.
