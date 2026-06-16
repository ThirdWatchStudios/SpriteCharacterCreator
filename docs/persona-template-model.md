# Persona Template Model — generating a coherent cast

**Status: DRAFT for discussion.** Design note for **persona templates**: seeded
archetype generators that stamp out a coherent `CharacterProfile`. They're the
**supply** side to scenario templates' **demand** (role slots + preconditions), and
the behavioral counterpart to the visual DNA the office population generator already
produces (`src/core/employee.ts`).

**Built (2026-06-15):** the generator + the 13 starter archetypes —
`src/core/personaTemplate.ts` (`PersonaTemplate`, `generatePersona`, `generateCast`,
`validatePersonaTemplate`, ranges + blends) and `src/data/personaArchetypes.ts`
(`PERSONA_ARCHETYPES`), with `tests/personaTemplate.test.ts`. **Still deferred:** the
relationship-graph wiring pass (§5). Decisions settled with Tom (2026-06-15) are marked
**[decided]**; remaining design choices are open.

- **Reuses, doesn't replace:** the existing character model (`src/core/profile.ts`) —
  OCEAN + game axes, needs, drives, preferences, skills, relationships, formative
  events, derived fields. A generated persona is an ordinary `CharacterProfile`, fully
  hand-editable after generation (the "derive a base, then author on top" principle).
- **Catalogs only:** archetypes are expressed entirely over the existing reusable
  catalogs — drive ids (`DEFAULT_DRIVES`), trait ids (`DEFAULT_TRAITS`), the axes/needs
  the model already defines. No parallel vocabulary.

---

## 1. Why

The full game needs a **persistent, varied cast you live with** — generated, not
hand-authored one profile at a time. Two constraints make raw random sliders useless:

1. **Coherence.** Random spines produce nonsense (high ambition + `minimize_effort` +
   `slacker`). Archetypes guarantee an internally consistent character.
2. **Castability.** Scenario templates can only fire if the cast *supplies* agents that
   satisfy their preconditions. A good spread of archetypes is what makes the scenario
   library playable (the coverage problem — §5).

Persona templates are the behavioral half of what `employee.ts` already does visually
(seeded Visual DNA + department-weighted parts). The intent: **one agent seed → a whole
agent** (visual DNA *and* persona), reproducible.

## 2. The model

A `PersonaTemplate` specifies, all from existing catalogs:

```ts
PersonaTemplate {
  id, label, description
  archetypeTags?: string[]                    // grouping + blend affinity
  spine: {                                    // per-axis [min,max] on 0–100; omitted = neutral 40–60
    ocean?: Partial<Record<OceanAxis, [number, number]>>
    axes?:  Partial<Record<PrimaryGameAxis, [number, number]>>   // ambition/integrity/loyalty/discretion
  }
  needs?: Partial<Record<NeedId, { baseline?: [number, number]; sensitivity?: [number, number] }>>
  drivePool: { primary: DriveId[]; secondary?: DriveId[] }       // ids into DEFAULT_DRIVES
  traits: { required?: TraitId[]; pool: TraitId[]; count: [number, number]; exclude?: TraitId[] }  // ids into DEFAULT_TRAITS
  identity?: { seniority?: Seniority[]; departments?: string[] } // leanings, optional
}
```

`generatePersona(template, seed, recipe?) → CharacterProfile`:

1. `base = createDefaultProfile(recipe)` — neutral starting profile.
2. `rng = mulberry32(seed)` — the same seeded RNG as Visual DNA.
3. Sample OCEAN + game axes within the template's ranges (unspecified → neutral).
4. Sample need `baseline`/`sensitivity` within ranges.
5. Draw `primary`/`secondary` drive from the pools.
6. Draw `count` traits: `required` + sampled from `pool` minus `exclude`.
7. Apply identity leanings.
8. `applyDerived(profile)` — temper, grudge-holding, reaction tendencies, volatility
   are **computed from the spine**, never sampled.
9. `validateProfile(profile)` — sanity. Optionally cross-check against
   `suggestedTraitTags()` (which already encodes spine→trait coherence) and warn if the
   drawn traits fight the spine.

**Determinism.** Seeded throughout; tie the persona seed to the same agent seed as
Visual DNA so one seed reproduces the full agent. Unifies with `employee.ts`.

### 2.1 Ranges + blends **[decided]**

- **Ranges, not fixed values** — two "Climbers" differ because each axis is sampled
  within `[min,max]`.
- **Optional secondary-archetype blend** — a persona may be `primary × secondary @ weight`
  (e.g. Climber × Gossip). Blend rule:
  - **Spine:** each axis range is pulled toward the secondary's by `weight` (≤ 0.5), then
    sampled — a Climber-with-a-gossip-streak, not a 50/50 mush.
  - **Drives:** union of both pools (primary weighted higher in the draw).
  - **Traits:** `required` from the primary kept; `pool` = union of both; `count` from the
    primary. `exclude` unions too (a hard contradiction in either still excludes).
- Blends are the main lever for cast variety on top of ranges.

## 3. Starter archetypes

~13 cover essentially every scenario role in `scenario-library.md`. Spine sketches are
illustrative ranges; the role column is the supply↔demand fit.

| Archetype | Spine sketch (ranges) | Supplies scenario roles |
|---|---|---|
| **The Climber** | ambition↑↑, conscientiousness↑, agreeableness↓, integrity mid; advance_career/seek_promotion | advanced, passed_over, betrayer, contender, thief |
| **The Operator** | integrity↓, loyalty↓, ambition↑, discretion↑; opportunist/spin_doctor | betrayer, briber, con_artist, ringleader, culprit |
| **The Gossip** | extraversion↑, discretion↓↓; maintain_social_access; gossip/social | amplifier, witness, double_agent, leaker |
| **The Office Mom** | agreeableness↑, extraversion↑; mentor_others/preserve_harmony; office_mom/peacemaker | welcomer, supporter, mediator, mentor |
| **The Cynic** | agreeableness↓, neuroticism↑ (→grudge↑); cynical/suspicious/contrarian | passed_over, accuser, holdout |
| **The Idealist** | integrity↑↑, openness↑; uphold_fairness/expose_wrongdoing; straight_shooter | whistleblower, lone_defender, idealist |
| **The Workhorse** | conscientiousness↑↑, neuroticism↑, rest↓; workaholic/perfectionist | overworked, carrier, creator, perfectionist |
| **The Slacker** | conscientiousness↓↓; minimize_effort; slacker/coaster | free-rider, sandbagger, weak_link |
| **The Charmer** | extraversion↑, agreeableness↑(surface), integrity mid; be_liked/gain_influence; charmer/brown_noser | favorite, manipulator, false_friend, champion |
| **The Veteran** | openness↓, loyalty↑ (→grudge↑); set_in_their_ways/reliable | overlooked_veteran, resistor, incumbent |
| **The Wallflower** | extraversion↓↓, neuroticism↑; wallflower/private/lone_wolf | outsider, scapegoat, victim, exposed |
| **The Hothead** | agreeableness↓, neuroticism↑ (→temper↑); hot_headed/blunt | combatant, enforcer, accuser |
| **The Loyalist** | loyalty↑, conscientiousness↑; job_security/preserve_leadership_confidence; rule_follower | authority-adjacent, accomplice, bystander |

(Newcomer/Outsider is a *state* — low familiarity + tenure — not a spine archetype; it
comes from the relationship-wiring pass + the lifecycle scenarios, not a persona template.)

## 4. Generation is blind; coverage is the feedback loop **[decided]**

Cast generation is **scenario-blind**: produce a varied cast from a chosen archetype mix,
then run the existing `analyzeTemplateCoverage(template, cast)` across the scenario library
to **report** which scenarios the cast can and can't run. This keeps emergence (we don't
contort the cast to guarantee scenarios) while surfacing a cast/library mismatch before
play. An optional **"ensure playable"** guarantee can sit on top later (top up the cast
until the required-role preconditions of the core library are satisfiable) — not the
default.

## 5. Deferred: relationship-graph wiring **[decided — its own design pass]**

A persona template produces **one individual**. But the persona model owns **baseline
relationships** (stable ties), and the *relational* scenario preconditions (rival→advanced,
mutual romance, ally/confidant→victim) depend entirely on the **graph between** cast
members. So a full **cast generator** is:

```
pick archetypes for N slots → generate each persona (§2) → WIRE the relationship graph → (coverage report §4)
```

**Step 3 — wiring the baseline relationship graph — is deferred to its own design pass.**
It is the meatiest part and deserves dedicated thought. Sketch of the problem, so we don't
lose it:

- **What it must produce:** directed edges with the six axes + a `relationshipType` id +
  optional `secret`, for the pairs that matter — exactly what scenario relational
  preconditions query and what the `thirdParty` jealousy coupling needs.
- **Candidate approaches (to weigh later):** (a) **archetype affinities** — a compatibility
  matrix (Climber↔Veteran tends to rivalry; Office Mom↔anyone tends to warmth; two
  Operators tend to wary alliance); (b) **seeded random wiring** within plausibility
  bounds; (c) **density/topology controls** (how connected, how many rivals/romances per
  N); (d) hybrid: archetype affinities set the *tendency*, seed sets the *specifics*.
- **Why separate:** it's graph generation, not individual generation; it's where the
  "feels like a real office" texture lives; and it directly gates scenario castability, so
  it wants the coverage loop (§4) as its acceptance test.

Until that pass, generated personas have spine/needs/drives/traits but **sparse or no
baseline relationships** — which means relationally-gated scenarios (Romance, Feud,
Betrayal, the Contested Promotion's `passed_over`) won't cast onto a freshly generated
cast yet. That's the expected, documented limitation.

## 6. Boundary reminders (what a persona template must NOT set)

Per the persona↔scenario boundary (`scenario_model.md`, and our `scenario.ts`):

- **No beliefs / knowledge** — those are scenario-owned (`beliefSeeds`/`knowledgeSeeds`).
- **No relationship *overrides*** — run-specific shifts are scenario-owned.
- **Baseline relationships** *are* persona-owned, but are **wired at the cast level** (§5),
  not by a single persona template.

A persona template owns only the durable, individual character: spine, needs, drives,
traits, skills, temperament, identity flavor.

## 7. Open questions

- **Archetype expression:** literal `[min,max]` per axis (explicit) vs. category-weighting
  over the trait/drive catalogs (the catalogs already have categories — terser, more
  data-driven)? Leaning explicit ranges for the spine + pool draws for traits/drives.
- **Identity/names:** does persona generation own name/pronoun/age/role generation, or
  defer to `employee.ts` / a name generator?
- **Skills:** sample a skill emphasis per archetype, or leave skills empty for now?
- **Department coupling:** should the existing `employee.ts` department profiles (visual)
  gain a persona-archetype counterpart (Sales → Charmer/Climber leanings, IT → Wallflower/
  lone_wolf, Accounting → Loyalist/rule_follower)?
- **Coherence enforcement:** warn-only (via `suggestedTraitTags`) or hard-reject incoherent
  draws?

## 8. Where it plugs into the code

- `src/core/profile.ts` — `createDefaultProfile` (base), `applyDerived` (derive step 8),
  `suggestedTraitTags` (coherence check), `validateProfile`, the axis/need/trait/drive types.
- `src/data/defaults.ts` — `DEFAULT_DRIVES` / `DEFAULT_TRAITS` (the pools archetypes draw from).
- `src/core/employee.ts` — `mulberry32` + the Visual-DNA/department-profile pattern to mirror;
  the unification point for "one seed → whole agent."
- New: `src/core/personaTemplate.ts` (the type + `generatePersona`) and
  `src/data/personaArchetypes.ts` (the starter set), parallel to the scenario template files.
</content>
