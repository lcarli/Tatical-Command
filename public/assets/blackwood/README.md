# Blackwood character integration candidates

Four static transparent PNGs in `characters/`, 96 x 128 source pixels. Intended
display size: 48 x 64. Manifest: `characters.manifest.json`.

Phaser integration contract: load as individual
textures, set display size to 48 x 64 and origin to `(0.5, 0.875)`, then place
that origin at the projected ground coordinate. Do not trim transparent padding.
The anchor is a shared base convention, not an anatomical center-of-mass marker.

Only show civilian artwork when PlayerView permits its identity. Keep unknown
and stale contacts abstract. Keep operator labels and selection overlays:
individual team silhouettes are subtle at runtime size. These PNGs are static
idle assets, not directional animation sheets.

`src/game/CommandScene.ts` now loads these four textures for operators and
currently identified civilian intel. Missing textures fall back to geometric
markers. Selection rings and labels remain; uncertain/stale contacts keep
abstract markers. This changes presentation only, with no entity definition,
simulation or mechanics changes. Environment art remains geometric because
architectural sources are still drafts.

Rebuild on Windows with PowerShell/System.Drawing:
`./assets/blackwood/export-characters.ps1` from the repository root.
QA: `./assets/blackwood/review-characters.ps1`.
