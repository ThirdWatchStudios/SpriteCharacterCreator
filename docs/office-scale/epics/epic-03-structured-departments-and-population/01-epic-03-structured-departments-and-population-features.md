# Epic 3 Feature Breakdown - Structured Departments And Population Generation

Project phase: Office-Scale Authoring (Terrarium studio)
Planning intent: Make `department` a structured, mutable field and generate whole departments as bounded social clusters — legibly-distinct full personas with intra-department ties pre-wired and plausible inter-department ties — so The Water Cooler's cast can grow as a persistent core plus a departmental periphery.
Prototype estimate: replace free-text `department` with a catalog id, couple the existing employee generator with the persona-template archetypes, and generate the relationship graph at org scale.
MVP estimate: department-flavored archetype generation, a tuned inter-department relationship graph, and coverage validation against the scenario-template library.

## Purpose

Supply the cast-novelty engine the office-scale direction needs: a frozen small cast plateaus no matter how many scenario templates exist, so Terrarium must generate distinct departments of real people that the player meets as the office is revealed. Builds on the shipped Office Population Generator (department visual DNA) and the DRAFT persona-template model. Serves sim epic E39 and supplies the mutable `department` field the sim's transfer (E41) needs.

## Feature Sequence

| Order | Code | Feature | Depends On | Purpose |
|---:|---|---|---|---|
| 1 | F3.1 | Structured And Mutable Department Field | none | Replace free-text `department` with a mutable catalog id; migrate existing data. |
| 2 | F3.2 | Department-Aware Persona Generation | F3.1 | Generate legibly-distinct full personas per department, not just visual DNA. |
| 3 | F3.3 | Relationship-Graph Generation | F3.2 | Pre-wire intra-department and plausible inter-department relationships at scale. |
| 4 | F3.4 | Department-Tagged Spawn | F3.1 | Spawn each generated agent into its department's wing. |
| 5 | F3.5 | Cast And Scenario Coverage Validation | F3.2, F3.3 | Flag when a generated org cannot satisfy enough scenario-template preconditions. |

Epic 3 goal:

```text
Terrarium generates whole departments of legibly-distinct personas with pre-wired relationships
and a structured, mutable department field — the populated org the sim reveals and casts onto.
```

Epic 3 exit question:

```text
Can the studio generate a multi-department org of distinct people with a coherent relationship
graph, on a structured/mutable department field, that satisfies the scenario-template library?
```

## Feature Definitions

### F3.1 - Structured And Mutable Department Field

Project phase: Office-Scale Authoring (Terrarium studio)
Planning intent: Replace today's immutable free-text `department` with a structured catalog id that the sim can reassign at runtime (for transfers).
Prototype estimate: change `identity.department` and `metadata.department` to a department catalog id; add a migration from free text; document mutability for the sim.
MVP estimate: tooling that maintains referential integrity when a department is renamed or split.
Goal: Make department a first-class, mutable, referencable property.
Feature scope:
- `department` becomes a catalog id (referencing the Epic 2 catalog) on personas and generated employees.
- Mutability documented so the sim's transfer (E41) can reassign it.
- A migration from existing free-text department values.
- The cheap-insurance ordering note: land this when the scenario-template export (Epic 4) ships.
Done when:
- `department` is a structured catalog id on personas and generated employees.
- Existing free-text values are migrated with no data loss.
- The contract documents the field and its mutability.
Exit question:

```text
Is department a structured, mutable catalog id with existing data migrated?
```

### F3.2 - Department-Aware Persona Generation

Project phase: Office-Scale Authoring (Terrarium studio)
Planning intent: Generate full personas (drives/traits/needs/axes) per department, not just visual DNA, by coupling the employee generator with the persona-template archetypes.
Prototype estimate: wire `docs/persona-template-model.md` archetypes into the population generator so a generated department yields coherent, distinct full personas.
MVP estimate: department archetype sets so a generated IT cohort reads differently from a Sales cohort.
Goal: Produce legibly-distinct full personas per department at scale.
Feature scope:
- Promote the persona-template model from DRAFT and wire it to department generation.
- Generated departments yield full personas, not just sprites + metadata.
- Distinctiveness controls (trait/drive spread) so a cohort reads as specific people.
- Decision: department-flavored archetypes vs. generic spread tagged by department.
Done when:
- Generating a department yields coherent, legibly-distinct full personas.
- The personas carry drives/traits/needs/axes, not just visual DNA.
- The archetype-flavor decision is implemented and documented.
Exit question:

```text
Does generating a department produce distinct full personas, not just visual DNA?
```

### F3.3 - Relationship-Graph Generation

Project phase: Office-Scale Authoring (Terrarium studio)
Planning intent: Populate the org's relationship graph at scale — the cluster already knows itself, and plausible cross-department ties exist — reusing the existing any-to-any relationship model.
Prototype estimate: generate intra-department ties (dense) and a plausible sparser inter-department graph using the relationship-type catalog and third-party coupling.
MVP estimate: tunable graph shape (density, type mix) and seeded reproducibility.
Goal: Give a generated org a coherent, plausible relationship graph.
Feature scope:
- Intra-department relationship generation (the cluster is pre-wired).
- Plausible inter-department relationship generation.
- Use of existing relationship types and third-party (jealousy) coupling; no new relationship model.
- Determinism for a given seed.
Done when:
- A generated org has dense intra-department ties and plausible inter-department ties.
- The graph uses the existing relationship-type catalog.
- Generation is deterministic for a fixed seed.
Exit question:

```text
Does a generated org have a coherent intra- and inter-department relationship graph?
```

### F3.4 - Department-Tagged Spawn

Project phase: Office-Scale Authoring (Terrarium studio)
Planning intent: Spawn each generated agent into its department's wing instead of all into cubicle-farm.
Prototype estimate: bind generation output to the per-wing desk anchors from Epic 1.
MVP estimate: balancing so wings are populated to plausible occupancy.
Goal: Seat generated agents in their own department's wing.
Feature scope:
- Each generated agent spawns into its department's wing (consumes Epic 1 per-wing desks).
- Spawn respects per-wing desk capacity and leaves transfer headroom.
- Spawn placement is deterministic for a given seed.
Done when:
- Generated agents seat in their department's wing, not a single shared room.
- Spawn respects wing desk capacity.
- Placement is deterministic for a fixed seed.
Exit question:

```text
Do generated agents spawn into their own department's wing?
```

### F3.5 - Cast And Scenario Coverage Validation

Project phase: Office-Scale Authoring (Terrarium studio)
Planning intent: Flag a cast/scenario-library mismatch before play — that a generated org can satisfy enough scenario-template preconditions to stay playable.
Prototype estimate: extend `analyzeTemplateCoverage` to check the generated org against the scenario-template library and report gaps.
MVP estimate: suggested generation adjustments when coverage is thin.
Goal: Catch unplayable orgs before export.
Feature scope:
- Coverage analysis of a generated org against the scenario-template library.
- A mismatch report naming under-covered templates/roles.
- Hook into the existing `analyzeTemplateCoverage` path and `CONTRACT.md` §6 open questions.
Done when:
- The studio reports whether a generated org satisfies enough template preconditions.
- A thin-coverage org is flagged with the specific gaps.
Exit question:

```text
Can the studio flag a cast/scenario-library mismatch before the org is exported?
```
