# Presence Profile — authoring how a person occupies space

**Status: DRAFT for discussion.** Design note for **Presence Profiles**: a per-character
layer that describes *how a body physically expresses itself* — gait, proximity, hesitation,
lingering, lean, attention — independent of what the body actually does. It is the physical
counterpart to the Persona's psychological model, and the character-body analog of the
overhead-badge **motion-intent** system the tool already ships (`src/parts/overheadMotion.ts`).

Written 2026-06-29 to capture a design exploration. **Nothing here is built.** Formulas and
field lists are illustrative, not final. Decisions settled in discussion are marked
**[agreed]**; everything else is open.

> **Naming.** This was first floated as "Performance Profile." We renamed it to **Presence
> Profile** **[agreed]**. "Performance" smells like animation clips and pulls toward a
> timeline editor. "Presence" is about *space occupation* — which is exactly what the system
> describes (standing distance, conversation radius, lean, lingering). The spatial/social
> fields fit "presence" and never fit "performance"; that mismatch was the tell. One-line
> definition: **"How does this person occupy space?"**

---

## 1. The four-layer model **[agreed]**

Terrarium authors three standing descriptions of a person; the simulation runs the fourth.

```
Sprite Recipe   →  what you look like      (recipe.json — visual DNA)
Persona         →  who you are             (profile.json — psychological spine)
Presence        →  how you occupy space    (presence.json — physical expression)   ← NEW
Simulation      →  what you actually do    (Unity / The Water Cooler)
```

This is not "Terrarium gets an animation editor." It is the missing third leg of a stool the
tool already stands on: it already separates *look* (recipe) from *self* (persona) and already
cedes *behavior* to the sim. Presence is *physical expression* — the layer between who someone
is and what they do.

## 2. The priors / sampler contract **[agreed]**

The clean statement of the whole division of labor:

> **Recipe, Persona, and Presence are priors over a person. The simulation is the world that
> samples them.**

Recipe = visual priors. Persona = psychological priors. Presence = physical priors. None of
the three ever *fire* — they are standing dispositions. The sim is the only thing that runs in
time and produces events. This is *why* the boundary holds by construction rather than by
convention: a prior describes *how*; a sample is drawn at runtime.

## 3. Adverbs, never verbs **[agreed]**

The operating rule, stated so anyone can apply it:

> **Terrarium authors the adverbs. Unity writes the verbs. Terrarium never emits a verb or a
> "when."**

- **Bad** (a verb/procedure): `"pace when angry"`.
- **Good** (adverbs/dispositions): `restlessness: high`, `reactionSpeed: fast`,
  `pauseLength: short`.

The sim supplies the verb and the state — *"agent is angry," "walk to the printer," "a
conversation just ended."* The Presence Profile answers only *how this particular body looks
while doing that*. Two employees in the identical emotional state perform it differently: one
paces, one goes still, one throws their hands up — same state, different presence.

**Litmus test for any field:** if its value depends on world state (who's nearby, where the
path goes, what just happened), it belongs to Unity. If it's a constant property of the
character regardless of situation, it belongs to Terrarium. *"Personal-space preference"* is a
Terrarium number; *"current distance to Bob"* is a Unity computation.

**Precedent in-repo.** `src/parts/overheadMotion.ts` already does exactly this for overhead
badges: `OverheadMotionIntent { intro, loop, outro, salienceTier }` — "the tool owns the
*vocabulary*; the sim owns the actual curves and timings." Presence Profile is that same
intent-not-keyframe pattern applied to the actor instead of the badge. We are extending a
proven pattern, not inventing one.

## 4. Two registers: steady-state vs transition signatures **[agreed]**

Presence expresses itself in two structurally different ways. **The second register is the
gold vein** — it is where a character feels like themselves without authoring any
character-specific scene.

```
Steady-state presence          (always-on baseline; reads, but it's wallpaper)
  - gait            walk speed + start/stop softness
  - restlessness    idle energy / sway / fidget, collapsed to one scalar
  - default distance how far this body stands from others by default
  - expressiveness  gesture frequency + size, collapsed to one scalar

Transition signatures          (fired at the seams between sim verbs — personality spikes here)
  - arrival         walk→stop; confident stop vs shy over-adjust
  - exit            conversation-end departure: turn-walk vs pause-turn-walk vs back-up-turn-walk
  - interruption    how the body reacts to being interrupted
  - noticing        someone passes: ignore vs turn-head-and-continue (curiosity)
  - hesitation      pre-action pause length
  - second-guessing reversing a motion already in progress
```

**Why the split matters.** The sim already raises the events the second register decorates
(`conversation-ended`, `path-arrived`, `agent-passed-within-N`). Presence does not invent
events — it **signs the gaps between events the sim already emits.** That is where the schema's
value concentrates: not in the steady-state knobs, but in a small set of named transition
points.

### 4.1 The timing core: `commitment` + `latency` **[agreed]**

Timing is the centerpiece of the whole system, and most of it reduces to two scalars on the
transition register:

- **`latency`** — how long the gap is (a long pause before leaving).
- **`commitment`** — probability the body *reverses an action already in progress*
  (start, stop, turn, resume).

These two generate the canonical three-employee illustration from *one* knob each, with no
character-specific authoring:

| Employee | commitment | latency | Reads as |
|---|---|---|---|
| **Bob**   | high | low  | decisive — ends, turns, leaves |
| **Linda** | high | high | deliberate — ends, pauses, then leaves |
| **Carl**  | low  | —    | second-guessing — starts, stops, turns back, resumes |

`commitment` is the single most evocative field in the system and costs almost nothing to
specify. It is a headline field. (See §8 — it is also the field that most needs sim buy-in.)

## 5. The Pareto field cut **[agreed in principle]**

These sprites render at RimWorld zoom (128u canvas, 4 facings, 4-frame walk). **Most of the
originally-brainstormed fields describe things no player can perceive at that scale and should
be cut** — authoring invisible detail is pure cost.

- **Invisible at zoom → cut:** breathing exaggeration, finger/arm looseness, shoulder roll,
  eye-contact precision, conversational-distance-vs-personal-space splits, mug-vs-clipboard
  movement, micro-expression. None of these read on a ~16px figure.
- **Immediately visible → keep:** walk speed, stopping hesitation, personal space, lingering
  after conversations, head-turn-to-notice. These are what players actually build stories from.

The kept set is roughly the ~8 scalars in §4 plus the two timing fields. The schema should
*allow* the long tail as optional fields (§7) but the first authoring pass must not *require*
it. **The live preview decides the final list:** build a looping idle/walk/converse vignette at
actual game zoom and let it prune any field that doesn't earn its place.

## 6. Rig-anchor justification **[agreed]**

A presence field is only expressible if the rig exposes an **anchor** for it to act on, and the
rig is pack-defined (per `TOOL_ARCHITECTURE.md`). The current humanoid rig exposes exactly six
anchors:

```
body | neck | headCenter | aboveHead | chest | handRight
```

Mapping the kept fields against them shows the art pipeline already votes for the Pareto cut:

- **Expressible today:** head-tracking → `headCenter` (across 3 discrete facings + mirrored
  west), gesture → `handRight`, sway/lean/restlessness → `chest` / `body`, gait → locomotion.
- **Has no anchor → inexpressible anyway:** "arm looseness" (no elbow), two-hand gestures (one
  hand), eye-contact precision (no face rig), micro-expression (no face rig). The cuts in §5
  are the fields the rig can't honor regardless.

**Rule:** presence fields target **named rig channels**, not specific art. A field whose anchor
the active pack's rig does not expose simply goes **dormant** — no error. This is the same
capability-negotiation discipline as parts referencing palette tokens by name, and it keeps
presence **renderer-agnostic**: the schema describes observable qualities ("high restlessness,"
"soft stops"), never drawing operations, so a sprite rig and a future skeletal/IK rig interpret
the same numbers their own way. Use normalized 0–1 / 0–100 scalars and semantic enums; never
pixels, frame indices, clip names, or framerate-bound milliseconds. (That constraint is also
what lets richer animation arrive later with **no schema change** — see §7.)

## 7. Pairwise resolution rule **[agreed]**

The biggest payoff is that presence makes *interactions* interesting, not just individuals. A
reserved body (stands back, minimal gestures, slow reactions) and an animated body (leans in,
big gestures, quick responses) make **every conversation between them look unique** — without
authoring the conversation. You authored how each participant occupies space; the pairing does
the rest.

This forces an extension of the boundary rule:

> **When two presence profiles meet (Bob the close-stander talks to Linda the far-stander),
> neither radius "wins" in Terrarium. Each profile authors a *preference*; the sim *resolves*
> the negotiation. Resolution is situational, therefore it is a verb, therefore it is Unity's.**

Terrarium ships two priors; the sim samples a staged distance from the pair. The instant
someone tries to author *"the gap between Bob and Linda"* inside Terrarium, the boundary has
broken.

**Honest cost — emergence is not WYSIWYG.** A single actor's loop previews fine in the tool,
but the best feature (how two profiles look *together*) only exists at runtime, in the sim,
after resolution. The most the tool can offer is a **canned two-actor vignette** that
*approximates* it; it will never be faithful, because real resolution depends on the sim's
spacing/pathing rules. Plan for **author in the tool, validate in the sim** — and do not
promise a preview that previews emergence.

## 8. Sim buy-in flags **[needs The Water Cooler agreement before building]**

`commitment` / dithering is the highest-reward field *and* the one most likely to fight the
sim. When the sim has decided "go to the printer" and presence injects "start, stop, turn back,
resume," there is a beat where the body moves *away* from the sim's target. This is the deepest
form of adverbs-not-verbs: **the adverb can include not-yet-doing-the-verb.** If the pathfinding
layer "corrects" the body back onto its path, the most human behavior gets scrubbed out by the
pathfinding butler.

This sentence belongs in `CONTRACT.md`:

> **Presence may add non-progress motion without invalidating the sim action.** The sim must
> treat dithering, lingering, and hesitation as expression, not as a failed or abandoned
> action.

Get this agreed before building `commitment`, or the sim will erase the very behavior that
makes Carl Carl. More broadly: presence.json is inert until the sim's locomotion / idle /
conversation systems consume it — like the overlay/badge integration, the tool can author the
artifact, but the seam needs sim-side work. Recommend proving **one channel end-to-end first**
(gait speed is the cheapest, most visible win) before investing in deep authoring UI.

## 9. How it would plug into the code (sketch, not a spec)

Mirror the Persona machinery exactly — presence is the *physical* sibling of the persona's
spine-derived `reactionTendencies`.

- **Type & derivation:** a `PresenceProfile` using the existing `Derived { value, authored }`
  "sticky" pattern, alongside a `derivePresence(profile)` step modeled on `applyDerived` in
  `src/core/profile.ts`. Default every field by deriving from the persona spine —
  extraversion → expressiveness / default distance; neuroticism → restlessness / hesitation;
  conscientiousness → deliberate timing / gait control; low agreeableness → larger personal
  space, less lean. **Every existing character then gets a coherent presence for free, and two
  different personas automatically move differently.** Tie it to the same agent seed so "one
  seed → whole agent" now covers visual DNA + persona + presence.
- **Authoring layers:** `derive(persona) → apply preset(s) → hand-override`. Presets are the
  reusable archetypes (confident / reserved / awkward / nervous / enthusiastic / tired /
  professional) expressed as deltas over baseline — the same shape as persona archetypes and
  the emotion modifiers. Do **not** make anyone fill ~10 sliders from scratch (fatal at
  company scale, where Epic 0 generates a whole org).
- **Emotion modifiers:** a per-character map `emotion → delta over baseline` (frustrated → for
  *this* body, amplify restlessness + shrink distance). Terrarium authors the map; the sim
  supplies the live emotion and applies the delta.
- **Export & versioning:** `presence.json` as a per-character sibling of `recipe.json` /
  `profile.json`, folded into the same bundle / `company.json` package. Additive optional field
  on `CharacterProfile` (rides along like `reactionTendencies`); bump the serialized profile
  schema (currently `schemaVersion: 9`) and add a migrate step. Optional + derivable ⇒ old
  profiles load forward with no pain, and later finer channels are new optional fields old
  consumers ignore (open-vocabulary, like moods/behaviors).
- **UI:** a pack-driven **Presence tab**, sibling to Persona / Cast / Behaviors, showing only
  the channels the active rig supports, defaulting to the derived state with presets + sliders
  on top, plus the live preview vignette of §5/§7.

## 10. Boundary reminders (what a Presence Profile must NOT contain)

- **No verbs, no "when."** It never says *do X* or *at time T*; only *how*.
- **No interaction resolution.** It authors a body's *preference*; the gap between two bodies
  is sim-resolved (§7).
- **No job-performance / KPI metrics.** "Performance" tempts an efficiency/productivity reading
  (consistency, collaboration scores). Those are **sim-owned** per `CONTRACT.md`. Presence is
  *manner of motion*, not *how well someone does their job*. A `performanceMetric`-style field
  appearing in the schema is a sign the concept has slipped its boundary.
- **No clips / keyframes / frame indices / ms.** That would weld it to today's sprite renderer
  and force schema churn to add animation. Qualities only.

## 11. Open questions

- **Preview fidelity:** how close can a two-actor canned vignette get to real sim resolution
  before it misleads more than it helps?
- **Preset authoring:** literal deltas over baseline (explicit) vs. category-weighting like the
  persona trait pools? Leaning explicit deltas, parallel to emotion modifiers.
- **Channel registry:** do packs declare supported presence channels in the `ContentPack`/rig,
  or is it inferred from declared anchors? Leaning explicit declaration for clean validation.
- **Determinism of `commitment`:** seeded per agent (reproducible Carl) vs. sim-side roll each
  transition (Carl second-guesses *sometimes*)? Disposition is tool-side; the per-event roll is
  almost certainly sim-side — needs the §8 conversation.
- **Where derivation lives:** engine (`derivePresence`) so headless/CLI gets it for free, vs.
  UI-only. Leaning engine, mirroring `applyDerived`.

---

**Files to reference when this moves from note to build:**

- `CONTRACT.md` — the tool↔sim boundary; add the §8 non-progress-motion sentence.
- `src/parts/overheadMotion.ts` — the intent-not-keyframe precedent presence extends.
- `src/core/profile.ts` — `applyDerived`, the `Derived { value, authored }` sticky pattern,
  `reactionTendencies` (the behavioral sibling), `serializeProfile`.
- `src/core/types.ts` — `AnchorName` (the six rig channels), `CURRENT_SCHEMA_VERSION`.
- `docs/persona-template-model.md` — the generation/derive-then-author pattern to mirror.
- `TOOL_ARCHITECTURE.md` — rig is pack-defined; presence channels negotiate against it.
