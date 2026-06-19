# F2.5 Org-Structure Validation - Stories

### S2.5.1 - Validate Department And Reporting Integrity

User story:
- As an author, I need export blocked on a broken org structure so the sim never loads an inconsistent chart.

Acceptance criteria:
- Every agent's department resolves to a catalog id; unresolved members are reported.
- Every department has a head and every report has a manager; violations are named.
- No dangling members, departments, or reporting links pass validation.

Dependencies:
- F2.2.
- F2.3.

### S2.5.2 - Pass Validation On All Sample Organizations

User story:
- As a maintainer, I need every shipped sample organization to pass org-structure validation so the examples stay trustworthy.

Acceptance criteria:
- All shipped sample organizations pass validation.
- A deliberately broken fixture fails with the expected message.
- Validation runs in the existing test harness.

Dependencies:
- S2.5.1.
