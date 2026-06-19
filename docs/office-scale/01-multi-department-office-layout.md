# 01 — Multi-Department Office Layout

**Status: DRAFT for decomposition.** Serves sim epics **E38** (org chart & reach) and
**E39** (department population); also supplies the **spare desk capacity** E41 (transfer)
needs. **Heaviest lift** in the office-scale set.

## Purpose

Today the layout generator produces a single flat office with every non-manager seated in
one `cubicle-farm`. The office-scale direction needs a layout that expresses a **multi-wing
organization**: distinct department wings/room-groups, each with its own desks, and explicit
**connectivity between wings** — so the sim can (a) reveal the office wing by wing under
fog-of-war, (b) spawn each department into its own space, and (c) derive **organizational
distance** between agents in different wings.

## Current state in Terrarium

- `src/core/layout.ts`: 5 shared-edge room templates on a fixed 22×14 grid; rooms are generic
  named locations (reception, manager-office, break-room, cubicle-farm, hallway, …). All desks
  are in `cubicle-farm`; `desk:<agentId>` anchors are resolved there only.
- `office-layout.json` (`CONTRACT.md` §3.4): `rooms`, `roomGrid`, `floors`, `walls`, `props`,
  `characterSpawns`, `anchors` (`kind: "room" | "desk"`), `interactionAnchors`.
- A **C# runtime port** is planned (`ROADMAP.md` 2.4): offices generate at runtime in Unity;
  the tool's layout JSON becomes a debug/golden artifact, not the shipping path.

## Scope (what to build)

- **Department wings / room-groups** as a layout concept: rooms grouped under a department, so
  a wing is an addressable unit, not just a loose set of rooms.
- **Per-department desks**: `desk:<agentId>` anchors resolvable in each department's wing, not
  only `cubicle-farm`. Each department seats its own people.
- **Wing connectivity / adjacency**: an explicit graph (which wings connect to which, via which
  hallways/doors) so the sim can compute reveal order and spatial distance.
- **Larger / scalable footprint**: the fixed 22×14 grid likely needs to grow or compose (a
  bigger grid, multi-floor, or connected sub-offices). Determine the scaling approach.
- **Spare desk / anchor capacity (for E41 transfers)**: each wing should be able to seat an
  agent transferred in later — either pre-provisioned spare desks or dynamic anchor assignment.

## Contract impact

- `office-layout.json` (§3.4) gains department grouping on rooms (e.g. `departmentId` per room
  or a `wings[]`/`roomGroups[]` block), wing adjacency, and per-wing desk anchors. Additive.
- Schema bump (v9 → next); document under `CONTRACT.md` §7 compatibility.

## Dependencies & coordination

- **Both layout paths**: changes must land in the tool's `layout.ts` **and** the planned C#
  runtime port (`ROADMAP.md` 2.4) so authored and runtime offices stay identical.
- Consumes/feeds doc 02 (org structure — the department ids the wings group by) and doc 03
  (which agents seat where).

## Open decisions

- **Authored vs. runtime-generated-and-persisted office.** The office-scale premise is "the
  org pre-exists and persists across the playthrough," which tensions with the 2.4 decision to
  generate offices at runtime. Options: author the multi-department office in the tool and ship
  it; generate at runtime once and persist; or hybrid. **This decision precedes most of the
  layout work** and should be resolved with the sim team.
- Grid scaling approach (bigger single grid vs. multi-floor vs. composed sub-offices).
- Distance model: is organizational distance derived from this layout (spatial) or from the org
  chart (structural)? (Shared with doc 02/04.)

## Candidate features (decomposition seeds)

- Department/wing as a first-class layout grouping in the layout model + JSON.
- Per-wing desk anchor resolution (generalize `desk:<agentId>` beyond cubicle-farm).
- Wing adjacency/connectivity graph in `office-layout.json`.
- Footprint scaling (grid growth / composition).
- Spare-desk / dynamic-anchor capacity for later transfers.
- C# runtime-port parity for all of the above (coordinate with `ROADMAP.md` 2.4).
- Golden-layout tests for multi-department generation.
