# F3.3 Relationship-Graph Generation - Stories

### S3.3.1 - Generate Intra-Department Relationships

User story:
- As the sim, I need each generated department pre-wired with internal relationships so a newly-revealed wing already knows itself.

Acceptance criteria:
- Generated departments have dense, plausible internal ties using existing relationship types.
- Ties include third-party (jealousy) coupling where relationship types declare it.
- Generation is deterministic for a given seed.

Dependencies:
- F3.2.

### S3.3.2 - Generate Plausible Inter-Department Relationships

User story:
- As the cross-department casting layer, I need plausible ties across departments so cross-wing pairings have material to work with.

Acceptance criteria:
- A sparser, plausible inter-department relationship graph is generated.
- Graph shape (density, type mix) is tunable.
- The combined graph uses only the existing relationship-type catalog.

Dependencies:
- S3.3.1.
