# Development Roadmap

## Current status — 2026-10-30
Tasks 001–007 are implemented as the Blackwood playable prototype. This is a
technical proof of the first-playable loop, not a finished game or confirmation
of fun, final balance or production readiness.

| Milestone | Task | Implementation status | Automated evidence |
| --- | --- | --- | --- |
| M0 — Foundation | [001](tasks/001-foundation.md) | Implemented | Strict TypeScript, lint, Node import, browser shell and build |
| M1 — Deterministic world | [002](tasks/002-simulation-core.md) | Implemented | PRNG/control golden traces, stable ordering, immutable snapshots and hashes |
| M2 — Orders and autonomy | [003](tasks/003-orders-autonomy.md) | Implemented | Six order types, three-operator plans, policies, dependencies and occupancy |
| M3 — Knowledge and NPCs | [004](tasks/004-perception-npcs.md) | Implemented | LOS, confidence, radio provenance, stale intel and hidden-contact invariants |
| M4 — Hybrid encounters | [005](tasks/005-hybrid-combat.md) | Implemented in headless fixtures | Threat filtering, surrender/cessation, bounded resources, stress and intent resumption |
| M5 — Command UI | [006](tasks/006-isometric-command-ui.md) | Implemented | Canvas selection, queue/execute/pause, policy controls and narrow viewport |
| M6 — Blackwood proof | [007](tasks/007-blackwood-replay.md) | Implemented | Autonomous completion, pause/replan, debrief, same-seed retry and replay file round-trip |

The latest local baseline has 46 unit/integration tests and 7 Chromium E2E tests.
Run the commands in [README.md](README.md#checks) to verify a checkout. GitHub CI
is configured in [.github/workflows/ci.yml](.github/workflows/ci.yml); its live
status is available in the repository's Actions tab.

## Next task — Manual Blackwood playtest
This is the next validation step, not an approved implementation task 008.

1. Run the sample plan with ADAPTIVE autonomy; evaluate the critical pause,
   continue or replan, and read the debrief.
2. Retry the same seed and plan; compare hashes. Then change only one order to
   compare two strategies in the same situation.
3. Keep the plan fixed and compare two policies, including WIDE autonomy for
   uninterrupted execution.
4. Record whether the player understands decisions, perceives the effect of
   their orders, and finds the pause useful. Capture concrete usability and
   pacing problems before selecting a follow-up implementation task.

Manual gameplay validation is still pending. Do not start campaign/progression
or invent new systems to address untested assumptions.

## Known prototype limits
- Art, timing, utility weights and balance are provisional.
- Blackwood starts with one uncertain civilian contact. Combat/threat cases are
  covered by headless fixtures, not a selectable combat mission.
- Sensing, NPC behavior, equipment and command layers are deliberately simplified;
  the broader GDD remains the design direction, not a list of completed features.
- Save/replay uses JSON files, not IndexedDB or campaign persistence.
- Automated browser coverage is Chromium only; performance budgets and other
  browsers have not been established.
- Vite reports a large Phaser bundle. This is a known build warning, not a
  failed check.

## Milestone definitions

## M0 — Specification and repo foundation
Docs, CI, strict TS, Vite/React/Phaser shell, Vitest/Playwright, lint, headless test entry. **Gate:** clean build and tests.

## M1 — Deterministic world
Seeded PRNG, fixed ticks, map/grid, entities, canonical snapshot, event log, replay hash. **Gate:** same inputs yield identical hashes.

## M2 — Orders and autonomy
Order queue/status/dependencies, policy inheritance, pathfinding, operator task execution, simple Utility AI, decision inspector. **Gate:** 3 operators independently finish noncombat objectives.

## M3 — Knowledge and NPCs
Perception/occlusion, observations, NPC behavior, communication. **Gate:** operators never act on hidden knowledge.

## M4 — Hybrid encounters
Threat assessment, constrained automatic reactions, abstract combat, timed presentation events, stress/fatigue effects. **Gate:** autonomous reactions and safety invariants pass.

## M5 — Command UI and smart pause
Isometric map, click-to-order, per-order presets, Havoc/Bravo 1 scope, event timeline, contextual pauses. **Gate:** full user loop playable.

## M6 — Blackwood vertical proof
Objectives, mission end, debrief, same-seed retry, decision explanations, minimal replay. **Gate:** complete mission with/without player intervention; alternative strategies visible.

## After proof (not part of M0-M6)
Persistent roster, training center, more proficiencies, psychological profiles, richer NPC behavior, 5 missions, polished art/audio, IndexedDB saves, campaign.

## Workflow
One task per PR; test gates before merge; document deviations as architecture decision records; do not add features to solve hypothetical future requirements.
