# F1.4 Footprint Scaling - Stories

### S1.4.1 - Parameterize The Layout Footprint

User story:
- As a Terrarium developer, I need the layout footprint to scale past the fixed 22x14 grid so several department wings fit without crowding.

Acceptance criteria:
- The grid size (or a wing-composition footprint) is parameterized, not hardcoded to 22x14.
- A multi-wing office generates without room overlap or crowding.
- Determinism holds: same template, seed, and department set yield the same office.

Dependencies:
- F1.1.

### S1.4.2 - Preserve Layout Invariants Across Wings

User story:
- As a maintainer, I need the shared-edge and single-wall invariants preserved across wings so the larger footprint does not introduce double walls or gaps.

Acceptance criteria:
- Adjacent rooms across wings share edges (no double walls, no gaps), matching the single-office rule.
- Doorways stay single-tile and badge-reader pairing still applies.
- Golden/snapshot checks for the invariants pass on multi-wing offices.

Dependencies:
- S1.4.1.
