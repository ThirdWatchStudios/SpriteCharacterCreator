# F4.4 Coverage Analysis With Department And Distance - Stories

### S4.4.1 - Evaluate Department/Distance Preconditions In Coverage

User story:
- As an author, I need coverage analysis to evaluate department and distance preconditions so it stays honest once templates reference them.

Acceptance criteria:
- `analyzeTemplateCoverage` evaluates department and distance predicates against the org.
- Coverage reflects whether cross-department/distance templates are castable.
- The analysis reuses the Epic 3 coverage path.

Dependencies:
- F4.2.
- F4.3.

### S4.4.2 - Report Department/Distance Coverage Gaps

User story:
- As an author, I need coverage gaps caused by department/distance named specifically so I can fix the org or the template.

Acceptance criteria:
- Gap reports name the department or distance condition that cannot be met.
- A well-covered org passes; a gapped org is flagged with specifics.
- The report integrates with Epic 3's coverage validation surface.

Dependencies:
- S4.4.1.
