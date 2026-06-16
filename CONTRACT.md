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
| Personality spine (OCEAN, game axes) | **Tool** | Authored. |
| Derived personality fields (temper, grudge-holding, reaction tendencies, volatility) | **Tool** | Computed here — see §4. The sim consumes the numbers; it does not re-derive them. |
| Needs, preferences, skills, baseline relationships, routine, formative events | **Tool** | Authored / exported. Mostly inert metadata here (not computed on). |
| Drive catalog (structured, reusable; `amplifiesNeeds`) | **Tool** | Project-level catalog (§3.5); personas reference by id. The need coupling is tool-authored data the sim acts on. |
| Trait catalog (structured, reusable; `biasesReactions`) | **Tool** | Project-level catalog (§3.6); persona `traitTags` are ids into it. Reaction nudges are tool-authored data the sim applies on top of the spine-derived tendencies. |
| Relationship-type catalog (structured, reusable; `biasesReactions` + `thirdParty`) | **Tool** | Project-level catalog (§3.7); relationship edges' `relationshipType` are ids into it. Carries reaction bias toward the target *and* the third-party (jealousy/protectiveness) coupling — tool-authored data the sim applies at interaction time. |
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
| `<agentId>-profile.json` | `serializeProfile` | character | Persona (§3.2). `meta.schema = character_model.md`. |
| `scenario.json` | `serializeScenario` | scenario | Scenario verbatim + `meta.schema = scenario_model.md` (§3.3). |
| `employees.json` | `buildScenarioPackage` | scenario | Flattened roster (id, dept, role, tags, spawn). |
| `relationships.json` | `buildScenarioPackage` | scenario | Resolved source→target edges (persona baseline + scenario overrides). |
| `beliefs.json` | `buildScenarioPackage` | scenario | Per-agent starting beliefs (from cast `beliefSeeds`). |
| `knowledge.json` | `buildScenarioPackage` | scenario | Truth facts, information items, per-agent `knows`. |
| `drives.json` | `project.drives` (verbatim) | project | Reusable drive catalog personas reference by id (§3.5). Also embedded in each scenario package. |
| `traits.json` | `project.traits` (verbatim) | project | Reusable trait catalog persona `traitTags` reference by id (§3.6). Also embedded in each scenario package. |
| `relationshipTypes.json` | `project.relationshipTypes` (verbatim) | project | Reusable relationship-type catalog edges' `relationshipType` reference by id (§3.7). Also embedded in each scenario package. |
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
    "displayName": "", "pronouns": "", "roleTitle": "", "department": "",
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
`{ version, source, generated, cols, rows, rooms[], roomGrid[][], floors[][], walls{grid[][],cells[]}, props[], characterSpawns[], anchors[], interactionAnchors[] }`
- `anchors[]`: `{ anchorId, roomId, x, y, kind: "room"|"desk" }` — what scenario `locations[].bindTo` resolves to.
- `interactionAnchors[]`: `{ id, interactionType, roomId, x, y }` — derived from interaction props (water cooler, printer, …).

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

### 3.8 `scenario-template.json` (cast-agnostic template) — **authoring-only today**
A **role-slotted, cast-agnostic** scenario: the full-game third axis (Cast / Office /
Scenario). It references **roles, not agent ids** — every truth/info/seed/spawn names
a `roleId`, and **casting** rewrites roles → agents to emit a bound `Scenario` (§3.3).
Authored in `src/core/scenarioTemplate.ts`; serialized by `serializeScenarioTemplate`
(`meta.artifact = "scenario-template"`, same `meta.schemaVersion`). **Not emitted in
the export bundle yet** — the tool casts to a bound `scenario.json` and exports that;
the template artifact lands when the sim grows a runtime caster (§5.7). See
`docs/scenario-template-model.md`.
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
}                                                                // axis ∈ trust|suspicion|affinity|influence|respect|familiarity; type/typeAnyOf = relationshipType id (§3.7)
```
`relationship` constrains a candidate **relative to the agent assigned to `toRole`**
(`direction`: outgoing | incoming | mutual). `aggregate` is the **"to-everyone"**
condition — it reduces (min/max/avg) the axis over the *whole cast* (a missing edge =
`missingAs`, default 0), e.g. an outsider with low familiarity to everybody.
**Proximity is the `familiarity` axis** at authoring time — the persona-level proxy the
sim refines with live spatial state (§5.4/§5.7).

**Role presence + family.** A role carries `presence: "present" | "absent"` (default
present). An **absent** ("negative") role is resolved — for distinctness and so the
seed/truth/info can reference its agent id — but kept **out of the emitted cast/spawns**
and reported as *the one to keep out* (the Scapegoat's off-scene culprit, the Power
Vacuum's removed authority). A template also carries an optional `family` (free-text
grouping). Both are tool-side authoring concerns; the emitted bound `scenario.json` is
unaffected (an absent role simply contributes no cast member, only the references it's
named in).

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

### 5.7 Scenario-template casting (sim-owned **future** — flagged, not implemented either side)
The full-game direction has the **engine cast templates at runtime** — bind a cast-agnostic `scenario-template.json` (§3.8) onto the live cast/office by precondition match. Today the **tool** does this at authoring time (`castTemplate` in `scenarioTemplate.ts`: greedy-best-with-backtracking over the precondition vocabulary, strongest-fit wins ties; required roles must fill or the cast fails; optional roles skip) and exports the resulting **bound** `scenario.json` — so **the prototype loader is unchanged**. When the sim adopts runtime casting (the separate "Scenario Loading" epic):
- a new optional input artifact `scenario-template.json` joins today's bound `scenario.json`;
- the sim gains a **runtime caster** = the port of `castTemplate`, same precondition vocabulary (§3.8), evaluating against **live** persona + relationship + **real spatial proximity** (the one precondition the sim does better than the tool's `familiarity` proxy);
- a bound `scenario.json` keeps loading as-is — it is the already-cast special case (single-candidate roles).

Nothing in this section obligates a sim change to ship the current tool work.

---

## 6. Open data-capture questions

Things the sim will likely need that the tool does **not** capture yet — decide before building the sim side:

1. ~~Drive semantics location~~ — **Resolved:** drives are a tool-authored structured catalog with a `amplifiesNeeds` coupling (§3.5/§5.1). Sub-question ~~per-drive reaction biases~~ — **Resolved (sim, 2026-06-15):** no per-drive reaction biases are authored; reaction shaping comes from trait + relationship-type `biasesReactions` only (need coupling is enough). See `persona_consumption_model.md`.
2. ~~KPI/objective evaluators~~ — **Resolved (2026-06-15):** `kpi` stays **free-form**. The sim keeps a registry of implemented evaluators (fallback+log on unknown, same discipline as drives/traits); the tool surfaces an authoring-time **"unknown KPI" warning** when a `kpi` id has no sim evaluator (non-breaking, like drive/trait autocomplete). No closed enum, no lockstep release. See `persona_consumption_model.md` Layer 7.
3. **Location/activity vocabularies** — `routine[].locationId/activity` and scenario `locationId`s are free-text; the sim owns the real set. Do we want the tool to validate routine `locationId`s against the scenario's declared locations?
4. ~~Time model~~ — **Resolved (sim, 2026-06-15):** the sim owns time via the Epic 20 compressed office-day clock; routine `"HH:MM"` maps onto it and needs deplete per step. The tool still does not model time — and does not need to. See `persona_consumption_model.md` Layer 1.
5. ~~Need ↔ drive coupling~~ — **Resolved:** it is tool data — `drives.json[].amplifiesNeeds` (§3.5). The activity→need *replenishment* map (a different mapping) is **sim-coded**, not exported (decided 2026-06-15).

---

## 7. Compatibility rules

- **Adding** a suggestion to a free-text vocabulary (drive, trait tag, KPI, location) is **non-breaking** — it only affects authoring autocomplete, never validation or export shape.
- **Version gating:** `profile.json` and `scenario.json` carry `meta.schemaVersion` (currently **9**, the project schema version). The sim version-gates on these — `scenario.json` gates a whole scenario package (the bundled `drives.json`/`traits.json` are resolved within that already-versioned context); `profile.json` gates the per-character visual-import path. Bare-array catalogs are intentionally unversioned — they never travel without a versioned `scenario.json` or `project.json`.
- **Renaming/removing a field** in §3 **is** breaking — bump `CURRENT_SCHEMA_VERSION` (which flows into `meta.schemaVersion`), add a migration step, and update the sim loader.
- The sim should **fallback + log**, never hard-fail, on an unrecognized free-text id (drive, KPI, activity). That tolerance is what lets the tool ship a richer vocabulary without lockstep sim releases.
