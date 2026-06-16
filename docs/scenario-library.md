# Scenario Library — proposed standard templates

**Status: DRAFT for discussion.** The well of cast-agnostic scenario templates to draw
from, organized into **families** (a free-text `family` grouping on each template).
Only **The Office Romance** is built as content; the model supports every "ready" entry.
Lines are intentionally compact — preconditions are the design content; Seed/Steer get
fleshed out when each is authored.

- **Model:** `src/core/scenarioTemplate.ts` — role slots + preconditions + seed +
  emotional payload, cast onto whoever fits. See `docs/scenario-template-model.md` §3,
  `CONTRACT.md` §3.8. Design source: `scenario_model.md` + `player_goal_system.md`.
- **Precondition vocab** (reuse existing catalogs only): `trait`, `axis` (OCEAN +
  ambition/integrity/loyalty/discretion + temper/grudgeHolding), `need`, `drive`,
  `relationship` (pairwise-to-a-role), `aggregate` (a rel axis reduced across the whole
  cast). Proximity == `familiarity`. Roles: `present` (default) or `absent` (resolved +
  referenced, kept off-scene, reported as "the one to remove").

**Legend** — **BUILT** · ▶ recommended build-first · ★ fills a payload gap ·
⚑ needs model/sim work *(dep)* · roles tagged `(req)`/`(opt)`/`(absent)`. Format:
`Name — roles(preconditions) → payload · distinguisher`.

---

## Family `attraction` *(relationship/affect)*
- **The Office Romance** **BUILT** — `loverA`/`loverB`(req, mutual affinity≥30 + familiarity≥50), `witness`(opt, low discretion) → infatuation, jealousy, heartbreak.
- **The Love Triangle** ▶ — `prize`(req); `suitorA`/`suitorB`(req, each high affinity→prize via crush/romance, low mutual affinity) → jealousy, rivalry, betrayal, heartbreak · *showcases the `thirdParty` coupling.*
- **The Unrequited Crush** — `pining`(req, crush→target one-way), `target`(req, oblivious), `rival`(opt) → longing, embarrassment, hope, rejection · *one-way edge.*
- **The Rebound** — `heartbroken`(req, recent ex-partner edge, high neuroticism), `available`(req, high affinity→heartbroken), `ex`(absent) → vulnerability, jealousy, healing/self-sabotage.
- **The Work-Spouse Jealousy** — `spouseA`/`spouseB`(req, work-spouse type), `interloper`(req) → possessiveness, insecurity · *thirdParty on a non-romantic bond.*

## Family `rumor` *(info/belief — the proven prototype path)*
- **The Contested Promotion** ▶ — `advanced`(req, high ambition), `passed_over`(req, rival→advanced, ambition+grudgeHolding), `amplifier`(opt, gossip/low discretion), `authority`(req) → resentment, paranoia, vindication · *templatizes the bound `promotion_rumor_001`; the bridge case.*
- **The Secret** ▶ — `subject`(req, high recognition/security need), `keeper`(req, high familiarity→subject), `tempted_leaker`(opt, gossip, low affinity→subject) → dread, shame, exposure, relief.
- **The Layoff Scare** — `vulnerable`(req, high security need, low influence), `opportunist`(opt, settle_score/advance, low integrity), `authority`(req) → fear, paranoia, self-preservation.
- **The Open Secret** ★ — `subject`(req, the last to know), `knowers`(aggregate: everyone else holds it) → dread, humiliation, pity, complicity · *inverts propagation.*
- **The Misattribution** — `originator`(req, said it), `misquoted`(req, wrongly credited/blamed), `spreader`(opt) → indignation, injustice, paranoia.
- **The Viral Praise** ★ — `praised`(req, rising star), `envious`(req, rival), `amplifier`(opt) → **pride**, envy, validation, resentment · *positive info spreads.*

## Family `credit` *(recognition & fairness)*
- **The Credit Theft** — `creator`(req, high competence + recognition need, low influence), `thief`(req, high ambition, low integrity), `authority`(req) → injustice, anger, helplessness, smugness · ⚑*(skill, optional)*
- **The Favorite** — `authority`(req), `favorite`(req, high trust/respect from authority, ambition), `overlooked`(req, high recognition need, low influence w/ authority) → resentment, jealousy, insecurity, smugness.
- **The Whistleblower** — `wrongdoer`(req, low integrity, high ambition), `witness`(req, straight_shooter/whistleblower, low loyalty→wrongdoer, drive expose_wrongdoing), `authority`(req) → anxiety, betrayal, vindication, dread.
- **The Overlooked Veteran** — `veteran`(req, high competence/seniority, recent low recognition, grudgeHolding), `rising_star`(req, young+ambitious), `authority`(req) → bitterness, obsolescence-fear, defiance.
- **The Snub** — `snubbed`(req, high belonging+recognition need), `snubber`(req, high influence), `witnesses`(aggregate) → hurt, exclusion, indignation.

## Family `rivalry` *(competition & power)*
- **The Feud (Cold War)** — `combatantA`/`combatantB`(req, mutual rival/nemesis, low affinity, high suspicion+temper), `bystander`(opt, ally to one) → hostility, dread, split loyalty, schadenfreude.
- **The Betrayal** ▶ — `victim`(req, high trust→betrayer), `betrayer`(req, ally/confidant→victim but high ambition, low loyalty, opportunist), `beneficiary`(req, rival→victim) → betrayal, shock, grief, vindication.
- **The Power Vacuum** — `authority`(absent, opt, high discretion/leadership), `contenderA`/`contenderB`(req, high ambition+influence, drive gain_influence), `followers`(opt) → ambition, anxiety, opportunism · *uses the `absent` role.*
- **The Swing Vote** — `factionA`/`factionB`(req, rivals), `undecided`(req, high agreeableness, up-for-grabs loyalty — the prize) → pressure, flattery, anxiety, betrayal.
- **The Enforcer** — `enforcer`(req, high influence, blunt, high temper), `target`(req, low influence, high security need), `bystander`(opt, afraid) → fear, helplessness, complicity, indignation.
- **The Underdog Challenge** — `challenger`(req, high ambition, low current influence), `incumbent`(req, high influence/respect) → hope, humiliation (either way), defiance.

## Family `belonging` *(connection & loss)*
- **The Outsider** ▶★ — `outsider`(req, aggregate low familiarity to cast, high belonging need), `gatekeeper`(opt, high influence, status_conscious, low openness), `welcomer`(opt, office_mom/social) → loneliness, exclusion, warmth · *uses `aggregate`.*
- **The Departure** ▶ — `leaver`(req, exiting), `left_behind`(req, high affinity+familiarity→leaver, close-friend/work-spouse), `replacement_eager`(opt, drive advance_career) → grief, abandonment, nostalgia, opportunism.
- **The Reconciliation** — `estrangedA`/`estrangedB`(req, ex-partner/ex-friend, lingering affinity, grudgeHolding) → awkwardness, longing, forgiveness or fresh hurt · *inverse of the Feud.*
- **The Mentor's Disappointment** — `mentor`(req, mentor→mentee, high respect/investment), `mentee`(req, protege→mentor, fails/defects) → disappointment, shame, defiance, grief.
- **The Clique** ★⚑ — `insiders`(aggregate high mutual affinity — *wants group roles*), `excluded`(req, aggregate low affinity to insiders) → exclusion, smug belonging, loneliness · ⚑*(group roles)*
- **The New Manager** — `new_boss`(req, aggregate low familiarity to cast, high ambition), `passed_over_internal`(req, wanted the job), `team`(opt) → resentment, anxiety, defiance · *aggregate + contested-promotion flavor.*
- **The Grief Spotlight** ★ — `bereaved`(req, offscreen loss), `supporter`(opt, high agreeableness), `avoider`(opt, low agreeableness) → grief, compassion, awkwardness, guilt.

## Family `blame`
- **The Scapegoat** ▶ — `culprit`(absent, req, low integrity, high discretion), `scapegoat`(req, low influence/respect), `accuser`(opt, blunt), `authority`(req) → fear, injustice, guilt, relief · *uses the `absent` role.*
- **The Cover-Up** — `responsible`(req, made the error), `accomplice`(req, loyal/complicit), `threat`(opt, might expose) → anxiety, complicity, guilt, dread.
- **The Witch Hunt** ⚑ — `accused`(req, low influence), `mob`(aggregate high suspicion — *wants group roles*), `lone_defender`(opt, high integrity) → mob-fear, paranoia, courage, injustice · ⚑*(group roles)*

## Family `integrity` 🆕 *(moral pressure)*
- **The Bribe** ★ — `tempted`(req, low integrity or high security-need-under-pressure), `briber`(req, high influence, low integrity), `idealist`(opt, high integrity witness) → temptation, guilt, **contempt**, complicity.
- **The Loyalty Test** — `tested`(req, high loyalty AND integrity, torn), `friend`(req, the one to protect), `authority`(req, demands compliance) → anguish, guilt, betrayal either way · *forced impossible choice.*
- **The Hypocrite Exposed** ★ — `hypocrite`(req, high status_conscious/outward integrity, secret flaw), `exposer`(req) → schadenfreude, **contempt**, humiliation, vindication.

## Family `status` 🆕 *(humiliation & hierarchy)*
- **The Public Failure** ★ — `failer`(req, high recognition need, high neuroticism), `audience`(aggregate), `rival`(opt, delights) → **humiliation**, schadenfreude, pity, shame.
- **The Impostor** — `impostor`(req, low competence in a high-status role, high neuroticism), `sharp_observer`(req, high competence, suspicious) → dread, anxiety, exposure-fear · ⚑*(skill helps)*
- **The Demotion** — `demoted`(req, was high now low, grudgeHolding), `successor`(req), `former_reports`(opt) → humiliation, bitterness, schadenfreude, pity.
- **The One-Upmanship** — `peerA`/`peerB`(req, both status_conscious + competitive, similar standing) → pettiness, insecurity, onlooker-exhaustion.

## Family `deception` 🆕 *(trust & cons)*
- **The Con** — `con_artist`(req, low integrity, high diplomacy), `mark`(req, high trust, agreeable) → delayed betrayal, foolishness, guilt · ⚑*(skill)*
- **The Frame** — `framer`(req, rival→victim, low integrity), `framed`(req, innocent), `authority`(req, believes it) → injustice, panic, vindictiveness · *active malice vs. the Scapegoat's drift.*
- **The Double Agent** — `double_agent`(req, low loyalty, gossip), `campA`/`campB`(req, rivals) → paranoia, betrayal, distrust.
- **The False Friend** — `manipulator`(req, opportunist, feigned ally→target), `target`(req, lonely, high belonging need) → exploited warmth, loneliness, guilt.

## Family `coalition` 🆕 *(group politics — mostly ⚑ group roles)*
- **The Coup** ⚑ — `target_leader`(req, authority present), `ringleader`(req, high ambition, low loyalty), `coalition`(*group role*) → betrayal, paranoia, ambition, dread · ⚑*(group roles)*
- **The Holdout** — `holdout`(req, high integrity/conscientiousness, refuses), `consensus`(aggregate, the rest), `pressurer`(opt) → isolation, conviction, resentment.

## Family `productivity` 🆕 *(work pressure → emotional payload)*
- **The Free Rider** ★ — `slacker`(req, trait:slacker/coaster, low conscientiousness), `carrier`(req, high conscientiousness, rising resentment), `authority`(opt, oblivious) → resentment, exploitation, indignation, guilt.
- **The Hostile Handoff** — `partnerA`/`partnerB`(req, mutual rival/low affinity, forced interdependence), `authority`(req, forces it) → friction, grudging respect, sabotage-temptation · *the "cooperation between hostile teams" objective.*
- **The Training-Your-Replacement** ★ — `trainer`(req, high security need, insecure), `trainee`(req, eager+ambitious), `authority`(req) → dread, obsolescence-fear, sabotage-temptation.
- **The Adoption Push** — `champion`(req, high openness, drive be_liked), `resistor`(req, set_in_their_ways/traditional, low openness), `fence_sitter`(opt, high agreeableness) → persuasion-anxiety, capitulation, defiance.
- **The Overpromiser** — `overpromiser`(req, high ambition, low conscientiousness, brown_noser), `team`(req, stuck delivering), `authority`(opt, pleased) → dread, resentment, panic, betrayal.
- **The Sandbagger** — `sandbagger`(req, drive minimize_effort/settle_score, low loyalty), `manager`(req, frustrated), `peer`(opt, carrying) → suspicion, frustration, resentment · *hidden withholding vs. the open Free Rider.*
- **The Perfectionist Bottleneck** — `perfectionist`(req, trait:perfectionist, high conscientiousness), `blocked`(req, deadline_driven, waiting), `authority`(opt) → frustration, contempt, anxiety.
- **The Recognition Drought** — `performer`(req, high competence + recognition need, depleting), `authority`(req, neglectful) → disengagement, bitterness, flight-risk · *the "turnover risk" objective.*
- **The Deadline Crunch** ⚑ — `lead`(req, deadline_driven), `weak_link`(req, procrastinator/flaky), `team`(opt) → pressure, panic, blame or camaraderie · ⚑*(time sim)*
- **The Outage / Printer Jam** ⚑ — `dependent`(req, deadline_driven), `fixer`(opt, competence/IT), `panicker`(opt, high neuroticism) → frustration, panic, relief, camaraderie · ⚑*(resource sim)* *(the `printer_jam` scaffold)*

## Family `territory` 🆕 *(environmental / spatial — mostly ⚑)*
- **The Desk War** ⚑ — `neighborA`/`neighborB`(req, low mutual affinity; one orderly/intolerant, one loud/messy) → irritation, passive-aggression, escalation · ⚑*(seating)*
- **The Reseating** ⚑ — `separated_pair`(high affinity, pulled apart) **or** `forced_pair`(low affinity, jammed together), `authority`(req) → loss/dread or opportunity · ⚑*(seating)* *generalizes the Romance seating lever.*
- **The Good Spot** ⚑ — `incumbent`(req, has the window/corner), `contenderA`/`contenderB`(req, status_conscious) → envy, entitlement, petty rivalry · ⚑*(spatial)*
- **The Encroachment** ⚑ — `encroacher`(req, low agreeableness, entitled), `displaced`(req, conflict-avoidant) → indignation, helplessness, resentment · ⚑*(spatial/objects)*
- **The Open-Plan Exposure** ★⚑ — `exposed`(req, high discretion/privacy need, doing something sensitive), `watcher`(req, gossip, curious) → anxiety, paranoia, exposure · ⚑*(spatial/visibility)* · **theme-on-theme: being watched mirrors the player's recon role.**
- **The Noise Complaint** ⚑ — `disruptor`(req, low conscientiousness/discretion, loud), `bothered`(aggregate, intolerant), `confronter_or_avoider`(opt) → irritation, confrontation-dread · ⚑*(spatial/noise)*
- **The Shared-Resource Crunch** ⚑ — `claimantA`/`claimantB`(req, deadline_driven), `hoarder`(opt, entitled) → frustration, pettiness, conflict · ⚑*(resource)* *(generalizes break_room_access)*
- **The Thermostat War** ⚑ — `factionA`/`factionB`(req, low affinity) over a trivial control → absurd escalation, pettiness · ⚑*(object)* *comic-relief proxy fight.*
- **The Sick Building** ⚑ — `aggregate` everyone degraded, `vocal_complainer`(opt), `silent_sufferer`(opt) → collective irritability, displaced blame · ⚑*(env/needs)* *mood-sink that makes other scenarios fire hotter.*

## Family `lifecycle` 🆕 *(tenure arcs — where the persistent cast pays off; mostly ⚑ history)*
- **The First Day** — `newcomer`(req, arrived), `welcomer`(opt, office_mom), `gatekeeper`(opt, status_conscious) → curiosity, anxiety, warmth-or-cold · *the arrival moment; branches into Outsider or integration.*
- **The Honeymoon** ⚑ — `newcomer`(req), `over_investor`(req, enthusiast, high agreeableness) → optimism → later disillusionment · ⚑*(history/sequence)*
- **The Ramp Failure** ⚑ — `struggler`(req, low competence-in-role, high neuroticism), `impatient_peer`(req, low agreeableness) vs `patient_mentor`(opt) → anxiety, frustration, contempt/sympathy · ⚑*(skill)*
- **The Last Straw** ⚑ — `disillusioned`(req, declining engagement + recent slight), `cause`(req, who pushed them) → resentment, resignation, the decision to leave · ⚑*(history)* *precursor to Departure.*
- **The Comeback** ⚑ — `fallen`(req, recent low standing), `skeptics`(aggregate), `believer`(opt, second chance) → hope, doubt, redemption/relapse · ⚑*(history)*

---

# Recommended build-first wave (▶)

All ready now; spans families, both primary engines, and showcases the new model features:
1. **The Contested Promotion** (`rumor`) — templatize the bound scenario; the decoupling worked example.
2. **The Love Triangle** (`attraction`) — the `thirdParty` jealousy coupling.
3. **The Outsider** (`belonging`) — the new `aggregate` precondition.
4. **The Scapegoat** (`blame`) — the new `absent` role.
5. **The Betrayal** (`rivalry`) — a provoke-first political relationship template.
6. **The Departure** (`belonging`) — broadens payload into grief/abandonment.

# Chains — "the office continues forward"

Chains are **emergent, not scripted**: the persistent cast + the sim's evolving state mean a
*resolved* scenario changes who qualifies next (Promotion Rumor → Carl exposed → Scapegoat →
Departure → Power Vacuum), with no branch tree authored. Resist hand-authoring chains. Optional
advisory `enables`/`follows` template hints (gap #7) could aid IRIS pacing + designer legibility
without scripting branches.

# Model / vocabulary gaps

1. ~~Aggregate ("to-everyone") preconditions~~ — **DONE** (`kind:'aggregate'`).
2. ~~Absent / negative roles~~ — **DONE** (`presence:'absent'`).
3. **History / event preconditions** — "recently failed / slighted / declining / demoted."
   Unqueryable today (lives in `formativeEvents` + runtime). **The whole `lifecycle` family
   needs this**, and it's where persistent-cast investment pays off. Upgraded from "skip" to
   "wanted." **Open.**
4. **Skill preconditions** — `kind:'skill'` (skill id + threshold). Credit Theft, Con, Enforcer,
   Impostor, Ramp Failure lean on it; all authorable without it for now. **Open.**
5. **Group / ensemble roles** — one slot → many agents (Clique, Witch Hunt, Coup, crowds/audiences).
   Option (a) add `count`/`min`/`max` to a role; (b) model crowds as an `aggregate` *condition on
   named principals* and don't cast the crowd. Leaning (b). **Open.**
6. **Shared intervention / "lever" catalog** (the Chekhov's-gun substrate) — generic move
   primitives the player fires, that templates bind + flavor. *Tabled by Tom — revisit.*
7. **Successor / chain hints** — advisory `enables`/`follows` on a template (not scripted
   branching). Low-cost. **Open.**

# Payload coverage

| Payload | Covered by |
|---|---|
| jealousy / rivalry | Romance, Love Triangle, Favorite, Feud, Work-Spouse |
| resentment / injustice | Contested Promotion, Credit Theft, Favorite, Scapegoat, Free Rider |
| betrayal | Betrayal, Whistleblower, Con, Double Agent, Coup |
| fear / paranoia | Layoff Scare, Scapegoat, Frame, Open-Plan Exposure, Witch Hunt |
| shame / guilt | Secret, Mentor's Disappointment, Bribe, Cover-Up |
| **humiliation / embarrassment** | Public Failure, Demotion, Unrequited Crush, Hypocrite |
| **contempt** | Bribe, Hypocrite, Perfectionist Bottleneck |
| grief / loneliness | Departure, Outsider, Grief Spotlight, False Friend, Last Straw |
| **pride / validation** | Viral Praise |
| vindication / smugness | Contested Promotion, Whistleblower, Credit Theft, Hypocrite |
| ambition / opportunism | Power Vacuum, Betrayal, Coup, Overpromiser |
| camaraderie / exploitation | Free Rider, Deadline Crunch, Outage, Hostile Handoff |
| obsolescence / disengagement | Overlooked Veteran, Training-Replacement, Recognition Drought |

Still thinnest on **awe/admiration** and **gratitude** — likely weak harvests; flag if wanted.

# Open questions

- `skill` precondition (gap #4): add, or author the few users on personality axes only?
- Group roles (gap #5): real ensemble roles, or aggregate-on-principals?
- Family granularity OK (14 families)? Candidate merges: `credit`↔`rumor`; `deception`↔`blame`;
  New Manager↔Contested Promotion as one family with variants.
- Cut line for ⚑ sim-gated entries (`territory`, time-based `productivity`, `lifecycle`): keep as a
  flagged backlog, or hold out until those systems exist?

---

## Changelog
- **Rev 4 (this pass):** consolidated the full chat brainstorm into the doc; added families
  `integrity`, `status`, `deception`, `coalition`, `productivity`, `territory`, `lifecycle`
  (~53 new candidates, ~70 total/14 families); switched to a compact catalog format; added the
  Chains section and gaps #5–#7; refreshed payload coverage.
- **Rev 3:** shipped `aggregate` + `absent` extensions + `family`; closed gaps #1/#2; reorg by family.
- **Rev 2:** Scapegoat/Departure/Outsider; per-entry Build field; de-gated build order; payload table.
- **Rev 1:** 14 scenarios across three engines.
</content>
