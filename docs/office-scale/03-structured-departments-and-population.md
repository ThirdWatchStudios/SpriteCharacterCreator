# 03 — Structured Departments & Population Generation

**Status: DRAFT for decomposition.** Serves sim epic **E39** (department population & cast
growth); also supplies the **mutable structured department** E41 (transfer) needs.

## Purpose

The office-scale direction grows the cast as a **persistent core + departmental periphery**, so
a long playthrough does not exhaust itself recombining scenario templates onto the same few
people. Terrarium must (a) make `department` a **structured, mutable** property, and (b) generate
whole departments as **bounded social clusters** — legibly-distinct personas with intra-department
ties pre-wired and plausible inter-department ties — at org scale.

## Current state in Terrarium

- **Department-aware *visual* generation already ships** (Office Population Generator, DONE):
  per-department part-weight profiles, bulk `generatePopulation` with uniqueness, and
  `EmployeeDefinition.metadata { department, role, agentId, displayName }`. But:
  - `department` is **flat free-text metadata**, not a structured catalog id, and **immutable**.
  - it generates **visual DNA + basic metadata**, not full personas (drives/traits/needs) or
    relationships.
- **Persona templates** (`docs/persona-template-model.md`, DRAFT) can stamp out coherent personas
  from seeded archetypes — designed, but not wired to department generation or export.
- **Relationships** already support **any-to-any** edges with rich types (§3.7) — the model is
  not the blocker; generation just has to populate the graph.

## Scope (what to build)

- **Structured + mutable `department` field**: replace free text with a catalog id (into the
  department catalog from doc 02), and make it mutable so the sim's transfer (E41) can reassign
  it at runtime.
- **Department-aware persona generation at scale**: couple the existing employee/visual generator
  with the persona-template archetypes so a generated department yields **legibly-distinct full
  personas** (drives/traits/needs/axes), not just sprites. Decide how department-flavored the
  archetypes are (e.g. department archetype sets) vs. a generic spread tagged by department.
- **Pre-wired relationship graph**: generate intra-department ties (the cluster already knows
  itself) and plausible inter-department ties, at org scale, using the existing relationship-type
  catalog and third-party coupling.
- **Department-tagged spawn**: each generated agent spawns into its department's wing (consumes
  doc 01's per-wing desks).
- **Coverage validation**: flag a cast/scenario-library mismatch before play — that a generated
  org can satisfy enough scenario-template preconditions to stay playable (extends the
  `analyzeTemplateCoverage` path and `CONTRACT.md` §6 open questions).

## Contract impact

- `profile.json` / `employees.json` `department` becomes a structured id (referencing doc 02's
  catalog); document mutability expectation for the sim. Schema bump.
- Generated personas + relationships flow through the existing export shapes (§3.2, §3.7) — no
  new payload, just generation reach and the structured field.

## Dependencies & coordination

- **Doc 02** (department catalog the field references; org structure the population fills).
- **Doc 01** (per-wing desks to spawn into).
- **Persona-template model** (`docs/persona-template-model.md`) — promote from DRAFT and wire to
  department generation.
- The structured/mutable field is the **cheap-insurance item**: land it **when the
  scenario-template export ships** (doc 04) so nothing migrates from free text later.

## Open decisions

- Department archetypes (department-flavored generation) vs. generic spread tagged by department.
- The core/periphery boundary and any churn policy (mostly sim-side, but generation must support
  a stable core + addable periphery).
- Density/shape of the generated inter-department relationship graph.

## Candidate features (decomposition seeds)

- Structured + mutable `department` field (catalog id) + migration from free text.
- Department-aware full-persona generation (employee generator × persona templates).
- Intra/inter-department relationship-graph generation.
- Department-tagged spawn into wings.
- Cast/scenario-library coverage validation + mismatch flagging.
