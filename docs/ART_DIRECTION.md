# Blackwood art direction — v1

## Scope
First visual kit for the existing Blackwood prototype. The user approved producing
an art reference and asset specification on 2026-10-30, and responded positively
to the visual direction. This does not add gameplay systems or replace the pending
manual playtest.

Reference: [Blackwood scene v1](../assets/art-direction/blackwood-reference-v1.png).
Generated with the built-in image generation tool. This is a style reference,
not a playable map, an exact projection template, or a ready-to-slice atlas.
Furniture, doorways and rubble in the illustration do not define collisions.

## Visual language
Stylized matte low-poly forms, orthographic isometric camera, restrained detail,
soft upper-left lighting and clear silhouettes. Charcoal green environment, sage
operators and ochre civilian follow the existing interface palette. Avoid bloom,
photorealism and decorative detail that hides navigable cells. Front walls must
be cut away; rear walls must not hide actors or targeting feedback.

Keep team members distinct through small equipment/silhouette differences and
existing name labels. Color alone must not communicate identity or status.
Unknown contacts use abstract markers until player-visible knowledge permits
an identifiable civilian sprite. Stale intel needs a visibly uncertain marker.

## Runtime contract
- Existing projection: tile center `(480 + (x-y)*34, 78 + (x+y)*19)`.
- Floor footprint: 68 x 38 logical pixels; validate exact edge alignment in Phaser.
- Export PNG RGBA with real transparency, no baked background or text.
- Initial export target: 2x runtime size. Floor source footprint: 136 x 76 px.
- Character starting canvas: 96 x 128 source px, displayed at 48 x 64 logical px;
  feet anchor at source `(48,112)`. This is a production target to verify in-scene.
- Shared canvas and anchor across every frame; no automatic per-frame trimming.
- Floor center anchor `(0.5,0.5)`; wall/prop manifests record the floor contact point.
- Keep shadows within each asset's declared footprint; selection/status marks are
  separate overlays. Sort actors and tall props by ground position.
- Initial characters face southeast in idle. Additional directions and animation
  frames follow only after the static kit passes the in-game scale check.
- Presentation reads immutable PlayerView/events. Art never changes simulation,
  visibility, collisions, timings, outcomes, or replay hashes.

## Asset inventory
| Priority | Asset IDs | First delivery |
| --- | --- | --- |
| P0 | floor-office-01, floor-office-02 | Two seamless compatible floor tiles |
| P0 | wall-nw, wall-ne, wall-corner | Cutaway wall modules with consistent height |
| P0 | entrance, passage-blocked | Mark existing geometry without new interactions |
| P0 | bravo-1-idle, bravo-2-idle, bravo-3-idle | Three readable operator variants |
| P0 | civilian-idle | One unarmed civilian silhouette |
| P0 | selected, target, contact-unknown, contact-stale, incapacitated | Code-native overlays, readable without color |
| P1 | move, inspect, protect, interact, wait, regroup | Consistent SVG order icons with text labels retained |
| P1 | objective-inspect, objective-search | Objective overlays |
| P1 | action-progress, reaction, impact | Small effects driven by existing events |
| P2 | desk, chair, cabinet | Optional decoration; must not imply new cover/collisions |
| P2 | order-confirm, alert, pause, mission-complete | Later audio pass; audio currently disabled |

## Production sequence and review
1. Establish the scene reference (delivered).
2. Produce isolated floor, wall, one operator and civilian PNGs using this reference.
3. Integrate that small kit in Phaser and inspect at zoom 0.7, 1.0 and 1.8.
4. Check seamless tiles, anchors, draw order, cutaway walls and click targets;
   ensure unknown/stale intel cannot leak identity through artwork.
5. Expand to the remaining P0 kit, then P1. Delay animation/audio until static
   legibility is established. Pause and replay must remain synchronized.

The generated scene visually establishes material, palette and silhouette only.
Exact tile geometry and small-size legibility still require runtime validation.

## Reproducible reference prompt
See [reference-prompt.txt](../assets/art-direction/reference-prompt.txt) for the
exact generation prompt. Keep selected references in this repository; generated
runtime files will live separately under `public/assets/blackwood/` once produced.
