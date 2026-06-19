# F2.1 Department Entity And Catalog - Stories

### S2.1.1 - Define The Department Entity And Catalog

User story:
- As a Terrarium developer, I need a department entity in a project-level catalog so departments have stable ids the rest of the office-scale work references.

Acceptance criteria:
- A department entity exists with `id`, `label`, and `category`.
- Departments live in a project-level catalog bundled with the export package.
- Department ids are stable across exports for the same project.

Dependencies:
- None.

### S2.1.2 - Seed The Catalog From Existing Department Names

User story:
- As an author, I need the existing department names (the Office Population Generator profiles) seeded into the catalog so I do not re-author them.

Acceptance criteria:
- The current department-name set is available as catalog seed data.
- Existing free-text `identity.department` values map onto catalog ids.
- Unmapped free-text values are reported for cleanup.

Dependencies:
- S2.1.1.
