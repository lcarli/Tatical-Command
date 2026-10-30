# TACTICAL COMMAND — Preproduction v1.0

Browser-based 2.5D isometric autonomous tactical-command strategy game. The player commands at Havoc (strategic) and Bravo 1 (local) levels; **operators execute independently**.

## First playable target
One small office map, 3 operators, 1 NPC, 2 objectives, autonomous execution, per-order policies, one meaningful decision pause, deterministic retry and a minimal event replay.

## Stack
TypeScript strict, Vite, React, Phaser, Vitest, Playwright. Simulation is framework-independent TypeScript and can run headless in Node.

## Document map
- `docs/GDD.md`: product definition, scope, gameplay rules
- `docs/ARCHITECTURE.md`: components, contracts, deterministic execution
- `docs/SIMULATION_SPEC.md`: tick phases, decisions, combat, psychology, policy
- `docs/DATA_MODEL.md`: initial TypeScript contracts
- `docs/MISSION_BLACKWOOD.md`: first playable mission
- `docs/TEST_PLAN.md`: acceptance criteria and automated tests
- `ROADMAP.md`: milestone sequence and gates
- `tasks/`: implementation tasks for Copilot
- `.github/copilot-instructions.md`: persistent agent instructions

## Prototype status
Tasks 001–007 are implemented as a small Blackwood playable proof. Read
`docs/GDD.md`, `docs/ARCHITECTURE.md`, and `.github/copilot-instructions.md`
before making changes. Implement only a selected task and its prerequisites;
campaign and progression remain out of scope.
See [ROADMAP.md](ROADMAP.md) for completed milestones, known limits and the
next manual playtest.

## Run locally
Requires Node.js 22.12+ and npm.

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite.

## Try Blackwood
1. Leave the default policies and choose **Load sample plan**, then **Execute plan**.
2. At the critical intelligence pause, continue the plan, prioritize the civilian,
   or edit/cancel orders before resuming.
3. Read the debrief, decision inspector and event timeline.
4. Choose **Retry same seed**, load the same plan, and compare the final hashes.
   Change only one policy or one destination to compare behavior.
5. To run unattended, select **WIDE** autonomy before loading the sample plan.
6. Save a replay JSON or choose **Replay recorded run**. Replay is read-only and
   verifies both the canonical state and event log. Files can be imported again.

Select an operator and a map tile, choose an order and policy, then queue it.
Coordinate inputs provide an alternative to canvas interaction. Havoc distributes
team intent; Bravo 1 scope assigns local operator orders. Scroll zooms the map,
middle-button dragging pans. Playback speed changes ticks per wall-clock interval,
not the fixed 100 ms logical step.

The map uses placeholder shapes. Default Blackwood has one uncertain civilian
contact; threat, surrender, abstract response and resource cases are covered by
headless encounter fixtures, not a separate combat scenario selector.

## Checks
```sh
npm run typecheck
npm run lint
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

Unit tests run under Node. The simulation also has a separate TypeScript check
without browser or Node ambient APIs. Playwright checks the shell in Chromium.
The next step is a manual Blackwood playtest: compare two plans and two policies,
check whether decisions are understandable and whether the pause is useful.
There is no approved task 008 yet. GitHub CI runs these checks on pushes and pull
requests; see the repository's [Actions](https://github.com/lcarli/Tatical-Command/actions)
for the latest result.

Scope and numeric balance values are provisional until playtested.
