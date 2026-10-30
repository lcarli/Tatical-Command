# Blackwood asset sources — v1

Work branch: `codex/blackwood-assets`. Art-only work: no game source, simulation,
mechanics, dependencies or content data changed during this asset batch.

Eight individual PNG sources generated with the built-in image generation tool,
using `../art-direction/blackwood-reference-v1.png` as the style reference.
Exact prompts are saved next to each image.

| Source | Dimensions | Status |
| --- | --- | --- |
| sources/floor-office-01-v1.png | 1677 x 938 | Flat diamond material source |
| sources/wall-nw-v1.png | 1536 x 1024 | Wall source; end posts/soft halo require refinement |
| sources/bravo-1-idle-v1.png | 1219 x 1290 | Southeast idle operator source |
| sources/civilian-idle-v1.png | 1210 x 1300 | Southeast idle civilian source |
| sources/bravo-2-idle-v1.png | 1219 x 1290 | Lean operator/radio silhouette source |
| sources/bravo-3-idle-v1.png | 1219 x 1290 | Broad operator/larger pack silhouette source |
| sources/entrance-v2.png | 1536 x 1024 | Open entrance source; halo cleanup pending |
| sources/passage-blocked-v1.png | 1536 x 1024 | Blocked doorway source; halo cleanup pending |

These originals are high-resolution source candidates. The four characters now
also have normalized integration candidates in `../../public/assets/blackwood/`.
All eight were visually inspected. PNG alpha was checked separately from the
viewer background: files use 32-bit ARGB and transparent corner pixels.
Interior alpha is slightly below opaque in the generated sources; edge/matte
cleanup should be checked over both light and dark backgrounds before export.

## Second source batch
Bravo 2 and Bravo 3 use Bravo 1 as the proportion/style reference. Their radio,
build and backpack differences are visual only and do not change simulation
loadouts or attributes. Small-size identity discrimination remains unverified.
The new silhouettes are source exploration; expansion does not waive the shared
canvas and small-size validation gate before runtime integration.

The entrance and blocked passage use the scene reference. Entrance v2 is an
edit of a discarded nearly-closed v1 candidate; both prompts are retained for
provenance. The selected image has an open door, but still needs matte cleanup.
Architectural sources face the opposite diagonal to the originally requested
NW edge; treat them as orientation candidates until geometry is normalized.
Do not infer passability or collision changes from these pictures.

## Next production pass
- Normalize floor to the exact 136 x 76 source diamond and check repeated seams;
  generated geometry alone is not a guarantee of seamless runtime tiling.
- Refine wall to a repeatable short module without end posts or soft halo;
  declare its ground anchor after geometry is finalized.
- Export all four characters to the shared 96 x 128 canvas with feet at (48,112),
  and inspect together at 48 x 64 logical pixels before runtime integration.
- Preserve these originals; put derived runtime assets under
  `public/assets/blackwood/` in a subsequent integration change.
- Coordinate renderer integration with the colleague working on gameplay.

## Normalized character delivery
`export-characters.ps1` mechanically packs the four original character sources
into transparent 96 x 128 PNGs at `public/assets/blackwood/characters/`. It does
not repaint, recolor or alter the source files. Bounds use an alpha threshold
of 128 plus a two-pixel safety margin for export cropping only; pixel alpha is
preserved through bicubic resampling. Visible height is normalized to 96 source
pixels and the shared base line is at y=112. Source hashes, crop rectangles,
destination rectangles, facing and Phaser origin are recorded in the manifest.

`review-characters.ps1` verified four frame sizes, anchors and transparent
corners, then produced `review/characters.png`. This sheet was visually inspected
at 96 x 128 and 48 x 64 on light and dark backgrounds: civilian/team separation
is clear; individual Bravos remain subtle and require names/selection overlays.
`characters-review.html` offers the same comparison in a browser.

## Architectural refinement candidates
Three imagegen edits and exact prompts are saved alongside the originals:
`wall-module-v2.png`, `entrance-v3.png`, `passage-blocked-v2.png`.
The wall now lacks end posts. All three still show soft halo artifacts despite
explicit cleanup prompts. They remain source drafts, are not copied into public
runtime assets, and have not passed modular edge or alpha-cleanup acceptance.
Architectural orientation/geometry and floor seams remain pending.

Validation executed: character export script, standalone QA script and
`git diff --check`. No game tests were run because game code was not changed.

Earlier source batches were art-only. The subsequent character integration is
restricted to `src/game/`, with test updates; simulation and mission data remain
unchanged. Environment geometry still uses placeholders.
The art direction contract is in `../../docs/ART_DIRECTION.md`.
