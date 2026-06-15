/**
 * Scenarios — the authored run setup for The Water Cooler. The studio authors a
 * whole run here and the sim *loads* it (see the design contract in
 * game-design-docs/the-water-cooler/docs/design/scenario_model.md).
 *
 * A scenario does NOT re-author art or character intrinsics — it references them
 * by id and adds the *situation* around them. One id space throughout:
 * `agentId` == recipe id == persona key == sim AgentId.
 *
 * Persona ↔ scenario boundary (resolved 2026-06-14): the persona owns the durable
 * character + baseline relationships; the scenario owns the situation — truth,
 * information, the experiment, the objective — plus the scenario-specific seeds
 * (`beliefSeeds`, `knowledgeSeeds`, `relationshipOverrides`) layered on top. The
 * loader applies persona baseline first, then the scenario seeds/overrides.
 */
import type { CharacterRecipe } from './types';
import { CURRENT_SCHEMA_VERSION } from './types';
import { STANCES, type Stance } from './profile';

// --- enums ------------------------------------------------------------------

export const ACCESS_STATES = ['open', 'locked', 'restricted', 'unavailable'] as const;
export type AccessState = (typeof ACCESS_STATES)[number];

export const ORIGIN_TYPES = ['official', 'observation', 'interpretation', 'rumor'] as const;
export type OriginType = (typeof ORIGIN_TYPES)[number];

export const TRUTH_ALIGNMENTS = ['true', 'false', 'misleading', 'unknown'] as const;
export type TruthAlignment = (typeof TRUTH_ALIGNMENTS)[number];

export const OBJECTIVE_CATEGORIES = ['productivity', 'stability', 'culture', 'political'] as const;
export type ObjectiveCategory = (typeof OBJECTIVE_CATEGORIES)[number];

/** Unipolar relationship axes a scenario override can set (affinity is bipolar). */
export const OVERRIDE_AXES = ['trust', 'suspicion', 'influence', 'respect', 'familiarity'] as const;
export type OverrideAxis = (typeof OVERRIDE_AXES)[number];

// --- scenario-specific seeds (layered on the persona at load) ----------------

/**
 * A run-specific relationship shift applied on top of the persona baseline.
 * `targetAgentId` is the relationship's target; the source is the cast member
 * this override is nested under. Only the provided axes are overridden.
 */
export interface RelationshipOverride {
  targetAgentId: string;
  trust?: number;
  suspicion?: number;
  affinity?: number;
  influence?: number;
  respect?: number;
  familiarity?: number;
  tags?: string[];
}

/** A starting belief — scenario state (a stance on a scenario topic). */
export interface ScenarioBelief {
  topic: string;
  claim: string;
  stance: Stance;
  confidence: number;
}

export interface ScenarioCastMember {
  /** References recipe.json + profile.json. */
  agentId: string;
  spawnLocationId: string;
  prototypeRole: string;
  /** Source = this agentId; layered over the persona's baseline relationships. */
  relationshipOverrides: RelationshipOverride[];
  /** Owner = this agentId; the home for starting beliefs (not the persona). */
  beliefSeeds: ScenarioBelief[];
  /** informationIds this agent starts aware of. */
  knowledgeSeeds: string[];
}

// --- world: locations, truth, information ------------------------------------

/** Where a sim location lands in the office (resolves the location-binding seam). */
export interface LocationBinding {
  /** Named office anchor (e.g. `desk:carl`); empty for room-level binding. */
  anchorId: string;
  /** Office room id (e.g. `cubicle-farm`, `break-room`). */
  roomId: string;
}

export interface ScenarioLocation {
  locationId: string;
  displayName: string;
  tags: string[];
  accessState: AccessState;
  /** Where agents go if this location is blocked; empty for none. */
  fallbackLocationId: string;
  bindTo: LocationBinding;
}

/** Objective simulation reality the run is measured against. */
export interface TruthFact {
  truthId: string;
  topic: string;
  statement: string;
  subjectAgentIds: string[];
  objectiveValue: boolean;
  sourceAgentId: string;
}

/** A transferable claim/observation plus who starts holding it. */
export interface InformationItem {
  informationId: string;
  topic: string;
  claim: string;
  originType: OriginType;
  truthId: string;
  truthAlignment: TruthAlignment;
  sourceAgentId: string;
  initialHolderAgentIds: string[];
}

// --- the experiment ----------------------------------------------------------

export interface InterventionType {
  type: string;
  values: string[];
}

/** A named bundle of intervention choices (one experimental condition). */
export interface ScenarioVariant {
  variantId: string;
  /** interventionType -> chosen value. */
  selections: Record<string, string>;
}

export interface ScenarioObjective {
  objectiveId: string;
  label: string;
  category: ObjectiveCategory;
  desiredPressure: string;
  intendedObservableBehavior: string;
  kpi: string;
  expectedEvidence: string[];
}

// --- the scenario ------------------------------------------------------------

export interface Scenario {
  scenarioId: string;
  title: string;
  summary: string;
  /**
   * The office layout seed this scenario's locations were bound against. Recorded
   * so the bound office is reproducible (regenerate the same office from this
   * seed). The office itself is still the shared project scene for now.
   */
  officeSeed?: number;
  cast: ScenarioCastMember[];
  locations: ScenarioLocation[];
  truthFacts: TruthFact[];
  informationItems: InformationItem[];
  interventionTypes: InterventionType[];
  variants: ScenarioVariant[];
  defaultVariantId: string;
  objective: ScenarioObjective;
}

// --- factory ----------------------------------------------------------------

/** An empty scenario shell to start authoring from. */
export function createDefaultScenario(scenarioId: string, title: string): Scenario {
  return {
    scenarioId,
    title,
    summary: '',
    cast: [],
    locations: [],
    truthFacts: [],
    informationItems: [],
    interventionTypes: [],
    variants: [],
    defaultVariantId: '',
    objective: {
      objectiveId: '',
      label: '',
      category: 'stability',
      desiredPressure: '',
      intendedObservableBehavior: '',
      kpi: '',
      expectedEvidence: [],
    },
  };
}

/** Add a cast member referencing an existing character, defaults filled. */
export function castMemberFor(recipe: CharacterRecipe, spawnLocationId = ''): ScenarioCastMember {
  return {
    agentId: recipe.id,
    spawnLocationId,
    prototypeRole: '',
    relationshipOverrides: [],
    beliefSeeds: [],
    knowledgeSeeds: [],
  };
}

// --- validation -------------------------------------------------------------

export interface ScenarioValidationContext {
  /** Recipe ids in the project — cast/targets must resolve to these. */
  agentIds: string[];
  /**
   * Named office anchor ids (rooms + per-agent desks) from computeOfficeAnchors.
   * When provided, location bindings are checked to resolve to a real anchor.
   * Omit to skip binding resolution (e.g. before a layout exists).
   */
  anchorIds?: string[];
}

/**
 * Return human-readable issues with a scenario. Empty array = valid. Used by the
 * import path, the export guard, and tests; the live UI also constrains inputs.
 * Office anchor ids are not checked here yet (named anchors are step 2).
 */
export function validateScenario(s: Scenario, ctx: ScenarioValidationContext): string[] {
  const issues: string[] = [];
  const agents = new Set(ctx.agentIds);
  const castIds = new Set(s.cast.map((c) => c.agentId));
  const locationIds = new Set(s.locations.map((l) => l.locationId));
  const truthIds = new Set(s.truthFacts.map((t) => t.truthId));
  const infoIds = new Set(s.informationItems.map((i) => i.informationId));
  const interventionByType = new Map(s.interventionTypes.map((t) => [t.type, new Set(t.values)]));
  const variantIds = new Set(s.variants.map((v) => v.variantId));

  if (!s.scenarioId) issues.push('Scenario is missing scenarioId.');

  const unit = (label: string, v: number) => {
    if (typeof v !== 'number' || v < 0 || v > 100) issues.push(`${label} must be 0–100 (got ${v}).`);
  };
  const bip = (label: string, v: number) => {
    if (typeof v !== 'number' || v < -100 || v > 100) issues.push(`${label} must be -100..100 (got ${v}).`);
  };
  const agent = (label: string, id: string) => {
    if (!agents.has(id)) issues.push(`${label} references unknown agent "${id}".`);
  };

  for (const c of s.cast) {
    agent(`cast "${c.agentId}"`, c.agentId);
    if (c.spawnLocationId && !locationIds.has(c.spawnLocationId))
      issues.push(`cast "${c.agentId}" spawns at unknown location "${c.spawnLocationId}".`);
    for (const r of c.relationshipOverrides) {
      agent(`${c.agentId} relationshipOverride target`, r.targetAgentId);
      for (const a of OVERRIDE_AXES) if (r[a] !== undefined) unit(`${c.agentId}->${r.targetAgentId}.${a}`, r[a] as number);
      if (r.affinity !== undefined) bip(`${c.agentId}->${r.targetAgentId}.affinity`, r.affinity);
    }
    for (const b of c.beliefSeeds) {
      if (!STANCES.includes(b.stance)) issues.push(`${c.agentId} belief "${b.topic}" has invalid stance "${b.stance}".`);
      unit(`${c.agentId} belief "${b.topic}".confidence`, b.confidence);
    }
    for (const k of c.knowledgeSeeds) if (!infoIds.has(k)) issues.push(`${c.agentId} knowledge seed "${k}" is not a declared information item.`);
  }

  const anchors = ctx.anchorIds ? new Set(ctx.anchorIds) : null;
  for (const l of s.locations) {
    if (l.fallbackLocationId && !locationIds.has(l.fallbackLocationId))
      issues.push(`location "${l.locationId}" falls back to unknown location "${l.fallbackLocationId}".`);
    if (!ACCESS_STATES.includes(l.accessState)) issues.push(`location "${l.locationId}" has invalid accessState "${l.accessState}".`);
    if (!l.bindTo || !l.bindTo.roomId) issues.push(`location "${l.locationId}" is not bound to an office room.`);
    if (anchors) {
      if (l.bindTo?.roomId && !anchors.has(l.bindTo.roomId))
        issues.push(`location "${l.locationId}" binds to unknown office room "${l.bindTo.roomId}".`);
      if (l.bindTo?.anchorId && !anchors.has(l.bindTo.anchorId))
        issues.push(`location "${l.locationId}" binds to unknown office anchor "${l.bindTo.anchorId}".`);
    }
  }

  for (const t of s.truthFacts) {
    agent(`truth "${t.truthId}" source`, t.sourceAgentId);
    for (const a of t.subjectAgentIds) agent(`truth "${t.truthId}" subject`, a);
  }

  for (const i of s.informationItems) {
    if (!ORIGIN_TYPES.includes(i.originType)) issues.push(`info "${i.informationId}" has invalid originType "${i.originType}".`);
    if (!TRUTH_ALIGNMENTS.includes(i.truthAlignment)) issues.push(`info "${i.informationId}" has invalid truthAlignment "${i.truthAlignment}".`);
    if (i.truthId && !truthIds.has(i.truthId)) issues.push(`info "${i.informationId}" references unknown truth "${i.truthId}".`);
    agent(`info "${i.informationId}" source`, i.sourceAgentId);
    for (const a of i.initialHolderAgentIds) agent(`info "${i.informationId}" holder`, a);
  }

  for (const v of s.variants) {
    for (const [type, value] of Object.entries(v.selections)) {
      const values = interventionByType.get(type);
      if (!values) issues.push(`variant "${v.variantId}" selects undeclared intervention type "${type}".`);
      else if (!values.has(value)) issues.push(`variant "${v.variantId}" sets "${type}" to undeclared value "${value}".`);
    }
  }
  if (s.defaultVariantId && !variantIds.has(s.defaultVariantId))
    issues.push(`defaultVariantId "${s.defaultVariantId}" is not a declared variant.`);

  if (!OBJECTIVE_CATEGORIES.includes(s.objective.category))
    issues.push(`objective has invalid category "${s.objective.category}".`);

  // Cross-check: every cast member should have a spawn location that exists.
  for (const c of s.cast) if (!c.spawnLocationId) issues.push(`cast "${c.agentId}" has no spawn location.`);
  // Cross-check: cast should be unique.
  if (castIds.size !== s.cast.length) issues.push('scenario has duplicate cast members.');

  return issues;
}

// --- export serialization ---------------------------------------------------

/** The consumer-facing scenario form written to scenario.json. */
export function serializeScenario(s: Scenario): unknown {
  return {
    ...structuredClone(s),
    meta: { generator: 'sprite-character-creator', schema: 'scenario_model.md', schemaVersion: CURRENT_SCHEMA_VERSION },
  };
}
