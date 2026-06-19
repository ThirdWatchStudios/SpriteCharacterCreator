# F3.1 Structured And Mutable Department Field - Stories

### S3.1.1 - Convert department To A Catalog Id

User story:
- As a Terrarium developer, I need `department` to be a catalog id (referencing the Epic 2 catalog) on personas and generated employees so it is structured rather than free text.

Acceptance criteria:
- `identity.department` and `metadata.department` are catalog ids, not free text.
- The contract documents the field type and a schema bump.
- The field is declared mutable so the sim can reassign it (for transfers).

Dependencies:
- F3.1.

### S3.1.2 - Migrate Existing Free-Text Department Values

User story:
- As a maintainer, I need existing free-text department values migrated to catalog ids so no data is lost when the field becomes structured.

Acceptance criteria:
- A migration maps existing free-text values to catalog ids.
- Unmapped values are reported, not dropped.
- The migration is idempotent.

Dependencies:
- S3.1.1.
