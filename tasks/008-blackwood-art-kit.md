# Task 008 — Blackwood visual kit

**Goal:** Establish the first Blackwood art direction and replace geometric
placeholders with a small, coherent static asset kit. Authorized by the user
on 2026-10-30. Follow [ART_DIRECTION](../docs/ART_DIRECTION.md).

## Status
- Delivered: scene reference, asset inventory, export/anchor conventions and
  phased production plan.
- Delivered: first four isolated high-resolution PNG sources (floor, wall,
  Bravo 1 and civilian), exact prompts and alpha inspection. See
  [asset source notes](../assets/blackwood/README.md).
- Delivered: second source batch adds Bravo 2, Bravo 3, open entrance and blocked
  passage. Eight sources total; halo cleanup, architectural orientation and
  small-size team differentiation remain explicit production checks.
- Pending: floor/architecture geometry and matte refinement, their runtime
  exports and broader visual QA. Architectural sources are not runtime sprites.
- Delivered: four normalized character PNG integration candidates, shared
  96 x 128 frames / (48,112) base anchor, manifest with provenance, export
  script and standalone light/dark size review. Reviewed at 48 x 64;
  individual operator differentiation remains subtle. Architecture revisions
  retain halos and remain drafts. Floor/architecture exports remain pending.
- Manual Blackwood gameplay validation remains pending independently.
- Delivered: character sprites replace operator placeholders and currently
  identified civilian markers in Phaser. Labels/selection, geometric fallback,
  ground depth ordering and stale/unknown abstract markers are preserved.
  No simulation or mission data changes. A presentation test checks the identity
  gate; the browser smoke test checks all four PNGs load successfully.

## Implementation scope
Start with one floor, wall, operator and civilian. Validate their scale before
expanding to the other P0 assets. Preserve map geometry, input, labels, camera,
player-visible knowledge, simulation boundaries and deterministic replay.
Use native vector/code overlays for simple status markers and order icons.

## Acceptance
- Reference and exact prompt are saved in the repository.
- Static assets have genuine alpha, consistent projection, declared dimensions
  and ground anchors; floor seams and cutaway occlusion pass visual inspection.
- Operators/civilian remain distinct at supported zoom levels. Unknown and stale
  contacts cannot reveal hidden identity.
- Pointer selection and tile targeting work with the new artwork.
- Presentation follows existing snapshots/events and freezes on pause.
- Run typecheck, lint, tests, build and relevant browser checks after integration;
  documentation/reference-only delivery does not require code test execution.

**Out of scope:** new combat systems, campaign, new map interactions, full
animation library, voice radio and audio enablement.
