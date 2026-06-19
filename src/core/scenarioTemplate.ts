/**
 * Scenario templates — cast-agnostic, role-slotted scenarios for the full game.
 *
 * A bound {@link Scenario} (scenario.ts) hard-binds its cast: every truth fact,
 * information item, belief seed, and objective names a specific `agentId`. That is
 * right for the prototype (one office, one fixed cast — `promotion_rumor_001`), but
 * the full game has three independent axes — Cast (who), Office (where), and
 * Scenario (what could happen). A `ScenarioTemplate` is that third axis: a stateless
 * template of **role slots + preconditions + a seed + an emotional payload**, cast
 * onto whoever in the current cast best fits the roles.
 *
 * Casting ({@link castTemplate}) rewrites roles → agents and emits a concrete,
 * fully-bound `Scenario` that loads exactly like a hand-authored one — a bound
 * scenario is just the fully-cast special case of a template.
 *
 * This is purely additive: it does not touch the bound-`Scenario` path. See the
 * design note in docs/scenario-template-model.md and the spec in
 * game-design-docs/the-water-cooler/docs/design/scenario_model.md
 * ("Full-game direction: decoupling the cast from the scenario").
 */
import {
  DERIVED_GAME_AXES,
  NEEDS,
  OCEAN_AXES,
  PRIMARY_GAME_AXES,
  STANCES,
  type CharacterProfile,
  type DerivedGameAxis,
  type NeedId,
  type OceanAxis,
  type PrimaryGameAxis,
  type Relationship,
} from './profile';
import {
  ACCESS_STATES,
  OBJECTIVE_CATEGORIES,
  ORIGIN_TYPES,
  OVERRIDE_AXES,
  TRUTH_ALIGNMENTS,
  validateScenario,
  type AccessState,
  type InterventionType,
  type OriginType,
  type Scenario,
  type ScenarioBelief,
  type ScenarioObjective,
  type ScenarioVariant,
  type TruthAlignment,
} from './scenario';
import { CURRENT_SCHEMA_VERSION } from './types';

// --- the precondition vocabulary --------------------------------------------
// Built entirely on the catalogs the tool already owns (traits, drives,
// relationshipTypes + the relationship axes, OCEAN + game axes, needs) — never a
// parallel vocabulary. See docs/scenario-template-model.md §3.

/** Persona personality axes a precondition can threshold against. */
export const PERSONA_AXES = [...OCEAN_AXES, ...PRIMARY_GAME_AXES, ...DERIVED_GAME_AXES] as const;
export type PersonaAxis = OceanAxis | PrimaryGameAxis | DerivedGameAxis;

/** Relationship axes a relationship precondition can threshold (affinity is bipolar). */
export const REL_PRECONDITION_AXES = ['trust', 'suspicion', 'affinity', 'influence', 'respect', 'familiarity'] as const;
export type RelPreconditionAxis = (typeof REL_PRECONDITION_AXES)[number];

export type CompareOp = 'gte' | 'lte';
export type RelDirection = 'outgoing' | 'incoming' | 'mutual';

/** Candidate carries (or lacks) a trait tag (an id into the trait catalog). */
export interface TraitPrecondition {
  kind: 'trait';
  trait: string;
  mode: 'has' | 'lacks';
}
/** Candidate's OCEAN / game / derived axis compares against a 0–100 threshold. */
export interface AxisPrecondition {
  kind: 'axis';
  axis: PersonaAxis;
  op: CompareOp;
  value: number;
}
/** Candidate's need baseline/sensitivity compares against a 0–100 threshold. */
export interface NeedPrecondition {
  kind: 'need';
  need: NeedId;
  field: 'baseline' | 'sensitivity';
  op: CompareOp;
  value: number;
}
/** Candidate's primary or secondary drive is one of the listed drive ids. */
export interface DrivePrecondition {
  kind: 'drive';
  anyOf: string[];
}
/**
 * Candidate's relationship *to the agent assigned to another role*. This is what
 * makes "two agents with mutual attraction" expressible. `direction` is relative to
 * the candidate (outgoing = candidate → other). Proximity is modeled as the
 * `familiarity` axis (see the design note §3) — the sim refines it with live state.
 */
export interface RelationshipPrecondition {
  kind: 'relationship';
  toRole: string;
  direction: RelDirection;
  /** relationshipType id constraint (single) — the edge's type must equal this. */
  type?: string;
  /** relationshipType id constraint (any of) — the edge's type must be one of these. */
  typeAnyOf?: string[];
  /** Numeric axis constraint on the edge. */
  axis?: RelPreconditionAxis;
  op?: CompareOp;
  value?: number;
}

export type AggregateReduce = 'min' | 'max' | 'avg';
/**
 * Candidate's relationship axis **aggregated across the rest of the cast** — the
 * "to-everyone" condition the pairwise `relationship` kind can't express (e.g. an
 * outsider with *low familiarity to everybody*). Intrinsic (no role ref): evaluated
 * over the whole cast minus the candidate. A relationship that doesn't exist counts
 * as `missingAs` (default 0 — "they don't know them"), so a no-edge newcomer reads
 * as maximally unfamiliar. See docs/scenario-template-model.md §3.
 */
export interface AggregatePrecondition {
  kind: 'aggregate';
  axis: RelPreconditionAxis;
  reduce: AggregateReduce;
  direction: 'outgoing' | 'incoming';
  op: CompareOp;
  value: number;
  /** Edge value assumed when a relationship is absent (default 0). */
  missingAs?: number;
}

export type Precondition =
  | TraitPrecondition
  | AxisPrecondition
  | NeedPrecondition
  | DrivePrecondition
  | RelationshipPrecondition
  | AggregatePrecondition;

const isRelational = (p: Precondition): p is RelationshipPrecondition => p.kind === 'relationship';

// --- the template ------------------------------------------------------------

export interface RoleSlot {
  roleId: string;
  label: string;
  description: string;
  /** A required role that can't fill fails the cast; an optional one is skipped. */
  required: boolean;
  /**
   * `'present'` (default) = the matched agent is an active participant (cast +
   * spawn). `'absent'` = the matched agent is resolved (for distinctness + so the
   * seed/truth/info can reference them by id) and **reported as the one to keep
   * out**, but is NOT added to the emitted cast/spawns — the "negative role" the
   * Scapegoat's off-scene culprit and the Power Vacuum's removed authority need.
   * `required` still governs whether a qualifying agent must exist.
   */
  presence?: 'present' | 'absent';
  preconditions: Precondition[];
}

const isAbsent = (r: RoleSlot): boolean => r.presence === 'absent';

/** Per-role scenario seeds, layered onto the persona at load (role refs, not agentIds). */
export interface TemplateRelationshipOverride {
  toRole: string;
  trust?: number;
  suspicion?: number;
  affinity?: number;
  influence?: number;
  respect?: number;
  familiarity?: number;
  tags?: string[];
}
export interface RoleSeed {
  roleId: string;
  beliefSeeds: ScenarioBelief[];
  /** informationIds this role starts aware of. */
  knowledgeSeeds: string[];
  relationshipOverrides: TemplateRelationshipOverride[];
}

/** A cast-agnostic location; desk binding is resolved to `desk:<agentId>` at cast time. */
export interface TemplateLocation {
  locationId: string;
  displayName: string;
  tags: string[];
  accessState: AccessState;
  fallbackLocationId: string;
  /** Office room id this binds to (e.g. `cubicle-farm`). */
  bindRoomId: string;
  /** When set, bind the anchor to the desk of whichever agent fills this role. */
  bindDeskOfRole?: string;
}

export interface TemplateTruthFact {
  truthId: string;
  topic: string;
  statement: string;
  subjectRoles: string[];
  objectiveValue: boolean;
  sourceRole: string;
}

export interface TemplateInformationItem {
  informationId: string;
  topic: string;
  claim: string;
  originType: OriginType;
  truthId: string;
  truthAlignment: TruthAlignment;
  sourceRole: string;
  initialHolderRoles: string[];
}

/** The emotional response(s) the scenario is designed to be able to produce (harvest). */
export interface EmotionalPayload {
  targetEmotions: string[];
  description: string;
}

export interface ScenarioTemplate {
  templateId: string;
  /** Organizing group (e.g. 'attraction', 'rumor', 'rivalry'); free-text. */
  family?: string;
  title: string;
  summary: string;
  /** Emerges when the live cast already satisfies preconditions, or is provoked. */
  triggering: 'emerge' | 'provoke';
  emotionalPayload: EmotionalPayload;
  roles: RoleSlot[];
  roleSeeds: RoleSeed[];
  locations: TemplateLocation[];
  roleSpawns: Array<{ roleId: string; locationId: string }>;
  truthFacts: TemplateTruthFact[];
  informationItems: TemplateInformationItem[];
  interventionTypes: InterventionType[];
  variants: ScenarioVariant[];
  defaultVariantId: string;
  objective: ScenarioObjective;
}

// --- precondition evaluation -------------------------------------------------

function readPersonaAxis(p: CharacterProfile, axis: PersonaAxis): number {
  if ((OCEAN_AXES as readonly string[]).includes(axis)) return p.personality.ocean[axis as OceanAxis];
  if ((PRIMARY_GAME_AXES as readonly string[]).includes(axis)) return p.personality.axes[axis as PrimaryGameAxis];
  return p.personality.derivedAxes[axis as DerivedGameAxis].value;
}

const cmp = (v: number, op: CompareOp, t: number): boolean => (op === 'gte' ? v >= t : v <= t);
/** Normalized 0–1 "how far past the threshold" — the fit margin used for tie-breaking. */
const margin = (v: number, op: CompareOp, t: number): number =>
  Math.max(0, Math.min(1, (op === 'gte' ? v - t : t - v) / 100));

const edgeOf = (from: CharacterProfile, toId: string): Relationship | undefined =>
  from.relationships.find((r) => r.targetAgentId === toId);

/** Aggregate a candidate's relationship axis across the rest of the cast. */
function aggregateValue(p: CharacterProfile, pre: AggregatePrecondition, cast: CharacterProfile[]): number | null {
  const others = cast.filter((o) => o.agentId !== p.agentId);
  if (others.length === 0) return null;
  const missingAs = pre.missingAs ?? 0;
  const read = (o: CharacterProfile): number => {
    const e = pre.direction === 'outgoing' ? edgeOf(p, o.agentId) : edgeOf(o, p.agentId);
    if (!e) return missingAs;
    return pre.axis === 'affinity' ? e.affinity : e[pre.axis];
  };
  const vals = others.map(read);
  if (pre.reduce === 'min') return Math.min(...vals);
  if (pre.reduce === 'max') return Math.max(...vals);
  return vals.reduce((a, c) => a + c, 0) / vals.length;
}

/** Whether a single-candidate (intrinsic) precondition holds for a profile. */
function intrinsicHolds(p: CharacterProfile, pre: Precondition, cast: CharacterProfile[]): boolean {
  switch (pre.kind) {
    case 'trait':
      return pre.mode === 'has' ? p.personality.traitTags.includes(pre.trait) : !p.personality.traitTags.includes(pre.trait);
    case 'axis':
      return cmp(readPersonaAxis(p, pre.axis), pre.op, pre.value);
    case 'need':
      return cmp(p.needs[pre.need][pre.field], pre.op, pre.value);
    case 'drive':
      return pre.anyOf.includes(p.drives.primary) || pre.anyOf.includes(p.drives.secondary);
    case 'aggregate': {
      const v = aggregateValue(p, pre, cast);
      return v !== null && cmp(v, pre.op, pre.value);
    }
    case 'relationship':
      return true; // relational — evaluated against another role at assignment time
  }
}

function intrinsicMargin(p: CharacterProfile, pre: Precondition, cast: CharacterProfile[]): number {
  if (pre.kind === 'axis') return margin(readPersonaAxis(p, pre.axis), pre.op, pre.value);
  if (pre.kind === 'need') return margin(p.needs[pre.need][pre.field], pre.op, pre.value);
  if (pre.kind === 'aggregate') {
    const v = aggregateValue(p, pre, cast);
    return v === null ? 0 : margin(v, pre.op, pre.value);
  }
  return intrinsicHolds(p, pre, cast) ? 0.5 : 0; // trait/drive: a flat satisfied bonus
}

function edgeHolds(edge: Relationship | undefined, pre: RelationshipPrecondition): boolean {
  if (!edge) return false;
  if (pre.type && edge.relationshipType !== pre.type) return false;
  if (pre.typeAnyOf && !(edge.relationshipType && pre.typeAnyOf.includes(edge.relationshipType))) return false;
  if (pre.axis && pre.op && pre.value !== undefined) {
    const v = pre.axis === 'affinity' ? edge.affinity : edge[pre.axis];
    if (!cmp(v, pre.op, pre.value)) return false;
  }
  return true;
}
function edgeMargin(edge: Relationship | undefined, pre: RelationshipPrecondition): number {
  if (!edge || !pre.axis || !pre.op || pre.value === undefined) return edge ? 0.5 : 0;
  const v = pre.axis === 'affinity' ? edge.affinity : edge[pre.axis];
  return margin(v, pre.op, pre.value);
}

/** Whether a relational precondition holds for `holder` toward `other` (per direction). */
function relationHolds(holder: CharacterProfile, other: CharacterProfile, pre: RelationshipPrecondition): boolean {
  const out = () => edgeHolds(edgeOf(holder, other.agentId), pre);
  const inc = () => edgeHolds(edgeOf(other, holder.agentId), pre);
  return pre.direction === 'outgoing' ? out() : pre.direction === 'incoming' ? inc() : out() && inc();
}
function relationMargin(holder: CharacterProfile, other: CharacterProfile, pre: RelationshipPrecondition): number {
  const out = edgeMargin(edgeOf(holder, other.agentId), pre);
  const inc = edgeMargin(edgeOf(other, holder.agentId), pre);
  return pre.direction === 'outgoing' ? out : pre.direction === 'incoming' ? inc : (out + inc) / 2;
}

// --- casting -----------------------------------------------------------------

export interface RoleAssignment {
  roleId: string;
  agentId: string | null;
  required: boolean;
  /** 'absent' roles are resolved (agentId set) but kept out of the emitted cast. */
  presence: 'present' | 'absent';
  score: number;
}
export interface ScoredCandidate {
  agentId: string;
  score: number;
}
export interface CastingReport {
  templateId: string;
  assignments: RoleAssignment[];
  unfilledRequired: string[];
  unfilledOptional: string[];
  /** Who *could* fill each role on intrinsic preconditions alone (coverage). */
  candidatesByRole: Record<string, ScoredCandidate[]>;
  /** Template issues + validation issues on the emitted scenario. */
  issues: string[];
}
export interface CastingResult {
  ok: boolean;
  scenario: Scenario | null;
  report: CastingReport;
}

export interface CastTemplateOptions {
  /** Override the emitted scenarioId (default `<templateId>`). */
  scenarioId?: string;
  /** Office anchor ids (computeOfficeAnchors → anchorId) for binding + validation. */
  anchorIds?: string[];
  /** Agent ids the emitted scenario validates against (default: the cast's ids). */
  agentIds?: string[];
}

/**
 * Cast a template onto a cast (the persona set in play). Resolves role → agent by
 * precondition match (greedy-best with backtracking: it enumerates feasible
 * assignments and keeps the highest-scoring one, so the *strongest* fit wins ties),
 * then emits a fully-bound `Scenario` and validates it with the existing
 * `validateScenario`. Required roles that can't fill make `ok=false` (scenario null);
 * optional roles that can't fill are skipped with a note.
 */
export function castTemplate(template: ScenarioTemplate, cast: CharacterProfile[], options: CastTemplateOptions = {}): CastingResult {
  const byId = new Map(cast.map((p) => [p.agentId, p]));
  const order = new Map(cast.map((p, i) => [p.agentId, i]));
  const roleById = new Map(template.roles.map((r) => [r.roleId, r]));

  // 1. intrinsic eligibility per role (ignores relational preconditions).
  const candidatesByRole: Record<string, ScoredCandidate[]> = {};
  const intrinsicEligible = new Map<string, CharacterProfile[]>();
  for (const role of template.roles) {
    const intrinsic = role.preconditions.filter((p) => !isRelational(p));
    const eligible = cast.filter((p) => intrinsic.every((pre) => intrinsicHolds(p, pre, cast)));
    intrinsicEligible.set(role.roleId, eligible);
    candidatesByRole[role.roleId] = eligible
      .map((p) => ({ agentId: p.agentId, score: round2(intrinsic.reduce((s, pre) => s + intrinsicMargin(p, pre, cast), 0)) }))
      .sort((a, b) => b.score - a.score || (order.get(a.agentId)! - order.get(b.agentId)!));
  }

  // 2. assignment order: required first, then optional; most-constrained first.
  const ordered = [...template.roles].sort((a, b) => {
    if (a.required !== b.required) return a.required ? -1 : 1;
    return intrinsicEligible.get(a.roleId)!.length - intrinsicEligible.get(b.roleId)!.length;
  });

  // relational preconditions of a role, and whether a candidate is co-castable
  // with the agents already assigned (both directions of every connecting edge).
  const relOf = (roleId: string) => roleById.get(roleId)!.preconditions.filter(isRelational);
  const relationalOk = (cand: CharacterProfile, role: RoleSlot, assign: Map<string, string | null>): boolean => {
    for (const pre of relOf(role.roleId)) {
      const tgt = assign.get(pre.toRole);
      if (tgt && !relationHolds(cand, byId.get(tgt)!, pre)) return false;
    }
    for (const [rid, agentId] of assign) {
      if (!agentId) continue;
      for (const pre of relOf(rid)) {
        if (pre.toRole === role.roleId && !relationHolds(byId.get(agentId)!, cand, pre)) return false;
      }
    }
    return true;
  };
  // pairwise relational margin of a candidate vs the already-assigned roles.
  const relationalScore = (cand: CharacterProfile, role: RoleSlot, assign: Map<string, string | null>): number => {
    let s = 0;
    for (const pre of relOf(role.roleId)) {
      const tgt = assign.get(pre.toRole);
      if (tgt) s += relationMargin(cand, byId.get(tgt)!, pre);
    }
    for (const [rid, agentId] of assign) {
      if (!agentId) continue;
      for (const pre of relOf(rid)) {
        if (pre.toRole === role.roleId) s += relationMargin(byId.get(agentId)!, cand, pre);
      }
    }
    return s;
  };

  // 3. enumerate feasible assignments, keep the highest-scoring complete one.
  //    Required-role fit dominates optional-role filling (weight, below), so a
  //    strong required pairing always beats a weak one that happens to also fill
  //    an optional slot.
  const REQ_WEIGHT = 1000;
  type Best = { assign: Map<string, string | null>; score: number };
  let best: Best | null = null;
  const intrinsicScoreOf = (roleId: string, agentId: string) =>
    candidatesByRole[roleId].find((c) => c.agentId === agentId)?.score ?? 0;
  const assign = new Map<string, string | null>();
  const used = new Set<string>();
  const search = (i: number, score: number): void => {
    if (i === ordered.length) {
      if (!best || score > best.score) best = { assign: new Map(assign), score };
      return;
    }
    const role = ordered[i];
    const w = role.required ? REQ_WEIGHT : 1;
    const cands = intrinsicEligible
      .get(role.roleId)!
      .filter((p) => !used.has(p.agentId) && relationalOk(p, role, assign))
      .map((p) => ({ p, node: w * (1 + intrinsicScoreOf(role.roleId, p.agentId) + relationalScore(p, role, assign)) }))
      .sort((a, b) => b.node - a.node || (order.get(a.p.agentId)! - order.get(b.p.agentId)!));
    for (const { p, node } of cands) {
      assign.set(role.roleId, p.agentId);
      used.add(p.agentId);
      search(i + 1, score + node);
      used.delete(p.agentId);
      assign.delete(role.roleId);
    }
    if (!role.required) {
      assign.set(role.roleId, null);
      search(i + 1, score);
      assign.delete(role.roleId);
    }
  };
  search(0, 0);

  // 4. assemble the report. When no complete assignment exists (a required role
  //    has zero co-castable candidates), fall back to a greedy partial so the
  //    report still shows what *did* fill and which required roles did not.
  const resolved = best as Best | null; // cast resets closure-narrowing on `best`
  const finalAssign = resolved ? resolved.assign : greedyPartial(ordered, intrinsicEligible, relationalOk, order, candidatesByRole, relationalScore, byId);
  const assignments: RoleAssignment[] = template.roles.map((r) => ({
    roleId: r.roleId,
    agentId: finalAssign.get(r.roleId) ?? null,
    required: r.required,
    presence: r.presence ?? 'present',
    score: round2((finalAssign.get(r.roleId) && intrinsicScoreOf(r.roleId, finalAssign.get(r.roleId)!)) || 0),
  }));
  const unfilledRequired = template.roles.filter((r) => r.required && !finalAssign.get(r.roleId)).map((r) => r.roleId);
  const unfilledOptional = template.roles.filter((r) => !r.required && !finalAssign.get(r.roleId)).map((r) => r.roleId);

  const issues: string[] = [...validateScenarioTemplate(template)];
  let scenario: Scenario | null = null;
  const ok = !!best && unfilledRequired.length === 0;
  if (ok) {
    scenario = emitScenario(template, finalAssign, options);
    const agentIds = options.agentIds ?? cast.map((p) => p.agentId);
    issues.push(...validateScenario(scenario, { agentIds, anchorIds: options.anchorIds }));
  } else {
    issues.push(`Cast incomplete: required role(s) unfilled — ${unfilledRequired.join(', ') || '(none — template invalid)'}`);
  }

  return { ok, scenario, report: { templateId: template.templateId, assignments, unfilledRequired, unfilledOptional, candidatesByRole, issues } };
}

/** Best-effort assignment used only for the report when a required role can't fill. */
function greedyPartial(
  ordered: RoleSlot[],
  intrinsicEligible: Map<string, CharacterProfile[]>,
  relationalOk: (c: CharacterProfile, r: RoleSlot, a: Map<string, string | null>) => boolean,
  order: Map<string, number>,
  candidatesByRole: Record<string, ScoredCandidate[]>,
  relationalScore: (c: CharacterProfile, r: RoleSlot, a: Map<string, string | null>) => number,
  _byId: Map<string, CharacterProfile>,
): Map<string, string | null> {
  const assign = new Map<string, string | null>();
  const used = new Set<string>();
  for (const role of ordered) {
    const intrinsicScoreOf = (agentId: string) => candidatesByRole[role.roleId].find((c) => c.agentId === agentId)?.score ?? 0;
    const cands = intrinsicEligible
      .get(role.roleId)!
      .filter((p) => !used.has(p.agentId) && relationalOk(p, role, assign))
      .sort((a, b) => (intrinsicScoreOf(b.agentId) + relationalScore(b, role, assign)) - (intrinsicScoreOf(a.agentId) + relationalScore(a, role, assign)) || (order.get(a.agentId)! - order.get(b.agentId)!));
    if (cands.length) {
      assign.set(role.roleId, cands[0].agentId);
      used.add(cands[0].agentId);
    } else {
      assign.set(role.roleId, null);
    }
  }
  return assign;
}

// --- emitting a bound Scenario from an assignment ---------------------------

function emitScenario(template: ScenarioTemplate, assign: Map<string, string | null>, options: CastTemplateOptions): Scenario {
  const agentOf = (roleId: string): string | null => assign.get(roleId) ?? null;
  // `filled` = resolved to an agent (true for absent roles too, so the seed/truth/
  // info can reference them by id); `active` = resolved AND a present participant.
  const filled = (roleId: string): boolean => !!agentOf(roleId);
  const presentRole = new Map(template.roles.map((r) => [r.roleId, !isAbsent(r)]));
  const active = (roleId: string): boolean => filled(roleId) && !!presentRole.get(roleId);
  const allFilled = (roleIds: string[]): boolean => roleIds.every(filled);

  // Locations survive unless tied to a role that isn't an active participant.
  const locations = template.locations
    .filter((l) => !(l.bindDeskOfRole && !active(l.bindDeskOfRole)))
    .map((l) => ({
      locationId: l.locationId,
      displayName: l.displayName,
      tags: [...l.tags],
      accessState: l.accessState,
      fallbackLocationId: l.fallbackLocationId,
      bindTo: { roomId: l.bindRoomId, anchorId: l.bindDeskOfRole ? `desk:${agentOf(l.bindDeskOfRole)}` : '' },
    }));
  const locationIds = new Set(locations.map((l) => l.locationId));
  const keepLoc = (id: string): string => (locationIds.has(id) ? id : '');
  // drop fallbacks that pointed at a now-dropped location.
  for (const l of locations) l.fallbackLocationId = keepLoc(l.fallbackLocationId);

  // Truth facts whose source/subjects are all filled.
  const truthFacts = template.truthFacts
    .filter((t) => filled(t.sourceRole) && allFilled(t.subjectRoles))
    .map((t) => ({
      truthId: t.truthId,
      topic: t.topic,
      statement: t.statement,
      subjectAgentIds: t.subjectRoles.map((r) => agentOf(r)!),
      objectiveValue: t.objectiveValue,
      sourceAgentId: agentOf(t.sourceRole)!,
    }));
  const truthIds = new Set(truthFacts.map((t) => t.truthId));

  // Information items whose source is filled (holders filtered to filled roles).
  const informationItems = template.informationItems
    .filter((i) => filled(i.sourceRole))
    .map((i) => ({
      informationId: i.informationId,
      topic: i.topic,
      claim: i.claim,
      originType: i.originType,
      truthId: truthIds.has(i.truthId) ? i.truthId : '',
      truthAlignment: i.truthAlignment,
      sourceAgentId: agentOf(i.sourceRole)!,
      initialHolderAgentIds: i.initialHolderRoles.filter(filled).map((r) => agentOf(r)!),
    }));
  const infoIds = new Set(informationItems.map((i) => i.informationId));

  const seedOf = new Map(template.roleSeeds.map((s) => [s.roleId, s]));
  const spawnOf = new Map(template.roleSpawns.map((s) => [s.roleId, s.locationId]));

  const castMembers = template.roles
    .filter((r) => active(r.roleId)) // absent roles emit no cast member / spawn
    .map((r) => {
      const agentId = agentOf(r.roleId)!;
      const seed = seedOf.get(r.roleId);
      const relationshipOverrides = (seed?.relationshipOverrides ?? [])
        .filter((ov) => filled(ov.toRole))
        .map((ov) => {
          const { toRole, ...axes } = ov;
          return { targetAgentId: agentOf(toRole)!, ...axes };
        });
      return {
        agentId,
        spawnLocationId: keepLoc(spawnOf.get(r.roleId) ?? ''),
        prototypeRole: r.label,
        relationshipOverrides,
        beliefSeeds: (seed?.beliefSeeds ?? []).map((b) => ({ ...b })),
        knowledgeSeeds: (seed?.knowledgeSeeds ?? []).filter((k) => infoIds.has(k)),
      };
    });

  return {
    scenarioId: options.scenarioId ?? template.templateId,
    title: template.title,
    summary: template.summary,
    cast: castMembers,
    locations,
    truthFacts,
    informationItems,
    interventionTypes: structuredClone(template.interventionTypes),
    variants: structuredClone(template.variants),
    defaultVariantId: template.defaultVariantId,
    objective: structuredClone(template.objective),
  };
}

// --- coverage ----------------------------------------------------------------

export interface RoleCoverage {
  roleId: string;
  required: boolean;
  /** Eligible agents on intrinsic preconditions alone (ignores relational fit). */
  intrinsicCandidateCount: number;
  /** Did this role actually fill when the whole template was cast onto the cast? */
  relationalFillable: boolean;
}
export interface CoverageReport {
  templateId: string;
  perRole: RoleCoverage[];
  fullyCastable: boolean;
  unfillableRequiredRoles: string[];
  notes: string[];
}

/**
 * Can this cast play this template? Surfaces per-role intrinsic candidate counts
 * (the cast/scenario-library mismatch a designer should see before play) plus
 * whether the required roles co-cast. See docs/scenario-template-model.md §5.
 */
export function analyzeTemplateCoverage(template: ScenarioTemplate, cast: CharacterProfile[]): CoverageReport {
  const result = castTemplate(template, cast);
  const filledRole = new Map(result.report.assignments.map((a) => [a.roleId, !!a.agentId]));
  const perRole: RoleCoverage[] = template.roles.map((r) => ({
    roleId: r.roleId,
    required: r.required,
    intrinsicCandidateCount: result.report.candidatesByRole[r.roleId]?.length ?? 0,
    relationalFillable: filledRole.get(r.roleId) ?? false,
  }));
  const notes: string[] = [];
  for (const rc of perRole) {
    if (rc.intrinsicCandidateCount === 0)
      notes.push(`No agent in the cast satisfies role "${rc.roleId}"'s preconditions.`);
    else if (!rc.relationalFillable)
      notes.push(`Role "${rc.roleId}" has ${rc.intrinsicCandidateCount} eligible agent(s) but none co-cast with the rest (taken by another role or failing a relationship precondition).`);
  }
  return {
    templateId: template.templateId,
    perRole,
    fullyCastable: result.ok,
    unfillableRequiredRoles: result.report.unfilledRequired,
    notes,
  };
}

// --- org-level coverage (F3.5) -----------------------------------------------

/** One uncastable template plus the required roles the cast cannot fill. */
export interface TemplateGap {
  templateId: string;
  unfillableRequiredRoles: string[];
}

/**
 * Coverage of a whole generated org against the scenario-template library — can
 * this cast actually produce playable scenarios? (Epic 3, F3.5 / S3.5.1). The
 * per-template detail comes from {@link analyzeTemplateCoverage}; this rolls it up
 * so the studio can flag a thin org before export.
 */
export interface OrgCoverageReport {
  /** Per-template coverage, in library order. */
  templates: CoverageReport[];
  /** The under-covered templates and the required roles that cannot be filled. */
  gaps: TemplateGap[];
  castableCount: number;
  totalCount: number;
  /** castableCount / totalCount, 0–1. An empty library is fully covered (1). */
  coverageRatio: number;
}

/**
 * Run a cast against the whole template library and aggregate the result.
 * Deterministic (casting is); pure. The library is passed in (the UI supplies
 * `ROLE_TEMPLATES`) so core carries no `data` dependency.
 */
export function analyzeOrgCoverage(
  library: ScenarioTemplate[],
  cast: CharacterProfile[],
): OrgCoverageReport {
  const templates = library.map((t) => analyzeTemplateCoverage(t, cast));
  const gaps: TemplateGap[] = templates
    .filter((c) => !c.fullyCastable)
    .map((c) => ({ templateId: c.templateId, unfillableRequiredRoles: c.unfillableRequiredRoles }));
  const totalCount = library.length;
  const castableCount = totalCount - gaps.length;
  return {
    templates,
    gaps,
    castableCount,
    totalCount,
    coverageRatio: totalCount === 0 ? 1 : castableCount / totalCount,
  };
}

export interface CoverageGateOptions {
  /** Below this castable ratio, warn and name the gaps (default 0.5). */
  warnBelow?: number;
  /** At or below this castable ratio, block the export (default 0 → block only when nothing casts). */
  blockAtOrBelow?: number;
}

export interface OrgCoverageValidation {
  errors: string[];
  warnings: string[];
  report: OrgCoverageReport;
}

/**
 * The pre-export coverage gate (F3.5 / S3.5.2). Mirrors `validateOrgStructure`'s
 * `{ errors, warnings }` shape: the in-app Export-all blocks on `errors` and
 * confirms past `warnings`. By default an org is **blocked** only when it can
 * cast *nothing* (you would ship an org that produces no scenarios) and merely
 * **warned** when coverage is thin — see CONTRACT.md §6. Both thresholds are
 * tunable. A well-covered cast returns no errors and no warnings.
 */
export function validateOrgScenarioCoverage(
  library: ScenarioTemplate[],
  cast: CharacterProfile[],
  opts: CoverageGateOptions = {},
): OrgCoverageValidation {
  const warnBelow = opts.warnBelow ?? 0.5;
  const blockAtOrBelow = opts.blockAtOrBelow ?? 0;
  const report = analyzeOrgCoverage(library, cast);
  const errors: string[] = [];
  const warnings: string[] = [];

  const gapList = report.gaps
    .map((g) => `${g.templateId}${g.unfillableRequiredRoles.length ? ` (unfillable: ${g.unfillableRequiredRoles.join(', ')})` : ''}`)
    .join('; ');
  const pct = Math.round(report.coverageRatio * 100);

  if (report.totalCount > 0 && report.coverageRatio <= blockAtOrBelow) {
    errors.push(
      `This cast can play ${report.castableCount}/${report.totalCount} scenario templates (${pct}%) — it cannot generate any scenario. Uncastable: ${gapList}.`,
    );
  } else if (report.coverageRatio < warnBelow && report.gaps.length) {
    warnings.push(
      `This cast covers only ${report.castableCount}/${report.totalCount} scenario templates (${pct}%). Under-covered: ${gapList}.`,
    );
  }

  return { errors, warnings, report };
}

// --- validation --------------------------------------------------------------

/** Human-readable issues with a template's authoring. Empty = valid. */
export function validateScenarioTemplate(t: ScenarioTemplate): string[] {
  const issues: string[] = [];
  const roleIds = new Set(t.roles.map((r) => r.roleId));
  const role = (label: string, id: string) => {
    if (!roleIds.has(id)) issues.push(`${label} references unknown role "${id}".`);
  };
  const unit = (label: string, v: number) => {
    if (typeof v !== 'number' || v < 0 || v > 100) issues.push(`${label} must be 0–100 (got ${v}).`);
  };

  if (!t.templateId) issues.push('Template is missing templateId.');
  if (t.roles.length === 0) issues.push('Template has no role slots.');
  if (!t.roles.some((r) => r.required)) issues.push('Template has no required role (nothing must fill).');
  if (roleIds.size !== t.roles.length) issues.push('Template has duplicate role ids.');
  if (!t.emotionalPayload || t.emotionalPayload.targetEmotions.length === 0)
    issues.push('Template has no emotional payload (targetEmotions is empty).');

  for (const r of t.roles) {
    for (const pre of r.preconditions) {
      switch (pre.kind) {
        case 'trait':
          if (!pre.trait) issues.push(`role "${r.roleId}" has a trait precondition with no trait.`);
          break;
        case 'axis':
          if (!(PERSONA_AXES as readonly string[]).includes(pre.axis)) issues.push(`role "${r.roleId}" axis precondition uses unknown axis "${pre.axis}".`);
          unit(`role "${r.roleId}" axis precondition value`, pre.value);
          break;
        case 'need':
          if (!(NEEDS as readonly string[]).includes(pre.need)) issues.push(`role "${r.roleId}" need precondition uses unknown need "${pre.need}".`);
          unit(`role "${r.roleId}" need precondition value`, pre.value);
          break;
        case 'drive':
          if (pre.anyOf.length === 0) issues.push(`role "${r.roleId}" drive precondition has an empty anyOf.`);
          break;
        case 'relationship':
          role(`role "${r.roleId}" relationship precondition`, pre.toRole);
          if (pre.axis) {
            if (!(REL_PRECONDITION_AXES as readonly string[]).includes(pre.axis)) issues.push(`role "${r.roleId}" relationship precondition uses unknown axis "${pre.axis}".`);
            if (!pre.op || pre.value === undefined) issues.push(`role "${r.roleId}" relationship precondition sets an axis without op/value.`);
          }
          break;
        case 'aggregate':
          if (!(REL_PRECONDITION_AXES as readonly string[]).includes(pre.axis)) issues.push(`role "${r.roleId}" aggregate precondition uses unknown axis "${pre.axis}".`);
          if (!['min', 'max', 'avg'].includes(pre.reduce)) issues.push(`role "${r.roleId}" aggregate precondition has invalid reduce "${pre.reduce}".`);
          if (!['outgoing', 'incoming'].includes(pre.direction)) issues.push(`role "${r.roleId}" aggregate precondition has invalid direction "${pre.direction}".`);
          if (pre.axis === 'affinity') {
            if (typeof pre.value !== 'number' || pre.value < -100 || pre.value > 100) issues.push(`role "${r.roleId}" aggregate affinity value must be -100..100.`);
          } else {
            unit(`role "${r.roleId}" aggregate precondition value`, pre.value);
          }
          break;
      }
    }
  }

  const absentRoles = new Set(t.roles.filter(isAbsent).map((r) => r.roleId));

  for (const s of t.roleSeeds) {
    role(`roleSeed`, s.roleId);
    for (const b of s.beliefSeeds) {
      if (!STANCES.includes(b.stance)) issues.push(`roleSeed "${s.roleId}" belief "${b.topic}" has invalid stance "${b.stance}".`);
      unit(`roleSeed "${s.roleId}" belief "${b.topic}".confidence`, b.confidence);
    }
    for (const ov of s.relationshipOverrides) {
      role(`roleSeed "${s.roleId}" relationshipOverride`, ov.toRole);
      for (const a of OVERRIDE_AXES) if (ov[a] !== undefined) unit(`roleSeed "${s.roleId}"->${ov.toRole}.${a}`, ov[a] as number);
      if (ov.affinity !== undefined && (ov.affinity < -100 || ov.affinity > 100)) issues.push(`roleSeed "${s.roleId}"->${ov.toRole}.affinity must be -100..100.`);
    }
  }

  const locationIds = new Set(t.locations.map((l) => l.locationId));
  for (const l of t.locations) {
    if (!ACCESS_STATES.includes(l.accessState)) issues.push(`location "${l.locationId}" has invalid accessState "${l.accessState}".`);
    if (!l.bindRoomId) issues.push(`location "${l.locationId}" has no office room binding.`);
    if (l.bindDeskOfRole) {
      role(`location "${l.locationId}" desk binding`, l.bindDeskOfRole);
      if (absentRoles.has(l.bindDeskOfRole)) issues.push(`location "${l.locationId}" binds a desk to absent role "${l.bindDeskOfRole}" (absent agents aren't seated).`);
    }
    if (l.fallbackLocationId && !locationIds.has(l.fallbackLocationId)) issues.push(`location "${l.locationId}" falls back to unknown location "${l.fallbackLocationId}".`);
  }
  for (const sp of t.roleSpawns) {
    role(`roleSpawn`, sp.roleId);
    if (absentRoles.has(sp.roleId)) issues.push(`roleSpawn targets absent role "${sp.roleId}" (absent agents aren't spawned).`);
    if (!locationIds.has(sp.locationId)) issues.push(`roleSpawn for "${sp.roleId}" uses unknown location "${sp.locationId}".`);
  }

  const truthIds = new Set(t.truthFacts.map((x) => x.truthId));
  for (const tf of t.truthFacts) {
    role(`truth "${tf.truthId}" source`, tf.sourceRole);
    for (const r of tf.subjectRoles) role(`truth "${tf.truthId}" subject`, r);
  }
  for (const i of t.informationItems) {
    if (!ORIGIN_TYPES.includes(i.originType)) issues.push(`info "${i.informationId}" has invalid originType "${i.originType}".`);
    if (!TRUTH_ALIGNMENTS.includes(i.truthAlignment)) issues.push(`info "${i.informationId}" has invalid truthAlignment "${i.truthAlignment}".`);
    if (i.truthId && !truthIds.has(i.truthId)) issues.push(`info "${i.informationId}" references unknown truth "${i.truthId}".`);
    role(`info "${i.informationId}" source`, i.sourceRole);
    for (const r of i.initialHolderRoles) role(`info "${i.informationId}" holder`, r);
  }

  const interventionByType = new Map(t.interventionTypes.map((x) => [x.type, new Set(x.values)]));
  const variantIds = new Set(t.variants.map((v) => v.variantId));
  for (const v of t.variants) {
    for (const [type, value] of Object.entries(v.selections)) {
      const values = interventionByType.get(type);
      if (!values) issues.push(`variant "${v.variantId}" selects undeclared intervention type "${type}".`);
      else if (!values.has(value)) issues.push(`variant "${v.variantId}" sets "${type}" to undeclared value "${value}".`);
    }
  }
  if (t.defaultVariantId && !variantIds.has(t.defaultVariantId)) issues.push(`defaultVariantId "${t.defaultVariantId}" is not a declared variant.`);
  if (!OBJECTIVE_CATEGORIES.includes(t.objective.category)) issues.push(`objective has invalid category "${t.objective.category}".`);

  return issues;
}

// --- export serialization ----------------------------------------------------

/** The consumer-facing template form (a future sim-side runtime-casting input). */
export function serializeScenarioTemplate(t: ScenarioTemplate): unknown {
  return {
    ...structuredClone(t),
    meta: { generator: 'sprite-character-creator', schema: 'scenario_model.md', schemaVersion: CURRENT_SCHEMA_VERSION, artifact: 'scenario-template' },
  };
}

const round2 = (n: number): number => Math.round(n * 100) / 100;
