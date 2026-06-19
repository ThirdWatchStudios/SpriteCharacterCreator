# F4.5 Reference Cross-Department Template - Stories

### S4.5.1 - Author A Cross-Department Reference Template

User story:
- As a template author, I need a cross-wing reference template (a cross-department analog of THE_OFFICE_ROMANCE) so the new vocabulary is proven with a real example.

Acceptance criteria:
- A reference template requires two slots in different departments and uses a distance term.
- The template casts successfully against a generated multi-department org.
- The template is documented in `docs/scenario-library.md`.

Dependencies:
- F4.2.
- F4.3.

### S4.5.2 - Test The Reference Template End To End

User story:
- As a maintainer, I need an automated test casting the reference template against a generated org so the cross-department path is regression-guarded.

Acceptance criteria:
- A test casts the reference template against a generated multi-department org and asserts a valid fill.
- The test exercises both the department and distance preconditions.
- It runs in the existing test harness.

Dependencies:
- S4.5.1.
