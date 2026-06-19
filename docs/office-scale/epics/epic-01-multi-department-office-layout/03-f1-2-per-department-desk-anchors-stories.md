# F1.2 Per-Department Desk Anchors - Stories

### S1.2.1 - Resolve Desk Anchors Within Each Wing

User story:
- As the sim binding agents to seats, I need `desk:<agentId>` anchors resolved inside each department's wing so each department seats its own people.

Acceptance criteria:
- `desk:<agentId>` anchors resolve within the wing the agent belongs to, not only in cubicle-farm.
- Desk ordering within a wing is deterministic for a given seed.
- Each desk anchor carries its wing/department identity in its metadata.

Dependencies:
- F1.1.

### S1.2.2 - Provision Spare Desk Capacity Per Wing

User story:
- As the sim's transfer mechanic (E41), I need spare desk capacity in a wing so an agent transferred in later has somewhere to sit.

Acceptance criteria:
- Each generated wing exposes at least one unassigned desk anchor.
- Spare anchors are addressable so a later assignment can bind an agent to one.
- Spare capacity does not break the deterministic desk ordering of assigned agents.

Dependencies:
- S1.2.1.

### S1.2.3 - Validate Desk Coverage Per Wing

User story:
- As an author, I need the studio to flag when a wing cannot seat its assigned cast so I catch capacity problems before export.

Acceptance criteria:
- Validation fails (or warns) when a wing has fewer desks than assigned agents.
- The message names the wing and the shortfall.
- Validation passes for every shipped template at its default population.

Dependencies:
- S1.2.1.
