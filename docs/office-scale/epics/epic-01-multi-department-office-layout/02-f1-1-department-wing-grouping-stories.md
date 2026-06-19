# F1.1 Department Wing Grouping - Stories

### S1.1.1 - Add Department/Wing Grouping To The Layout Model

User story:
- As a Terrarium developer, I need a department/wing grouping in the `layout.ts` model so rooms can belong to a department and a wing can be addressed as a unit.

Acceptance criteria:
- The layout model represents a department/wing as a named group of rooms.
- Every room resolves to exactly one wing (single-office offices map to one implicit wing).
- The grouping is deterministic for a given template and seed.

Dependencies:
- None.

### S1.1.2 - Emit Wing Grouping In office-layout.json

User story:
- As the sim consuming the export, I need wing grouping in `office-layout.json` so I can address departments and their rooms.

Acceptance criteria:
- `office-layout.json` carries `departmentId` per room (or an explicit `wings[]`/`roomGroups[]` block).
- The addition is additive; existing fields are unchanged.
- The export round-trips: a generated office re-exports with identical wing grouping for a fixed seed.

Dependencies:
- S1.1.1.

### S1.1.3 - Preserve Single-Office Compatibility And Version The Schema

User story:
- As a maintainer, I need existing single-office templates to keep exporting unchanged so the grouping work does not regress the current pipeline.

Acceptance criteria:
- Existing single-office templates export with one implicit wing and no consumer-visible change to prior fields.
- The schema version is bumped and the change documented in `CONTRACT.md` §7.
- Compositor/layout snapshot tests still pass for the single-office templates.

Dependencies:
- S1.1.2.
