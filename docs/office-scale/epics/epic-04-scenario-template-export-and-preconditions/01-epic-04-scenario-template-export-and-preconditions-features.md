# Epic 4 Feature Breakdown - Scenario-Template Export And Department-Aware Preconditions

Project phase: Office-Scale Authoring (Terrarium studio)
Planning intent: Graduate `scenario-template.json` from authoring-only to a first-class exported and sim-consumed artifact, and extend the precondition vocabulary with department and organizational-distance terms — so cross-department scenarios can be cast and priced.
Prototype estimate: export the existing `scenarioTemplate.ts` model as a consumed artifact (co-spec with the sim caster) and add department/distance precondition terms.
MVP estimate: a full cross-department template library and a tuned distance-cost model shared with the sim.

## Purpose

Cross-department scenarios are the payoff of office scale: a high role-precondition fit that happens to span wings, with payload scaling on compatibility and difficulty on organizational distance. That needs the sim to consume scenario templates (not just bound scenarios) and a precondition vocabulary that can talk about department and distance. This is a two-sided contract — keep it synchronized with the sim's Scenario Loading / casting epics (E30 generalize, E34). Serves sim epic E40.

## Feature Sequence

| Order | Code | Feature | Depends On | Purpose |
|---:|---|---|---|---|
| 1 | F4.1 | Scenario-Template Export Artifact | none | Make `scenario-template.json` an exported, sim-consumed artifact, co-spec with the sim caster. |
| 2 | F4.2 | Department-Aware Preconditions | F4.1 | Add precondition terms for department membership and same/different-department. |
| 3 | F4.3 | Organizational-Distance Preconditions | F4.2 | Add a distance condition/cost term consuming the wing/org distance signal. |
| 4 | F4.4 | Coverage Analysis With Department And Distance | F4.2, F4.3 | Extend coverage analysis to account for department/distance preconditions. |
| 5 | F4.5 | Reference Cross-Department Template | F4.2, F4.3 | Author a cross-wing reference template proving the new vocabulary end to end. |

Epic 4 goal:

```text
Terrarium exports scenario templates the sim consumes, with department- and distance-aware
preconditions, so cross-department pairings can be cast and priced.
```

Epic 4 exit question:

```text
Can a scenario template express and the sim consume a cross-department pairing, with the
precondition vocabulary kept one synchronized contract across tool and sim?
```

## Feature Definitions

### F4.1 - Scenario-Template Export Artifact

Project phase: Office-Scale Authoring (Terrarium studio)
Planning intent: Turn `scenario-template.json` (authoring-only today, §3.8) into an exported artifact the sim's runtime caster consumes, kept one contract across both sides.
Prototype estimate: export the existing `scenarioTemplate.ts` model and co-specify the consumed format with the sim's caster epic.
MVP estimate: versioned template packages with validation parity between tool and sim.
Goal: Make scenario templates a real cross-boundary artifact.
Feature scope:
- Export `scenario-template.json` as a first-class, sim-consumed artifact.
- Co-specification with the sim's Scenario Loading / casting epic (E30 generalize, E34) as one contract.
- Promotion of `CONTRACT.md` §3.8 from authoring-only and activation of §5.7 (sim casting).
Done when:
- `scenario-template.json` is exported in a format the sim caster consumes.
- The tool format and the sim caster are documented as one synchronized contract.
- The contract sections (§3.8, §5.7) are updated.
Exit question:

```text
Is scenario-template.json an exported, sim-consumed artifact under one synchronized contract?
```

### F4.2 - Department-Aware Preconditions

Project phase: Office-Scale Authoring (Terrarium studio)
Planning intent: Extend the role-slot precondition vocabulary so a slot can require or forbid a department, or require two slots to be in different departments.
Prototype estimate: add department-membership and same/different-department predicates to the precondition language and `castTemplate`/`validateScenarioTemplate`.
MVP estimate: a richer department-relationship precondition set shared with the sim.
Goal: Let a template express the core cross-wing pairing condition.
Feature scope:
- Department-membership preconditions (require/forbid a department on a slot).
- A "two slots in different departments" predicate (the cross-wing pairing).
- Support in `castTemplate` and `validateScenarioTemplate`.
- Shared precondition vocabulary with the sim.
Done when:
- A template can require slots in specific or different departments.
- Casting and validation honor the new predicates.
- The vocabulary is documented and shared with the sim.
Exit question:

```text
Can a template require a cross-department pairing through the precondition vocabulary?
```

### F4.3 - Organizational-Distance Preconditions

Project phase: Office-Scale Authoring (Terrarium studio)
Planning intent: Let a template express a distance condition or distance-scaled cost, consuming the distance signal from the layout (Epic 1) or org chart (Epic 2) per the structural-vs-spatial decision.
Prototype estimate: add a distance predicate/cost term reading the wing-connectivity or org-chart distance.
MVP estimate: a tuned distance-cost curve feeding the payload/difficulty trade.
Goal: Make organizational distance expressible in a template.
Feature scope:
- A distance precondition/cost term in the template vocabulary.
- Consumption of the distance signal (spatial from Epic 1, or structural from Epic 2 — per decision).
- Resolution of the structural-vs-spatial distance decision, documented.
Done when:
- A template can condition on or be priced by organizational distance.
- The distance source (spatial/structural) is decided and wired.
- Casting honors the distance term.
Exit question:

```text
Can a template read organizational distance as a precondition or cost?
```

### F4.4 - Coverage Analysis With Department And Distance

Project phase: Office-Scale Authoring (Terrarium studio)
Planning intent: Extend coverage analysis so it accounts for department and distance preconditions when checking whether the current org can satisfy a template library.
Prototype estimate: update `analyzeTemplateCoverage` to evaluate department/distance predicates against the generated org.
MVP estimate: coverage suggestions when a department/distance gap makes templates uncastable.
Goal: Keep coverage analysis honest once preconditions reference department/distance.
Feature scope:
- `analyzeTemplateCoverage` accounts for department and distance preconditions.
- Coverage gaps name the department/distance condition that cannot be met.
- Ties into Epic 3's cast/scenario coverage validation.
Done when:
- Coverage analysis evaluates department/distance preconditions against the org.
- Gaps caused by department/distance are reported specifically.
Exit question:

```text
Does coverage analysis correctly account for department and distance preconditions?
```

### F4.5 - Reference Cross-Department Template

Project phase: Office-Scale Authoring (Terrarium studio)
Planning intent: Author a cross-wing reference template (a cross-department analog of `THE_OFFICE_ROMANCE`) that exercises the new vocabulary end to end.
Prototype estimate: a reference template requiring two slots in different departments with a distance term, plus a test.
MVP estimate: a small starter library of cross-department templates.
Goal: Prove the department/distance vocabulary with a real template.
Feature scope:
- A reference cross-department template using department + distance preconditions.
- A test casting it against a generated multi-department org.
- Inclusion in `docs/scenario-library.md` as a documented standard template.
Done when:
- A reference cross-department template casts successfully against a generated org.
- The template exercises both department and distance preconditions.
- It is documented in the scenario library.
Exit question:

```text
Does a reference cross-department template cast end to end against a generated multi-department org?
```
