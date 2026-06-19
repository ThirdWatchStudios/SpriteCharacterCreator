# 04 — Scenario-Template Export & Department-Aware Preconditions

**Status: DRAFT for decomposition.** Serves sim epic **E40** (cross-department casting) and is
the shared prerequisite for the sim's **Scenario Loading / casting** epics (E30 generalize + E34).

## Purpose

Cross-department scenarios are the payoff of office scale: "these two would pair beautifully" is a
high role-precondition fit that happens to span wings, with the emotional payload scaling with
compatibility and the difficulty scaling with **organizational distance**. For that to work, the
sim must consume **scenario templates** (not just bound scenarios), and the precondition vocabulary
must be able to talk about **department** and **distance**.

## Current state in Terrarium

- **Scenario templates exist tool-side** (`src/core/scenarioTemplate.ts`,
  `docs/scenario-template-model.md`, DONE): cast-agnostic role slots + per-slot preconditions
  (over traits/drives/relationship axes/OCEAN + game axes/needs), `castTemplate`,
  `validateScenarioTemplate`, `analyzeTemplateCoverage`, the reference `THE_OFFICE_ROMANCE`.
- **But `scenario-template.json` is authoring-only** (`CONTRACT.md` §3.8): the tool can cast a
  template into a bound scenario at authoring time, but the **sim does not consume the template
  artifact** — runtime casting is the separate, not-yet-built sim epic (§5.7).
- Preconditions are **not department-aware** and have **no notion of organizational distance**.

## Scope (what to build)

- **Make `scenario-template.json` a first-class exported + consumed artifact**: align the tool's
  export (§3.8) with the sim's runtime caster so templates load and cast at runtime. Keep it
  **one synchronized contract** with the sim's casting epic — do not let the tool template format
  and the sim caster diverge.
- **Department-aware preconditions**: extend the precondition vocabulary so a role slot can require
  (or forbid) a department, or require two slots to be in **different** departments — the core
  cross-wing pairing expression.
- **Organizational-distance preconditions/cost**: let a template express a distance condition or a
  distance-scaled cost, consuming the distance signal (structural from doc 02 or spatial from doc
  01, per the open decision).
- **Coverage at org scale**: `analyzeTemplateCoverage` should account for department/distance
  preconditions when checking whether the current org can satisfy a template library (ties to doc
  03's coverage validation).

## Contract impact

- `CONTRACT.md` §3.8 graduates from "authoring-only today" to an exported/consumed artifact;
  §5.7 (sim-owned future casting) becomes active and must be co-specified with the sim.
- Precondition schema gains department + distance terms. Schema bump.

## Dependencies & coordination

- **Tight coordination with the sim** (E30 generalize + E34 + E40): this is a two-sided contract;
  the tool's template export and the sim's caster are halves of one bridge.
- **Doc 02 / Doc 01** for the distance signal the distance precondition reads.
- **Doc 03** for the populated org the templates cast onto.

## Open decisions

- **Distance is structural or spatial** (shared gating decision) — determines what the distance
  precondition reads.
- Precondition language for "different department" / "distance ≥ N" — exact vocabulary, shared with
  the sim's precondition contract.
- How much of the runtime caster is co-built now vs. when the sim's casting epic runs.

## Candidate features (decomposition seeds)

- `scenario-template.json` as an exported, sim-consumed artifact (contract co-spec with sim).
- Department precondition terms (require/forbid/different-department).
- Organizational-distance precondition / cost term.
- Coverage analysis accounting for department + distance.
- Reference cross-department template (a cross-wing analog of `THE_OFFICE_ROMANCE`).
