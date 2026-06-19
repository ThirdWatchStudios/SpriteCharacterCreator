# F3.2 Department-Aware Persona Generation - Stories

### S3.2.1 - Wire Persona Templates Into Population Generation

User story:
- As an author, I need the population generator to produce full personas (not just visual DNA) by using the persona-template archetypes so a generated department is real people.

Acceptance criteria:
- Generating a department yields full personas with drives/traits/needs/axes.
- The persona-template model is promoted from DRAFT and used by the generator.
- Generation is deterministic for a given seed.

Dependencies:
- F3.1.

### S3.2.2 - Make Generated Cohorts Legibly Distinct

User story:
- As a player meeting a new department, I need its members to be legibly distinct so "four new HR employees" are real people, not reskins.

Acceptance criteria:
- A generated cohort shows meaningful trait/drive spread, not near-duplicates.
- The department-flavored-vs-generic-spread decision is implemented and documented.
- Distinctiveness is measurable (e.g. a variety metric) and meets a threshold.

Dependencies:
- S3.2.1.
