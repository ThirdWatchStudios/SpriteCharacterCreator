# Scenario Template Model — decoupling the cast from the scenario

Design note for the tool-side change that introduces **cast-agnostic, role-slotted
scenario templates** alongside the existing concretely-bound `Scenario`.

- **Source of truth (design):**
  `game-design-docs/the-water-cooler/docs/design/scenario_model.md` — esp.
  "Full-game direction: decoupling the cast from the scenario (2026-06-15)",
  "Scenario template anatomy (full game)", "Player consumption: provoke, steer,
  harvest", and Open decisions 5–7. Also `player_goal_system.md`
  ("The Emotion-Harvest Loop") and `character_model.md` (the persona this queries).
- **Status:** additive. Nothing here removes or reshapes the bound `Scenario`
  path (`createDefaultScenario` / `validateScenario` / `serializeScenario` /
  `buildScenarioPackage` / the export). `promotion_rumor_001` is unchanged.
- **Scope:** tool-side TypeScript only. The Unity sim is **not** modified here; the
  one place its loader contract would change is flagged in §7 and left to a future
  sim epic.

---

## 1. Why — the three independent axes

Today a `Scenario` hard-binds its cast: `cast: [{ agentId: "carl" }, …]`, and every
truth fact, information item, belief seed, relationship override, and objective
references those specific agents. That is exactly right for the **prototype** (one
office, one fixed cast). It is the wrong shape for the **full game**, which has
three independent axes (per the design doc):

- **Cast** (who) — persistent, stateful agents, generated or pre-defined, chosen at
  **new game**; the player lives with them for the whole playthrough. Investment
  comes from depth/persistence of *one* cast, not churning disposable casts.
- **Office** (where) — a layout; already separable.
- **Scenario** (what could happen) — a **stateless, cast-agnostic template**: role
  slots + per-slot preconditions + a seed situation + the emotional payload it can
  produce + how it triggers.

A bound `Scenario` is then just the **fully-cast special case** of a template: its
roles are pre-resolved to named agents because there is exactly one cast.

The emotion-harvest loop (`player_goal_system.md`) is the *why* the payload matters:
a scenario exists to produce a **target emotional response** the player provokes,
steers, and harvests. The template carries that payload as a first-class field.

---

## 2. `ScenarioTemplate` — the type (distinct from `Scenario`)

A template mirrors `Scenario` but **keyed by role id, never agent id**. New module
`src/core/scenarioTemplate.ts`; the type is **`ScenarioTemplate`** (the unrelated
preset-picker interface in `src/data/scenarioTemplates.ts` keeps its local name —
it is a "start from this authored scenario" list, a different concept, and is not
touched).

```text
ScenarioTemplate
  templateId, title, summary
  triggering: 'emerge' | 'provoke'        # design "Triggering"
  emotionalPayload: { targetEmotions[], description }   # the harvest target
  roles: RoleSlot[]                        # the abstract parts to fill
  roleSeeds: RoleSeed[]                    # per-role belief/knowledge/relationship seeds
  locations: TemplateLocation[]            # cast-agnostic; desk binding resolved at cast time
  roleSpawns: { roleId, locationId }[]     # where each role starts
  truthFacts: TemplateTruthFact[]          # subjectRoles / sourceRole (not agentIds)
  informationItems: TemplateInformationItem[]  # sourceRole / initialHolderRoles
  interventionTypes, variants, defaultVariantId   # the experiment (cast-agnostic already)
  objective: ScenarioObjective             # KPI framing; reused verbatim
```

A `RoleSlot` is:

```text
RoleSlot { roleId, label, description, required, preconditions: Precondition[] }
```

- `roleId` — abstract part: `instigator`, `rival`, `witness`, `loverA`, `loverB`, …
- `required` — a `false` (optional) role may stay unfilled; the scenario still
  casts, with a note. A `true` role that can't fill **fails** the cast.
- `preconditions` — the slot's eligibility, expressed against persona intrinsics +
  relationships (§3).

Everything that in a bound `Scenario` referenced an `agentId` references a
**`roleId`** here; casting (§4) rewrites roles → agents to emit a concrete
`Scenario`.

---

## 3. The role/precondition vocabulary — the persona ↔ scenario contract

Preconditions are built **entirely on the catalogs the tool already owns** (no
parallel vocabulary):

- **trait tags** — `traits.json` ids on `personality.traitTags`
- **personality axes** — OCEAN (`openness … neuroticism`) + primary game axes
  (`ambition, integrity, loyalty, discretion`) + derived (`temper, grudgeHolding`)
- **needs** — the six need ids, each `{ baseline, sensitivity }`
- **drives** — `drives.json` ids on `drives.primary / secondary`
- **relationships** — directed edges with the six axes
  (`trust, suspicion, affinity, influence, respect, familiarity`) + a
  `relationshipType` id from `relationshipTypes.json`

A `Precondition` is a discriminated union (`kind`):

| kind | queries | shape |
|---|---|---|
| `trait` | one candidate's trait tags | `{ trait, mode: 'has' \| 'lacks' }` |
| `axis` | one candidate's OCEAN/game axis | `{ axis, op: 'gte' \| 'lte', value }` |
| `need` | one candidate's need | `{ need, field: 'baseline' \| 'sensitivity', op, value }` |
| `drive` | one candidate's primary/secondary drive | `{ anyOf: driveId[] }` |
| `relationship` | candidate **vs. another role** | `{ toRole, direction, type?/typeAnyOf?, axis?, op?, value? }` |
| `aggregate` | candidate's rel axis **across the whole cast** | `{ axis, reduce: 'min'\|'max'\|'avg', direction, op, value, missingAs? }` |

- **Intrinsic** preconditions (`trait/axis/need/drive`) constrain a single
  candidate; **relational** (`relationship`) constrains a candidate *relative to the
  agent assigned to `toRole`* — this is what makes "two agents with mutual
  attraction" expressible.
- `relationship.direction`: `outgoing` (candidate → other), `incoming`
  (other → candidate), or `mutual` (both edges must satisfy). `axis` may be any of
  the six axes or `affinity`; `op`/`value` give the threshold; `type`/`typeAnyOf`
  constrain the `relationshipType` id.
- **Proximity** is modeled as the **`familiarity`** relationship axis — the
  persona-level proxy for "how much these two are around each other." This keeps
  proximity queryable from persona state alone (no office required for a preview).
  The sim may *refine* proximity with live spatial position at runtime; the tool's
  authoring-time proxy is `familiarity` (noted in CONTRACT §5.x).
- **`aggregate`** is the **"to-everyone"** condition the pairwise `relationship` kind
  can't express — *an outsider with low familiarity to the whole cast*, *a clique
  with high mutual affinity*. It reduces (`min`/`max`/`avg`) a candidate's chosen rel
  axis over the rest of the cast; a missing edge counts as `missingAs` (default `0` —
  "they don't know them"), so a no-edge newcomer reads as maximally unfamiliar. It is
  intrinsic (no role ref), evaluated at the eligibility stage.

### Role presence — present vs. absent ("negative") roles

A role carries `presence: 'present' | 'absent'` (default `present`):

- **present** — the matched agent is an active participant (emitted into the bound
  scenario's cast + spawn).
- **absent** — the matched agent is *resolved* (so it consumes an agent for
  distinctness and its id can be referenced by the seed / truth / info) but is **not**
  added to the emitted cast/spawns, and is **reported as the one to keep out**. This
  is the "negative role" the **Scapegoat**'s off-scene culprit (referenced by the
  truth fact, never in the room) and the **Power Vacuum**'s removed authority need.
  `required` still governs whether a qualifying agent must *exist*: a required-absent
  culprit must resolve (a real culprit exists); an optional-absent authority resolves
  *who to remove* if one exists, else the vacuum simply stands. Absent roles may not
  carry a spawn or a desk binding (validated).

Templates also carry an optional `family` (e.g. `'attraction'`, `'rumor'`,
`'rivalry'`) — a free-text grouping for organizing the library, no mechanical effect.

Each precondition is **hard** (must hold to be eligible) but also contributes a
**margin** to the candidate's fit score (§4 tie-breaking): the further past the
threshold, the stronger the fit.

---

## 4. Casting — binding a template to a cast

`castTemplate(template, cast, office?) → CastingResult` resolves roles → agents.

**Inputs**

- `cast` — the persona set in play (`CharacterProfile[]`): the intrinsics +
  baseline relationships the preconditions query.
- `office` — optional office anchors (`computeOfficeAnchors`), used only to resolve
  per-role **desk** location bindings and to validate the produced scenario's
  bindings. Casting works without it (bindings stay room-level / unchecked).

**Algorithm (greedy-best with backtracking)**

1. **Per-role intrinsic eligibility** — for each role, the agents satisfying its
   `trait/axis/need/drive` preconditions. (Relational preconditions are deferred
   to assignment because they depend on other roles.)
2. **Assignment order** — required roles first, then optional; within each group,
   **most-constrained first** (fewest intrinsic candidates) to prune early.
3. **Backtracking assign** — for the current role, candidates =
   intrinsic-eligible ∧ not already assigned to another role ∧ all `relationship`
   preconditions hold against **already-assigned** roles. Sort candidates by **fit
   score** (descending) and try best-first.
   - **Tie-breaking** = the fit score: count of satisfied preconditions + summed
     normalized margins (so the *strongest* mutual attraction wins, not just the
     first eligible pair). Deterministic; ties fall back to cast order.
   - An **optional** role with no candidate is left `null` and assignment
     continues. A **required** role with no candidate triggers backtracking; if no
     assignment of earlier roles rescues it, the cast **fails**.
4. **Emit** — from the completed assignment, build a concrete `Scenario`:
   role → `ScenarioCastMember` (agentId, spawn, prototypeRole = role label, seeds,
   overrides with `toRole` rewritten to the assigned agent); template locations →
   `ScenarioLocation` (desk bindings resolved to `desk:<agentId>`); truth/info →
   role refs rewritten to agent ids. **Anything referencing an unfilled optional
   role is dropped** (its location, spawn, seeds, the overrides that point at it,
   and truth/info whose source/subject role is unfilled) so the emitted scenario is
   internally consistent.
5. **Validate** — the emitted `Scenario` is run through the **existing**
   `validateScenario` (cast/targets resolve, locations bind, variants complete).
   Issues surface in the report; a clean cast yields a scenario that loads exactly
   like a hand-authored one.

**Output — `CastingResult`**

```text
CastingResult {
  ok: boolean                      # every REQUIRED role filled
  scenario: Scenario | null        # the bound scenario (null when ok === false)
  report: CastingReport
}
CastingReport {
  templateId
  assignments: { roleId, agentId | null, required, score }[]
  unfilledRequired: roleId[]       # why ok === false
  unfilledOptional: roleId[]
  candidatesByRole: { roleId: { agentId, score }[] }   # who *could* fill each role
  issues: string[]                 # template issues + emitted-scenario validation issues
}
```

**Behavior when nobody qualifies** (design Open decision 5): the engine here does
**skip** (optional) / **flag-and-fail** (required), and always reports the
candidate sets so a designer can see *why*. It deliberately does **not** auto-relax
preconditions or auto-mutate the cast — that is a player/sim-side "provoke" action
(create the preconditions), out of scope for the authoring tool. The report gives a
designer the data to relax the template or enrich the cast by hand.

---

## 5. Generated-cast coverage (design Open decision 7)

`analyzeTemplateCoverage(template, cast) → CoverageReport` answers "can this cast
play this template?" *before* play:

```text
CoverageReport {
  templateId
  perRole: { roleId, required, intrinsicCandidateCount, relationalFillable }[]
  fullyCastable: boolean           # a complete required-role assignment exists
  unfillableRequiredRoles: roleId[]
  notes: string[]                  # e.g. "no agent carries the 'gossip' trait"
}
```

- `intrinsicCandidateCount` is the per-role eligible-agent count **ignoring**
  relational constraints — this is what tells a designer "no one in this cast is a
  plausible *witness*" independent of who fills the lovers.
- `fullyCastable` runs the real `castTemplate` and reports whether the required
  roles resolve together (relational constraints can make two individually-eligible
  roles un-co-castable).
- Run across a **library × cast** matrix, this is the cast/scenario-library
  mismatch surface the design asks for: a designer sees which templates a freshly
  generated cast can and cannot produce before shipping the pairing into play.

---

## 6. Alignment with CONTRACT.md and schema versioning

- **No new `meta.schemaVersion` bump for the bound path.** The emitted `Scenario`
  is the *existing* shape (`meta.schemaVersion` 9), so `scenario.json` and the
  whole export bundle are byte-compatible. The prototype sim loader is untouched.
- **Templates are a new, separate authoring artifact**, not part of the bound
  `Scenario` schema. If/when a template is *exported* for the sim to cast at
  runtime, it serializes as its own `scenario-template.json` carrying the same
  `meta.schemaVersion`, version-gated identically (the bare-array catalogs travel
  unchanged). Until the sim consumes templates, the tool's job is: author against
  roles, **cast to a bound `Scenario`, export that**.
- **The vocabulary reuses existing catalogs** (traits/drives/relationshipTypes +
  the documented axes), so CONTRACT §3.5–§3.7 already cover the ids a precondition
  references. The only CONTRACT addition is documenting (a) that proximity ==
  `familiarity` at authoring time and (b) the new template artifact + the role/
  precondition vocabulary as the persona↔scenario casting contract.

---

## 7. Sim-side contract change (flag only — NOT implemented here)

The full-game direction has the **engine cast templates at runtime** ("casts the
template onto whoever in the current office best fits the roles' preconditions").
That is a **sim-side loader change**, tracked separately (the "Scenario Loading"
epic in `scenario_model.md` §"Implementation note"). When the sim adopts it:

1. A new optional input artifact **`scenario-template.json`** (role slots +
   preconditions + role-keyed seeds/world + payload), alongside today's
   fully-bound `scenario.json`.
2. The sim gains a **runtime caster** = the C#/engine port of `castTemplate`: same
   precondition vocabulary (§3), same greedy-best-with-backtracking resolution
   (§4), evaluating against **live** persona + relationship + (real spatial)
   proximity state rather than authoring-time baselines.
3. **Proximity** is the one precondition the sim should evaluate *better* than the
   tool: the tool uses the `familiarity` proxy; the sim has true positions.
4. **Back-compat:** a bound `scenario.json` keeps loading as-is — it is the
   already-cast special case, equivalent to a template with single-candidate roles.

Until that epic lands, the tool **only emits bound `scenario.json`** (cast at
authoring time). Nothing in this note obligates a sim change to ship the tool work.

---

## 8. Where the docs and code agree / diverge

- The design doc's role/precondition vocabulary was left as Open decisions 5–7;
  this note *resolves the tool-side half* of them (the precondition union, the
  casting/tie-break/fallback rules, the coverage report) and feeds them back as the
  concrete contract. No contradiction with the spec found — it asked for exactly
  this and deferred the specifics.
- One reconciliation: the spec lists **proximity** as a first-class precondition
  input. The tool has no live spatial state at authoring time, so it binds
  proximity to the **`familiarity`** relationship axis and flags the spatial
  refinement as sim-side (§3, §7). This is a deliberate, documented narrowing, not
  a silent divergence.
</content>
</invoke>
