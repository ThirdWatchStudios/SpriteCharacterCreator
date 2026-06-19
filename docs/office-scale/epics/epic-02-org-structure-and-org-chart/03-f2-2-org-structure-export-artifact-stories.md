# F2.2 Org-Structure Export Artifact - Stories

### S2.2.1 - Export org-structure.json

User story:
- As the sim, I need an `org-structure.json` listing departments and their members so I can render the organization.

Acceptance criteria:
- `org-structure.json` lists every department (by catalog id) and its members (by agentId).
- The artifact ships in the scenario package bundle.
- The payload and a schema bump are documented in `CONTRACT.md` §3.x and §7.

Dependencies:
- F2.1.

### S2.2.2 - Separate Visible Structure From Fogged Contents

User story:
- As the sim's fog-of-war, I need the visible structure separated from the fogged contents so I can show the chart without leaking who is inside.

Acceptance criteria:
- The artifact distinguishes structure the player can see (departments exist, labels) from contents to fog (members, ties).
- The sim can load the structure without the member roster.
- The separation is documented as part of the contract.

Dependencies:
- S2.2.1.
