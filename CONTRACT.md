# Export Contract — Terrarium → The Water Cooler

What this tool **provides** to the Unity sim, and what the sim is expected to **compute** from it.

This is the tool-side companion to the canonical design specs
(`game-design-docs/the-water-cooler/docs/design/character_model.md` and
`scenario_model.md`, which the export `meta.schema` fields point at). When the two
disagree, the design spec wins for *intent*; this doc wins for *the actual bytes
we currently emit*.

Status: **living sketch.** The payload shapes here are real (taken from the
exporters). The "Sim-side formulas" section is a design sketch — it exists to
pin down what data we must capture here so the sim has what it needs.

---

## 1. Ownership boundary

| Concern | Owner | Notes |
|---|---|---|
| Visual recipe, sprite atlas, layout art | **Tool** | Authored + rendered + exported. |
| Status & interaction visuals (moods, activity badges, conversation style) | **Tool** | Tool owns the *vocabulary + art*; the sim *selects + places* at runtime — moods by behavioral state, activity badges by routine `activity`, the conversation connector by its own agent pairing (§3.9). None are baked into recipes. |
| Personality spine (OCEAN, game axes) | **Tool** | Authored. |
| Derived personality fields (temper, grudge-holding, reaction tendencies, volatility) | **Tool** | Computed here — see §4. The sim consumes the numbers; it does not re-derive them. |
| Needs, preferences, skills, baseline relationships, routine, formative events | **Tool** | Authored / exported. Mostly inert metadata here (not computed on). |
| Drive catalog (structured, reusable; `amplifiesNeeds`) | **Tool** | Project-level catalog (§3.5); personas reference by id. The need coupling is tool-authored data the sim acts on. |
| Trait catalog (structured, reusable; `biasesReactions`) | **Tool** | Project-level catalog (§3.6); persona `traitTags` are ids into it. Reaction nudges are tool-authored data the sim applies on top of the spine-derived tendencies. |
| Relationship-type catalog (structured, reusable; `biasesReactions` + `thirdParty`) | **Tool** | Project-level catalog (§3.7); relationship edges' `relationshipType` are ids into it. Carries reaction bias toward the target *and* the third-party (jealousy/protectiveness) coupling — tool-authored data the sim applies at interaction time. |
| Behavior **catalog** (structured, reusable; observable actions + constraints/couplings) | **Tool** | Project-level catalog (§3.14). Authors *what behaviors exist* (Steal Lunch, Spread Rumor, …) plus their context/affordance requirements, pressure pulls, trait modifiers (trait ids, §3.6), relationship requirements (bond ids, §3.7), and expected outcomes. The catalog is tool-authored data; *which behavior happens now* is sim-owned (the row below). |
| Scenario situation (truth, information, experiment, objective, seeds) | **Tool** | Authored + exported. |
| Scenario **templates** (role slots + preconditions + emotional payload) | **Tool** | Cast-agnostic authoring (§3.8). The tool casts a template → a bound scenario at authoring time and exports the bound `scenario.json`; runtime casting is a future sim concern (§5.7). |
| **Behavior** — how any of the above turns into decisions, need depletion, relationship drift, belief spread, KPI scoring | **Sim** | Not implemented in this repo. See §5. |
| The meaning of a free-text id (a `drive`, a `trait_tag`, a `locationId`, a routine `activity`) | **Sim** | The tool deliberately does not enforce these vocabularies — it ships strings; the sim decides what they do (and should log/fallback on ids it doesn't implement). |

**The id contract (one id space):** `agentId` == recipe `id` == persona key == scenario cast `agentId` == sim `AgentId`. Everything links by this id. `spriteBinding.characterConfigId == agentId` by convention.

Coordinate convention: scene grids are row-major `[y][x]`; anchors/spawns carry explicit `{x, y}` cells.

---

## 2. Export bundle

| File | Built by | Per | Contents |
|---|---|---|---|
| `<name>-recipe.json` | recipe (verbatim) | character | Visual recipe (§3.1). |
| `<name>-atlas@Nx.json` + sheet/layer PNGs | `characterAtlas` / `characterLayerManifest` | character | Sprite frames + anchors for the renderer. |
| `moods@Nx.png` + `moods-atlas@Nx.json` | `moodAtlas` | character | 6 moods × 4 facings; per-character **face overlays** only (the overhead emote is no longer baked here — see mood-emotes). Sim selects by behavioral state (§3.9). |
| `<agentId>-profile.json` | `serializeProfile` | character | Persona (§3.2). `meta.schema = character_model.md`. |
| `scenario.json` | `serializeScenario` | scenario | Scenario verbatim + `meta.schema = scenario_model.md` (§3.3). |
| `employees.json` | `buildScenarioPackage` | scenario | Flattened roster (id, dept, role, tags, spawn). |
| `relationships.json` | `buildScenarioPackage` | scenario | Resolved source→target edges (persona baseline + scenario overrides). |
| `beliefs.json` | `buildScenarioPackage` | scenario | Per-agent starting beliefs (from cast `beliefSeeds`). |
| `knowledge.json` | `buildScenarioPackage` | scenario | Truth facts, information items, per-agent `knows`. |
| `drives.json` | `project.drives` (verbatim) | project | Reusable drive catalog personas reference by id (§3.5). Also embedded in each scenario package. |
| `traits.json` | `project.traits` (verbatim) | project | Reusable trait catalog persona `traitTags` reference by id (§3.6). Also embedded in each scenario package. |
| `relationshipTypes.json` | `project.relationshipTypes` (verbatim) | project | Reusable relationship-type catalog edges' `relationshipType` reference by id (§3.7). Also embedded in each scenario package. |
| `departments.json` | `project.departments` (verbatim) | project | Reusable department catalog — the single org model referenced by stable id (§3.10). Also embedded in each scenario package. |
| `behaviors.json` | `project.behaviors` (verbatim) | project | Reusable workplace-behavior catalog — observable actions the sim selects for agents under pressure (§3.14). Also embedded in each scenario package. |
| `org-structure.json` | `buildOrgStructure` | project | Org chart: departments + members with a visible-structure / fogged-contents split (§3.11). Also embedded in each scenario package. |
| `company.json` | `serializeCompany(project.company)` | project | The **company root** — the new-game seed the rest of the bundle cascaded from (§3.12). The default project ships `MERIDIAN_DYNAMICS`, so a plain export is a company package; emitted whenever `project.company` is set, absent only for a company-stripped (sprite-only) project. |
| `scenario-template.json` | `serializeScenarioTemplateLibrary` | project | The cast-agnostic **scenario-template library** the sim's runtime caster binds onto the live cast/office (§3.8/§5.7). Emitted when a library is supplied to `exportAll`; absent for a sprite-only export. |
| `mood-emotes@Nx.png` + `mood-emotes-atlas@Nx.json` | `moodEmotesAtlas` | project | One **shared** strip of overhead mood bubbles (character-independent) — the emote half of a mood, split out of the sheet. Sim blits one above an agent keyed off mood (§3.9). |
| `activity-badges@Nx.png` + `activity-badges-atlas@Nx.json` | `activityBadgesAtlas` | project | One **shared** strip of overhead status badges (character-independent). Sim blits one above an agent keyed off the routine `activity` string (§3.9). |
| `conversation-style.json` | `conversationStyleJson` | project | Style for the linked-bubble conversation visual; sim draws it between two paired talking agents (§3.9). |
| `overlay-style.json` | `overlayStyleJson` | project | **Floor-overlay look spec** (Epic 36) — the per-channel form/weight/dash/motion **plus the static-richness grammar** (`glow` bloom, directional `flow`, per-agent `endpoints`, emotion-keyed `jitter`) and a cross-channel `focus` model the **Shapes** floor layer reads to draw relationship arcs, pressure halos, info packets, and belief tints from sim state. Discipline preserved: state lines pop via static richness (glow/gradient/endpoints), animation stays reserved for events (`rules.motionEncodesEvents`). Tool owns the look; Shapes owns the drawing. Colors reference theme `--wc-*` (§3.13). |
| `theme.uss` + `theme.json` | `themeUss` / `themeJson` | project | The **shared UI palette** as UI Toolkit `:root` custom properties (`--wc-*`) and a framework-neutral map. The single color source the framing UI AND the Shapes floor layer resolve so chrome and world agree without sharing a pipeline (§3.13). `--wc-line` carries the project's actual `style.outline.color`. |
| `icons/<id>.svg` + `icons/<id>@Nx.png` + `icons/icons-manifest.json` | `composeIcon` / `iconsManifest` | project | **UI icon set** — framing-UI glyphs. Each icon ships a resolution-independent SVG (UI Toolkit `VectorImage`) **and** a PNG ladder (uGUI `Sprite`). `tintable` icons are white masks the framework recolors from `theme.uss`; `literal` icons ship final colors (§3.13). |
| `office-layout.json` | `sceneToLayoutJson` | scene | Rooms, floors, walls, props, spawns, anchors, interaction anchors (§3.4). |
| `interaction-anchors.json` | `computeInteractionAnchors` | scene | Interaction points derived from placed props. |

`buildScenarioPackage` is the assembled bundle — it runs `resolveScenarioRun` (persona baseline + scenario seeds/overrides) and emits the scenario-scoped files above.

---

## 3. Payload shapes

All numeric ranges are `0–100` unless noted. `affinity` is bipolar `-100..100`; preference `valence` is `-100..100`.

### 3.1 `recipe.json` (visual)
```jsonc
{
  "id": "janice",
  "name": "Janice",
  "parts": { "body": "...", "head": "...", "hair": "...", "outfit": "...", "accessories": ["..."] },
  "palette": { "skin": "#..", "hair": "#..", "outfitPrimary": "#..", "outfitSecondary": "#..", "accent": "#.." }
}
```

### 3.2 `profile.json` (persona) — `serializeProfile`
```jsonc
{
  "agentId": "janice",
  "identity": {
    "displayName": "", "pronouns": "", "roleTitle": "",
    "department": "operations",   // department catalog id (§3.10), '' = unassigned; MUTABLE — sim reassigns for transfers (E41)
    "seniority": "intern|junior|senior|lead|manager", "ageBand": "", "bio": "", "prototypeRole": ""
  },
  "personality": {
    "ocean": { "openness": 0, "conscientiousness": 0, "extraversion": 0, "agreeableness": 0, "neuroticism": 0 },
    "axes": {
      "ambition": 0, "integrity": 0, "loyalty": 0, "discretion": 0,
      "temper": 0,          // DERIVED — folded in at export (§4)
      "grudgeHolding": 0    // DERIVED — folded in at export (§4)
    },
    "traitTags": ["ambitious", "..."]          // ids into the trait catalog (§3.6)
  },
  "needs": {                                    // 6 fixed need ids
    "recognition": { "baseline": 0, "sensitivity": 0 },
    "belonging": {…}, "security": {…}, "autonomy": {…}, "competence": {…}, "rest": {…}
  },
  "drives": {
    "primary": "prove_readiness",               // free-text id
    "secondary": "",                            // free-text id
    "objectives": [
      { "id": "...", "sourceDrive": "prove_readiness", "targetOrConcern": "",
        "expectedBehaviorTendency": "share|withhold|confirm|avoid|support|confront|reroute",
        "status": "active|paused|achieved|abandoned" }
    ]
  },
  "preferences": [ { "subjectId": "coffee", "valence": -100, "note": "?" } ],   // subjectId from SUBJECT_CATALOG
  "skills": [ { "skillId": "coding", "level": 0 } ],                            // skillId from SKILL_TRACKS
  "relationships": [                            // baseline, persona-owned
    { "targetAgentId": "carl", "trust": 50, "suspicion": 0, "affinity": 0,
      "influence": 0, "respect": 50, "familiarity": 50,
      "relationshipType": "romance",            // id into relationshipTypes catalog (§3.7), or null
      "secret": false,                          // hidden bond (secret romance / covert alliance)
      "tags": [] }
  ],
  "formativeEvents": [                          // authored memory; effects already folded into the spine
    { "id": "...", "title": "", "description": "", "when": "years_ago",
      "involvedAgentIds": [], "visibility": "public|private|secret", "knownToAgentIds": [],
      "effects": [ { "targetKind": "personality_axis|need_baseline|relationship_axis|preference|belief|trait_tag|drive",
                     "targetRef": "", "op": "set|add|nudge", "value": 0 } ] }
  ],
  "reactionTendencies": { "confront": 0, "gossip": 0, "withdraw": 0, "verify": 0,
                          "reassure": 0, "escalate": 0, "ignore": 0 },          // DERIVED (§4)
  "routine": [ { "startTime": "09:00", "endTime": "12:00", "locationId": "",
                 "activity": "work", "onBlockedLocation": "reroute_to_fallback|wait_in_hallway|return_to_desk|skip_block" } ],
  "temperament": { "baselineSocialState": "normal|suspicious|curious|defensive|hostile|confused",
                   "volatility": 0 },           // volatility DERIVED (§4)
  "spriteBinding": { "layerAtlasId": "", "characterConfigId": "<agentId>",
                     "fallbackSpriteId": null, "paletteSource": "default-from-recipe|override" },
  "meta": { "generator": "sprite-character-creator", "schema": "character_model.md", "schemaVersion": 9 }
}
```

> Note: beliefs/knowledge are **not** in the persona — they're scenario state (cast `beliefSeeds` / `knowledgeSeeds`). The persona owns the durable character; the scenario owns the situation.

### 3.3 `scenario.json` — `serializeScenario` (the `Scenario` verbatim + `meta`)
`meta`: `{ generator, schema: "scenario_model.md", schemaVersion: 9 }`. Top level: `scenarioId, title, summary, officeSeed?, cast[], locations[], truthFacts[], informationItems[], interventionTypes[], variants[], defaultVariantId, objective`.
- `cast[]`: `{ agentId, spawnLocationId, prototypeRole, relationshipOverrides[], beliefSeeds[], knowledgeSeeds[] }`
- `locations[]`: `{ locationId, displayName, tags[], accessState, fallbackLocationId, bindTo:{ anchorId, roomId } }`
- `truthFacts[]`: `{ truthId, topic, statement, subjectAgentIds[], objectiveValue:bool, sourceAgentId }`
- `informationItems[]`: `{ informationId, topic, claim, originType, truthId, truthAlignment, sourceAgentId, initialHolderAgentIds[] }`
- `variants[]`: `{ variantId, selections: { <interventionType>: <value> } }`
- `objective`: `{ objectiveId, label, category, desiredPressure, intendedObservableBehavior, kpi, expectedEvidence[] }`

### 3.4 `office-layout.json` — `sceneToLayoutJson`
`{ version, source, generated, cols, rows, tenantRect, rooms[], roomGrid[][], floors[][], walls{grid[][],cells[]}, props[], characterSpawns[], anchors[], interactionAnchors[], wings[], connectivity[] }` (**version 4** — v2 added `rooms[].departmentId` + the `wings[]` block (F1.1); v3 added the `connectivity[]` wing-adjacency graph (F1.3); v4 added the optional building-surround `tenantRect`).
- `tenantRect`: `{ x, y, cols, rows } | null` — the **playable** office sub-region when a non-playable **building surround** (the "floor in a tower" border) has been added. `cols`/`rows` then describe the **grown** tenant+ring grid; the ring cells (outside `tenantRect`) carry floors/walls/props but **no `roomGrid`/`wings`/`anchors`**, and never produce `interactionAnchors`. `null` ⇒ no surround, the whole grid is playable, exactly as before (additive — old loaders ignore the field). **The sim must clamp pathfinding and spawns to `tenantRect`** (walkability is floor-based, and ring cells carry a lobby floor — so they're walkable unless clamped), and **frame the camera on `tenantRect`, not the grown grid**. See docs/building-surround-model.md.
- `anchors[]`: `{ anchorId, roomId, x, y, kind: "room"|"desk"|"spare-desk", wingId?, departmentId? }` — what scenario `locations[].bindTo` resolves to. Desks seat each base-cast agent **in its own department's wing** (F1.2; the manager binds to their office, so has no desk anchor); `spare-desk:<wingId>:<n>` anchors expose unassigned seats per wing for the sim's later transfers (E41). `wingId`/`departmentId` tag which wing the anchor sits in (`departmentId: null` for the common/main wing).
- `interactionAnchors[]`: `{ id, interactionType, roomId, x, y }` — derived from interaction props (water cooler, printer, …).
- `wings[]`: `{ id, departmentId, label, roomIds[], bounds:{x,y,cols,rows} }` — rooms grouped into department wings (the physical projection of the org chart; sim reveals wing-by-wing + measures wing distance). Each `rooms[]` entry may carry an optional `departmentId` (the F2.1 catalog id) that `computeWings` groups by; untagged rooms fall into `wing-common`. See **§3.4.1** for the composed procedural office the default now ships.
- `connectivity[]`: `{ wings: [wingIdA, wingIdB], doorways }` — the wing-adjacency graph derived from the door topology (F1.3). Each edge is an undirected wing-id pair (sorted) a doorway physically joins; `doorways` = how many (a connection-strength hint). BFS from the entry wing yields **fog-of-war reveal order** + **wing-to-wing (hop) distance**. A single-office layout has one wing and an empty `connectivity[]`; a composed office is connected — every department wing reaches `wing-common` via its corridor doorway, and **wing-to-wing cross-doors may add further edges** (so the edge count is `≥ department-wing count`, not exactly it).
- **Department-tagged spawn (F3.4):** with a generated population, the office auto-derives a wing per department in the cast and seats each agent at a chair **in its department's wing**. In **dense mode** (the golden default) over-capacity agents *stand* on open floor **in their own wing** rather than being dropped (varied desk styles leave some wings short of chairs); the spare-reserving default still leaves transfer headroom and reports overflow.

#### 3.4.1 Composed procedural office (sim-integration notes)

The default golden export and `export company:<archetype>:<seed>` both ship a **procedural meandering-spine** office, *not* the old 22×14 single-office template. Sim importers/binders must handle its shape:

- **Room ids are suffixed / multiplied — bind by `kind`, not `id`.** Bullpens are `cubicle-farm@<dept>` (one per populated department), and there are up to three corridor rooms: `hallway`, `hallway-east`, `hallway-cross`. Every room still carries its archetype in **`kind`** (`cubicle-farm`, `hallway`, `manager-office`, `break-room`, `conference-room`, `reception`, `focus-room`, `copy-room`). **The sim's location map must resolve by `kind`** (and per-agent `desk:<agentId>` / `interactionType` anchors), since the bare ids `cubicle-farm`/`hallway` no longer uniquely exist. Anchors remain the precise bind: `desk:<agentId>` for workstations, `interactionType` for amenities.
- **Layout = reception entrance + a bending spine.** Reception is the full-height left entrance. With ≥4 rooms the spine **bends**: a left block and a right block sit at *different* corridor heights, joined by a full-height **cross corridor** (`hallway-cross`) — an S/Z hallway, not a straight band. Rooms bud off **both** sides at **varied widths/depths** with **staggered doorways**; small `focus-room`/`copy-room` rooms are sprinkled in. The sim-bound common rooms (`manager-office`, `break-room`, `conference-room`, `hallway`) are always present (in `wing-common`); `management` is the manager office, never a bullpen.
- **`cols`/`rows` are not a fixed formula.** `rows` stays 14; `cols` grows roughly with department count but varies with seeded room widths + sprinkled rooms. Do not assume `8 + N*8`. Invariants still hold: every interior cell belongs to a room (no gaps), room interiors are disjoint, single shared walls (inclusive overlap-by-1, no double walls), single-tile doorways, every room reachable from reception.
- **Per-department theming.** Each `cubicle-farm@<dept>` paints its department's `theme.floor` / `theme.wall` (see §3.10) — the sim needs tile sprites for every floor/wall id the catalog can emit (`floor-wood|terrazzo|rubber-mat|utility-vinyl|quiet-carpet|carpet|carpet-tiles|linoleum`, `wall-office|glass|panel|brick|cubicle`); the building shell stays `wall-office`.
- **Per-wing amenities.** Every bullpen carries its own `water_cooler` + `printer` (+ plant) interaction anchors, plus a `desk:<agentId>` anchor per seated agent (incl. the generated `golden-<dept>-N` cast).
- **Cast is dynamic.** The default bundle ships the 4 hero agents **plus a generated supporting population** (`golden-<dept>-N`), each with a recipe + `profile.json` + relationships. Enumerate all `characters/*` folders; do not hardcode the 4. `agentId == recipe id == layer-atlas family` still holds.
- **Parity:** the `tests/golden/office-layout/*.json` fixtures changed substantially; the sim-side C# parity fixtures (S1.5.1) must be re-synced from these.

### 3.5 `drives.json` (reusable drive catalog) — project-level
The shared set of motivations personas reference by id. `profile.drives.primary/secondary` and `objectives[].sourceDrive` are ids into this catalog.
```jsonc
[
  { "id": "advance_career", "label": "Advance career",
    "description": "Climb the ladder; take on higher-profile work.",
    "category": "status|security|power|social|growth",
    "amplifiesNeeds": ["recognition", "competence"] }   // subset of the 6 need ids
]
```
A persona drive id not present here is a valid one-off — the sim should fallback + log (§7). Shipped both at the bundle root and inside each `scenarios/<id>/` package so a scenario bundle is self-contained.

### 3.6 `traits.json` (reusable trait catalog) — project-level
The shared set of personality tags persona `traitTags` reference by id. `biasesReactions` are signed nudges to the reaction propensities on a coarse **−2..+2** scale (only non-zero categories stored); the sim scales to its own units and applies them on top of the spine-derived reaction tendencies (§4).
```jsonc
[
  { "id": "hot_headed", "label": "Hot-headed",
    "description": "Quick to anger.",
    "category": "work_ethic|social|politics|temperament|integrity|openness|competence|status",
    "biasesReactions": { "confront": 2, "escalate": 2 } }   // subset of the 7 reaction categories
]
```
As with drives, a persona may carry a trait id absent from the catalog — fallback + log (§7). Shipped at the bundle root and in each scenario package.

### 3.7 `relationshipTypes.json` (reusable relationship-type catalog) — project-level
The shared set of bond types a relationship edge references by id (`relationships[].relationshipType`). `biasesReactions` are signed **−2..+2** nudges (only non-zero stored) to the holder's reactions *toward the target* — the sim applies them like trait biases (§5.3). `thirdParty` is the optional **triangular (jealousy/protectiveness) coupling**: when the *target* of this relationship engages a third party, the holder reacts — `sensitivity` (0–100) is how strongly, `biasesReactions` is the reaction shape, and `intensifiesTowardDisliked` tells the sim to scale it up when that third party is someone the holder regards negatively (a rival / low affinity). Behavior selection stays in the sim (§5.4); the tool ships the coupling.
```jsonc
[
  { "id": "romance", "label": "Romance", "description": "Romantic partner; devoted — and possessive.",
    "category": "professional|social|romantic|adversarial",
    "secretByDefault": true,                                // seeds the per-edge `secret` flag
    "biasesReactions": { "reassure": 2, "confront": -1 },   // toward the target
    "thirdParty": {                                          // optional jealousy hook
      "sensitivity": 80,
      "biasesReactions": { "confront": 1, "withdraw": 1, "escalate": 1 },
      "intensifiesTowardDisliked": true } }
]
```
As with drives/traits, an edge may carry a type id absent from the catalog — fallback + log (§7). Shipped at the bundle root and in each scenario package.

### 3.8 `scenario-template.json` (cast-agnostic template) — **exported, sim-consumed (F4.1)**
A **role-slotted, cast-agnostic** scenario: the full-game third axis (Cast / Office /
Scenario). It references **roles, not agent ids** — every truth/info/seed/spawn names
a `roleId`, and **casting** rewrites roles → agents to emit a bound `Scenario` (§3.3).
Authored in `src/core/scenarioTemplate.ts`; a single template serialized by
`serializeScenarioTemplate` (`meta.artifact = "scenario-template"`), and the whole
**library** by `serializeScenarioTemplateLibrary` → the exported `scenario-template.json`
(`meta.artifact = "scenario-template-library"`, `{ meta, templates[] }`, same
`meta.schemaVersion` as the package). The tool also still casts to a bound `scenario.json`
and exports that; the template artifact is the **runtime caster's** input (§5.7) — it ships
at the bundle root alongside the bound scenarios. The library is passed into `exportAll`
(the UI supplies `ROLE_TEMPLATES`), so a sprite-only export with no library omits the file.
See `docs/scenario-template-model.md`.
```jsonc
{
  "templateId": "the_office_romance",
  "triggering": "emerge",                          // emerge | provoke
  "emotionalPayload": { "targetEmotions": ["infatuation","jealousy","heartbreak"], "description": "…" },
  "roles": [
    { "roleId": "loverA", "label": "Lover A", "required": true,
      "preconditions": [ /* see the precondition vocabulary below */ ] }
  ],
  "roleSeeds":  [ { "roleId": "loverA", "beliefSeeds": [...], "knowledgeSeeds": ["love_note"],
                    "relationshipOverrides": [ { "toRole": "loverB", "affinity": 90 } ] } ],
  "locations":  [ { "locationId": "loverA_desk", "bindRoomId": "cubicle-farm", "bindDeskOfRole": "loverA", … } ],
  "roleSpawns": [ { "roleId": "loverA", "locationId": "loverA_desk" } ],
  "truthFacts": [ { "truthId": "…", "subjectRoles": ["loverA","loverB"], "sourceRole": "loverA", … } ],
  "informationItems": [ { "informationId": "love_note", "sourceRole": "loverA", "initialHolderRoles": ["loverA","loverB"], … } ],
  "interventionTypes": [...], "variants": [...], "defaultVariantId": "…", "objective": { … }   // as §3.3
}
```

**Precondition vocabulary (the persona ↔ scenario casting contract).** Built only on
the catalogs §3.5–§3.7 already define — no parallel vocabulary. Discriminated by `kind`:
```jsonc
{ "kind": "trait", "trait": "gossip", "mode": "has" }            // trait id (§3.6)
{ "kind": "axis",  "axis": "discretion", "op": "lte", "value": 35 }   // OCEAN + game + derived axis, 0–100
{ "kind": "need",  "need": "recognition", "field": "sensitivity", "op": "gte", "value": 70 }
{ "kind": "drive", "anyOf": ["maintain_social_access"] }         // drive ids (§3.5)
{ "kind": "relationship", "toRole": "loverB", "direction": "mutual", "axis": "affinity", "op": "gte", "value": 30 }
{ "kind": "aggregate", "axis": "familiarity", "reduce": "avg", "direction": "outgoing", "op": "lte", "value": 30 }
{ "kind": "department", "department": "sales", "mode": "in" }     // department catalog id (§3.10); mode in|notIn
{ "kind": "crossDepartment", "toRole": "loverA", "relation": "different" }   // relation same|different
{ "kind": "distance", "toRole": "rivalB", "source": "structural", "op": "gte", "value": 50, "weight": 0.5 }  // source structural|spatial; hard (op+value) and/or soft (weight)
}                                                                // axis ∈ trust|suspicion|affinity|influence|respect|familiarity; type/typeAnyOf = relationshipType id (§3.7)
```
`relationship` constrains a candidate **relative to the agent assigned to `toRole`**
(`direction`: outgoing | incoming | mutual). `aggregate` is the **"to-everyone"**
condition — it reduces (min/max/avg) the axis over the *whole cast* (a missing edge =
`missingAs`, default 0), e.g. an outsider with low familiarity to everybody.
**Proximity is the `familiarity` axis** at authoring time — the persona-level proxy the
sim refines with live spatial state (§5.4/§5.7).

**Department predicates (F4.2 — the cross-wing vocabulary).** `department` is **intrinsic**:
the candidate's `identity.department` (a department catalog id, §3.10/§3.2) must equal
(`mode:"in"`) or differ from (`mode:"notIn"`) the named id; an unassigned candidate
(`department: ""`) is `in` nothing and `notIn` everything. `crossDepartment` is
**relational** like `relationship` — it constrains the candidate's department *against the
agent assigned to `toRole`*: `relation:"different"` is the **core cross-department pairing**
(the two slots must resolve to different departments), `relation:"same"` requires the same.
Both sides must have a **known** department — `crossDepartment` never casts onto an
unassigned (`""`) agent, so a cross-wing template can't silently bind department-less
agents. The ids are the same stable ids the org chart (§3.11) and wings (§3.4) key on.

**Organizational-distance predicate (F4.3 — the cross-wing difficulty/payload term).**
`distance` is **relational** (resolved against `toRole`, symmetric) and reads one of two
signals via `source` (default `"structural"`):
- **`structural`** = hop distance in the **reporting tree** (derived from the cast's
  `manager`/`direct-report` edges, §3.7/§3.11) — always resolvable from the cast alone.
- **`spatial`** = wing-hop distance in the office **wing-connectivity graph** (§3.4) —
  resolvable only when a generated office scene is in play.

Distances are normalized **0–100** (graph hops capped at 6, then scaled). The term takes
two **forms**, either or both: a **hard** threshold (`op`+`value`) gating eligibility, and a
**soft** `weight` (may be negative) adding `weight · distance/100` to the casting fit score so
a template can *prefer* a farther-apart (or closer) pairing. An **unknown** distance — no
graph path, or a `spatial` query with no scene — is **inert**: it never blocks the cast and
contributes 0 to the score (fallback discipline, §7). The resolved distances behind the final
cast surface in the casting report (`report.distances[]`) so the sim/payload can scale on how
far apart the pairing landed.

**Distance-source decision (S4.3.1 — recorded, shared with the sim): BOTH, structural-first.**
The tool's authoring-time caster uses **structural** distance by default because it computes
from the cast alone (no office scene required — the company cascade and previews are
scene-less) and is the more semantically meaningful "organizational distance." **Spatial** is
supported as an opt-in `source` when a scene is present, but real spatial proximity is the
**sim's** strength at runtime (the same division already set for proximity↔`familiarity`,
§5.4/§5.7): the sim receives both signals in the bundle — the reporting tree in
`org-structure.json` (§3.11) and the wing graph in `office-layout.json` (§3.4) — and can refine
either. Both forms (hard threshold + soft cost) are supported so a template author can *gate*
on distance or merely *price* difficulty/payload by it.

**Role presence + family.** A role carries `presence: "present" | "absent"` (default
present). An **absent** ("negative") role is resolved — for distinctness and so the
seed/truth/info can reference its agent id — but kept **out of the emitted cast/spawns**
and reported as *the one to keep out* (the Scapegoat's off-scene culprit, the Power
Vacuum's removed authority). A template also carries an optional `family` (free-text
grouping). Both are tool-side authoring concerns; the emitted bound `scenario.json` is
unaffected (an absent role simply contributes no cast member, only the references it's
named in).

### 3.9 Visual interaction system — moods, activity badges, conversation style

The runtime layer that shows *what an agent is doing where it stopped*. Three
parallel pieces, all following the same split: **the tool ships the vocabulary +
art; the sim selects which to show and where to place it.** None are stored in a
recipe. They stack — an agent can be *working* **and** *suspicious* at once.

**Moods** are split into two halves with different ownership shapes:
- **Face overlay** (`moods-atlas@Nx.json`, per character) — eyebrows/mouth painted
  on the head; depends on the face, so it's per-character. 6 states × 4 facings,
  keyed `"<mood>_<facing>"`; north has no face but its frame is still emitted so
  indexing stays uniform. The sim selects a mood from behavioral state and shows
  that frame.
- **Overhead emote** (`mood-emotes-atlas@Nx.json`, one **shared** project-level
  strip) — the bubble above the head. Character-independent, so it ships once and
  is placed by the sim at `aboveHead` — **structurally identical to an activity
  badge** (`normal` has no emote, so idle crowds stay clean). One frame per emoted
  mood, keyed by mood id.

> **Breaking change (full refactor):** the overhead mood emote used to be baked
> into every `moods@Nx.png` frame; it now lives only in `mood-emotes-atlas`
> (`moods-atlas.meta.emoteBaked: false` flags this). A consumer that composites
> from the layer atlas never had the emote at all (it was only ever in the baked
> sheet) — so splitting it out both *fixes* that gap and unifies overhead emote +
> activity badge into one shared-sprite mechanism. The sim importer must now
> composite the shared mood-emote atlas above the head instead of relying on the
> sheet.

**Activity badges** (`activity-badges-atlas@Nx.json`, one **shared** project-level
strip) — a character-independent overhead emote per activity. The "working" badge
looks identical over anyone, so it ships once, not per character.
```jsonc
{
  "kind": "activity-badges",
  "frameSize": 256, "scale": 2,
  "activities": ["work","talking","meeting","break","lunch","idle","walk","monitoring"],
  "frames": { "work": { "x": 0, "y": 0, "w": 256, "h": 256 }, "...": {} },
  "pivot": { "x": 0.5, "y": 0.5 },               // badge bubble center
  // Per-id MOTION INTENT — how the sim should animate the badge, and where it sits
  // in the salience hierarchy. The tool owns the vocabulary, so it owns the intent;
  // the sim still owns the actual curves/timings (this is a recommendation, not a track).
  "motion": {
    "transient": false,                          // ongoing state, not an event flash
    "byId": {
      "work": { "intro": "fade-in", "loop": "none", "outro": "fade-out", "salienceTier": 1 },
      "...": {}
    }
  },
  "meta": { "shared": true, "facingIndependent": true }
}
```
All four overhead atlases (`activity-badges`, `mood-emotes`, `prop-status-badges`,
`attention-puffs`) now carry this `motion` block. `transient: true` marks the
event-flash family (attention puffs); the state families are `false`. `salienceTier`
(higher wins) is the authored importance the sim uses for its salience budget, draw
order, and base scale — for attention puffs the tiers encode the §7 hierarchy with
`attn-harvestable` at the top (and `loop: "shimmer"` + `outro: "hold"`, the player's
call-to-action). **Legibility:** every badge cell is drawn with a light contrast halo
behind the dark ink ring so it reads as a sticker against a busy floor, and the source
art is scaled up; the sim still owns the on-floor screen-space size (a min-size clamp).

Runtime convention: the sim reads each agent's current activity, looks up the
matching frame, and blits it above the agent's head. **Placement:** because the
badge is a *separate* sprite (unlike a mood emote, which is baked into the
character sheet), the sim needs to know where the head is — the character
`atlas@Nx.json` now ships `anchors.aboveHead` (per facing, normalized, same
bottom-left origin as `pivot`); the activity atlas echoes the south value in
`attach`. The activity
string stays **free-text, sim-owned** (§1) — the badged set is the *recommended*
vocabulary, not a closed enum; an `activity` with no frame simply draws no badge
(fallback+log, §7). The blank state (`none`) has no frame by design.

**Conversation style** (`conversation-style.json`, one project-level file) — the
look of a 1:1 conversation. The connector is drawn between two **live** world
positions, so the tool can't author the instance, only the style.
```jsonc
{
  "kind": "conversation-style",
  "style": "linked-bubbles",
  "badge": "talking",                            // activity badge shown on each conversant
  "anchor": "aboveHead",                         // per-agent attach point for badge + link
  "link": { "kind": "dotted-arc", "color": "#46C07A", "width": 2.4, "dash": "0.5 5", "bow": 24 }
}
```
Runtime convention: the sim **owns the pairing** (it already pairs agents for
water-cooler gossip). For each pair it shows `badge` on both agents and draws
`link` between their `anchor` points (the arc bows up `bow` canvas units over the
two badges). Group chats (N>2) generalize the same connector across all members.
The tool provides style + the reused `talking` badge; the sim provides pairing +
placement.

### 3.10 `departments.json` (reusable department catalog) — project-level
The single org model — structured department units the office-scale work references by **stable id** (the way drives/traits/relationship-types are catalogs). Category is free-text with a fallback vocabulary (`leadership|finance|commercial|technical|operations|administrative`). The company cascade (Epic 0 F0.3) fills this catalog; layout groups wings by its ids. Personas/employees carry `department` as free text today; the id-reference rewrite is a future migration (Epic 3 F3.1), so a free-text value maps onto a catalog id by exact-id, case-insensitive label, or slug. An entry also carries **optional `capabilities`** (F2.4) — the surveillance **medium(s)** reaching that department grants the player (IT→email/logs, HR→records, Facilities→badge/camera). Free-text + fallback (suggested vocab `email|im|logs|personnel_records|financial_trails|badge_logs|cameras|crm|exec_comms`), seeded by category and overridable; absent = grants nothing. **The tool authors the tags; the sim owns the clearance/medium model** (access tiers, reach, gating) that consumes them — the access/temporal axis is the clearance ladder's, not the tag's. An entry also carries an **optional `theme`** (`{ floor?, wall?, accent? }`) — the visual identity the procedural office paints onto that department's wing (floor/wall are asset ids; `accent` is a hex colour, currently editor-only). Seeded by category, overridable; absent falls back to room-kind defaults. Shipped at the bundle root and in each scenario package.
```jsonc
[
  { "id": "engineering", "label": "Engineering", "category": "technical",
    "capabilities": ["email","im","logs"], "theme": { "floor": "floor-utility-vinyl", "wall": "wall-glass", "accent": "#1FB6C9" } }
]
```

### 3.11 `org-structure.json` (org chart) — project-level, **derived**
The loadable org chart, derived from §3.10 + the personas (`buildOrgStructure`). The load-bearing shape is a **structure / contents split** for the sim's fog-of-war: `structure` is what the player always sees (which departments exist), `contents` is what the sim fogs until a wing is reached (who is inside, the reporting lines, the heads). The sim can load `structure` alone to draw the chart. Every catalog department appears in both `structure.departments` and `contents.members` (possibly empty). Members resolve by mapping each persona's `department` onto a catalog id; unresolved personas land in `unassigned` (F2.5 validation flags them).

**Reporting lines are DERIVED from the `manager` / `direct-report` relationship edges (§3.7), not authored separately (F2.3 decision)** — one source of truth. `manager` edge = the holder reports to the target; `direct-report` edge = the target reports to the holder. Each `contents.reportingLines[]` is a `{ managerAgentId, reportAgentId }`. The **head** per department is the topmost member (no manager *inside* the department), seniority-tiebroken — so every populated department resolves a head even with no reporting edge yet; an empty department's head is `null`. A report with a conflicting or unresolvable manager is flagged at authoring time (not emitted). Deterministic; not stored in the project (recomputed on export). Shipped at the bundle root and in each scenario package.
```jsonc
{
  "structure": {                                            // visible — safe to load without the roster
    "departments": [ { "id": "operations", "label": "Operations", "category": "operations", "capabilities": ["badge_logs","cameras"] } ]
  },                                                        // capabilities (F2.4) are VISIBLE: the player sees what reaching a dept buys before contents un-fog
  "contents": {                                             // fogged — revealed wing-by-wing
    "members": { "operations": ["janice", "carl", "linda"], "management": ["manager"] },  // agentIds by dept id
    "reportingLines": [ { "managerAgentId": "manager", "reportAgentId": "janice" } ],      // derived from §3.7 edges
    "heads": { "operations": "janice", "management": "manager", "legal": null },           // topmost member per dept
    "unassigned": []                                        // personas whose department resolves to no catalog id
  },
  "meta": { "generator": "sprite-character-creator", "schema": "00-company-root-and-cascade.md",
            "departmentCount": 13, "memberCount": 4, "reportingLineCount": 1 }
}
```

### 3.12 `company.json` (the company root) — project-level, **company package**
The **company root** (Epic 0 F0.8), written at the **bundle root** with the existing payloads as its children (org-structure / personas / relationships / `office-layout.json` / `scenario(-template)` below it). It is the new-game seed: the culture/economy/history that *cascaded down* into the departments, people, and relationships in the same bundle. The **default project ships `MERIDIAN_DYNAMICS`** (the reference declining-incumbent) as `project.company`, so a plain export is already a complete company package the sim can load without running the cascade; a *generated* company (`export company:<archetype>:<seed>`) replaces it with a cascaded org. Climate aggregates resolve to plain numbers (the sim shouldn't re-derive); the editable form (with `Derived` wrappers + `authored` flags) lives in `project.json`. Additive — no existing payload changes shape, and a company-stripped (sprite-only) export simply omits this file, so single-scenario bundles load exactly as before.
```jsonc
{
  "companyId": "acme",
  "identity": { "name": "Acme Co", "industry": "Software", "sizeBand": "small", "headcount": 50, "ownership": "bootstrapped", "reputation": 56 },
  "culture": { "hierarchy": 28, "secrecy": 40, "volatility": 63, "cutthroat": 42, "mercenary": 17, "pace": 86, "fear": 27 },
  "economy": { "financialHealth": 50, "trajectory": "growing", "morale": 55, "runwayMonths": 18 },
  "mission": { "statedMission": "…", "actualPriority": "…", "hypocrisyGap": 40 },
  "history": [ { "id": "lay", "kind": "layoff", "when": "recent", "magnitude": 80, "visibility": "public", "involvedDepartments": ["Engineering"] } ],
  "narrative": { "officialStory": "…", "realStory": "…", "openSecrets": ["…"] },
  "socialClimate": { "orgTrust": 50, "rivalries": [], "powerCenters": [] },
  "climate": { "factionalism": 41, "fear": 39, "volatility": 71 },             // derived → flat numbers (sim doesn't re-derive)
  "meta": { "generator": "sprite-character-creator", "schema": "00-company-root-and-cascade.md" }
}
```

### 3.13 UI assets — `theme.uss` / `theme.json` + `icons/*` (project-level)
The framing UI's share of the bundle (full rationale: [docs/ui-art-plan.md](docs/ui-art-plan.md)).

**Ownership boundary.** The tool owns every UI shape with **no state, no layout, and no text** — icons, glyphs, ornaments — plus the shared color palette. The Unity UI framework (uGUI today, UI Toolkit/USS as the migration target) owns every **container, control, state, and string**: panels, buttons, scrollbars, typography, and all interaction states (`:hover`/`:active`/`:disabled`), 9-slice, and layout. An icon may sit *inside* a button; a button is never a tool asset. Do not request panel/button/text sprites from this tool.

**`theme.json` / `theme.uss`** — one canonical palette ([src/data/uiPalette.ts](src/data/uiPalette.ts)) emitted two ways: USS `:root` custom properties for UI Toolkit and a flat `{ palette: { name: hex } }` map for uGUI / non-USS consumers. Names: `ink`, `on-color`, `line` (= the project's `style.outline.color`), `surface`, `panel`, `accent`, `status-*` (info/positive/warning/danger/neutral), and `emote-*` (the activity + mood bubble hues, so chrome legends match the world). This is the cohesion contract: world sprites and chrome resolve the **same** colors without sharing a pipeline.

**`icons/`** — each `IconDef` emits `icons/<id>.svg` (resolution-independent, design `viewBox="0 0 128 128"` — import as a UI Toolkit `VectorImage`) and a non-pixelated PNG ladder `icons/<id>@{1,2,4}x.png` (uGUI `Sprite`), from one definition, so assets survive the uGUI→UI Toolkit migration unchanged. `icons/icons-manifest.json` indexes them:
```jsonc
{
  "kind": "icons",
  "designCanvas": 128,
  "icons": [
    { "id": "ui-gear", "label": "Settings", "mode": "tintable",
      "svg": "icons/ui-gear.svg", "png": ["icons/ui-gear@1x.png", "icons/ui-gear@2x.png", "icons/ui-gear@4x.png"] }
  ]
}
```
**Tinting.** `mode: "tintable"` icons are **white masks** — recolor with one flat multiply (USS `unity-background-image-tint-color`, uGUI `Image.color`), pulling from `theme.uss` `--wc-*`. Because the multiply is flat, tintable icons are single-color by construction. `mode: "literal"` icons ship final multi-hue colors and are not recolored. Unknown ids draw nothing (free-text-with-fallback, consistent with badges).

The shipped icon set is catalog-grounded: control glyphs + trim (tintable), department-CATEGORY glyphs (`dept-*`, tintable — the six `DEFAULT_DEPARTMENTS` categories), the six canonical needs (`need-*`, tintable), and relationship-CATEGORY glyphs (`rel-*`, literal, colored from `--wc-rel-*`). These cover the coarse groupings; leaf-level coverage tracks the UI epic.

**`cursors/`** — cursors are textures, not vectors, so they export **PNG-only**: `cursors/<id>@{1,2,4}x.png` + `cursors/cursors-manifest.json`. Each manifest entry carries a **normalized `hotspot`** `{x,y}` (0..1, multiply by chosen texture size for the active pixel). Cursors render dark ink under a light halo so the pointer reads on any background. Wire via USS `cursor: url("…") <x> <y>` / uGUI `Cursor.SetCursor`.

**Epic 36 palette + floor channels.** The theme ships the surveillance-workstation palette (`ui_visual_design.md` "Visual Language"): charcoal/slate `--wc-surface`/`--wc-panel`, light `--wc-text`, a single institutional **teal-blue** `--wc-accent`, amber `--wc-status-warning`, red `--wc-status-danger` (used rarely). It also ships the **floor-overlay channel tokens** — `--wc-trust`, `--wc-suspicion`, `--wc-hostility`, `--wc-belief-truth`, `--wc-belief-rumor`, `--wc-pressure`, `--wc-information`, `--wc-change`, `--wc-surveillance` — so the Shapes floor layer (`overlay-style.json`) and the chrome resolve **one** palette. Note `emote-*` (sprite badge hues) are separate and unchanged.

### 3.14 `behaviors.json` (reusable workplace-behavior catalog) — project-level
The shared set of **observable office actions** an agent can take to express inner state — the bridge between drives / needs / pressures / traits / emotional state and what a coworker actually *sees happen*. The tool authors **what behaviors exist** and their constraints/couplings; the sim owns **which behavior happens now** (selection, scoring, simulation, outcome resolution). A behavior is reusable: the same definition ("Steal lunch") is selectable by many agents under different motivations (resentment, jealousy, revenge, boredom) — the behavior is constant, the motivation varies.
```jsonc
[
  { "id": "steal_lunch", "displayName": "Steal lunch",
    "category": "productivity|social|territorial|coping|escalation",
    "description": "Takes another employee's lunch from the break room.",
    "requiredContext": ["break_room", "target_employee", "manager_absent"],  // situational tokens the sim matches
    "requiredAffordances": ["lunch"],                                         // objects/resources the sim binds to props
    "pressureWeights": { "resentment": 3, "jealousy": 2, "spite": 2 },        // relative PULL per pressure (not a trigger)
    "traitModifiers": { "rule_bender": 2, "rule_follower": -3 },              // trait ids (§3.6) → signed nudge
    "relationshipRequirements": {
      "requiresTarget": true,           // does it act on another employee?
      "targetKnown": false,             // must the actor already know the target?
      "relationshipTypeAnyOf": [] },    // optional: only toward these bond-type ids (§3.7); empty = any
    "visibility": "private|semi-private|public",   // how observable — sim weights social fallout
    "severity": "trivial|minor|moderate|major|severe",
    "outcomes": ["target_annoyed", "trust_loss", "gossip_seed"] }            // EXPECTED consequences (sim resolves actuals)
]
```
`pressureWeights` / `traitModifiers` keys, `requiredContext` / `requiredAffordances`, and `outcomes` are **free-text-with-fallback** (the tool ships curated suggestion vocabularies, but the sim's pressure/context/affordance/outcome model is authoritative — unknown tokens fall back + log, §7). `traitModifiers` keys SHOULD resolve to the trait catalog (§3.6) and `relationshipTypeAnyOf` to the relationship-type catalog (§3.7) — the tool warns on a dangling id but never blocks. The catalog is exported **verbatim**; behaviors are not referenced by id from personas (the sim selects them at runtime), so there are no back-references. Shipped at the bundle root and in each scenario package. The default project ships ~28 behaviors across all five categories so a plain export gives the sim a complete behavior vocabulary to test against.

---

## 4. Formulas computed **in the tool** (authoritative)

These run in `applyDerived` before export ([src/core/profile.ts](src/core/profile.ts)). Authored overrides win; otherwise the value is derived. Helpers: `avg(...)` = arithmetic mean; `clampUnit` = clamp to `0–100`. All inputs are `0–100`.

```
temper          = clamp( 0.6·neuroticism + 0.4·(100 − agreeableness) )
grudgeHolding   = clamp( 0.6·(100 − agreeableness) + 0.4·neuroticism )

confront        = avg( extraversion, 100 − agreeableness, temper )
gossip          = avg( 100 − discretion, extraversion )
withdraw        = avg( neuroticism, 100 − extraversion )
verify          = avg( conscientiousness, integrity )
reassure        = avg( agreeableness, extraversion )
escalate        = avg( ambition, conscientiousness )
ignore          = avg( 100 − extraversion, 100 − neuroticism )

volatility      = avg( neuroticism, temper )
```

Inputs are **only** OCEAN + the four primary game axes (ambition, integrity, loyalty, discretion). **Drives, trait tags, needs, preferences, skills, and objectives feed nothing here** — they are authored → exported, and given meaning by the sim.

---

## 5. Formulas the **sim** owns (design sketch — NOT implemented here)

This section is the point of the doc: deciding these tells us what to capture in the tool. Treat everything below as **proposed/TBD** until the Unity side commits.

### 5.1 Drives → behavior
Drives are now a **structured, reusable catalog** (`drives.json`, §3.5) that personas reference by id. Each drive carries `amplifiesNeeds` — the tool-authored coupling the sim acts on. Resolution the sim owns:
- Look up the persona's `drives.primary`/`secondary` ids in the catalog. `primary` should weigh heavier than `secondary` (e.g. 2:1).
- A drive raises motivation pressure on its `amplifiesNeeds` (combine with §5.2 need depletion).
- `objectives[]` gate/scope drives to a concern: `{ sourceDrive, targetOrConcern, expectedBehaviorTendency, status }` — only `status:"active"` objectives apply; `expectedBehaviorTendency` is the predicted action when the concern is salient.
- **Unknown id discipline:** a persona may reference a drive id absent from the catalog (a one-off). The sim should fallback + log, never hard-fail.

**Still sim-owned:** action *selection* from drive pressure, and any per-drive reaction bias beyond the need coupling (we deliberately did not author reaction weights per drive — that would overlap the spine-derived reaction tendencies in §4).

### 5.2 Needs depletion / pressure
`needs[id] = { baseline, sensitivity }`. Sketch: satisfaction starts at `baseline`, depletes over time scaled by `sensitivity`, and the most-deprived need (optionally weighted by active drives, §5.1) sets current motivation. The tool already surfaces "top needs" by `sensitivity` for preview only.

### 5.3 Reaction selection
On an event, the sim picks among the 7 `reactionTendencies` (already numeric, §4) — likely a weighted/softmax draw, modulated by `temperament.volatility`, current mood, and the triggering relationship. **Trait biases (§3.6) apply here:** for each trait the persona carries, add its `biasesReactions` nudges (scaled) to the corresponding tendencies before selecting. **Relationship-type biases (§3.7) also apply here when there's a triggering relationship:** look up the edge's `relationshipType` in the catalog and add its `biasesReactions` (toward-the-target nudges) the same way — this is what makes a character react *differently to different people*. Tool provides the base tendencies + trait nudges + relationship-type nudges; sim provides the combine + selection rule.

### 5.4 Relationship dynamics
`relationships[]` (resolved baseline + overrides) are the **starting** edges; each carries a `relationshipType` id (§3.7) and an optional `secret` flag. The sim evolves the edges over the run (trust/suspicion/affinity/influence/respect/familiarity drift from interactions, gated by `grudgeHolding` for how long slights persist). **Third-party / jealousy is sim-owned behavior the tool feeds:** when agent B (the target of A's `romance`/`mentor`/… edge) interacts with a third agent C, the sim looks up that edge's relationship type, and if it carries a `thirdParty` coupling, biases A's reaction by `thirdParty.biasesReactions` scaled by `sensitivity` — scaled up further when `intensifiesTowardDisliked` and A regards C negatively (low affinity / rival). Example: Linda has a secret `romance` edge → Carl; Carl talks to Janice (whom Linda is cool on) → Linda's jealousy fires, intensified. Tool ships the start edges + the typed coupling; sim owns the drift model and the triangular evaluation.

### 5.5 Belief & information propagation
`beliefs.json` (per-agent stance+confidence) and `knowledge.json` (truths, information items, who-knows-what) are start state. The sim owns spread: who shares with whom (gated by `gossip` tendency, `discretion`, affinity, `accessState` of shared locations), and how `truthAlignment`/`originType` shift a receiver's `confidence`/`stance`.

### 5.6 Objective / KPI scoring
`objective.kpi` + `expectedEvidence[]` + the active `variant`'s `selections` define what a run is measured against. The sim owns the measurement; the tool owns the definition. KPI strings are free-text — same registry/fallback discipline as drives.

### 5.7 Scenario-template casting (one synchronized contract — tool exports, sim casts)
The full-game direction has the **engine cast templates at runtime** — bind a cast-agnostic `scenario-template.json` (§3.8) onto the live cast/office by precondition match. The **tool** does this at authoring time (`castTemplate` in `scenarioTemplate.ts`: greedy-best-with-backtracking over the precondition vocabulary, strongest-fit wins ties; required roles must fill or the cast fails; optional roles skip) and exports the resulting **bound** `scenario.json` — so **the prototype loader is unchanged**. **As of F4.1 the template library is also exported** (`scenario-template.json`, §3.8), so the sim's runtime caster ("Scenario Loading" epic — E30 generalize / E34) has its input artifact:
- the input artifact `scenario-template.json` ships beside today's bound `scenario.json`;
- the sim gains a **runtime caster** = the port of `castTemplate`, **the same precondition vocabulary (§3.8) — one contract, two evaluators**, evaluating against **live** persona + relationship + department/org-distance + **real spatial proximity** (the conditions the sim does better than the tool's authoring-time proxies — `familiarity` for proximity, and the `spatial` `distance` source which the tool only resolves when a scene is present while the sim has live positions);
- a bound `scenario.json` keeps loading as-is — it is the already-cast special case (single-candidate roles).

**Validation parity / drift check.** The precondition vocabulary in §3.8 is the single source of truth both casters implement; `validateScenarioTemplate` is the tool-side authoring gate and the sim's loader runs the equivalent structural check on ingest. The **shared fixture** is the exported library itself — `THE_OFFICE_ROMANCE` round-tripped through both casters against the same cast must produce the same role→agent assignment; a divergence is a contract drift. (The bound-`scenario.json` path obligates no sim change to ship tool work.)

---

## 6. Open data-capture questions

Things the sim will likely need that the tool does **not** capture yet — decide before building the sim side:

1. ~~Drive semantics location~~ — **Resolved:** drives are a tool-authored structured catalog with a `amplifiesNeeds` coupling (§3.5/§5.1). Sub-question ~~per-drive reaction biases~~ — **Resolved (sim, 2026-06-15):** no per-drive reaction biases are authored; reaction shaping comes from trait + relationship-type `biasesReactions` only (need coupling is enough). See `persona_consumption_model.md`.
2. ~~KPI/objective evaluators~~ — **Resolved (2026-06-15):** `kpi` stays **free-form**. The sim keeps a registry of implemented evaluators (fallback+log on unknown, same discipline as drives/traits); the tool surfaces an authoring-time **"unknown KPI" warning** when a `kpi` id has no sim evaluator (non-breaking, like drive/trait autocomplete). No closed enum, no lockstep release. See `persona_consumption_model.md` Layer 7.
3. **Location/activity vocabularies** — `routine[].locationId/activity` and scenario `locationId`s are free-text; the sim owns the real set. `activity` now also drives the overhead **activity badge** (§3.9): the badged set (`work/talking/meeting/break/lunch/idle/walk/monitoring`) is the recommended vocabulary, fed from the same list as routine autocomplete so the two can't drift, but still free-text with fallback (an unbadged activity just draws no badge). Open: do we want the tool to validate routine `locationId`s against the scenario's declared locations?
4. ~~Time model~~ — **Resolved (sim, 2026-06-15):** the sim owns time via the Epic 20 compressed office-day clock; routine `"HH:MM"` maps onto it and needs deplete per step. The tool still does not model time — and does not need to. See `persona_consumption_model.md` Layer 1.
5. ~~Need ↔ drive coupling~~ — **Resolved:** it is tool data — `drives.json[].amplifiesNeeds` (§3.5). The activity→need *replenishment* map (a different mapping) is **sim-coded**, not exported (decided 2026-06-15).
6. ~~Scenario-template cast-coverage gate~~ — **Resolved (F3.5):** the tool checks a generated org against the scenario-template library (`ROLE_TEMPLATES`) before export, reusing the per-template `analyzeTemplateCoverage` path. `analyzeOrgCoverage(library, cast)` aggregates a castable ratio + named gaps (`scenarioTemplate.ts`); `validateOrgScenarioCoverage` returns the same `{ errors, warnings }` shape as `validateOrgStructure` (§3.11). **Warn vs. block:** the export **hard-blocks** only when the cast can play *nothing* (castable ratio ≤ `blockAtOrBelow`, default 0 — shipping an org that generates no scenarios is the only true error) and **warns + confirms** when coverage is merely thin (ratio < `warnBelow`, default 0.5), naming the under-covered templates and the required roles that cannot fill. Both thresholds are tunable; a sprite-only export with no personas skips the gate. This is a tool-side authoring guard — it changes no exported artifact shape and obligates no sim change. **F4.4** extends the analysis to the department/distance vocabulary (§3.8): `analyzeTemplateCoverage` already *evaluates* department/`crossDepartment`/`distance` preconditions (it casts the template), and now **names the specific unmet condition** behind a blocked required role — a missing department (`requires department "legal", which has no members`), an unsatisfiable cross-wing pairing (`must be in a different department from "rivalB"…`), or an unreachable distance threshold (`requires organizational distance gte 90 from "a"…`). These reasons ride on `RoleCoverage.unmetReasons` / `TemplateGap.reasons` and flow into the gate's message. Spatial-distance gaps aren't diagnosed at coverage time (no office scene); structural distance is.
7. ~~Department capability/medium tags (E2 F2.4)~~ — **Resolved + BUILT (2026-06-20).** *Capability-mapping home (S2.4.1):* **Terrarium-side** — per-department capability/medium tags are authored data the tool owns (a department property like `category`/`subculture`), while the **clearance/medium model that consumes them stays sim-owned** (matches the established split; per-department tags allow per-company variation a uniform sim rule can't). *Data shape:* confirmed against the game-design-docs surveillance/clearance model (`surveillance_and_clearance_model.md` + `14_OFFICE_SCALE_DIRECTION.md`, which keep capability **tags** tool-side but capability **semantics + reach/access gating** sim-side) → **flat free-text medium ids** `capabilities?: string[]`, NOT an access-tiered shape (the access/temporal axis is the clearance ladder's, sim-owned). Built (S2.4.2): optional `capabilities?` on `DepartmentDefinition` (§3.10), seeded by category via `CATEGORY_CAPABILITIES`/`defaultCapabilitiesForCategory` (so cascade-generated orgs are surveillance-ready, overridable per department), surfaced in the **visible** half of `org-structure.json` (§3.11) and carried verbatim in `departments.json`, editable in the Departments panel. Free-text + fallback (suggested vocab `DEPARTMENT_CAPABILITIES`); absent-safe; the exact medium table stays open sim-side (E38 consumer, behind the Build 0.4 gate).

---

## 7. Compatibility rules

- **Adding** a suggestion to a free-text vocabulary (drive, trait tag, KPI, location, activity) is **non-breaking** — it only affects authoring autocomplete, never validation or export shape. **Adding an activity badge** is likewise non-breaking: a new shared-atlas cell the sim shows for that `activity` or ignores (§3.9).
- **Version gating:** `profile.json`, `scenario.json`, and `scenario-template.json` carry `meta.schemaVersion` (currently **12**, the project schema version — v10 added the `departments.json` catalog §3.10 + the derived `org-structure.json` §3.11; v11 made persona `identity.department` a department-catalog **id**, mutable for the sim's transfer tier; v12 added the optional `company` root §3.12 — additive, so a pre-v12 project just has no company). `office-layout.json` carries its **own** payload version (now **3** — v2 added `rooms[].departmentId` + the `wings[]` block; v3 added the `connectivity[]` wing-adjacency graph, §3.4); every addition is additive, so the bumps are non-breaking. The sim version-gates on these — `scenario.json` gates a whole scenario package (the bundled `drives.json`/`traits.json`/`departments.json`/`org-structure.json` are resolved within that already-versioned context); `profile.json` gates the per-character visual-import path. Bare-array catalogs (and the derived `org-structure.json`) are intentionally unversioned — they never travel without a versioned `scenario.json` or `project.json`.
- **Renaming/removing a field** in §3 **is** breaking — bump `CURRENT_SCHEMA_VERSION` (which flows into `meta.schemaVersion`), add a migration step, and update the sim loader.
- The sim should **fallback + log**, never hard-fail, on an unrecognized free-text id (drive, KPI, activity). That tolerance is what lets the tool ship a richer vocabulary without lockstep sim releases.
