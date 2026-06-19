# Epic 1 Feature Breakdown - Multi-Department Office Layout

Project phase: Office-Scale Authoring (Terrarium studio)
Planning intent: Extend Terrarium's office-layout generator from a single flat office (all non-manager cast in one cubicle-farm) to a multi-department organization — distinct department wings, per-department desks, and explicit connectivity between wings — so The Water Cooler can reveal the office wing by wing, spawn each department into its own space, and derive organizational distance.
Prototype estimate: extend `src/core/layout.ts` and `office-layout.json` (§3.4) with department/wing grouping, per-wing desk anchors, and a wing-adjacency block, on the existing template set.
MVP estimate: scalable multi-floor/composed footprints, the matching C# runtime-port parity, and golden-layout tests across all department configurations.

## Purpose

Make the authored office a multi-department organization rather than a single flat room set. This is the heaviest lift in the office-scale set and the structural foundation the org chart (Epic 2), population (Epic 3), and cross-department casting (Epic 4) build on. It serves sim epics E38 and E39 and supplies the spare desk capacity the sim's transfer mechanic (E41) needs.

## Feature Sequence

| Order | Code | Feature | Depends On | Purpose |
|---:|---|---|---|---|
| 1 | F1.1 | Department Wing Grouping | none | Group rooms under a department so a wing is an addressable layout unit, in the model and `office-layout.json`. |
| 2 | F1.2 | Per-Department Desk Anchors | F1.1 | Resolve `desk:<agentId>` anchors in each department's wing, with spare/dynamic capacity for later transfers. |
| 3 | F1.3 | Wing Connectivity Graph | F1.1 | Emit explicit wing adjacency/connectivity so the sim can compute reveal order and spatial distance. |
| 4 | F1.4 | Footprint Scaling | F1.1 | Grow the layout footprint so multiple department wings fit without crowding. |
| 5 | F1.5 | Runtime-Port Parity And Golden Tests | F1.1, F1.2, F1.3, F1.4 | Mirror the multi-department changes in the C# runtime port and lock them with golden-layout tests. |

Epic 1 goal:

```text
Terrarium generates an office with distinct department wings, per-wing desks, and explicit
wing connectivity, exported in office-layout.json — the structural foundation the org chart,
population, and cross-department casting build on.
```

Epic 1 exit question:

```text
Can the studio generate and export a multi-department office — wings, per-wing desks, and
adjacency — that the sim can reveal wing by wing and measure distance across, without breaking
the single-office templates?
```

## Feature Definitions

### F1.1 - Department Wing Grouping

Project phase: Office-Scale Authoring (Terrarium studio)
Planning intent: Introduce the department/wing as a first-class layout grouping so rooms belong to a department and a wing can be addressed as a unit.
Prototype estimate: add a department grouping to the layout model and a `departmentId` on rooms (or a `wings[]` block) in `office-layout.json`, over the existing templates.
MVP estimate: department-driven template composition where each wing is generated from a department profile.
Goal: Make the office layout express which rooms form which department's wing.
Feature scope:
- A department/wing grouping concept in the `layout.ts` model.
- `departmentId` per room (or an explicit `wings[]`/`roomGroups[]` block) in `office-layout.json`.
- Backward-compatible default so existing single-office templates still export (one implicit wing).
- A schema version bump documented in `CONTRACT.md` §7.
Done when:
- A generated office groups its rooms under named departments in `office-layout.json`.
- Existing single-office templates still export with no consumer-visible change.
- The new grouping is additive and version-documented.
Exit question:

```text
Does office-layout.json express department/wing grouping over rooms without breaking the single-office templates?
```

### F1.2 - Per-Department Desk Anchors

Project phase: Office-Scale Authoring (Terrarium studio)
Planning intent: Generalize desk anchoring so each department seats its own people, instead of every desk living in one cubicle-farm — and leave headroom for agents transferred in later.
Prototype estimate: resolve `desk:<agentId>` anchors within each wing's seating area; add a small pool of unassigned desk anchors per wing.
MVP estimate: dynamic anchor assignment that provisions a desk on demand when an agent joins or transfers into a wing.
Goal: Seat each department's cast in its own wing, with spare capacity for transfers.
Feature scope:
- Per-wing `desk:<agentId>` anchor resolution (generalize beyond cubicle-farm).
- Deterministic desk ordering within a wing (preserve the seeded, reproducible contract).
- Spare/unassigned desk anchors per wing so a later transfer has somewhere to sit (serves sim E41).
- Anchor metadata identifying which wing/department a desk belongs to.
Done when:
- Each department's agents resolve to desks inside that department's wing.
- A generated wing exposes at least one spare desk anchor for later assignment.
- Desk ordering stays deterministic for a given seed.
Exit question:

```text
Do agents seat in their own department's wing, with spare desk capacity exposed for transfers?
```

### F1.3 - Wing Connectivity Graph

Project phase: Office-Scale Authoring (Terrarium studio)
Planning intent: Emit how wings connect, so the sim can decide reveal order under fog-of-war and compute spatial distance between wings.
Prototype estimate: derive a wing-adjacency graph from shared hallways/doorways and write it into `office-layout.json`.
MVP estimate: weighted connectivity (walk cost between wings) feeding an organizational-distance metric.
Goal: Make wing-to-wing connectivity an explicit, exported artifact.
Feature scope:
- A wing-adjacency/connectivity block in `office-layout.json`.
- Derivation from the generated hallway/doorway topology.
- A connectivity representation the sim can read as both reveal-order and distance input.
Done when:
- `office-layout.json` includes an explicit wing-connectivity graph.
- Every wing is reachable from every other wing in the graph.
- The connectivity matches the generated door/hallway topology.
Exit question:

```text
Does the export describe wing connectivity well enough to drive both fog-of-war reveal order and distance?
```

### F1.4 - Footprint Scaling

Project phase: Office-Scale Authoring (Terrarium studio)
Planning intent: Grow the layout footprint past the fixed 22x14 single-office grid so multiple department wings fit without crowding.
Prototype estimate: parameterize the grid size and pack multiple wings into a larger single grid.
MVP estimate: multi-floor or composed sub-office footprints for large organizations.
Goal: Fit a multi-department office in a footprint that scales with department count.
Feature scope:
- Parameterized/scalable grid (or wing composition) replacing the fixed 22x14 assumption.
- Wing placement that keeps shared-edge room rules and single walls intact.
- Determinism preserved: same template + seed + department set yields the same office.
Done when:
- An office with several department wings generates without overlap or crowding.
- Shared-edge/single-wall invariants still hold across wings.
- Generation stays deterministic for a fixed seed and department set.
Exit question:

```text
Can the footprint hold several department wings while preserving the layout invariants and determinism?
```

### F1.5 - Runtime-Port Parity And Golden Tests

Project phase: Office-Scale Authoring (Terrarium studio)
Planning intent: Keep the tool and the planned C# runtime generator identical, and lock multi-department generation against regressions.
Prototype estimate: mirror F1.1-F1.4 in the C# `OfficeLayoutGenerator` port (ROADMAP 2.4) and add golden-layout snapshots for representative department configurations.
MVP estimate: a shared determinism/parity harness comparing tool and runtime output bit-for-bit (or engine-local seed parity, per the 2.4 decision).
Goal: Ensure authored and runtime offices match, and guard multi-department generation.
Feature scope:
- Port F1.1-F1.4 changes into the C# runtime layout generator (coordinate with ROADMAP 2.4).
- Golden-layout tests for representative multi-department configurations.
- A parity check (or documented engine-local-seed divergence) between tool and runtime output.
Done when:
- The runtime port produces the same multi-department structure the tool exports (or divergence is documented and intended).
- Golden-layout tests cover the multi-department cases and fail on regression.
Exit question:

```text
Do the tool and the runtime port agree on multi-department generation, with golden tests guarding it?
```
