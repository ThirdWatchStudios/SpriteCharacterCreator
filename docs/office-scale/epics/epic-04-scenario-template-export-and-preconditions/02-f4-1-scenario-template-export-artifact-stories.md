# F4.1 Scenario-Template Export Artifact - Stories

### S4.1.1 - Export scenario-template.json As A Consumed Artifact

User story:
- As the sim's runtime caster, I need `scenario-template.json` exported in a format I consume so templates can be cast at runtime, not only at authoring time.

Acceptance criteria:
- The existing `scenarioTemplate.ts` model exports as `scenario-template.json` for sim consumption.
- `CONTRACT.md` §3.8 is promoted from authoring-only and §5.7 (sim casting) is activated.
- The artifact is versioned with the package schema.

Dependencies:
- None.

### S4.1.2 - Co-Specify One Synchronized Template Contract

User story:
- As both teams, I need the tool's template format and the sim's caster defined as one contract so the two sides cannot drift.

Acceptance criteria:
- The template format is documented as a single contract shared with the sim's casting epic (E30 generalize, E34).
- Validation expectations are stated for both sides.
- A drift check (or shared fixture) is identified.

Dependencies:
- S4.1.1.
