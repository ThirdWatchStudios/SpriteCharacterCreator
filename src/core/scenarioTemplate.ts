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
import { deriveReportingLines } from './orgStructure';

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

/**
 * Candidate is (or is not) a member of a given **department** — a department
 * catalog id (Epic 2 F2.1 / Epic 3 F3.1, persona `identity.department`). Intrinsic
 * (single-candidate): `'in'` requires the candidate's department equal `department`,
 * `'notIn'` forbids it. An unassigned candidate (`department === ''`) is `'in'`
 * nothing and `'notIn'` everything. The id is matched verbatim — the same stable id
 * the org-structure (§3.11) and wings (§3.4) key on.
 */
export interface DepartmentPrecondition {
  kind: 'department';
  department: string;
  mode: 'in' | 'notIn';
}
/**
 * The candidate's department **relative to the agent assigned to another role** —
 * the cross-wing pairing predicate (F4.2). Relational (like `relationship`):
 * resolved at assignment time against `toRole`. `'different'` requires the two
 * resolve to different departments (the core cross-department condition);
 * `'same'` requires the same. Both sides must have a **known** department — an
 * agent with no department (`''`) can satisfy neither, so a cross-department
 * pairing never silently casts on unassigned agents. Symmetric.
 */
export interface CrossDepartmentPrecondition {
  kind: 'crossDepartment';
  toRole: string;
  relation: 'same' | 'different';
}

/** Which distance signal an organizational-distance precondition reads (F4.3). */
export type DistanceSource = 'structural' | 'spatial';
/**
 * The candidate's **organizational distance** from the agent assigned to another
 * role (F4.3) — the cross-wing difficulty/payload signal. Relational (resolved at
 * assignment time against `toRole`) and symmetric. **`source`** picks the signal
 * (default `'structural'`):
 * - `'structural'` = hop distance in the reporting tree (derived from the cast's
 *   `manager`/`direct-report` edges, §3.7) — always available from the cast alone.
 * - `'spatial'` = wing-hop distance in the office wing-connectivity graph (§3.4) —
 *   only when the caller supplies a {@link DistanceContext} (a generated office
 *   scene); the sim refines real spatial proximity at runtime (§5.7).
 *
 * Two **forms**, either or both (F4.3 / S4.3.2):
 * - **hard** (`op` + `value`, a 0–100 normalized distance threshold) — an
 *   eligibility gate. An **unknown** distance (no path / no spatial context) is
 *   **inert** — it never blocks the cast (fallback discipline, §7).
 * - **soft** (`weight`, may be negative) — contributes `weight · distance/100` to
 *   the casting fit score, so a template can *prefer* a farther-apart (or closer)
 *   pairing without forbidding any. Inert when the distance is unknown.
 */
export interface DistancePrecondition {
  kind: 'distance';
  toRole: string;
  source?: DistanceSource;
  op?: CompareOp;
  value?: number;
  weight?: number;
}

export type Precondition =
  | TraitPrecondition
  | AxisPrecondition
  | NeedPrecondition
  | DrivePrecondition
  | RelationshipPrecondition
  | AggregatePrecondition
  | DepartmentPrecondition
  | CrossDepartmentPrecondition
  | DistancePrecondition;

const isRelational = (p: Precondition): p is RelationshipPrecondition => p.kind === 'relationship';
const isCrossDepartment = (p: Precondition): p is CrossDepartmentPrecondition => p.kind === 'crossDepartment';
const isDistance = (p: Precondition): p is DistancePrecondition => p.kind === 'distance';
/** A **cross-role** precondition — evaluated against the agent assigned to another role. */
type CrossRolePrecondition = RelationshipPrecondition | CrossDepartmentPrecondition | DistancePrecondition;
const isCrossRole = (p: Precondition): p is CrossRolePrecondition => isRelational(p) || isCrossDepartment(p) || isDistance(p);

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

/** A candidate's department catalog id (`''` = unassigned). */
const deptOf = (p: CharacterProfile): string => p.identity.department;

// --- organizational distance (F4.3) -----------------------------------------
// Distance normalization: raw graph-hop counts capped + scaled to 0–100 so a
// distance threshold reads on the same 0–100 scale as the axis preconditions.
// CAP hops map to 100; beyond the cap is still 100 (saturated "far apart").
const DISTANCE_HOP_CAP = 6;

const buildUndirectedAdj = (edges: Array<readonly [string, string]>): Map<string, Set<string>> => {
  const adj = new Map<string, Set<string>>();
  const link = (a: string, b: string) => (adj.get(a) ?? adj.set(a, new Set()).get(a)!).add(b);
  for (const [a, b] of edges) {
    if (!a || !b || a === b) continue;
    link(a, b);
    link(b, a);
  }
  return adj;
};

/** Shortest path length (edge count) between two nodes, or null if unreachable. */
const bfsHops = (adj: Map<string, Set<string>>, from: string, to: string): number | null => {
  if (from === to) return 0;
  const seen = new Set<string>([from]);
  let frontier = [from];
  let hops = 0;
  while (frontier.length) {
    hops += 1;
    const next: string[] = [];
    for (const node of frontier) {
      for (const n of adj.get(node) ?? []) {
        if (n === to) return hops;
        if (!seen.has(n)) {
          seen.add(n);
          next.push(n);
        }
      }
    }
    frontier = next;
  }
  return null;
};

const normalizeHops = (hops: number | null): number | null =>
  hops === null ? null : Math.min(100, (hops / DISTANCE_HOP_CAP) * 100);

/**
 * Spatial context for `distance` preconditions sourced `'spatial'` (F4.3): which
 * wing each agent sits in + the wing-adjacency graph (`computeWingConnectivity`
 * edges, §3.4). Supplied by a caller that has a generated office scene; absent for
 * scene-less casting (company cascade, previews), where a `'spatial'` distance term
 * reads as unknown (and is therefore inert).
 */
export interface DistanceContext {
  wingOfAgent?: Record<string, string>;
  connectivity?: Array<{ wings: [string, string] }>;
}

/**
 * A per-cast distance resolver: normalized 0–100 organizational distance between
 * two agents on the chosen signal, or null when the distance is unknown (no path
 * in the graph, or no spatial context for a spatial query).
 */
function makeDistanceResolver(cast: CharacterProfile[], ctx: DistanceContext | undefined) {
  const castIds = new Set(cast.map((p) => p.agentId));
  const reporting = buildUndirectedAdj(
    deriveReportingLines(cast, castIds).lines.map((l) => [l.managerAgentId, l.reportAgentId] as const),
  );
  const wingOf = ctx?.wingOfAgent ?? {};
  const wingAdj = buildUndirectedAdj((ctx?.connectivity ?? []).map((e) => e.wings as readonly [string, string]));
  return (aId: string, bId: string, source: DistanceSource): number | null => {
    if (aId === bId) return 0;
    if (source === 'spatial') {
      const wa = wingOf[aId];
      const wb = wingOf[bId];
      if (!wa || !wb) return null; // no spatial context → unknown
      return normalizeHops(bfsHops(wingAdj, wa, wb));
    }
    return normalizeHops(bfsHops(reporting, aId, bId));
  };
}
type DistanceResolver = ReturnType<typeof makeDistanceResolver>;

/** Whether a hard distance threshold holds; unknown distance is inert (passes). */
function distanceHolds(holder: CharacterProfile, other: CharacterProfile, pre: DistancePrecondition, dist: DistanceResolver): boolean {
  if (pre.op === undefined || pre.value === undefined) return true; // soft-only term gates nothing
  const d = dist(holder.agentId, other.agentId, pre.source ?? 'structural');
  return d === null ? true : cmp(d, pre.op, pre.value);
}
/** The soft (weighted) contribution of a distance term to the fit score; 0 when unknown. */
function distanceScore(holder: CharacterProfile, other: CharacterProfile, pre: DistancePrecondition, dist: DistanceResolver): number {
  if (pre.weight === undefined) return 0;
  const d = dist(holder.agentId, other.agentId, pre.source ?? 'structural');
  return d === null ? 0 : pre.weight * (d / 100);
}

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
    case 'department':
      return pre.mode === 'in' ? deptOf(p) === pre.department : deptOf(p) !== pre.department;
    case 'relationship':
    case 'crossDepartment':
    case 'distance':
      return true; // cross-role — evaluated against another role at assignment time
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

/** Whether a same/different-department precondition holds between two agents (symmetric). */
function crossDeptHolds(holder: CharacterProfile, other: CharacterProfile, pre: CrossDepartmentPrecondition): boolean {
  const a = deptOf(holder);
  const b = deptOf(other);
  if (!a || !b) return false; // an unknown department satisfies no cross-department constraint
  return pre.relation === 'same' ? a === b : a !== b;
}

/** Whether a cross-role precondition holds for `holder` toward `other`. */
function crossRoleHolds(holder: CharacterProfile, other: CharacterProfile, pre: CrossRolePrecondition, dist: DistanceResolver): boolean {
  if (isDistance(pre)) return distanceHolds(holder, other, pre, dist);
  if (isCrossDepartment(pre)) return crossDeptHolds(holder, other, pre);
  return relationHolds(holder, other, pre);
}
/** Tie-break / fit margin of a cross-role precondition. */
function crossRoleMargin(holder: CharacterProfile, other: CharacterProfile, pre: CrossRolePrecondition, dist: DistanceResolver): number {
  if (isDistance(pre)) return distanceScore(holder, other, pre, dist);
  if (isCrossDepartment(pre)) return crossDeptHolds(holder, other, pre) ? 0.5 : 0; // department is binary: a flat satisfied bonus
  return relationMargin(holder, other, pre);
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
/** A resolved organizational distance for one of the template's `distance` terms (F4.3). */
export interface ResolvedDistance {
  fromRole: string;
  toRole: string;
  source: DistanceSource;
  /** 0–100 normalized distance, or null when unknown (no graph path / no spatial context). */
  value: number | null;
}

export interface CastingReport {
  templateId: string;
  assignments: RoleAssignment[];
  unfilledRequired: string[];
  unfilledOptional: string[];
  /** Who *could* fill each role on intrinsic preconditions alone (coverage). */
  candidatesByRole: Record<string, ScoredCandidate[]>;
  /**
   * The organizational distances behind the final cast's `distance` terms (F4.3) —
   * so the sim/payload can scale difficulty on how far apart the pairing landed.
   * Empty when the template declares no distance term.
   */
  distances: ResolvedDistance[];
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
  /**
   * Spatial context for `'spatial'`-sourced `distance` preconditions (F4.3). Omit
   * for scene-less casting — `'structural'` distance still resolves from the cast,
   * and a `'spatial'` term reads as unknown (inert).
   */
  distance?: DistanceContext;
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
  // Organizational-distance resolver (F4.3): structural reporting-tree hops from the
  // cast, plus spatial wing hops when the caller supplies a DistanceContext.
  const dist = makeDistanceResolver(cast, options.distance);

  // 1. intrinsic eligibility per role (ignores relational preconditions).
  const candidatesByRole: Record<string, ScoredCandidate[]> = {};
  const intrinsicEligible = new Map<string, CharacterProfile[]>();
  for (const role of template.roles) {
    const intrinsic = role.preconditions.filter((p) => !isCrossRole(p));
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

  // cross-role preconditions of a role (relationship + cross-department), and
  // whether a candidate is co-castable with the agents already assigned (both
  // directions of every connecting constraint).
  const relOf = (roleId: string): CrossRolePrecondition[] => roleById.get(roleId)!.preconditions.filter(isCrossRole);
  const relationalOk = (cand: CharacterProfile, role: RoleSlot, assign: Map<string, string | null>): boolean => {
    for (const pre of relOf(role.roleId)) {
      const tgt = assign.get(pre.toRole);
      if (tgt && !crossRoleHolds(cand, byId.get(tgt)!, pre, dist)) return false;
    }
    for (const [rid, agentId] of assign) {
      if (!agentId) continue;
      for (const pre of relOf(rid)) {
        if (pre.toRole === role.roleId && !crossRoleHolds(byId.get(agentId)!, cand, pre, dist)) return false;
      }
    }
    return true;
  };
  // pairwise cross-role margin of a candidate vs the already-assigned roles.
  const relationalScore = (cand: CharacterProfile, role: RoleSlot, assign: Map<string, string | null>): number => {
    let s = 0;
    for (const pre of relOf(role.roleId)) {
      const tgt = assign.get(pre.toRole);
      if (tgt) s += crossRoleMargin(cand, byId.get(tgt)!, pre, dist);
    }
    for (const [rid, agentId] of assign) {
      if (!agentId) continue;
      for (const pre of relOf(rid)) {
        if (pre.toRole === role.roleId) s += crossRoleMargin(byId.get(agentId)!, cand, pre, dist);
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

  // Resolve the distances behind the final cast's distance terms (F4.3) so the
  // payload can scale on how far apart the pairing landed. Only when both ends fill.
  const distances: ResolvedDistance[] = [];
  for (const role of template.roles) {
    const from = finalAssign.get(role.roleId);
    if (!from) continue;
    for (const pre of role.preconditions) {
      if (!isDistance(pre)) continue;
      const to = finalAssign.get(pre.toRole);
      if (!to) continue;
      const source = pre.source ?? 'structural';
      distances.push({ fromRole: role.roleId, toRole: pre.toRole, source, value: round2x(dist(from, to, source)) });
    }
  }

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

  return { ok, scenario, report: { templateId: template.templateId, assignments, unfilledRequired, unfilledOptional, candidatesByRole, distances, issues } };
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
  /**
   * F4.4: when this role is a coverage blocker, the specific unmet conditions —
   * naming the department / cross-department / distance precondition that can't be
   * met (S4.4.2). Empty for a role that fills.
   */
  unmetReasons: string[];
}
export interface CoverageReport {
  templateId: string;
  perRole: RoleCoverage[];
  fullyCastable: boolean;
  unfillableRequiredRoles: string[];
  notes: string[];
}

/**
 * Explain *why* a coverage-blocked role can't fill (F4.4 / S4.4.2) — naming the
 * specific unmet department / cross-department / distance condition when that is
 * the cause, so a gap report points at the org or template to fix. Conservative: a
 * cross-role term is blamed only when its partner role HAS eligible candidates
 * (else the partner's own intrinsic gap is the real cause) and the term is provably
 * unsatisfiable across the eligible pools. Spatial distance isn't diagnosable here
 * (coverage carries no office scene), so only structural distance is checked.
 */
function diagnoseRoleGap(
  role: RoleSlot,
  cast: CharacterProfile[],
  candidatesByRole: Record<string, ScoredCandidate[]>,
  dist: DistanceResolver,
): string[] {
  const reasons: string[] = [];
  const poolOf = (roleId: string): CharacterProfile[] => {
    const ids = new Set((candidatesByRole[roleId] ?? []).map((c) => c.agentId));
    return cast.filter((p) => ids.has(p.agentId));
  };
  const elig = poolOf(role.roleId);

  // Intrinsic dead end: nobody even satisfies the single-candidate preconditions.
  if (elig.length === 0) {
    for (const pre of role.preconditions) {
      if (pre.kind !== 'department') continue;
      const anyMember = cast.some((p) => (pre.mode === 'in' ? deptOf(p) === pre.department : deptOf(p) !== pre.department));
      if (!anyMember)
        reasons.push(
          pre.mode === 'in'
            ? `role "${role.roleId}" requires department "${pre.department}", which has no members in this org.`
            : `role "${role.roleId}" forbids department "${pre.department}", but every member belongs to it.`,
        );
    }
    if (reasons.length === 0) reasons.push(`no agent in the cast satisfies role "${role.roleId}"'s preconditions.`);
    return reasons;
  }

  // Cross-role dead end: eligible agents exist but a department/distance term to a
  // populated partner role can't be met by any eligible pairing.
  for (const pre of role.preconditions) {
    if (pre.kind === 'crossDepartment') {
      const partner = poolOf(pre.toRole);
      if (partner.length === 0) continue; // the partner's own gap is the cause
      const feasible = elig.some((a) => partner.some((b) => a.agentId !== b.agentId && crossDeptHolds(a, b, pre)));
      if (!feasible)
        reasons.push(
          pre.relation === 'different'
            ? `role "${role.roleId}" must be in a different department from "${pre.toRole}", but their eligible agents can't form a cross-department pair.`
            : `role "${role.roleId}" must share a department with "${pre.toRole}", but no eligible same-department pair exists.`,
        );
    } else if (pre.kind === 'distance' && (pre.source ?? 'structural') === 'structural' && pre.op !== undefined && pre.value !== undefined) {
      const partner = poolOf(pre.toRole);
      if (partner.length === 0) continue;
      const feasible = elig.some((a) =>
        partner.some((b) => {
          if (a.agentId === b.agentId) return false;
          const d = dist(a.agentId, b.agentId, 'structural');
          return d !== null && cmp(d, pre.op!, pre.value!);
        }),
      );
      if (!feasible)
        reasons.push(`role "${role.roleId}" requires organizational distance ${pre.op} ${pre.value} from "${pre.toRole}", but no eligible pairing is that far apart.`);
    }
  }
  if (reasons.length === 0)
    reasons.push(`role "${role.roleId}" has ${elig.length} eligible agent(s) but none co-cast with the rest (taken by another role or failing a relationship precondition).`);
  return reasons;
}

/**
 * Can this cast play this template? Surfaces per-role intrinsic candidate counts
 * (the cast/scenario-library mismatch a designer should see before play) plus
 * whether the required roles co-cast, and — for a blocked role — the specific unmet
 * department/distance condition (F4.4). See docs/scenario-template-model.md §5.
 */
export function analyzeTemplateCoverage(template: ScenarioTemplate, cast: CharacterProfile[]): CoverageReport {
  const result = castTemplate(template, cast);
  const filledRole = new Map(result.report.assignments.map((a) => [a.roleId, !!a.agentId]));
  // Structural-only resolver for distance diagnosis (coverage has no office scene).
  const dist = makeDistanceResolver(cast, undefined);
  const perRole: RoleCoverage[] = template.roles.map((r) => {
    const intrinsicCandidateCount = result.report.candidatesByRole[r.roleId]?.length ?? 0;
    const relationalFillable = filledRole.get(r.roleId) ?? false;
    const blocked = intrinsicCandidateCount === 0 || !relationalFillable;
    const unmetReasons = blocked ? diagnoseRoleGap(r, cast, result.report.candidatesByRole, dist) : [];
    return { roleId: r.roleId, required: r.required, intrinsicCandidateCount, relationalFillable, unmetReasons };
  });
  return {
    templateId: template.templateId,
    perRole,
    fullyCastable: result.ok,
    unfillableRequiredRoles: result.report.unfilledRequired,
    notes: perRole.flatMap((rc) => rc.unmetReasons),
  };
}

// --- org-level coverage (F3.5) -----------------------------------------------

/** One uncastable template plus the required roles the cast cannot fill. */
export interface TemplateGap {
  templateId: string;
  unfillableRequiredRoles: string[];
  /**
   * F4.4: the specific unmet conditions behind the unfillable required roles —
   * naming the department / cross-department / distance precondition that can't be
   * met, so the gap points at the org or template to fix (S4.4.2).
   */
  reasons: string[];
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
    .map((c) => {
      const blocked = new Set(c.unfillableRequiredRoles);
      return {
        templateId: c.templateId,
        unfillableRequiredRoles: c.unfillableRequiredRoles,
        reasons: c.perRole.filter((rc) => blocked.has(rc.roleId)).flatMap((rc) => rc.unmetReasons),
      };
    });
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
    .map((g) => {
      const roles = g.unfillableRequiredRoles.length ? ` (unfillable: ${g.unfillableRequiredRoles.join(', ')})` : '';
      const why = g.reasons.length ? ` — ${g.reasons.join('; ')}` : '';
      return `${g.templateId}${roles}${why}`;
    })
    .join(' | ')
    .replace(/\.+$/, ''); // reasons end in '.'; the message adds its own period
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
        case 'department':
          if (!pre.department) issues.push(`role "${r.roleId}" has a department precondition with no department.`);
          if (!['in', 'notIn'].includes(pre.mode)) issues.push(`role "${r.roleId}" department precondition has invalid mode "${pre.mode}".`);
          break;
        case 'crossDepartment':
          role(`role "${r.roleId}" crossDepartment precondition`, pre.toRole);
          if (pre.toRole === r.roleId) issues.push(`role "${r.roleId}" crossDepartment precondition references itself.`);
          if (!['same', 'different'].includes(pre.relation)) issues.push(`role "${r.roleId}" crossDepartment precondition has invalid relation "${pre.relation}".`);
          break;
        case 'distance':
          role(`role "${r.roleId}" distance precondition`, pre.toRole);
          if (pre.toRole === r.roleId) issues.push(`role "${r.roleId}" distance precondition references itself.`);
          if (pre.source !== undefined && !['structural', 'spatial'].includes(pre.source)) issues.push(`role "${r.roleId}" distance precondition uses unknown source "${pre.source}".`);
          if (pre.op !== undefined || pre.value !== undefined) {
            if (pre.op === undefined || pre.value === undefined) issues.push(`role "${r.roleId}" distance precondition sets a threshold without both op and value.`);
            else unit(`role "${r.roleId}" distance precondition value`, pre.value);
          }
          if (pre.weight !== undefined && typeof pre.weight !== 'number') issues.push(`role "${r.roleId}" distance precondition weight must be a number.`);
          if (pre.op === undefined && pre.value === undefined && pre.weight === undefined) issues.push(`role "${r.roleId}" distance precondition has neither a threshold (op+value) nor a weight.`);
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

/** The consumer-facing template form (the sim-side runtime-casting input, §3.8/§5.7). */
export function serializeScenarioTemplate(t: ScenarioTemplate): unknown {
  return {
    ...structuredClone(t),
    meta: { generator: 'sprite-character-creator', schema: 'scenario_model.md', schemaVersion: CURRENT_SCHEMA_VERSION, artifact: 'scenario-template' },
  };
}

/**
 * The exported `scenario-template.json` artifact (F4.1): the whole template
 * library under one versioned `meta` block, the sim's runtime caster consumes it
 * (§3.8/§5.7). One synchronized contract — the same precondition vocabulary the
 * tool's {@link castTemplate} evaluates is the one the sim's port evaluates, so a
 * round-trip of this artifact through either caster yields the same assignments.
 */
export function serializeScenarioTemplateLibrary(templates: ScenarioTemplate[]): unknown {
  return {
    meta: { generator: 'sprite-character-creator', schema: 'scenario_model.md', schemaVersion: CURRENT_SCHEMA_VERSION, artifact: 'scenario-template-library' },
    templates: templates.map((t) => structuredClone(t)),
  };
}

const round2 = (n: number): number => Math.round(n * 100) / 100;
/** round2 that passes null through (for an unknown distance). */
const round2x = (n: number | null): number | null => (n === null ? null : round2(n));
