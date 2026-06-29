/**
 * Character profiles — the full-game "persona" authored alongside each sprite.
 *
 * This is the tool-side implementation of the design contract in
 * game-design-docs/the-water-cooler/docs/design/character_model.md. A profile is
 * the *authored, starting* character (dispositions + initial conditions); the sim
 * owns everything at runtime. Profiles are keyed by `agentId`, which equals the
 * CharacterRecipe id (== the sim's AgentId), so sprite and persona never drift.
 *
 * Two scales (resolved 2026-06-14):
 *   - unipolar (OCEAN, game axes, needs, skills, most relationship axes): 0–100
 *   - bipolar  (relationship affinity, preference valence):              -100..100
 *
 * "Derive a base, then hand-author on top" (design principle #4): the derived
 * game axes, reaction tendencies, and temperament volatility are computed from
 * the personality spine by default and become sticky once a designer overrides
 * them (`authored: true`). See {@link applyDerived}.
 *
 * The personality axes / needs / skill tracks / subject catalog declared here are
 * the `modern-office` content pack's character schema. A different game ships a
 * different schema; the Persona UI renders from these declarations.
 */
import type { CharacterRecipe } from './types';
import type { Mood } from './types';
import { CURRENT_SCHEMA_VERSION, MOODS } from './types';
import { ACTIVITIES } from '../parts/activities';

// --- scale helpers ----------------------------------------------------------

/** Clamp + round to the 0–100 unipolar scale. */
export const clampUnit = (v: number): number => Math.max(0, Math.min(100, Math.round(v)));
/** Clamp + round to the -100..100 bipolar scale. */
export const clampBipolar = (v: number): number => Math.max(-100, Math.min(100, Math.round(v)));

const avg = (...xs: number[]): number => clampUnit(xs.reduce((a, c) => a + c, 0) / xs.length);

// --- personality ------------------------------------------------------------

export const OCEAN_AXES = [
  'openness',
  'conscientiousness',
  'extraversion',
  'agreeableness',
  'neuroticism',
] as const;
export type OceanAxis = (typeof OCEAN_AXES)[number];

/** Primary game axes — things OCEAN does not capture; always hand-authored. */
export const PRIMARY_GAME_AXES = ['ambition', 'integrity', 'loyalty', 'discretion'] as const;
export type PrimaryGameAxis = (typeof PRIMARY_GAME_AXES)[number];

/** OCEAN-adjacent axes — derived from the spine by default, overridable. */
export const DERIVED_GAME_AXES = ['temper', 'grudgeHolding'] as const;
export type DerivedGameAxis = (typeof DERIVED_GAME_AXES)[number];

export const AXIS_LABELS: Record<OceanAxis | PrimaryGameAxis | DerivedGameAxis, string> = {
  openness: 'Openness',
  conscientiousness: 'Conscientiousness',
  extraversion: 'Extraversion',
  agreeableness: 'Agreeableness',
  neuroticism: 'Neuroticism',
  ambition: 'Ambition',
  integrity: 'Integrity',
  loyalty: 'Loyalty',
  discretion: 'Discretion',
  temper: 'Temper',
  grudgeHolding: 'Grudge-holding',
};

/** A value that is computed from the spine unless a designer has overridden it. */
export interface Derived {
  value: number;
  /** When true, the user set this by hand; re-deriving must not clobber it. */
  authored: boolean;
}
const derived = (value: number): Derived => ({ value: clampUnit(value), authored: false });

export interface Personality {
  ocean: Record<OceanAxis, number>;
  axes: Record<PrimaryGameAxis, number>;
  derivedAxes: Record<DerivedGameAxis, Derived>;
  /** Readable shorthand layered on top of the numeric spine. */
  traitTags: string[];
}

// --- needs (motivation core) ------------------------------------------------

export const NEEDS = ['recognition', 'belonging', 'security', 'autonomy', 'competence', 'rest'] as const;
export type NeedId = (typeof NEEDS)[number];

export const NEED_LABELS: Record<NeedId, string> = {
  recognition: 'Recognition',
  belonging: 'Belonging',
  security: 'Security',
  autonomy: 'Autonomy',
  competence: 'Competence',
  rest: 'Rest',
};

export interface NeedSetting {
  /** Starting satisfaction, 0–100. */
  baseline: number;
  /** How fast it depletes / how strongly it drives behavior, 0–100. */
  sensitivity: number;
}

// --- drives -----------------------------------------------------------------

export const EXPECTED_BEHAVIOR_TENDENCIES = [
  'share',
  'withhold',
  'confirm',
  'avoid',
  'support',
  'confront',
  'reroute',
] as const;
export type ExpectedBehaviorTendency = (typeof EXPECTED_BEHAVIOR_TENDENCIES)[number];

export const OBJECTIVE_STATUSES = ['active', 'paused', 'achieved', 'abandoned'] as const;
export type ObjectiveStatus = (typeof OBJECTIVE_STATUSES)[number];

/**
 * A drive is a reusable, structured motivation defined once in the project
 * catalog and referenced by persona id. `amplifiesNeeds` is the contract hook the
 * sim acts on — which of the six needs this drive pushes harder. Behavior
 * selection still lives in the sim; the tool owns the catalog + the need coupling.
 */
export const DRIVE_CATEGORIES = ['status', 'security', 'power', 'social', 'growth'] as const;
export type DriveCategory = (typeof DRIVE_CATEGORIES)[number];

export interface DriveDefinition {
  id: string;
  label: string;
  description: string;
  category: DriveCategory;
  /** Which needs this drive intensifies; the sim weights motivation by these. */
  amplifiesNeeds: NeedId[];
}

export interface PersonalObjective {
  id: string;
  sourceDrive: string;
  targetOrConcern: string;
  expectedBehaviorTendency: ExpectedBehaviorTendency;
  status: ObjectiveStatus;
}

export interface Drives {
  primary: string;
  secondary: string;
  objectives: PersonalObjective[];
}

// --- preferences (loves / hates of catalog subjects) ------------------------

export type SubjectKind = 'topic' | 'object' | 'activity' | 'location' | 'people_type';

export interface SubjectCatalogEntry {
  subjectId: string;
  kind: SubjectKind;
  displayName: string;
}

/** The modern-office subject catalog — preferences reference these ids. */
export const SUBJECT_CATALOG: SubjectCatalogEntry[] = [
  { subjectId: 'coffee', kind: 'object', displayName: 'Coffee' },
  { subjectId: 'free_snacks', kind: 'object', displayName: 'Free snacks' },
  { subjectId: 'monday_sync', kind: 'activity', displayName: 'The Monday sync' },
  { subjectId: 'all_hands', kind: 'activity', displayName: 'All-hands meetings' },
  { subjectId: 'small_talk', kind: 'activity', displayName: 'Small talk' },
  { subjectId: 'deadlines', kind: 'topic', displayName: 'Deadlines' },
  { subjectId: 'overtime', kind: 'activity', displayName: 'Overtime' },
  { subjectId: 'gossip', kind: 'topic', displayName: 'Office gossip' },
  { subjectId: 'open_floor_plan', kind: 'location', displayName: 'The open floor plan' },
  { subjectId: 'corner_desk', kind: 'location', displayName: 'The corner desk' },
  { subjectId: 'break_room', kind: 'location', displayName: 'The break room' },
  { subjectId: 'team_lunch', kind: 'activity', displayName: 'Team lunch' },
  { subjectId: 'management', kind: 'people_type', displayName: 'Management' },
  { subjectId: 'new_hires', kind: 'people_type', displayName: 'New hires' },
  { subjectId: 'recognition', kind: 'topic', displayName: 'Public recognition' },
];

export interface Preference {
  subjectId: string;
  /** -100 (hate) .. 100 (love). */
  valence: number;
  note?: string;
}

// --- skills -----------------------------------------------------------------

export interface SkillTrack {
  skillId: string;
  label: string;
}

/** The modern-office skill tracks. */
export const SKILL_TRACKS: SkillTrack[] = [
  { skillId: 'accounting', label: 'Accounting' },
  { skillId: 'presentation', label: 'Presentation' },
  { skillId: 'coding', label: 'Coding' },
  { skillId: 'diplomacy', label: 'Diplomacy' },
  { skillId: 'organization', label: 'Organization' },
  { skillId: 'sales', label: 'Sales' },
  { skillId: 'writing', label: 'Writing' },
  { skillId: 'leadership', label: 'Leadership' },
];

export interface Skill {
  skillId: string;
  level: number;
}

// --- relationships ----------------------------------------------------------

/** Unipolar relationship axes (affinity is handled separately, bipolar). */
export const RELATIONSHIP_AXES = ['trust', 'suspicion', 'influence', 'respect', 'familiarity'] as const;
export type RelationshipAxis = (typeof RELATIONSHIP_AXES)[number];

export const RELATIONSHIP_TAG_SUGGESTIONS = [
  'rival',
  'mentor',
  'mentee',
  'friend',
  'ally',
  'ex-friend',
  'confidant',
];

/** Top-level grouping for the relationship-type catalog. */
export const RELATIONSHIP_TYPE_CATEGORIES = ['professional', 'social', 'romantic', 'adversarial'] as const;
export type RelationshipTypeCategory = (typeof RELATIONSHIP_TYPE_CATEGORIES)[number];

/**
 * The triangular (third-party) coupling on a relationship type — the data the sim
 * needs to model jealousy/protectiveness. When the *target* of a relationship of
 * this type engages a third party, the holder reacts: `sensitivity` is how
 * strongly, `biasesReactions` is the shape of the reaction (−2..+2 nudges, same
 * scale as trait biases), and `intensifiesTowardDisliked` tells the sim to scale
 * the reaction up when that third party is someone the holder regards negatively
 * (a rival / low affinity). Tool authors the coupling; the sim applies it.
 */
export interface ThirdPartyCoupling {
  /** 0–100: how strongly the holder reacts to the target engaging others. */
  sensitivity: number;
  biasesReactions: Partial<Record<ReactionCategory, number>>;
  intensifiesTowardDisliked: boolean;
}

/**
 * A reusable relationship type, defined once in the project catalog and
 * referenced by a relationship edge's `relationshipType` id (the same pattern as
 * drives and traits). `biasesReactions` colors the holder's reactions *toward the
 * target* (sim applies it alongside trait biases, §5.3); `thirdParty` is the
 * optional jealousy/protectiveness hook (§5.4). Behavior selection stays in the
 * sim — the tool ships the structured coupling.
 */
export interface RelationshipTypeDefinition {
  id: string;
  label: string;
  description: string;
  category: RelationshipTypeCategory;
  /** Typically hidden (secret romance, covert alliance) — seeds the per-edge toggle. */
  secretByDefault?: boolean;
  /** −2..+2 nudges to the holder's reactions toward the target. Only non-zero stored. */
  biasesReactions: Partial<Record<ReactionCategory, number>>;
  /** Triangular coupling for jealousy/protectiveness; omit for neutral bonds. */
  thirdParty?: ThirdPartyCoupling;
}

export interface Relationship {
  targetAgentId: string;
  trust: number;
  suspicion: number;
  /** -100 (hostile) .. 100 (strongly likes). */
  affinity: number;
  influence: number;
  respect: number;
  familiarity: number;
  /** Id into the project relationshipTypes catalog; the numeric axes carry the nuance. */
  relationshipType?: string;
  /** Hidden bond (secret romance, covert alliance). Exported for the sim. */
  secret?: boolean;
  tags: string[];
}

// --- beliefs & knowledge ----------------------------------------------------

// Stance is shared with the scenario model (scenario.ts), which owns starting
// beliefs now — the persona no longer carries beliefs/knowledge (see
// scenario_model.md "persona ↔ scenario boundary").
export const STANCES = ['unknown', 'accepts', 'doubts', 'suspects', 'rejects'] as const;
export type Stance = (typeof STANCES)[number];

// --- formative events (the authored memory layer) ---------------------------

export const FORMATIVE_VISIBILITY = ['public', 'private', 'secret'] as const;
export type FormativeVisibility = (typeof FORMATIVE_VISIBILITY)[number];

export const FORMATIVE_TARGET_KINDS = [
  'personality_axis',
  'need_baseline',
  'relationship_axis',
  'preference',
  'belief',
  'trait_tag',
  'drive',
] as const;
export type FormativeTargetKind = (typeof FORMATIVE_TARGET_KINDS)[number];

export const FORMATIVE_OPS = ['set', 'add', 'nudge'] as const;
export type FormativeOp = (typeof FORMATIVE_OPS)[number];

/**
 * One bias a formative event applies to the starting state. `targetRef` is
 * interpreted per kind (an axis name, an `agent:axis` pair, a subject id, a
 * belief topic, etc.). Folded into the numeric fields by {@link applyFormativeEffects}.
 */
export interface FormativeEffect {
  targetKind: FormativeTargetKind;
  targetRef: string;
  op: FormativeOp;
  /** Number for numeric targets, string for tag/drive/stance targets. */
  value: number | string;
}

export interface FormativeEvent {
  id: string;
  title: string;
  description: string;
  /** Coarse time, free text: "years_ago", "recent", … */
  when: string;
  involvedAgentIds: string[];
  visibility: FormativeVisibility;
  knownToAgentIds: string[];
  effects: FormativeEffect[];
}

// --- reactions (Epic 26) ----------------------------------------------------

export const REACTION_CATEGORIES = [
  'confront',
  'gossip',
  'withdraw',
  'verify',
  'reassure',
  'escalate',
  'ignore',
] as const;
export type ReactionCategory = (typeof REACTION_CATEGORIES)[number];

// --- presence (Epic 29: how a body occupies space) --------------------------

/**
 * Presence channels — the physical-expression layer (see docs/presence-profile.md).
 * The sim authors *what* a body does; the presence profile authors *how* it does
 * it ("adverbs, never verbs"). Each channel is a 0–100 disposition derived from
 * the personality spine by default and sticky once hand-authored — the same
 * derive-a-base-then-author pattern as the reaction tendencies and derived axes.
 *
 * Two registers:
 *   - steady-state (always-on baseline): gaitSpeed, gaitControl, restlessness,
 *     personalSpace, expressiveness.
 *   - transition signatures (fired at the seams between sim verbs — arrival, exit,
 *     noticing, hesitation): commitment, latency, attentiveness.
 *
 * These are renderer-agnostic *intent*, not animation clips (cf.
 * parts/overheadMotion.ts): a channel targets a named rig anchor and simply goes
 * dormant if the active rig lacks it. The sim owns the actual curves/timing and
 * the pairwise resolution (whose personalSpace "wins" when two bodies meet). The
 * tool never emits a verb or a "when". See CONTRACT.md.
 */
export const PRESENCE_CHANNELS = [
  // steady-state
  'gaitSpeed',
  'gaitControl',
  'restlessness',
  'personalSpace',
  'expressiveness',
  // transition signatures
  'commitment',
  'latency',
  'attentiveness',
] as const;
export type PresenceChannel = (typeof PRESENCE_CHANNELS)[number];

/**
 * The two registers (CONTRACT.md §5.8). Steady-state is the always-on baseline;
 * transition signatures fire at the seams between sim events (arrival, exit,
 * noticing, hesitation). Together they partition PRESENCE_CHANNELS — the UI groups
 * by these, and presencePartitionIsExhaustive() (tested) guards against drift.
 */
export const PRESENCE_STEADY_STATE: PresenceChannel[] = [
  'gaitSpeed',
  'gaitControl',
  'restlessness',
  'personalSpace',
  'expressiveness',
];
export const PRESENCE_TRANSITION: PresenceChannel[] = ['commitment', 'latency', 'attentiveness'];

/**
 * Per-mood physical-expression deltas over the baseline presence (CONTRACT.md §5.8).
 * The sim owns the current mood; this map answers *how this body expresses it* — the
 * sim adds the current mood's deltas on top of the resolved presence numbers. Sparse:
 * only non-zero channels are stored, and `normal` is the baseline (never an entry).
 * The point is per-character variation: one body paces when hostile (+restlessness),
 * another freezes (−restlessness) — same mood, opposite deltas. Authored, not derived
 * (deltas are bipolar, −100..100); kept beside `presence` and exported in profile.json.
 */
export type PresenceMoodMap = Partial<Record<Mood, Partial<Record<PresenceChannel, number>>>>;

/** The moods a presence map can modulate — every mood except the `normal` baseline. */
export const MODULATED_MOODS: Mood[] = MOODS.filter((m) => m !== 'normal');

export const PRESENCE_LABELS: Record<PresenceChannel, string> = {
  gaitSpeed: 'Gait speed',
  gaitControl: 'Gait control',
  restlessness: 'Restlessness',
  personalSpace: 'Personal space',
  expressiveness: 'Expressiveness',
  commitment: 'Commitment',
  latency: 'Latency',
  attentiveness: 'Attentiveness',
};

/**
 * A reusable presence preset — signed deltas folded over the spine-derived
 * baseline (the "derive a base, then author on top" step for the body layer).
 * Presets are an authoring-time convenience (like the persona archetypes in
 * data/personaArchetypes.ts), NOT a project catalog or an exported artifact: the
 * sim only ever sees the resolved presence numbers, never which preset produced
 * them — the same way it never sees which archetype generated a persona. Only the
 * channels a preset cares about are listed; the rest keep deriving from the spine.
 * See applyPresencePreset and data/presencePresets.ts.
 */
export interface PresencePreset {
  id: string;
  label: string;
  description: string;
  deltas: Partial<Record<PresenceChannel, number>>;
}

// --- routine (Epic 20) ------------------------------------------------------

export const ON_BLOCKED_LOCATION = [
  'reroute_to_fallback',
  'wait_in_hallway',
  'return_to_desk',
  'skip_block',
] as const;
export type OnBlockedLocation = (typeof ON_BLOCKED_LOCATION)[number];

export interface RoutineBlock {
  startTime: string;
  endTime: string;
  locationId: string;
  activity: string;
  onBlockedLocation: OnBlockedLocation;
}

/** Suggested sim location ids (free text; the sim owns the real location set). */
export const LOCATION_SUGGESTIONS = [
  'janice_desk',
  'carl_desk',
  'linda_desk',
  'manager_office',
  'break_room',
  'hallway',
  'conference_room',
  'reception',
];

/**
 * Suggested routine activities (still free text — the sim owns meaning). Derived
 * from the activity-badge vocabulary so an authored routine and the overhead
 * badge it gets in the sim can't drift apart. 'none' is the blank/no-badge state.
 */
export const ACTIVITY_SUGGESTIONS = ACTIVITIES.filter((a) => a !== 'none');

// --- identity & temperament -------------------------------------------------

export const SENIORITY = ['intern', 'junior', 'senior', 'lead', 'manager'] as const;
export type Seniority = (typeof SENIORITY)[number];

/**
 * Curated option lists for the otherwise free-text identity fields. These are
 * deliberately *not* union types on Identity — the fields stay `string` so older
 * saves (and any one-off custom value) survive; the UI renders them as closed
 * dropdowns that still preserve whatever is already set. Extend a list here to
 * add a new choice. Departments include the office's generator departments
 * (Accounting/IT/HR/Management — see core/employee.ts) for consistency.
 */
export const DEPARTMENTS = [
  'Accounting',
  'Finance',
  'Sales',
  'Marketing',
  'IT',
  'Engineering',
  'HR',
  'Operations',
  'Facilities',
  'Customer Support',
  'Legal',
  'Management',
  'Executive',
] as const;

export const AGE_BANDS = ['20s', '30s', '40s', '50s', '60s+'] as const;

export const PRONOUNS = ['she/her', 'he/him', 'they/them', 'she/they', 'he/they', 'any', 'prefer not to say'] as const;

export interface Identity {
  displayName: string;
  pronouns: string;
  roleTitle: string;
  /**
   * Department **catalog id** (Epic 3 F3.1) — references the project `departments`
   * catalog (core/department.ts). `''` = unassigned. Mutable: the sim reassigns it
   * for transfers (E41). Older free-text values are migrated to ids by migrateV11.
   */
  department: string;
  seniority: Seniority;
  ageBand: string;
  bio: string;
  prototypeRole: string;
}

export interface Temperament {
  baselineSocialState: Mood;
  /** Derived from neuroticism + temper by default. */
  volatility: Derived;
}

export const PALETTE_SOURCES = ['default-from-recipe', 'override'] as const;
export type PaletteSource = (typeof PALETTE_SOURCES)[number];

export interface SpriteBinding {
  /** Family/Recipe id from the sprite tool (Epic 28 F28.4). */
  layerAtlasId: string;
  /** == agentId by convention; auto-linked to the sprite recipe id. */
  characterConfigId: string;
  fallbackSpriteId: string | null;
  paletteSource: PaletteSource;
}

// --- the profile ------------------------------------------------------------

export interface CharacterProfile {
  /** Stable key. Equals the CharacterRecipe id and the sim's AgentId. */
  agentId: string;
  identity: Identity;
  personality: Personality;
  needs: Record<NeedId, NeedSetting>;
  drives: Drives;
  preferences: Preference[];
  skills: Skill[];
  relationships: Relationship[];
  formativeEvents: FormativeEvent[];
  reactionTendencies: Record<ReactionCategory, Derived>;
  /** Physical-expression dispositions (how this body occupies space). Derived from
   *  the spine, sticky once authored; resolved to plain numbers on export. */
  presence: Record<PresenceChannel, Derived>;
  /** Per-mood presence deltas — how this body physically expresses each mood (§5.8).
   *  Optional + sparse; absent ⇒ the body expresses every mood the same way. */
  presenceMoods?: PresenceMoodMap;
  routine: RoutineBlock[];
  temperament: Temperament;
  spriteBinding: SpriteBinding;
}

// --- derivation -------------------------------------------------------------

/** Compute the derived game axes from the personality spine. */
export function deriveAxes(
  ocean: Record<OceanAxis, number>,
  _axes: Record<PrimaryGameAxis, number>,
): Record<DerivedGameAxis, number> {
  return {
    // Temper = anger / conflict-escalation, weighted toward neuroticism.
    temper: clampUnit(0.6 * ocean.neuroticism + 0.4 * (100 - ocean.agreeableness)),
    // Grudge-holding = resentment persistence, weighted toward disagreeableness.
    grudgeHolding: clampUnit(0.6 * (100 - ocean.agreeableness) + 0.4 * ocean.neuroticism),
  };
}

/** Compute reaction propensities from the spine. Starting heuristics; tunable. */
export function deriveReactionTendencies(
  ocean: Record<OceanAxis, number>,
  axes: Record<PrimaryGameAxis, number>,
  temper: number,
): Record<ReactionCategory, number> {
  return {
    confront: avg(ocean.extraversion, 100 - ocean.agreeableness, temper),
    gossip: avg(100 - axes.discretion, ocean.extraversion),
    withdraw: avg(ocean.neuroticism, 100 - ocean.extraversion),
    verify: avg(ocean.conscientiousness, axes.integrity),
    reassure: avg(ocean.agreeableness, ocean.extraversion),
    escalate: avg(axes.ambition, ocean.conscientiousness),
    ignore: avg(100 - ocean.extraversion, 100 - ocean.neuroticism),
  };
}

export function deriveVolatility(ocean: Record<OceanAxis, number>, temper: number): number {
  return avg(ocean.neuroticism, temper);
}

/**
 * Compute the presence dispositions from the spine. Starting heuristics — tunable
 * exactly like the reaction tendencies, and explicitly NOT a contract the sim
 * re-runs: the sim consumes the resolved numbers, never the formula. Mirrors the
 * derive-a-base-then-author principle so two different personas automatically move
 * differently before anyone touches a slider.
 */
export function derivePresence(
  ocean: Record<OceanAxis, number>,
  axes: Record<PrimaryGameAxis, number>,
): Record<PresenceChannel, number> {
  return {
    // Brisk, confident walkers read as outgoing + driven.
    gaitSpeed: avg(ocean.extraversion, axes.ambition),
    // Crisp, controlled stops/starts read as disciplined + calm.
    gaitControl: avg(ocean.conscientiousness, 100 - ocean.neuroticism),
    // Idle fidget energy: anxious + energetic + undisciplined.
    restlessness: avg(ocean.neuroticism, ocean.extraversion, 100 - ocean.conscientiousness),
    // Default standing distance: prickly + introverted + guarded keep more space.
    personalSpace: avg(100 - ocean.agreeableness, 100 - ocean.extraversion, ocean.neuroticism),
    // Gesture frequency + size: outgoing + open + uninhibited.
    expressiveness: avg(ocean.extraversion, ocean.openness, 100 - ocean.neuroticism),
    // Follow-through vs second-guessing (the "Carl" knob): decisive = calm + conscientious + driven.
    commitment: avg(100 - ocean.neuroticism, ocean.conscientiousness, axes.ambition),
    // Pause/linger length at transitions: anxious + introverted hesitate longer.
    latency: avg(ocean.neuroticism, 100 - ocean.extraversion),
    // Head-turn-to-notice / glance toward events: curious + outgoing.
    attentiveness: avg(ocean.openness, ocean.extraversion),
  };
}

/**
 * Recompute every derived field that hasn't been hand-authored. Mutates and
 * returns the profile. Run on create, after spine edits, and before export.
 */
export function applyDerived(p: CharacterProfile): CharacterProfile {
  const { ocean, axes } = p.personality;
  const da = deriveAxes(ocean, axes);
  for (const key of DERIVED_GAME_AXES) {
    if (!p.personality.derivedAxes[key].authored) p.personality.derivedAxes[key].value = da[key];
  }
  const temper = p.personality.derivedAxes.temper.value;
  const rt = deriveReactionTendencies(ocean, axes, temper);
  for (const key of REACTION_CATEGORIES) {
    if (!p.reactionTendencies[key].authored) p.reactionTendencies[key].value = rt[key];
  }
  if (!p.temperament.volatility.authored) {
    p.temperament.volatility.value = deriveVolatility(ocean, temper);
  }
  const pres = derivePresence(ocean, axes);
  for (const key of PRESENCE_CHANNELS) {
    if (!p.presence[key].authored) p.presence[key].value = pres[key];
  }
  return p;
}

/**
 * Attach a spine-derived presence layer to a profile that predates it (migration
 * helper, v14). No-op if presence already exists, so it never clobbers authored
 * channels; otherwise seeds neutral wrappers and re-derives from the spine.
 */
export function ensurePresence(p: CharacterProfile): CharacterProfile {
  if (!(p as { presence?: unknown }).presence) {
    p.presence = blankPresence();
    applyDerived(p);
  }
  return p;
}

export interface PresencePresetReport {
  applied: Array<{ channel: PresenceChannel; delta: number; value: number }>;
}

/**
 * Fold a presence preset's deltas over the current spine-derived baseline — the
 * `derive → preset → override` authoring step for the body layer. The baseline is
 * refreshed first (so deltas land on the up-to-date derivation), then each touched
 * channel is clamped and marked `authored` so the preset sticks through later
 * re-derivation and survives export (which re-runs applyDerived). One-shot, like
 * applyFormativeEffects: applying a second preset stacks on the first (its deltas
 * fold over already-authored channels), and untouched channels keep deriving from
 * the spine. Mutates the profile; returns what changed.
 */
export function applyPresencePreset(p: CharacterProfile, preset: PresencePreset): PresencePresetReport {
  applyDerived(p); // bring every non-authored channel to its current spine baseline
  const applied: PresencePresetReport['applied'] = [];
  for (const channel of PRESENCE_CHANNELS) {
    const delta = preset.deltas[channel];
    if (!delta) continue; // skip 0 / undefined — a no-op channel
    const value = clampUnit(p.presence[channel].value + delta);
    p.presence[channel] = { value, authored: true };
    applied.push({ channel, delta, value });
  }
  return { applied };
}

// --- per-mood presence modulation (§5.8) ------------------------------------

/** Set (or clear, when 0) one channel's delta for one mood, pruning empties. */
export function setPresenceMood(
  p: CharacterProfile,
  mood: Mood,
  channel: PresenceChannel,
  delta: number,
): void {
  const map = (p.presenceMoods ??= {});
  if (!delta) {
    const entry = map[mood];
    if (entry) {
      delete entry[channel];
      if (Object.keys(entry).length === 0) delete map[mood];
    }
    if (Object.keys(map).length === 0) delete p.presenceMoods;
    return;
  }
  (map[mood] ??= {})[channel] = clampBipolar(delta);
}

/** Replace a mood's whole delta set (the "fill typical" / preset action), pruning zeros. */
export function setPresenceMoodMap(
  p: CharacterProfile,
  mood: Mood,
  deltas: Partial<Record<PresenceChannel, number>>,
): void {
  clearPresenceMood(p, mood);
  for (const channel of PRESENCE_CHANNELS) setPresenceMood(p, mood, channel, deltas[channel] ?? 0);
}

/** Remove all deltas for a mood, pruning the map when it empties. */
export function clearPresenceMood(p: CharacterProfile, mood: Mood): void {
  if (!p.presenceMoods) return;
  delete p.presenceMoods[mood];
  if (Object.keys(p.presenceMoods).length === 0) delete p.presenceMoods;
}

/** Canonical, prune-empty copy of a mood map: clamps deltas, drops 0s/empty moods. */
export function normalizePresenceMoods(map: PresenceMoodMap | undefined): PresenceMoodMap {
  const out: PresenceMoodMap = {};
  for (const mood of MODULATED_MOODS) {
    const entry = map?.[mood];
    if (!entry) continue;
    const cleaned: Partial<Record<PresenceChannel, number>> = {};
    for (const channel of PRESENCE_CHANNELS) {
      const d = entry[channel];
      if (d) cleaned[channel] = clampBipolar(d);
    }
    if (Object.keys(cleaned).length) out[mood] = cleaned;
  }
  return out;
}

/**
 * A trait is a reusable, structured personality tag defined once in the project
 * catalog and referenced by persona (id strings in `personality.traitTags`).
 * `biasesReactions` is the contract hook the sim acts on — signed nudges to the
 * reaction propensities, on a coarse −2..+2 scale (the sim scales to its own
 * units and combines with the spine-derived tendencies in deriveReactionTendencies).
 * Only non-zero categories are stored. Behavior selection stays in the sim.
 */
export const TRAIT_CATEGORIES = [
  'work_ethic', 'social', 'politics', 'temperament', 'integrity', 'openness', 'competence', 'status',
] as const;
export type TraitCategory = (typeof TRAIT_CATEGORIES)[number];

export interface TraitDefinition {
  id: string;
  label: string;
  description: string;
  category: TraitCategory;
  biasesReactions: Partial<Record<ReactionCategory, number>>;
}

/** Trait ids suggested from the spine (UI offers these; never auto-applied). */
export function suggestedTraitTags(p: CharacterProfile): string[] {
  const { ocean, axes, derivedAxes } = p.personality;
  const tags: string[] = [];
  if (ocean.conscientiousness >= 70 && axes.ambition >= 70) tags.push('workaholic');
  if (ocean.conscientiousness <= 30) tags.push('scatterbrained');
  if (axes.discretion <= 35) tags.push('gossip');
  if (axes.ambition >= 75) tags.push('climber');
  if (ocean.agreeableness <= 30) tags.push('prickly');
  if (ocean.agreeableness >= 75 && ocean.extraversion >= 60) tags.push('office_mom');
  if (ocean.extraversion >= 75) tags.push('social');
  if (ocean.extraversion <= 30) tags.push('wallflower');
  if (ocean.neuroticism >= 70) tags.push('worrier');
  if (ocean.openness <= 30) tags.push('set_in_their_ways');
  if (ocean.openness >= 75) tags.push('curious');
  if (axes.integrity <= 35) tags.push('spin_doctor');
  if (axes.integrity >= 75) tags.push('straight_shooter');
  if (axes.loyalty >= 75) tags.push('loyalist');
  if (axes.loyalty <= 30) tags.push('opportunist');
  if (derivedAxes.temper.value >= 70) tags.push('hot_headed');
  if (derivedAxes.grudgeHolding.value >= 70) tags.push('grudge_holder');
  return tags.filter((t) => !p.personality.traitTags.includes(t));
}

// --- factory ----------------------------------------------------------------

const neutralOcean = (): Record<OceanAxis, number> => ({
  openness: 50,
  conscientiousness: 50,
  extraversion: 50,
  agreeableness: 50,
  neuroticism: 50,
});

const neutralAxes = (): Record<PrimaryGameAxis, number> => ({
  ambition: 50,
  integrity: 50,
  loyalty: 50,
  discretion: 50,
});

const defaultNeeds = (): Record<NeedId, NeedSetting> =>
  Object.fromEntries(NEEDS.map((n) => [n, { baseline: 70, sensitivity: 50 }])) as Record<
    NeedId,
    NeedSetting
  >;

const blankReactions = (): Record<ReactionCategory, Derived> =>
  Object.fromEntries(REACTION_CATEGORIES.map((c) => [c, derived(50)])) as Record<
    ReactionCategory,
    Derived
  >;

const blankPresence = (): Record<PresenceChannel, Derived> =>
  Object.fromEntries(PRESENCE_CHANNELS.map((c) => [c, derived(50)])) as Record<
    PresenceChannel,
    Derived
  >;

/** A neutral profile for a recipe — all sliders mid, derived computed, lists empty. */
export function createDefaultProfile(recipe: CharacterRecipe): CharacterProfile {
  const profile: CharacterProfile = {
    agentId: recipe.id,
    identity: {
      displayName: recipe.name,
      pronouns: '',
      roleTitle: '',
      department: '',
      seniority: 'junior',
      ageBand: '',
      bio: '',
      prototypeRole: '',
    },
    personality: {
      ocean: neutralOcean(),
      axes: neutralAxes(),
      derivedAxes: { temper: derived(50), grudgeHolding: derived(50) },
      traitTags: [],
    },
    needs: defaultNeeds(),
    drives: { primary: '', secondary: '', objectives: [] },
    preferences: [],
    skills: [],
    relationships: [],
    formativeEvents: [],
    reactionTendencies: blankReactions(),
    presence: blankPresence(),
    routine: [],
    temperament: { baselineSocialState: 'normal', volatility: derived(50) },
    spriteBinding: {
      layerAtlasId: recipe.id,
      characterConfigId: recipe.id,
      fallbackSpriteId: null,
      paletteSource: 'default-from-recipe',
    },
  };
  return applyDerived(profile);
}

// --- validation -------------------------------------------------------------

export interface ValidationContext {
  /** All recipe ids in the project — relationship/formative targets must resolve. */
  agentIds: string[];
  subjectIds?: string[];
  skillIds?: string[];
}

/**
 * Return human-readable issues with a profile. Empty array = valid. Used by the
 * import path and the round-trip test; the live UI clamps at the input layer.
 */
export function validateProfile(p: CharacterProfile, ctx: ValidationContext): string[] {
  const issues: string[] = [];
  const subjectIds = new Set(ctx.subjectIds ?? SUBJECT_CATALOG.map((s) => s.subjectId));
  const skillIds = new Set(ctx.skillIds ?? SKILL_TRACKS.map((s) => s.skillId));
  const agents = new Set(ctx.agentIds);

  const unit = (label: string, v: number) => {
    if (typeof v !== 'number' || v < 0 || v > 100) issues.push(`${label} must be 0–100 (got ${v}).`);
  };
  const bip = (label: string, v: number) => {
    if (typeof v !== 'number' || v < -100 || v > 100)
      issues.push(`${label} must be -100..100 (got ${v}).`);
  };

  if (!p.agentId) issues.push('Profile is missing agentId.');
  if (!agents.has(p.agentId)) issues.push(`agentId "${p.agentId}" has no matching character recipe.`);

  for (const k of OCEAN_AXES) unit(`ocean.${k}`, p.personality.ocean[k]);
  for (const k of PRIMARY_GAME_AXES) unit(`axes.${k}`, p.personality.axes[k]);
  for (const k of DERIVED_GAME_AXES) unit(`derivedAxes.${k}`, p.personality.derivedAxes[k]?.value);

  for (const n of NEEDS) {
    unit(`needs.${n}.baseline`, p.needs[n]?.baseline);
    unit(`needs.${n}.sensitivity`, p.needs[n]?.sensitivity);
  }

  for (const pref of p.preferences) {
    bip(`preference "${pref.subjectId}"`, pref.valence);
    if (!subjectIds.has(pref.subjectId))
      issues.push(`preference subjectId "${pref.subjectId}" is not in the subject catalog.`);
  }

  for (const s of p.skills) {
    unit(`skill "${s.skillId}"`, s.level);
    if (!skillIds.has(s.skillId)) issues.push(`skill "${s.skillId}" is not a declared skill track.`);
  }

  for (const r of p.relationships) {
    if (!agents.has(r.targetAgentId))
      issues.push(`relationship target "${r.targetAgentId}" has no matching character.`);
    if (r.targetAgentId === p.agentId) issues.push('relationship points at the character itself.');
    for (const a of RELATIONSHIP_AXES) unit(`relationship ${r.targetAgentId}.${a}`, r[a]);
    bip(`relationship ${r.targetAgentId}.affinity`, r.affinity);
  }

  for (const c of REACTION_CATEGORIES) unit(`reactionTendencies.${c}`, p.reactionTendencies[c]?.value);
  for (const c of PRESENCE_CHANNELS) unit(`presence.${c}`, p.presence[c]?.value);
  for (const mood of MODULATED_MOODS) {
    const entry = p.presenceMoods?.[mood];
    if (!entry) continue;
    for (const c of PRESENCE_CHANNELS) {
      if (entry[c] !== undefined) bip(`presenceMoods.${mood}.${c}`, entry[c]!);
    }
  }
  unit('temperament.volatility', p.temperament.volatility?.value);

  for (const fe of p.formativeEvents) {
    for (const a of fe.involvedAgentIds) {
      if (!agents.has(a)) issues.push(`formative event "${fe.title}" involves unknown agent "${a}".`);
    }
  }

  return issues;
}

/** Clamp every numeric field into range. Mutates and returns. */
export function clampProfile(p: CharacterProfile): CharacterProfile {
  for (const k of OCEAN_AXES) p.personality.ocean[k] = clampUnit(p.personality.ocean[k]);
  for (const k of PRIMARY_GAME_AXES) p.personality.axes[k] = clampUnit(p.personality.axes[k]);
  for (const k of DERIVED_GAME_AXES) p.personality.derivedAxes[k].value = clampUnit(p.personality.derivedAxes[k].value);
  for (const n of NEEDS) {
    p.needs[n].baseline = clampUnit(p.needs[n].baseline);
    p.needs[n].sensitivity = clampUnit(p.needs[n].sensitivity);
  }
  for (const pref of p.preferences) pref.valence = clampBipolar(pref.valence);
  for (const s of p.skills) s.level = clampUnit(s.level);
  for (const r of p.relationships) {
    for (const a of RELATIONSHIP_AXES) r[a] = clampUnit(r[a]);
    r.affinity = clampBipolar(r.affinity);
  }
  for (const c of REACTION_CATEGORIES) p.reactionTendencies[c].value = clampUnit(p.reactionTendencies[c].value);
  for (const c of PRESENCE_CHANNELS) p.presence[c].value = clampUnit(p.presence[c].value);
  if (p.presenceMoods) {
    const norm = normalizePresenceMoods(p.presenceMoods);
    if (Object.keys(norm).length) p.presenceMoods = norm;
    else delete p.presenceMoods;
  }
  p.temperament.volatility.value = clampUnit(p.temperament.volatility.value);
  return p;
}

// --- formative-event apply engine -------------------------------------------

const clampTo = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, Math.round(v)));

/**
 * Apply one numeric op. `set` writes the value, `add` is an absolute delta, and
 * `nudge` moves a fraction (value as a percent) toward the endpoint in the
 * value's direction — e.g. nudge +20 on 50/[0,100] → 60, nudge -20 → 40.
 */
function opNumber(current: number, op: FormativeOp, value: number, lo: number, hi: number): number {
  if (op === 'set') return clampTo(value, lo, hi);
  if (op === 'add') return clampTo(current + value, lo, hi);
  const frac = Math.max(-1, Math.min(1, value / 100));
  const target = frac >= 0 ? hi : lo;
  return clampTo(current + (target - current) * Math.abs(frac), lo, hi);
}

export interface FormativeApplyReport {
  applied: string[];
  skipped: string[];
}

/**
 * Fold the given formative events' effects into the profile's starting fields —
 * the "compute a base, then hand-edit" authoring step (design §9). This is a
 * one-shot, user-triggered action (not re-run on load), so it never double-applies
 * on its own; applying the same event twice compounds, which is the caller's call.
 * Mutates the profile and returns a report of what changed / was skipped.
 */
export function applyFormativeEffects(p: CharacterProfile, events: FormativeEvent[]): FormativeApplyReport {
  const applied: string[] = [];
  const skipped: string[] = [];

  for (const ev of events) {
    for (const eff of ev.effects) {
      const numeric = typeof eff.value === 'number' ? eff.value : Number(eff.value);
      const needsNumber = eff.targetKind !== 'trait_tag' && eff.targetKind !== 'drive';
      if (needsNumber && Number.isNaN(numeric)) {
        skipped.push(`${ev.title}: ${eff.targetKind} "${eff.targetRef}" needs a numeric value.`);
        continue;
      }

      switch (eff.targetKind) {
        case 'personality_axis': {
          if ((OCEAN_AXES as readonly string[]).includes(eff.targetRef)) {
            const k = eff.targetRef as OceanAxis;
            p.personality.ocean[k] = opNumber(p.personality.ocean[k], eff.op, numeric, 0, 100);
          } else if ((PRIMARY_GAME_AXES as readonly string[]).includes(eff.targetRef)) {
            const k = eff.targetRef as PrimaryGameAxis;
            p.personality.axes[k] = opNumber(p.personality.axes[k], eff.op, numeric, 0, 100);
          } else {
            skipped.push(`${ev.title}: unknown personality axis "${eff.targetRef}".`);
            continue;
          }
          applied.push(`${ev.title}: ${eff.op} ${eff.targetRef} → ${numeric}`);
          break;
        }
        case 'need_baseline': {
          if (!(NEEDS as readonly string[]).includes(eff.targetRef)) {
            skipped.push(`${ev.title}: unknown need "${eff.targetRef}".`);
            continue;
          }
          const n = eff.targetRef as NeedId;
          p.needs[n].baseline = opNumber(p.needs[n].baseline, eff.op, numeric, 0, 100);
          applied.push(`${ev.title}: ${eff.op} need ${n}.baseline → ${numeric}`);
          break;
        }
        case 'relationship_axis': {
          const [agent, axis] = eff.targetRef.split(':');
          if (!agent || !axis) {
            skipped.push(`${ev.title}: relationship ref must be "agent:axis" (got "${eff.targetRef}").`);
            continue;
          }
          let r = p.relationships.find((x) => x.targetAgentId === agent);
          if (!r) {
            r = { targetAgentId: agent, trust: 50, suspicion: 0, affinity: 0, influence: 0, respect: 50, familiarity: 50, tags: [] };
            p.relationships.push(r);
          }
          if (axis === 'affinity') {
            r.affinity = opNumber(r.affinity, eff.op, numeric, -100, 100);
          } else if ((RELATIONSHIP_AXES as readonly string[]).includes(axis)) {
            const a = axis as RelationshipAxis;
            r[a] = opNumber(r[a], eff.op, numeric, 0, 100);
          } else {
            skipped.push(`${ev.title}: unknown relationship axis "${axis}".`);
            continue;
          }
          applied.push(`${ev.title}: ${eff.op} ${agent}.${axis} → ${numeric}`);
          break;
        }
        case 'preference': {
          let pref = p.preferences.find((x) => x.subjectId === eff.targetRef);
          if (!pref) {
            pref = { subjectId: eff.targetRef, valence: 0 };
            p.preferences.push(pref);
          }
          pref.valence = opNumber(pref.valence, eff.op, numeric, -100, 100);
          applied.push(`${ev.title}: ${eff.op} preference ${eff.targetRef} → ${numeric}`);
          break;
        }
        case 'belief': {
          // Beliefs are scenario-owned now; a persona formative event can't seed
          // one. Author the belief as a scenario beliefSeed instead.
          skipped.push(`${ev.title}: beliefs are scenario-owned — add a scenario beliefSeed for topic "${eff.targetRef}".`);
          break;
        }
        case 'trait_tag': {
          const tag = String(eff.value).trim();
          if (tag && !p.personality.traitTags.includes(tag)) {
            p.personality.traitTags.push(tag);
            applied.push(`${ev.title}: added trait tag "${tag}"`);
          } else {
            skipped.push(`${ev.title}: trait tag "${tag}" empty or already present.`);
          }
          break;
        }
        case 'drive': {
          const slot = eff.targetRef === 'secondary' ? 'secondary' : 'primary';
          p.drives[slot] = String(eff.value);
          applied.push(`${ev.title}: set ${slot} drive → ${eff.value}`);
          break;
        }
        default:
          skipped.push(`${ev.title}: unknown target kind "${eff.targetKind}".`);
      }
    }
  }

  // Spine may have moved; refresh any non-authored derived fields.
  applyDerived(p);
  return { applied, skipped };
}

// --- export serialization ---------------------------------------------------

/**
 * The consumer-facing shape written to `characters/<id>/profile.json`. Derived
 * fields are resolved to plain numbers (the sim shouldn't re-derive), and the
 * authoring-only `authored` flags are dropped. The full editable form (with
 * Derived wrappers) lives in project.json instead — same split as recipe vs sheet.
 */
export function serializeProfile(input: CharacterProfile): unknown {
  const p = applyDerived(structuredClone(input));
  return {
    agentId: p.agentId,
    identity: p.identity,
    personality: {
      ocean: p.personality.ocean,
      axes: {
        ...p.personality.axes,
        temper: p.personality.derivedAxes.temper.value,
        grudgeHolding: p.personality.derivedAxes.grudgeHolding.value,
      },
      traitTags: p.personality.traitTags,
    },
    needs: p.needs,
    drives: p.drives,
    preferences: p.preferences,
    skills: p.skills,
    relationships: p.relationships,
    formativeEvents: p.formativeEvents,
    reactionTendencies: Object.fromEntries(
      REACTION_CATEGORIES.map((c) => [c, p.reactionTendencies[c].value]),
    ),
    presence: Object.fromEntries(
      PRESENCE_CHANNELS.map((c) => [c, p.presence[c].value]),
    ),
    // Per-mood presence deltas (§5.8) — sparse; omitted entirely when none authored.
    ...(() => {
      const moods = normalizePresenceMoods(p.presenceMoods);
      return Object.keys(moods).length ? { presenceMoods: moods } : {};
    })(),
    routine: p.routine,
    temperament: {
      baselineSocialState: p.temperament.baselineSocialState,
      volatility: p.temperament.volatility.value,
    },
    spriteBinding: p.spriteBinding,
    meta: { generator: 'sprite-character-creator', schema: 'character_model.md', schemaVersion: CURRENT_SCHEMA_VERSION },
  };
}
