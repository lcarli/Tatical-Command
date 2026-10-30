# Test Plan and Definition of Done

## Mandatory checks for each task
`npm run typecheck`, `npm run lint`, `npm test`, `npm run build` (once scripts exist). Add regression fixtures for changes to engine behavior.

## Unit tests
- Seeded PRNG yields stable known sequence.
- Policy resolution respects mission -> team -> order; hard constraints cannot be overridden.
- Order dependency/status transitions and interruption/resumption.
- Grid pathfinding respects obstacles, stable tie-breaks and occupancy.
- Perception respects occlusion, detection vs identification and stale observations.
- Stress/fatigue bounded, resilience attenuates effects, no accidental coupling to unrelated proficiencies.
- Decision selection rejects invalid candidates before utility scoring.
- Abstract combat consumes resources, respects surrender and ends when threat ends.
- Pause aggregation occurs at tick boundary.

## Integration tests
- Blackwood fully executes without further input after initial planning.
- Fixed seed+commands produce identical event log and final canonical hash across repeated runs.
- Policy variation produces an observable difference in designed fixture.
- Different strategies produce explainable differences.
- Rendering reads events and cannot mutate simulation.
- Terminal state stops progression.

## UI E2E
Select operator, issue order via map, change per-order policy, execute, pause, resume, finish, retry. Player-visible intel excludes hidden entities.

## Acceptance gate
No critical invariant violations, no uncaught runtime errors, full first-playable loop, deterministic replay, explainable debrief. Performance budget to be established with actual browser profiling; avoid inventing targets prematurely.

## Available automated fixtures
- `tests/unit/`: Node import, PRNG/control golden traces, canonical hashing, typed
  boundary failures, transactional team commands, response safety and resilience.
- `tests/integration/`: three-operator plans, policy timing, occupancy, dependencies,
  LOS, confidence, radio/stale intel, abstract encounters, resource bounds, Blackwood
  autonomous completion/failure, pause/replan, retry and exact versioned replay.
- `tests/e2e/`: Chromium shell, canvas operator/tile input, queue/execute/pause,
  full Blackwood decision/debrief/replay, unattended wide-autonomy retry,
  visible invalid-command errors and replay download/import.

Automation does not establish fun, final balance, performance budgets or
cross-browser support. Run a manual playtest before expanding scope.
