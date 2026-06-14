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
npm test         # compositor golden-snapshot tests
```

Work is auto-saved to localStorage. Use **Export project JSON** / **Import project** in
the top bar to move a project between machines or check it into git.

### Headless export

Regenerate the full asset tree from a project file without a browser — the same
contents as the in-app "Export all" zip (characters / character-layers / props /
walls / floors PNGs + atlas JSON at 1x/2x/4x, plus `project.json` and, when the
project has a scene, `office-layout.json`):

```sh
npm run export -- path/to/project.json out/
npm run export -- default out/   # built-in project + a seeded office layout
```

SVG→PNG is rendered with [resvg-js](https://github.com/yisibl/resvg-js); the
in-app export uses the browser canvas. Both share one code path
(`exportAll()` in `src/core/exporter.ts`) behind a `Rasterizer` interface, so the
trees match — output is deterministic (identical bytes across runs).

## Web portal

The GitHub Pages build publishes the current app from `main`:

https://thirdwatchstudios.github.io/SpriteCharacterCreator/

## Tabs

- **Characters** — pick body/head/hair/outfit/accessories, tweak the 5-token palette,
  or hit *+ Random coworker*. Preview shows all four facings, with a mood picker for
  the six emotional states (normal, suspicious, curious, defensive, hostile, confused).
  Moods are face overlays applied at render time — they are never part of a recipe.
- **Persona** — authors a full-game *character profile* alongside the selected
  sprite, keyed by the same id (`agentId`). OCEAN personality spine + office game
  axes, needs, drives, preferences (loves/hates), skills, multi-axis
  relationships, starting beliefs, reaction tendencies, routine, temperament,
  and formative events (whose effects can be folded into the starting state in
  one click). Derived fields (temper, grudge-holding, reaction tendencies,
  volatility) are computed from the personality spine and can be hand-overridden.
  Profiles are sparse — a sprite need not have one. See
  [`src/core/profile.ts`](src/core/profile.ts) and the design contract in the
  adjacent game-design-docs (`the-water-cooler/docs/design/character_model.md`).
- **Props** — parametric office objects with sliders and a 3-token palette: water
  cooler, printer, desk, coffee machine, office plant, break room fridge,
  conference table, reception desk, badge reader, door/open door, office window,
  nameplate, HVAC vent, desk clutter, couch, rug, vending machine, office chair,
  cubicle workstation, whiteboard, and filing cabinet.

  Props follow the RimWorld hybrid-projection convention, tagged per template:
  - **Plan** (top-down): desks, tables, chairs, reception desk, cubicle
    workstation, desk clutter, couches, rugs, and wall-slot inserts. Pivot at
    center, render on the furniture layer below characters, rotate freely
    in-engine (one sprite = all four orientations).
  - **Elevation** (front view): everything else. Pivot at the base (y = 0.09, same
    ground line as characters), y-sort with characters, never rotate.
  - **Wall slot** placement: door, window, nameplate, HVAC vent, and badge reader
    mount into or over wall runs. The wall-slot flag is separate from projection,
    so importers can keep these aligned to wall cells instead of free floor
    placement.
  The rule for new templates: if characters stand behind/around/on it → plan;
  tall with a small footprint and only approached from the front → elevation.
  The projection and placement ship in each prop's atlas JSON (`projection`,
  `placement`, `pivot`, `meta.sorting`, `meta.rotatable`, `meta.wallSlot`).

- **Walls & Floors** — autotiling walls and seamless floor tiles.
  - Walls (office wall, glass partition, cubicle partition) are 16-piece
    autotile sets indexed by a 4-bit neighbor mask (N=1, E=2, S=4, W=8): place
    a wall in the grid, look up its neighbors, pick frame `mask_<n>` from the
    tileset. Sheets are 4×4, mask = row*4+col; connected arms overdraw the tile
    edge so outlines stay continuous across tiles. The preview shows a sample
    room assembled from the set.
  - Floors (carpet, carpet tiles, wood, linoleum) are single seamless tiles —
    patterns wrap at the edges (speckles and plank seams repeat across the
    boundary). Floors render flat with no outline pass and sit on the
    bottom layer. The preview tiles 3×2 to prove seamlessness.
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
characters/<name>/profile.json            # full-game persona (only when authored); derived fields resolved to numbers
character-layers/<name>/layers@{1,2,4}x.png # re-tintable part layers (rows) x facings (cols)
character-layers/<name>/manifest@{1,2,4}x.json # layer z/tint/mood + frame rects; baked outline layer
props/<name>/sprite@{1,2,4}x.png
props/<name>/atlas@{1,2,4}x.json            # projection + placement + pivot
walls/<name>/tileset@{1,2,4}x.png           # 4x4 sheet, frames keyed mask_0..mask_15
walls/<name>/atlas@{1,2,4}x.json            # mask bits, frame rects, human names
floors/<name>/tile@{1,2,4}x.png             # seamless, tileable: true in atlas
office-layout.json                          # current scene grid, props, spawns, named anchors (rooms + per-agent desks)
scenarios/<id>.json                         # authored run definitions (cast refs + locations + truth/info + variants + objective), one per scenario
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
- **New wall or floor**: add a `WallTemplate` / `FloorTemplate` in
  `src/tiles/templates.ts`. Walls build per neighbor-mask; floors must wrap
  at the tile edges (draw ±128 copies of anything near an edge).
- **New or adjusted mood**: edit `MOOD_OVERLAYS` in `src/parts/moods.ts` (and the
  `Mood` union in `src/core/types.ts` if adding one). Overlays are brow/mouth strokes
  at the headCenter anchor, z 45 (over the head, under hair).
- **New anchor / facing tweaks**: `ANCHORS` in `src/core/compositor.ts` — parts are
  positioned only via anchors, so moving an anchor moves everything attached to it.
