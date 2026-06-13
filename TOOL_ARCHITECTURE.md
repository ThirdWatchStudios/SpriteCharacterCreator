# Tool Architecture Evolution — toward a reusable, multi-game sprite engine

Plan for turning this from "The Water Cooler's art tool" into a genre-agnostic
**sprite engine** that multiple games drive via swappable **content packs**.
Written 2026-06-13 to capture direction; nothing here is built yet.

---

## 1. Goal

One engine, many games. A new game (fantasy tavern sim, sci-fi station, monster
collector) ships its own **content pack** and reuses the engine unchanged. Side
benefits the user asked for: real separation of concerns, lazy-load only the
active pack's content (not a 2000-line file for 200 lines of need), and far more
style/prop/genre flexibility.

---

## 2. Current-state diagnosis (measured)

- **Engine imports content directly** (the core problem):
  `core/compositor.ts`, `core/layout.ts`, `core/scene.ts`, `core/random.ts`,
  `core/exporter.ts` all `import { … } from '../parts|props|tiles|data'`. The
  engine is welded to this game's office content.
- **Giant files are content, not logic**: `layout.ts` 996, `parts/library.ts`
  944, `props/templates.ts` 709, `data/defaults.ts` 401 — mostly data tangled
  with algorithm.
- **The humanoid model is hardcoded** in the engine: the palette tokens
  (`skin/hair/outfitPrimary/outfitSecondary/accent`), the slots
  (`body/head/hair/outfit/accessory`), the anchor skeleton (body/neck/headCenter/
  …), the facings (S/E/N + mirrored W), the 128u canvas, and the 6 social moods
  are all baked into `compositor.ts` / `types.ts` / `parts/`. A robot, vehicle,
  or creature can't be expressed.
- **The UI is hardcoded to those slots/tabs** (`characterPanel` assumes
  body/head/hair/outfit/accessories).

None of this is wrong for one game — it's the cost of not yet needing reuse.

---

## 3. The core idea: Engine / Content-Pack split

### The Engine (game-agnostic, never imports content)
Compositor, layer-atlas export, exporter, the layout *algorithm*, scene
rendering rules (quadrant floors, door-aware walls, autotile masks), the SVG/PNG
plumbing, and all the **contracts** (interfaces). Takes content via a registry —
never reaches into a specific pack.

### A Content Pack (per game/genre) — implements `ContentPack`
Declares everything game-specific:
- **Rig**: the palette `tokens`, the part `slots`, the `anchors` per facing
  (the skeleton parts attach to), the proportion groups (which anchors scale
  together, e.g. the head group), the `facings` set + mirror rule, the `canvas`
  size. *This is the deepest flexibility lever* — the rig is what makes a pack
  humanoid vs. quadruped vs. vehicle.
- **Content**: parts (by slot), prop templates, wall/floor templates, the mood/
  state overlay set + emotes, palette pools, the cast (default recipes), default
  prop/tile instances, room archetypes + furnishing rules + the layout
  templates, and style presets.

A game = engine + one pack. The tool loads a pack and is otherwise pack-blind.

---

## 4. Refactor steps (ordered; refactor, don't rewrite — keep it working)

1. **Invert the engine→content dependency (the keystone).** Replace the direct
   imports with a registry the engine reads: `getPart(id)`, `partsForSlot(slot)`,
   `PROP_TEMPLATES`, `WALL/FLOOR_TEMPLATES`, `MOOD_OVERLAYS`, anchors, tokens —
   all served from an injected `ContentPack`/registry instead of static imports.
   `compositor.compose(recipe, style, pack)` etc. Low-risk, mechanical, and it
   alone unblocks everything else. Do this first.
2. **Define the `ContentPack` interface** (in the engine) covering the rig +
   content listed above. Make tokens/slots/anchors/facings/canvas/moods all
   pack-declared, not constants in `types.ts`/`compositor.ts`.
3. **Wrap current content as the `modern-office` pack** and split the giant
   files into it:
   - `parts/library.ts` → `packs/modern-office/parts/{heads,hair,outfits,accessories}.ts`
   - `props/templates.ts` → `packs/modern-office/props/{furniture,appliances,fixtures,doors}.ts`
   - `tiles/templates.ts` → `packs/modern-office/tiles/{walls,floors}.ts`
   - `data/defaults.ts` → `packs/modern-office/{cast,instances}.ts`
   - `layout.ts` splits **across the boundary**: the generation *algorithm*
     (grid, wall drawing, comb logic, RNG helpers, spawn) stays in the engine
     (`core/layout/`), while the room *templates* + furnishing *rules* move to
     `packs/modern-office/layout/`. Engine exposes hooks the pack fills.
4. **Lazy-load packs** via dynamic `import()` — only the active pack's content
   loads. This is the literal "load 200, not 2000," and it scales as packs
   multiply.
5. **Make the UI pack-driven**: build the slot selectors, tabs, and palette
   swatches from the pack's declared rig, not hardcoded slot names. A creature
   pack with `body/head/tail/wings` then "just works" in the UI.
6. **Version the project format** to reference `packId` + pack version + engine
   contract version, so a saved project knows which pack/engine it targets.

---

## 5. Flexibility this unlocks (per pack)

- **Palette tokens** are pack-defined — a robot pack uses `chassis/trim/lights/
  glow`, a creature uses `hide/markings/eyes`; parts reference tokens by name.
- **Slots + anchors (the rig)** are pack-defined — quadrupeds, vehicles
  (chassis/turret/treads), multi-part creatures, all expressible.
- **Facings** are pack-defined — 8-directional, or pure top-down (1 facing),
  not just the office's 3+mirror.
- **Canvas size** is pack-defined — bigger sprites, different proportions.
- **Mood/state overlays** are pack-defined — a combat game swaps the 6 social
  moods for alert/aggro/stunned/dead; a pet game for happy/hungry/sleepy.
- **Walls/floors/props + room archetypes + furnishing rules** are pack-defined —
  a tavern pack ships bar/kitchen/cellar rooms and tavern furniture; the same
  generator algorithm furnishes them.
- **Style presets** per pack carry genre tone (gritty noir vs. bright cartoon),
  on top of the existing global style sheet.

---

## 6. Other recommendations

- **Registry / plugin pattern**: content registers into the engine (vs. the
  engine importing it). Opens the door to user-authored or DLC packs without
  touching core.
- **Pack schema validation**: validate a pack on load (every part's slot is
  declared, every token referenced exists, anchors cover all facings) with
  clear errors — critical once non-experts author packs.
- **Headless engine API**: expose the engine as a pure library
  (`compose`, `exportZip`, `generateLayout` taking a pack) usable outside the
  UI — feeds the planned headless CLI (Roadmap 2.5), build pipelines, and other
  tools/games directly. The compositor is already close; the dependency
  inversion (step 1) finishes it.
- **Package/monorepo split (eventually)**: `@studio/sprite-engine` +
  `@studio/pack-modern-office`, `@studio/pack-*` as separate packages so each
  game depends on the engine + its pack(s). Don't do this until pack #2 proves
  the seams.
- **Per-pack golden snapshot tests** (extends Roadmap 3.3): each pack gets a
  snapshot suite so engine changes can't silently regress any pack's art.
- **"Authoring a content pack" guide**: the doc that lets another game's artist
  build a pack against the contracts.
- **Engine contract versioning**: packs declare the engine version they target;
  the engine can warn on mismatch.

---

## 7. Sequencing & the real test

1. **Dependency inversion (step 1)** — keystone, low-risk, unblocks all.
2. **Extract `modern-office` pack + split files (steps 2–4)** — same art, new
   structure, lazy-loaded. The tool behaves identically; the code is clean.
3. **Build a SECOND, deliberately-different pack** (e.g. a tiny `fantasy-tavern`
   or `sci-fi` proof). *This is the real test of the abstraction* — pack #2
   reveals which seams are right and which leaked. Resist over-abstracting
   before it; let pack #2 pull the generality out.
4. UI pack-driven + project versioning (steps 5–6) as packs multiply.

**Guiding principle:** refactor in place, keep `modern-office` rendering
identically at every step (the golden snapshots guard this), and let the second
pack — not speculation — drive how general the rig/contracts need to be.

---

## 8. Relationship to the rest of the roadmap

- This is orthogonal to the Unity integration (`The-Water-Cooler/
  SPRITE_INTEGRATION.md`) — that consumes the engine's *output*; this restructures
  the tool's *internals*. The export contracts (zip layout, layer atlas,
  layout JSON) should stay stable so Unity is unaffected by the refactor.
- The dependency inversion also de-risks the headless CLI (Roadmap 2.5) and the
  eventual C# ports, since "engine as a library taking a pack" is the clean
  surface they all want.
