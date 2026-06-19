# F2.3 Reporting-Line Hierarchy - Stories

### S2.3.1 - Capture Reporting Lines In The Org Structure

User story:
- As the sim, I need reporting lines (manager to reports) in the org structure so the chart has a hierarchy and each department has a head.

Acceptance criteria:
- `org-structure.json` includes manager-to-report lines.
- Every department resolves to a head.
- The reporting representation is deterministic for a given project.

Dependencies:
- F2.2.

### S2.3.2 - Decide And Implement Derivation Vs Authoring

User story:
- As a Terrarium developer, I need a decision (and implementation) on whether reporting lines derive from manager/direct-report relationship edges or are authored explicitly, so the source of truth is unambiguous.

Acceptance criteria:
- The derivation-vs-authoring choice is decided and documented.
- The chosen path is implemented; the other is not left half-built.
- A report with no resolvable manager is flagged.

Dependencies:
- S2.3.1.
