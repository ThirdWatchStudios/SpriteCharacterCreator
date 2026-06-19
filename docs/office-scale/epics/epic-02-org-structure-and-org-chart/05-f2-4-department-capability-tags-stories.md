# F2.4 Department Capability Tags - Stories

### S2.4.1 - Resolve The Capability-Mapping Home Decision

User story:
- As the team, I need the "capability/medium mapping home" decision resolved (authored in Terrarium vs. sim-side config) so this feature is either built or explicitly deferred, not half-done.

Acceptance criteria:
- The decision is recorded with its rationale.
- If sim-side, this feature is marked deferred and the remaining story is not started.
- If Terrarium-side, the capability vocabulary is agreed with the sim team.

Dependencies:
- F2.1.

### S2.4.2 - Attach Capability/Medium Tags Per Department

User story:
- As the sim's clearance/medium model, I need departments to carry capability/medium tags (IT to email/logs, HR to records) so reaching a department can grant a medium.

Acceptance criteria:
- Departments can carry optional capability/medium tags surfaced in `org-structure.json`.
- The capability vocabulary is shared and documented with the sim.
- Tags are optional and absent-safe for departments that grant nothing.

Dependencies:
- S2.4.1.

Placeholder / deferred notes:
- Conditional on the capability-mapping-home decision landing Terrarium-side.
