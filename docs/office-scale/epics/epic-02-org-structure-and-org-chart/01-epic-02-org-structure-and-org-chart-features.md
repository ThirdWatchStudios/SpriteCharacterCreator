# Epic 2 Feature Breakdown - Org Structure And Org-Chart Artifact

Project phase: Office-Scale Authoring (Terrarium studio)
Planning intent: Author and export the organization's structure — departments as first-class units, their membership, reporting lines, and (decision-dependent) the capability each grants — so the sim can present an org chart whose structure is visible while its contents stay fogged.
Prototype estimate: a project-level department catalog plus a new `org-structure.json` export (departments, members, reporting lines), additive to the contract.
MVP estimate: capability/medium tags per department and a derived-or-authored reporting hierarchy with validation.

## Purpose

Give The Water Cooler the org chart that is the player's route-planning surface: which departments exist and roughly what each buys, while who is inside and how they are tangled stays fogged until reached. Terrarium owns the structure (departments, members, reporting lines); the sim owns the fog and the reach. Serves sim epic E38.

## Feature Sequence

| Order | Code | Feature | Depends On | Purpose |
|---:|---|---|---|---|
| 1 | F2.1 | Department Entity And Catalog | none | A project-level department catalog (id, label, category) that other artifacts reference. |
| 2 | F2.2 | Org-Structure Export Artifact | F2.1 | Export departments and their members as a first-class `org-structure.json`. |
| 3 | F2.3 | Reporting-Line Hierarchy | F2.2 | Capture manager-to-report lines, derived from relationship edges or authored explicitly. |
| 4 | F2.4 | Department Capability Tags | F2.1 | Attach capability/medium tags per department, if capability mapping is authored in Terrarium. |
| 5 | F2.5 | Org-Structure Validation | F2.2, F2.3 | Validate that departments resolve, every department has a head, and no report dangles. |

Epic 2 goal:

```text
Terrarium exports an org-structure artifact — departments, members, and reporting lines (plus
optional capability tags) — that the sim can render as a known-structure, fogged-contents org
chart.
```

Epic 2 exit question:

```text
Can the studio author and export the organization's structure cleanly enough that the sim can
show the chart while keeping the people inside fogged?
```

## Feature Definitions

### F2.1 - Department Entity And Catalog

Project phase: Office-Scale Authoring (Terrarium studio)
Planning intent: Make a department a structured entity in a project-level catalog, the way drives/traits/relationshipTypes are catalogs today.
Prototype estimate: a `departments.json`-style catalog of `{ id, label, category }`, bundled with the scenario package.
MVP estimate: department metadata (capability tags, generation profile linkage) carried on the catalog entry.
Goal: Define the canonical set of departments the rest of the office-scale work references by id.
Feature scope:
- A department entity (`id`, `label`, `category`).
- A project-level department catalog, bundled with the export package like the other catalogs.
- Reuse of the existing department-name set (the Office Population Generator profiles) as seed data.
Done when:
- A project defines its departments in a catalog with stable ids.
- The catalog ships in the scenario package bundle.
- Existing free-text department names map onto catalog ids.
Exit question:

```text
Is there a project-level department catalog with stable ids the other artifacts can reference?
```

### F2.2 - Org-Structure Export Artifact

Project phase: Office-Scale Authoring (Terrarium studio)
Planning intent: Export the organization's structure as a first-class artifact separating visible structure from fogged contents.
Prototype estimate: an `org-structure.json` listing departments (by catalog id) and their members (by agentId).
MVP estimate: a structure/contents split that lets the sim load the chart without the member roster, for fog-of-war.
Goal: Make the org structure a loadable artifact the sim can render as a chart.
Feature scope:
- `org-structure.json` export: departments and their members.
- A clean separation of the structure the player sees from the contents the sim fogs.
- A new `CONTRACT.md` §3.x payload entry plus a schema bump.
Done when:
- `org-structure.json` lists every department and its members.
- The artifact distinguishes visible structure from fogged contents.
- The contract documents the new payload and version.
Exit question:

```text
Does org-structure.json carry the chart structure with a clean structure/contents separation?
```

### F2.3 - Reporting-Line Hierarchy

Project phase: Office-Scale Authoring (Terrarium studio)
Planning intent: Capture who reports to whom, deciding between deriving the hierarchy from existing manager/direct-report relationship edges and authoring it explicitly.
Prototype estimate: derive reporting lines from the manager/direct-report relationship types (§3.7) into the org-structure artifact.
MVP estimate: explicit hierarchy authoring with validation when derived and authored lines disagree.
Goal: Represent the reporting hierarchy in the org-structure artifact.
Feature scope:
- Reporting lines (manager to reports) in `org-structure.json`.
- Derivation from manager/direct-report relationship edges, or explicit authoring (decide and document which).
- Each department resolving to a head.
Done when:
- The org structure includes reporting lines with a department head per department.
- The derivation/authoring choice is implemented and documented.
- A report with no manager is flagged, not silently dropped.
Exit question:

```text
Does the org structure express reporting lines with a head per department?
```

### F2.4 - Department Capability Tags

Project phase: Office-Scale Authoring (Terrarium studio)
Planning intent: If the team decides capability/medium mapping is authored in Terrarium, attach those tags per department (IT to email/logs, HR to records, Facilities to badge/camera).
Prototype estimate: optional `capabilities` tags on the department catalog entry, surfaced in `org-structure.json`.
MVP estimate: a capability vocabulary shared with the sim's clearance/medium model.
Goal: Let a department declare the surveillance medium/tool it grants, pending the authoring-vs-sim decision.
Feature scope:
- Optional capability/medium tags per department.
- A capability vocabulary the sim's medium axis can consume.
- A clear gate noting this feature is conditional on the "capability mapping home" decision.
Done when:
- Departments can carry capability/medium tags when authored-in-Terrarium is chosen.
- The capability vocabulary is documented and shared with the sim.
- If the decision lands sim-side, this feature is explicitly deferred, not half-built.
Exit question:

```text
Can a department declare its granted capability/medium, contingent on the authoring-home decision?
```

### F2.5 - Org-Structure Validation

Project phase: Office-Scale Authoring (Terrarium studio)
Planning intent: Catch structural problems before export so the sim never loads a broken chart.
Prototype estimate: validation that every agent's department resolves, every department has a head, and no report dangles.
MVP estimate: validation surfaced in the authoring UI with actionable messages.
Goal: Guarantee the exported org structure is internally consistent.
Feature scope:
- Every agent's department resolves to a catalog id.
- Every department has a head; every report has a manager.
- No dangling members, departments, or reporting links.
Done when:
- Export is blocked (or warns) on an inconsistent org structure, naming the problem.
- All shipped sample organizations pass validation.
Exit question:

```text
Does validation guarantee a consistent org structure before it can be exported?
```
