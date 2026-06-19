# F4.2 Department-Aware Preconditions - Stories

### S4.2.1 - Add Department-Membership Predicates

User story:
- As a template author, I need to require or forbid a department on a role slot so a scenario can target specific departments.

Acceptance criteria:
- A role slot can require or forbid membership in a given department.
- `castTemplate` and `validateScenarioTemplate` honor the predicate.
- The predicate is documented in the shared precondition vocabulary.

Dependencies:
- F4.1.

### S4.2.2 - Add A Different-Department Predicate

User story:
- As a template author, I need to require two slots be in different departments so I can express the core cross-wing pairing.

Acceptance criteria:
- A predicate requires two slots resolve to different departments.
- Casting rejects same-department fills for that predicate.
- The predicate is shared and documented with the sim.

Dependencies:
- S4.2.1.
