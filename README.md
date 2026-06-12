# Sprite Character Creator

A sprite compositor toolkit for **The Water Cooler** — generate RimWorld-style office
characters and props as PNG sprite sheets, with a globally tweakable art style.

This is not a drawing tool. Characters are **data** (a recipe of part ids + a palette),
composited from a shared vector part library at export time. That means:

- Infinite consistent variety — the randomizer builds new coworkers from the same parts.
- The art style is never baked in. Outline width/color, head/body proportions, and
  palettes are applied at composite time; change them and every existing character and
  prop re-renders. Hit export again and your whole asset set is restyled.
- Recipes are engine-agnostic JSON, so in-game character generation later only needs a
  port of the small compositor, not new art.

## Running

```sh
npm install
npm run dev      # open the printed localhost URL
npm run build    # typecheck + production build
```

Work is auto-saved to localStorage. Use **Export project JSON** / **Import project** in
the top bar to move a project between machines or check it into git.

## Tabs

- **Characters** — pick body/head/hair/outfit/accessories, tweak the 5-token palette,
  or hit *+ Random coworker*. Preview shows all four facings, with a mood picker for
  the six emotional states (normal, suspicious, curious, defensive, hostile, confused).
  Moods are face overlays applied at render time — they are never part of a recipe.
- **Props** — parametric office objects with sliders and a 3-token palette: water
  cooler, printer, desk, coffee machine, office plant, break room fridge, conference
  table, reception desk, badge reader (with granted/denied light), office chair,
  whiteboard, and filing cabinet.
- **Style** — the global style sheet: outline width/color/mode, head scale, body width,
  base sprite size, and the palette pools that feed the randomizer. Every control
  restyles all characters and props live.

## Export format

**Export all (zip)** produces:

```
characters/<name>/sheet@{1,2,4}x.png        # 4 frames: south, east, north, west
characters/<name>/atlas@{1,2,4}x.json       # frame rects + pivot
characters/<name>/moods@{1,2,4}x.png        # 6 mood rows x 4 facing columns
characters/<name>/moods-atlas@{1,2,4}x.json # frames keyed "<mood>_<facing>"
characters/<name>/recipe.json
props/<name>/sprite@{1,2,4}x.png
project.json                                # full regenerable project state
```

Mood sheets contain a row per mood in a fixed order (normal, suspicious, curious,
defensive, hostile, confused). North frames are identical across moods (no face from
behind) but are emitted anyway so frame indexing stays uniform in the engine.

Sheets follow the RimWorld convention: **no frame animation** — 3 authored facings,
with west baked as mirrored east for convenience (`meta.westIsMirroredEast`). Movement
in-game is slide/bob between waypoints plus facing swaps.

## Importing into Unity

1. Drop a `sheet@2x.png` into `Assets/`.
2. Texture Type: *Sprite (2D and UI)*, Sprite Mode: *Multiple*.
3. In the Sprite Editor, slice by *Grid By Cell Size* using `frameSize` from the atlas
   JSON (256 for a 2x sheet at the default 128px base).
4. Set the pivot to Bottom (the atlas `pivot` is `(0.5, 0.09)` normalized) so sprites
   sit on the ground line.
5. Pixels Per Unit: pick one value (e.g. 256 = 1 world unit per character) and use it
   for every sheet so characters and props stay in proportion.

## Extending

- **New part** (hairstyle, outfit, accessory): add a `PartDef` in
  `src/parts/library.ts`. Author shapes in part-local coords against the anchor
  conventions documented at the top of that file. Fills must use `$token` palette
  references — never hardcode style colors.
- **New prop**: add a `PropTemplate` in `src/props/templates.ts`.
- **New or adjusted mood**: edit `MOOD_OVERLAYS` in `src/parts/moods.ts` (and the
  `Mood` union in `src/core/types.ts` if adding one). Overlays are brow/mouth strokes
  at the headCenter anchor, z 45 (over the head, under hair).
- **New anchor / facing tweaks**: `ANCHORS` in `src/core/compositor.ts` — parts are
  positioned only via anchors, so moving an anchor moves everything attached to it.
