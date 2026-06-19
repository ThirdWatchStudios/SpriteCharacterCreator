# 02 — Org Structure & Org-Chart Artifact

**Status: DRAFT for decomposition.** Serves sim epic **E38** (org chart & departmental reach).

## Purpose

The office-scale direction's core surface is an **org chart whose structure is visible while
its contents stay fogged** — the player sees that an IT department exists and roughly what
reaching it buys, but the people inside stay dark until access is granted. Terrarium must author
and export that structure: departments as **first-class units**, their membership, reporting
lines, and (decision-dependent) the capability each grants.

## Current state in Terrarium

- `department` exists only as a **free-text** `identity` field on a persona (`CONTRACT.md` §3.2)
  and as `metadata.department` on generated employees. It carries no structure — no department
  roster, no hierarchy, no capability, no artifact.
- The Office Population Generator has department **generation profiles** (random/accounting/IT/
  HR/management) but those are visual-DNA weights, not an org model.
- There is **no org-structure / org-chart export** of any kind.

## Scope (what to build)

- **Department as a first-class unit**: a structured entity (id, label, category) defining the
  organization's departments — the catalog the structured-department field (doc 03) references.
- **Org-structure / org-chart artifact**: a new export declaring departments, their **members**,
  and **reporting lines** (manager → reports). The reporting graph can derive from the existing
  manager/direct-report **relationship types** (§3.7) or be authored explicitly — decide which.
- **Known-structure / fogged-contents shape**: the artifact should cleanly separate the
  *structure* the player can see (departments exist, their names, what they administer) from the
  *contents* the sim keeps fogged (who is in them, their ties).
- **Department → capability/medium tags (decision-gated)**: if capability mapping is authored in
  Terrarium (IT → email/logs, HR → records, Facilities → badge/camera), attach those tags to
  each department here.

## Contract impact

- New payload: `org-structure.json` (or `departments.json` + a chart block) under a new
  `CONTRACT.md` §3.x, project-level (travels with the bundle like the drives/traits/
  relationshipTypes catalogs).
- Schema bump; document compatibility (§7).

## Dependencies & coordination

- Provides the **department catalog** doc 03's structured field references.
- Provides the **wing grouping ids** doc 01 groups rooms by.
- Provides the **structural distance** signal doc 04 may use for cross-department preconditions.

## Open decisions

- **Capability/medium mapping home** (authored here vs. sim-side config) — the gating decision
  for whether the capability tags belong in this artifact.
- **Reporting lines**: derive from manager/direct-report relationship edges, or author an
  explicit hierarchy? (Affects whether this is mostly a *view* over existing data or new
  authored content.)
- How much of the chart is authored vs. generated alongside the population (doc 03).

## Candidate features (decomposition seeds)

- Department entity + project-level department catalog.
- `org-structure.json` export (departments, members, reporting lines).
- Manager/report hierarchy derivation from relationship edges (or explicit authoring).
- Department capability/medium tags (if authored-in-Terrarium is chosen).
- Validation: every agent's department resolves; every department has a head; no dangling
  reports.
