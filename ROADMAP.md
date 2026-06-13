# Roadmap

Where the sprite toolkit goes next. Phases are ordered by dependency: each one
builds on the last, and items within a phase are roughly independent.

Current state (done): character compositor with anchors/tokens/silhouette
contracts, 6 mood overlays, 21 prop templates / 22 default prop instances with
hybrid plan/elevation projection and wall-slot placement metadata, 3
autotiling wall sets, 4 seamless floors, global style sheet, PNG + atlas export
at 1x/2x/4x, scene/layout JSON, full-project zip.

---

## Phase 1 — See the game in the tool

### 1.1 Scene preview tab — DONE
A fourth canvas that composes floors + walls + props + characters into one
mock office screenshot, RimWorld-style hybrid projection rules applied
(floor layer → plan props → y-sorted elevation props and characters).
- Hand-place entities on a grid (click to stamp, right-click to clear).
- Mood selector per placed character — verify "suspicion spreading through
  the office" reads at game zoom before the game can show it.
- Export the scene as a poster PNG for art-direction review.
- **Why first:** every art decision so far has been judged one sprite at a
  time; the real test is sprites against each other in a room.

### 1.2 Random office layout generator — DONE
Implemented with: 22×14 grid, shared-edge room templates (never double walls),
comb-pattern cubicle farm (autotile partitions + desk/chair pods, coworkers
spawn seated), seeded RNG (same template+seed = same office, recorded in the
layout JSON), scene persisted in project state.
Generate plausible office layouts and furnish them automatically.
- Room-split (BSP or grid partition) into the game's named locations:
  reception, manager office, break room, conference room, cubicle farm,
  hallway.
- Per-room furnishing rules (break room gets fridge + coffee + water cooler;
  cubicle farm gets desk/chair/partition repeats; conference gets the table).
- Populate with the cast plus N random coworkers.
- Output: rendered scene **and** a layout JSON (grid of floor ids, wall
  cells, prop placements with rotation, character spawns) the game could
  consume directly later.
- Depends on 1.1 for rendering.

### 1.3 Style presets — DONE
Implemented with: built-in "Warm office", "Corporate cold", and
"High-contrast readability" presets, project-persisted custom presets,
one-click apply/update/delete controls, and a compare view that renders the
current scene plus character strips side by side across styles.
Named, saveable style sheets ("Warm office", "Corporate cold", "High-contrast
readability") with one-click switching and a side-by-side compare view.
Cheap to build, and it's the payoff of the style-never-baked-into-parts rule.

### 1.4 Pixelate render mode — DONE
Implemented with: a project-persisted Style → Render pixelation slider, live
preview hints using crisp SVG edges, and PNG raster exports that render through
a smaller intermediate canvas before nearest-neighbor upscaling. Touches only
preview/export behavior; part definitions stay vector-smooth and unchanged.

---

## Phase 2 — Into Unity

### 2.1 Unity import helper — DONE
Implemented in The-Water-Cooler with a Phase 2 editor menu importer:
`Water Cooler/Phase 2/Import Sprite Toolkit Zip...`. The importer extracts a
Sprite Character Creator export zip into a timestamped generated folder,
slices character/mood sheets and wall tilesets from atlas JSON, applies pivot
and projection metadata, builds character/prop prefabs, creates floor/prop/
character metadata assets, and uses a 16-mask wall sprite lookup instead of
RuleTiles until the map path needs a Tilemap dependency.

Editor script in The-Water-Cooler that ingests the export zip:
- Slices sheets using the atlas JSONs (frames, pivots).
- Applies projection metadata: plan props → center pivot, floor sorting
  layer, rotation allowed; elevation → base pivot, y-sorted.
- Builds RuleTiles (or a mask→sprite lookup) from wall tileset atlases.
- Generates prefabs per character/prop.
- **Why before the port:** pre-baked sprites + this importer may be all the
  game needs for a long time. The port is only urgent if runtime NPC
  generation is needed.

### 2.2 Runtime rendering decision (chosen hybrid)
The C# port should not draw vector shapes in Unity. Runtime generation should
assemble imported sprites from data:
- **Baked sheets for maps, props, walls, and floors** — the tool exports final
  sprite sheets/atlases plus JSON metadata. Unity imports them once, then the
  map generator places sprites via layout JSON, tile masks, prop ids, pivots,
  sorting hints, and projection metadata.
- **Layer atlases for generated coworkers** — the tool exports body/head/hair/
  outfit/accessory/mood layers as separate neutral or token-mask textures.
  Unity generates NPC recipes, then stacks/tints those layers by facing, mood,
  anchor, z-order, and palette.

Rejected or limited alternatives:
- **Unity VectorGraphics package** — parse the part SVGs directly, rasterize
  to textures at runtime. Closest to a straight vector port, but more runtime
  complexity than this project needs.
- **Shapes library** (already in the project) — render parts as immediate-mode
  vector draws; useful for editor/debug overlays and procedural primitives, but
  not a drop-in compositor for these assets because the current parts are SVG
  path data and Shapes has no SVG importer. Choosing it as the primary runtime
  renderer would mean re-authoring/constraining art to Shapes primitives and
  issuing carefully ordered draw calls every frame.
Keep Shapes available for map gizmos, placement previews, selection rings,
route/debug lines, room bounds, or intentionally primitive procedural graphics.

Spike proof:
- Export a layer atlas for one character family: body/head/hair/outfit/mood
  overlays as separate neutral or token-mask textures.
- In Unity, compose two coworkers from the same atlas with different recipes,
  palette tints, moods, facings, and sort orders.
- Generate one small office from layout JSON using imported wall/floor/prop
  atlas entries; use Shapes only for debug overlays such as room bounds or
  navigation paths.
- Accept the raster-atlas path if the result is visually close, avoids visible
  seams, and generates a room plus 10 NPC variants without per-frame vector
  draw work.

### 2.3 C# compositor port
Port only the data model + sprite-layer assembly needed for generated
coworkers: recipes, palette token resolution, anchors, z-order, proportions,
facings, and mood overlays. This is an `NpcSpriteComposer`, not a vector
renderer. Maps do not use this path; they use layout generation plus imported
tile/prop sprite lookups. The outline pass should stay baked unless the layer
atlas spike proves a shader outline is necessary. Target API:
`NpcSpriteSet Compose(CharacterRecipe recipe, StyleSheet style)`.

### 2.4 Headless export CLI
`npm run export -- project.json out/` — regenerate every asset without the
browser (resvg-js or playwright for SVG→PNG). Lets the game's build pipeline
treat art as a compiled artifact of `project.json`, which is the whole point
of art-as-data.

---

## Phase 3 — Content depth & hardening

### 3.1 Remaining object taxonomy — DONE
Implemented with: wall-slot door/open-door/window/nameplate/HVAC templates,
door open/closed state parameter, badge-reader pairing in generated doorways,
desk clutter, couch, rug, vending machine, default prop instances, starter-scene
coverage, generated-office placement rules, and `placement` metadata in prop
atlases plus layout JSON.
- **Door** — special wall-slot tile (fits into a wall run, open/closed
  states); pairs with the badge reader.
- Window (wall-slot, like door), nameplate, HVAC vent, desk clutter
  (papers, phone), couch + rug (plan), vending machine (elevation).

### 3.2 Part library growth
More heads, hair, outfits (hoodie, suit jacket, dress), accessories (watch,
earbuds, clipboard). Carried-item overlays for characters (coffee run, stack
of papers) — same slot system, anchored at the hands.

### 3.3 Compositor snapshot tests
Golden-file tests (vitest): compose the cast + every part + all 16 wall masks
against committed SVG snapshots. The north-facing hair bug was exactly the
class of regression this catches — geometry helpers silently misbehaving for
inputs nobody eyeballed.

### 3.4 Atlas packing & texture hygiene
Single packed atlas option (everything in one texture with a JSON map),
1–2px bleed gutters for mipmapping/filtering, POT-sized outputs. Matters
once the game ships dozens of sheets.

### 3.5 Project schema versioning
The save format is patched ad-hoc (`??=` defaults). Before the game starts
consuming project.json, add a `version` bump + explicit migration steps so
old saves and the game's expectations can't drift apart.

---

## Explicitly out of scope (on purpose)

- **Frame animation** — the RimWorld slide-and-bob convention is a core scope
  decision, not a missing feature. Re-litigate only if playtests demand it.
- **In-tool game logic** (pathfinding, sim hooks) — the layout generator emits
  data; the game owns behavior.
- **Isometric projection** — would invalidate the part library; the top-down
  hybrid is settled.
