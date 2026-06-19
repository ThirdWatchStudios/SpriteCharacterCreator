# Office-Scale Authoring — Terrarium scope for The Water Cooler's growing office

**Status: DRAFT for decomposition.** This is the Terrarium (authoring-studio) half of
The Water Cooler's "office-scale" direction. It is pulled out here as its own set of docs
so it can be decomposed and tracked in its own GitHub project, in parallel with the
sim-side work.

## Where this comes from

The Water Cooler design docs (the `game-design-docs` repo) converged on a direction for how
the office **scales over a long playthrough** to give the game momentum and escape a
fixed-cast content ceiling. Sim-side source of truth:

- `the-water-cooler/docs/prototype-scope/14_OFFICE_SCALE_DIRECTION.md` (the direction)
- sim gap epics **38–41** (org chart & reach; department population & cast growth;
  cross-department casting; structural intervention)

The spine: **the whole organization pre-exists**, and the player is *granted fog-of-war
reach* into it wing by wing — never building or staffing it. A persistent core cast grows
by a **departmental periphery**; reached wings stay always-live; departments double as
**capability unlocks**; cross-department pairings and an engineered-reorganization (transfer)
tier deepen the loop.

A large share of that is **authored content**, which is Terrarium's job. This doc set
captures only the authoring-side work.

## Why this is Terrarium work

Terrarium authors the **8:00 AM starting state** — "employees, departments, office layout,
props, visual identities, and starting social conditions" (see the repo README) — and
exports a scenario package the sim loads. It never scripts behavior. The office-scale
direction does not change that boundary; it makes the starting state it authors **bigger and
structured**: a multi-department organization with an org chart, a populated cross-department
social graph, and a layout with real wings — instead of one flat office with one fixed cast.

## What Terrarium does today (the baseline)

Accurate current state, so the work areas below build on it rather than re-describe it:

- **Office layout generation** (`ROADMAP.md` 1.2, 2.4): a single flat office — fixed 22×14
  grid, a handful of shared-edge room templates, all non-manager cast seated in one
  `cubicle-farm`. Anchors are `room` (per room) + `desk:<agentId>` (cubicle-farm only). A C#
  runtime port (2.4) is planned so offices generate **at runtime in Unity**, with the tool's
  layout JSON as a debug/golden artifact.
- **Office Population Generator** (`ROADMAP.md`, DONE 2026-06-13): department **generation
  profiles** (random/accounting/IT/HR/management) as per-part visual weights, bulk
  `generatePopulation` with uniqueness, `EmployeeDefinition` carrying
  `metadata { department, role, agentId, displayName }`. So **department-aware *visual*
  generation already exists** — but `department` is flat metadata, not a structured catalog,
  and this generates visual DNA, not full personas, relationships, or org structure.
- **Personas** (`CONTRACT.md` §3.2): rich `profile.json` (OCEAN + game axes, needs, drives,
  traits, **relationships**, routine). `department` is a **free-text** `identity` field.
- **Persona templates** (`docs/persona-template-model.md`, DRAFT): seeded archetypes that
  stamp out coherent personas — designed, not yet wired to department generation or export.
- **Relationships** (`CONTRACT.md` §3.7): 12 relationship types, **any-to-any** (cross-group
  already supported), baseline + scenario overrides, third-party jealousy coupling.
- **Scenario templates** (`CONTRACT.md` §3.8, `docs/scenario-template-model.md`, DONE
  tool-side): cast-agnostic role slots + preconditions + emotional payload, `castTemplate`,
  coverage analysis. **`scenario-template.json` is authoring-only today** — the sim does not
  consume it yet (that is the sim-side "Scenario Loading" / casting epic).
- **No org-chart artifact, no department→capability mapping, no multi-wing layout.**

## The work areas (this doc set)

Each becomes an epic during decomposition. Mapping to the sim-side epics it serves:

| # | Work area | Serves sim epic(s) | Lift |
|---|---|---|---|
| [01](01-multi-department-office-layout.md) | Multi-department office layout | E38, E39 (+ E41 spare desks) | **Heaviest** |
| [02](02-org-structure-and-org-chart.md) | Org structure & org-chart artifact | E38 | Medium |
| [03](03-structured-departments-and-population.md) | Structured departments & population generation | E39 (+ E41 mutable field) | Medium |
| [04](04-scenario-template-export-and-preconditions.md) | Scenario-template export & dept-aware preconditions | E40 (+ shared E30/E34) | Medium |

The lighter sim-side asks fold into their natural homes: E41's *transfer* needs only a
**mutable structured department** (doc 03) + **spare desk/anchor capacity** (doc 01); E38's
**capability mapping** rides on the org-structure artifact (doc 02).

## Architecture & contract notes

- **This is `modern-office` content-pack work, not engine work** (`TOOL_ARCHITECTURE.md`):
  departments, org structure, and capability tags are game-specific. Keep them out of the
  game-agnostic sprite engine.
- **Contract changes are additive** (schema currently v9; `CONTRACT.md` §7). New artifacts
  (org structure) and new fields (structured/mutable department, capability tags, distance
  preconditions) bump the schema but do not break existing exports.
- The **office-as-runtime-generated decision** (`ROADMAP.md` 2.4) interacts with the
  office-scale direction's "the org pre-exists and persists" premise — see doc 01's open
  decision on authored vs. runtime-generated-and-persisted offices.

## Two design decisions that gate who builds what

1. **Where does the department → capability/medium mapping live** — authored in Terrarium
   (pack-portable) or sim-side config? (Doc 02.)
2. **Is organizational distance structural or spatial** — org-chart distance, layout
   (wing-to-wing) distance, or both? Decides which structure Terrarium must emit. (Docs 01/02/04.)

## Sequencing

All of this is **downstream of the sim proving the harvest atom is fun** (see the sim-side
Build 0.4 order). It is not urgent. But two items are **parallel-safe and worth landing
early**, because they ride work already on the critical path:

- **Structured + mutable `department` field** (doc 03) — land it **when the scenario-template
  export ships** (doc 04, already needed for the sim's casting epic), so nothing has to be
  migrated from free text later. This is the cheap-insurance item.
- **Scenario-template export** (doc 04) — the sim's casting epic needs it regardless of office
  scale; keep it one synchronized contract.

## Status

DRAFT, ready for decomposition into epics/features/stories and import into the new GitHub
project. Nothing here is built yet; these docs hold the scope and the seams.
