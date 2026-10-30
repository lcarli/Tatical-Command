# GitHub Copilot repository instructions

You are implementing TACTICAL COMMAND, a deterministic autonomous command-strategy game. Read `README.md`, `docs/GDD.md`, `docs/ARCHITECTURE.md`, `docs/SIMULATION_SPEC.md`, and the current task before editing.

## Non-negotiable rules
- Implement **only** the selected task and its prerequisites; do not invent new game systems.
- Keep simulation pure TypeScript and independent of React, Phaser, DOM, clocks and networking.
- Fixed tick 100 ms, injected seeded PRNG, stable iteration/order/tie-breaking. No `Math.random` or `Date.now` in simulation.
- Commands enter only through validated engine interfaces; renderer/UI never mutates world state.
- Separate world truth from each operator's knowledge and from player-visible intelligence.
- Enforce mandatory safety constraints before utility scoring; order urgency does not grant authorization to use force.
- Preserve order intent during temporary autonomous reactions; log why actions were chosen.
- Combat resolution is abstract; visual effects only present logged outcomes.
- Use strict TS, discriminated unions, runtime validation at boundaries and no `any`.
- Write focused unit/integration tests for every behavior and invariant; run typecheck, lint, test and build.
- Keep comments explanatory, not redundant. Update docs only if explicitly required or to record an approved change.
- Stop and report uncertainty when the task requires a game-design decision not specified in docs.

## Task completion report
Summarize files changed, behavior delivered, tests run/results, remaining risks, and exact next task. Do not claim tests passed unless executed.
