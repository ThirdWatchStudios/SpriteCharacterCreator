# F3.4 Department-Tagged Spawn - Stories

### S3.4.1 - Spawn Generated Agents Into Their Wing

User story:
- As the sim, I need each generated agent to spawn into its department's wing so the office reads as departments, not one shared room.

Acceptance criteria:
- Generated agents bind to per-wing desk anchors from Epic 1, in their own department's wing.
- Spawn respects per-wing desk capacity and leaves transfer headroom.
- Placement is deterministic for a fixed seed.

Dependencies:
- F3.1.

### S3.4.2 - Balance Wing Occupancy

User story:
- As an author, I need wings populated to plausible occupancy so no wing reads as empty or overstuffed.

Acceptance criteria:
- Generation fills wings to a plausible occupancy band.
- Over-capacity generation is reported rather than silently overflowing.
- Occupancy is reproducible for a given seed.

Dependencies:
- S3.4.1.
