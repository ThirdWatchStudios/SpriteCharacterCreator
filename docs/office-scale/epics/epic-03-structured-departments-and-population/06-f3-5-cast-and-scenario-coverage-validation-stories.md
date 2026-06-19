# F3.5 Cast And Scenario Coverage Validation - Stories

### S3.5.1 - Analyze Generated-Org Coverage Against The Template Library

User story:
- As an author, I need the studio to check a generated org against the scenario-template library so I know it can produce playable scenarios before export.

Acceptance criteria:
- Coverage analysis runs a generated org against the scenario-template library.
- The report names under-covered templates and the roles that cannot be filled.
- The analysis reuses the existing `analyzeTemplateCoverage` path.

Dependencies:
- F3.2.
- F3.3.

### S3.5.2 - Flag Thin-Coverage Orgs Before Export

User story:
- As an author, I need a thin-coverage org flagged before export so I do not ship an org that cannot generate scenarios.

Acceptance criteria:
- Export warns (or blocks) when coverage falls below a threshold, naming the gaps.
- A well-covered sample org passes cleanly.
- The check is documented against `CONTRACT.md` §6 open questions.

Dependencies:
- S3.5.1.
