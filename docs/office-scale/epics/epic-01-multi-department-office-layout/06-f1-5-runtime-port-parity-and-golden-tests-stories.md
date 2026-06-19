# F1.5 Runtime-Port Parity And Golden Tests - Stories

### S1.5.1 - Port Multi-Department Generation To The C# Runtime Generator

User story:
- As the game, I need the multi-department changes mirrored in the C# `OfficeLayoutGenerator` port so runtime-generated offices match the authored ones.

Acceptance criteria:
- F1.1-F1.4 (wing grouping, per-wing desks, connectivity, footprint) are implemented in the C# runtime port (ROADMAP 2.4).
- The runtime port produces the same `SpriteToolkitOfficeLayout` shape the tool exports for a department set.
- Any intentional tool/runtime divergence (e.g. engine-local seeds per the 2.4 decision) is documented, not silent.

Dependencies:
- F1.1.
- F1.2.
- F1.3.
- F1.4.

### S1.5.2 - Golden-Layout Tests For Multi-Department Generation

User story:
- As a maintainer, I need golden-layout tests for representative multi-department configurations so generation regressions are caught.

Acceptance criteria:
- Golden snapshots exist for representative multi-department offices (wing grouping, desks, connectivity).
- The tests fail when generation output changes unexpectedly.
- The suite runs in the existing test harness (vitest tool-side; the runtime port's test path Unity-side).

Dependencies:
- S1.5.1.
