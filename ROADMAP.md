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

### 2.1 Unity import helper — DONE (verified 2026-06-13)
Implemented in The-Water-Cooler with a Phase 2 editor menu importer:
`Water Cooler/Phase 2/Import Sprite Toolkit Zip...`. The importer extracts a
Sprite Character Creator export zip into a timestamped generated folder,
slices character/mood sheets and wall tilesets from atlas JSON, applies pivot
and projection metadata, builds character/prop prefabs, creates floor/prop/
character metadata assets, and uses a 16-mask wall sprite lookup instead of
RuleTiles until the map path needs a Tilemap dependency.

Cross-checked against `exporter.ts`: folder/file names, frame keys, the
top-down→bottom-up Y-flip (`textureHeight - y - h`), computed textureHeight vs
real PNG canvas, bottom-up pivots, and no west double-mirror all verified
correct. **Fixed one real bug:** mood sheets at 4x are 2048×3072, past Unity's
default 2048 `maxTextureSize`, which silently downscaled the texture while atlas
rects stayed full-size → broken mood sprites by default. `ConfigureBaseTexture`
now sets `maxTextureSize = 8192`. Still worth an in-editor smoke test (single-
sprite prop/floor pivots; a real 4x import) since slicing can't be unit-tested
headlessly; the Y-flip math and frame-name parsers also have no automated test
yet (cheap future win: make them `internal` + EditMode tests).

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
- **Tool-side half — DONE (2026-06-13).** `characterLayerSheetPng` +
  `characterLayerManifest` (exporter.ts), backed by `characterLayers` in
  compositor.ts, export a character as outline-free, re-tintable part layers:
  one row per (part × colour-source) + mood rows, one column per facing. Token
  colours render as WHITE MASKS the engine multiplies by the recipe colour
  (preserves AA); literal detail renders untinted; mood layers swap by the
  active mood. Manifest carries z-order, tint token, mood, and Y-flip-ready
  frame rects (reuses the 2.1 slicing path). Exposed via "Layer atlas PNG" /
  "Layer manifest JSON" buttons on the character panel.
  **Validated:** a Unity-style consumer (slice frames → multiply masks by
  palette → stack by z → swap mood) reconstructs every cast member across all
  4 moods/facings at mean diff **0.02/255** vs `composeCharacter` (outline-free)
  — pixel-faithful. Two palettes + moods from one atlas yield distinct
  coworkers. **Outline is a baked silhouette layer** (layer key `outline`,
  z -1, untinted) — the engine draws it first, no shader needed; rebuild WITH
  it matches `composeCharacter` (outline on) at mean **0.008/255**. The layer
  atlas now also ships inside the export-all zip under
  `character-layers/<slug>/` (`layers@Nx.png` + `manifest@Nx.json` + recipe),
  so the existing zip-import flow can reach it.
- **Unity-side half — VALIDATED in-editor (2026-06-13).** Imported a real zip
  (layerAtlases imported, layoutJson present) and composed four
  differently-tinted coworkers from one atlas via the demo component — tint,
  mood, and facing all correct. Spike passes: the raster layer-atlas path works.
  (Fix applied during bring-up: split the import ScriptableObjects/MonoBehaviour
  into one-file-per-class so Unity resolves the MonoScripts — "no script asset"
  warnings otherwise.) Smoothness: character/mood/layer sheets now import with
  Bilinear filtering (centered figures, low bleed risk); walls/floors stay Point
  to avoid packed-atlas seams until gutters land (3.4). Remaining lever if still
  soft: layer atlases import at 2x (4x layer sheets hit the texture ceiling) —
  bump via a grid repack later.
  In The-Water-Cooler:
  - `Runtime/Phase2/SpriteToolkitLayerAtlas.cs` — `SpriteToolkitLayerAtlas` SO
    (layers with z/tint/mood + per-facing sprites, default palette) and
    `SpriteToolkitNpcComposer` (SelectLayers by mood + (z,order); Compose
    stacks SpriteRenderers, `color = palette[tint]` — stock sprite shader does
    the multiply, no shader; SortingGroup on the parent; outline layer drawn
    first).
  - `Editor/Phase2/SpriteToolkitZipImporter.cs` — `ImportCharacterLayers` reads
    `character-layers/*/manifest@Nx.json`, slices `layers@Nx.png` via the
    existing AtlasJson Y-flip path, builds the SO; prefers 2x (4x layer sheets
    hit the texture-size ceiling). Wired into the catalog.
  - `Tests/EditMode/SpriteToolkitNpcComposerTests.cs` — layer selection/order/
    mood-filter + tint resolution (pure logic, runs headless).
  - **Verify on the working machine:** (1) EditMode tests pass; (2) re-export
    the zip, run the importer, confirm a `SpriteToolkitLayerAtlas` asset per
    character with sliced layer sprites; (3) `Compose` two coworkers (different
    palette + mood + facing) — confirm correct tint, no seams, outline reads;
    (4) check `SortingGroup` resolves (else drop that line — composer works
    without it); (5) confirm single-sprite pivots and the 2x slice look right.
    Then generate one small office from layout JSON. New .cs files get .meta
    files auto-generated on first Unity import.

### 2.3 C# compositor port
Port only the data model + sprite-layer assembly needed for generated
coworkers: recipes, palette token resolution, anchors, z-order, proportions,
facings, and mood overlays. This is an `NpcSpriteComposer`, not a vector
renderer. Maps do not use this path; they assemble from the runtime layout
generator (2.4) plus imported tile/prop sprite lookups. The outline pass should
stay baked unless the layer atlas spike proves a shader outline is necessary.
Target API: `NpcSpriteSet Compose(CharacterRecipe recipe, StyleSheet style)`.

### 2.4 C# layout generator port (runtime offices)
**Decision (locked):** offices are generated procedurally **at runtime in
Unity**, not pre-authored. So `src/core/layout.ts` gets a real C# port — Unity
produces a fresh, seeded office each playthrough rather than loading exported
layout JSON. (The tool's layout JSON export stays as a debug/authoring and
golden-test artifact, not the shipping path.)

**Sequenced renderer-first.** Step 1 (the scene renderer) is built before the
generator port so the office can be seen in the prototype scene against
known-good data, and because the renderer is needed either way:

- **Step 1 — scene assembler, fed by exported layout JSON — CODE WRITTEN
  (2026-06-13), UNVERIFIED.** In The-Water-Cooler:
  `SpriteToolkitOfficeLayout` SO (parsed layout — grids/props/spawns; no runtime
  JSON dependency, the project has no runtime Newtonsoft), importer
  `ImportOfficeLayout` parses `office-layout.json` into it (catalog gained an
  `OfficeLayout` field), and `SpriteToolkitSceneAssembler` MonoBehaviour
  (ContextMenu "Assemble Office") instantiates floors, autotiled walls
  (door-aware mask recomputed in C#), plan/elevation props, and NPCs via the
  composer. Simplifications: full-tile floors (walls hide boundary bleed); banded
  + y-sort ordering (no wall→character occlusion); plan-prop rotation negated
  (verify sign). Output `SpriteToolkitOfficeLayout` is the shared shape the Step
  2 generator will produce, so both render identically.
- **Step 2 — port `layout.ts` to a C# `OfficeLayoutGenerator`** that produces a
  `SpriteToolkitOfficeLayout` at runtime (no JSON), rendered by the same
  assembler. Details below.

> **Full integration handoff:** `The-Water-Cooler/SPRITE_INTEGRATION.md` —
> binding the sprite pipeline to the live sim (generator port, game-view camera,
> location↔layout + agent↔NPC binding, interaction points, pathfinding, art-loop
> CLI). Key finding: the sim's `ShortTermSocialStateLabel` enum (Normal/Curious/
> Suspicious/Defensive/Hostile/Confused) is a 1:1 match with the mood overlays.
> The sim renders agents as immediate-mode `OnGUI` markers in normalized 0–1
> space (no GameObjects) — integration is the shift to world-space sprite
> GameObjects driven by sim state. Start a fresh integration session there.

Port to a deterministic `OfficeLayoutGenerator`:
- **Room templates** — the shared-edge `RoomSpec` rects per template (adjacent
  rooms must overlap one tile on boundaries — porting note: this is what keeps
  walls single, not double), plus the room archetype set (reception, manager,
  break, conference, cubicle farm, hallway, waiting-nook, focus/copy/records
  rooms, storage closet).
- **Seeded RNG** — `mulberry32` threaded through every random choice; the
  determinism contract is load-bearing: same `{templateId, seed}` ⇒ identical
  office, so the game can store/replay a building from two numbers. Match the
  JS RNG bit-for-bit OR accept that C# diverges and treat seeds as engine-local.
- **Wall drawing** — perimeter + shared room walls, office-wall shell
  re-asserted last (interior glass never on the exterior), single-tile doorways
  cleared with one door prop each (no widening), badge-reader pairing.
- **Cubicle comb** — partition spines never parallel-adjacent to a room wall
  (fuses into a lattice); pods skip door-gap columns; seats returned so
  coworkers spawn seated.
- **Furnishing rules** — per-room prop placement scaled to room size (break
  room/​reception always get a centre cluster so big rooms don't read empty),
  non-destructive spawn (never deletes furniture; chairs are the only sit-able
  prop).
- **Output** — an in-memory scene (floor-id grid, wall-id grid, prop/character
  placements with rotation/facing/mood) that the Unity map assembler turns into
  instantiated sprites via the imported tile/prop atlases + the 2.3 NPC composer
  for spawned coworkers.

The renderer that consumes this output must also replicate two tool-side
render-time rules (documented in scene.ts): **per-quadrant floor resolution**
(floors stay inside wall bounds; borrow the neighbour/diagonal room's floor at
walls and thresholds) and **walls extending an arm into door tiles** (close the
gap beside a door without latticing cubicle openings). Depends on 2.1 (import)
and 2.3 (NPC composer).

### 2.5 Headless export CLI — DONE (2026-06-13)
Implemented with: `npm run export -- <project.json|default> <outDir>`
(`scripts/export.ts`, run via tsx). Regenerates the full asset tree without a
browser — `characters/`, `character-layers/`, `props/`, `walls/`, `floors/`
(PNG + atlas JSON at 1x/2x/4x) plus `project.json` and, when the project has a
scene, `office-layout.json` — the exact same contents as the in-app "Export
all" zip. SVG→PNG is factored behind a `Rasterizer` interface in `exporter.ts`:
the browser keeps its `<canvas>` backend (in-app path byte-unchanged), the CLI
supplies a `resvg-js` backend (`src/core/rasterizer-node.ts`). The whole export
loop is now a single `exportAll(project, { sink, rasterizer })` that both paths
call — the browser wraps it with a JSZip sink, the CLI with a filesystem sink —
so the two outputs are structurally identical by construction; only PNG bytes
differ (the injected rasterizer) and JSON is bit-identical. `default` runs the
built-in project + a seeded office so the scene outputs are exercised.
Pixelate (style `pixelScale` > 1) is supported headlessly via a small
nearest-neighbor upscale (pngjs); the default project is `pixelScale` 1.
Implementation note: the resvg backend composites cells with a group transform
rather than nested `<svg>` (resvg panics computing the bbox of some nested
viewports, e.g. the quiet-carpet floor). **Verified:** `npm run build` clean,
79 compositor snapshots still green (compose output unchanged by the refactor),
the CLI exports 419 files on the default project, PNGs are valid with correct
dimensions, and two runs (incl. a round-trip of the exported `project.json`)
are byte-for-byte identical (fully deterministic).
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

### 3.2 Part library growth — DONE (outfits reworked 2026-06-13)
Implemented with: three additional head shapes (long, angular, soft square),
five hair variants (side part, pixie, ponytail, long straight, coils), outfits,
and five accessories/carried overlays (watch, earbuds, clipboard, coffee run,
stack of papers) exposed through the existing character selectors and random
coworker generator.

Review found the first-pass outfits (hoodie, suit jacket, dress) broke the
established outfit convention — they drew whole-garment shapes in
`$outfitSecondary` instead of minimal collar/detail overlays on the
`$outfitPrimary` body capsule, and the dress flared a sharp un-outlined skirt
*outside* the body silhouette. All three were re-authored to the convention
(detail accents inside the silhouette, body capsule = the garment), and two
more were added for variety (turtleneck, sweater vest). Heads, hair, and
accessories were spot-checked and are stylistically consistent — no rework.
Outfit slot now has 10 options.
More heads, hair, outfits (hoodie, suit jacket, dress), accessories (watch,
earbuds, clipboard). Carried-item overlays for characters (coffee run, stack
of papers) — same slot system, anchored at the hands.

### 3.3 Compositor snapshot tests — DONE (2026-06-13)
Implemented with: `tests/compositor.snapshot.test.ts` (vitest), a `test` /
`test:update` npm script, and 79 committed golden `.svg` files under
`tests/__snapshots__/` — cast (8: each member × all facings, plus a 6-mood
strip), every part (40: each swapped onto a neutral recipe across all facings),
all 16 autotile masks for each wall set (3), every floor (6), and every prop
(22). Renders pin DEFAULT_STYLE + an explicit pixel size so a snapshot depends
only on the compositor and content, never on ambient style; multi-cell renders
(facings/masks/moods) are laid out into one reviewable grid SVG per subject.
Pure functions, no RNG/clock, so runs are deterministic. Verified: `npm run
build` clean, `npm run test` green twice, and a deliberately corrupted snapshot
fails its test (regression-catching confirmed).
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

## Office Population Generator — DONE (2026-06-13)

New "Employees" tab turning the tool into a procedural office-population pipeline.
`src/core/employee.ts`: deterministic Visual DNA (`seedToInt` FNV-1a + `mulberry32`;
seed string ⇒ identical employee), department generation profiles (random/
accounting/IT/HR/management) as declarative per-part-id weights — bias not lock,
slot-dynamic so new parts/slots need no code (Feature 8), `EmployeeDefinition`
(visualSeed/profile/name/recipe/metadata{department,role,agentId,displayName} for
Water Cooler integration), bulk `generatePopulation` (unique-by-appearance with
collision retry + exhaustion flag) + variety metrics (unique / near-duplicate
counts). Exporter: `employeeSpritePng`, `employeePortraitPng` (head+torso crop),
`employeePackageZip` (`Employee_<seed>/{sprite.png,portrait.png,employee.json}` +
roster.json — drag-into-Unity). UI (`src/ui/employeePanel.ts`): seed controls
(generate/randomize/copy), profile dropdown, full-body/portrait toggle, employee
JSON export/import, population gen + metrics + Unity-package export. Additive —
existing tabs untouched. Verified: determinism, profile bias (IT 11/40 hoodies 0
suits; mgmt inverse), 50-unique population, package structure, portrait crop.
Note: employee JSON uses part ids + palette tokens (the real Unity contract), not
the spec's illustrative indices.

## Scenario templates — cast/scenario decoupling (additive, 2026-06-15)

The Scenario tab authored fully-**bound** scenarios (cast named by `agentId`),
right for the prototype's one fixed cast. The full game needs three independent
axes — Cast (who) / Office (where) / Scenario (what could happen) — so a scenario
becomes a **cast-agnostic, role-slotted template**: role slots + per-slot
preconditions (over traits/drives/relationship axes/OCEAN+game axes/needs) + a seed
+ an emotional payload, cast onto whoever best fits. Implemented tool-side:
`src/core/scenarioTemplate.ts` (`ScenarioTemplate`, `castTemplate`,
`validateScenarioTemplate`, `analyzeTemplateCoverage`, `serializeScenarioTemplate`),
the reference `THE_OFFICE_ROMANCE` template (`src/data/roleTemplates.ts`), a
"Cast role template" authoring-preview affordance in the Scenario panel, and
`tests/scenarioTemplate.test.ts`. **Additive:** the bound-`Scenario` path
(`promotion_rumor_001`, `validateScenario`, `serializeScenario`, the export) is
untouched — casting emits a bound scenario that loads identically. Design note:
`docs/scenario-template-model.md`; contract: `CONTRACT.md` §3.8/§5.7. The sim-side
runtime caster (consuming `scenario-template.json` directly) is a **separate, not-yet-built**
"Scenario Loading" epic — flagged, not implemented here.

## Office-Scale Authoring — the growing office (own project, DRAFT)

The full-game "office-scale" direction makes the authored starting state **bigger and
structured**: a multi-department organization with an org chart, a populated
cross-department social graph, and a layout with real wings — so The Water Cooler's office
**grows over a long playthrough** (the player is granted fog-of-war reach into a pre-existing
org). This is a substantial, content-heavy body of work, pulled out into its own doc set and
its own GitHub project, to be decomposed separately. Downstream of the sim proving its harvest
loop is fun; not urgent, but two items (a structured/mutable `department` field and the
scenario-template export) are parallel-safe and worth landing early.

Scope and work areas: **[`docs/office-scale/`](docs/office-scale/README.md)** —
multi-department layout, org-structure/org-chart artifact, structured departments & population
generation, and scenario-template export + department-aware preconditions. Sim-side source of
truth lives in the `game-design-docs` repo (`14_OFFICE_SCALE_DIRECTION.md` + epics 38–41).
Mostly `modern-office` content-pack work; contract changes are additive (`CONTRACT.md` §7).

## Phase 4 — Engine / content-pack architecture (multi-game reuse)

Full plan in `TOOL_ARCHITECTURE.md`. Turn this from one game's tool into a
genre-agnostic **sprite engine** + swappable **content packs**. Core problem
(measured): the engine (`core/*`) directly imports the office content
(`parts/props/tiles/data`), and the giant files (`layout.ts` 996, `library.ts`
944, `props/templates.ts` 709) are content tangled with logic. Keystone fix:
**invert the engine→content dependency** (engine takes a `ContentPack`/registry,
never imports content), then extract `modern-office` as the first pack (splitting
those files), lazy-load packs, make the rig (tokens/slots/anchors/facings/canvas/
moods) pack-declared, and prove it with a second, deliberately-different pack.
Orthogonal to the Unity integration; keep export contracts stable.

---

## Explicitly out of scope (on purpose)

- **Frame animation** — the RimWorld slide-and-bob convention is a core scope
  decision, not a missing feature. Re-litigate only if playtests demand it.
- **Game logic** (pathfinding, sim hooks, AI) — the layout generator (both the
  TS original and the 2.4 C# port) only produces geometry and placements; the
  game owns all behavior on top of that data.
- **Isometric projection** — would invalidate the part library; the top-down
  hybrid is settled.
