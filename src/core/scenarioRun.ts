/**
 * Scenario run resolver — computes the *effective* starting state the sim will
 * load, the way the sim will compute it: persona baseline first, then scenario
 * overrides/seeds on top (the loader precedence from scenario_model.md). The
 * studio uses this for the dry-run preview; it is also the studio half of the
 * studio↔sim parity the Scenario Loading epic (Epic 30) validates against.
 *
 * Pure and deterministic — given the same scenario + profiles + variant it always
 * resolves the same run.
 */
import type { CharacterProfile, Relationship } from './profile';
import { NEEDS, NEED_LABELS } from './profile';
import type { InformationItem, Scenario, ScenarioBelief, ScenarioObjective, TruthFact } from './scenario';
import { OVERRIDE_AXES, serializeScenario, validateScenario } from './scenario';
import type { ProjectState } from './types';
import { computeInteractionAnchors, sceneToLayoutJson } from './layout';

/** A baseline relationship with the scenario override (if any) folded in. */
export interface ResolvedRelationship extends Relationship {
  /** True when a scenario relationshipOverride touched this relationship. */
  fromOverride: boolean;
}

export interface ResolvedAgent {
  agentId: string;
  displayName: string;
  hasPersona: boolean;
  prototypeRole: string;
  spawnLocationId: string;
  spawnBinding: { anchorId: string; roomId: string } | null;
  /** From the persona (empty when none). */
  drivePrimary: string;
  driveSecondary: string;
  topNeeds: string[];
  traitTags: string[];
  /** Effective starting state. */
  relationships: ResolvedRelationship[];
  beliefs: ScenarioBelief[];
  knowledge: string[];
}

export interface ResolvedRun {
  scenarioId: string;
  variantId: string;
  variantConditions: Record<string, string>;
  agents: ResolvedAgent[];
  truthFacts: TruthFact[];
  informationItems: InformationItem[];
  objective: ScenarioObjective;
  /** Validation issues for the scenario as resolved (reuses validateScenario). */
  issues: string[];
}

export interface ResolveOptions {
  profiles: CharacterProfile[];
  characters?: Array<{ id: string; name: string }>;
  variantId?: string;
  agentIds: string[];
  anchorIds?: string[];
}

const neutralRel = (targetAgentId: string): Relationship => ({
  targetAgentId,
  trust: 50,
  suspicion: 0,
  affinity: 0,
  influence: 0,
  respect: 50,
  familiarity: 50,
  tags: [],
});

export function resolveScenarioRun(scenario: Scenario, opts: ResolveOptions): ResolvedRun {
  const profiles = new Map(opts.profiles.map((p) => [p.agentId, p]));
  const names = new Map((opts.characters ?? []).map((c) => [c.id, c.name]));

  const vid =
    opts.variantId && scenario.variants.some((v) => v.variantId === opts.variantId)
      ? opts.variantId
      : scenario.defaultVariantId;
  const variant = scenario.variants.find((v) => v.variantId === vid);

  const agents: ResolvedAgent[] = scenario.cast.map((member) => {
    const profile = profiles.get(member.agentId);

    // Relationships: persona baseline, then scenario overrides folded on top.
    const rels = new Map<string, ResolvedRelationship>();
    for (const r of profile?.relationships ?? []) {
      rels.set(r.targetAgentId, { ...structuredClone(r), fromOverride: false });
    }
    for (const ov of member.relationshipOverrides) {
      const cur = rels.get(ov.targetAgentId) ?? { ...neutralRel(ov.targetAgentId), fromOverride: false };
      for (const a of OVERRIDE_AXES) if (ov[a] !== undefined) cur[a] = ov[a] as number;
      if (ov.affinity !== undefined) cur.affinity = ov.affinity;
      if (ov.tags) cur.tags = ov.tags;
      cur.fromOverride = true;
      rels.set(ov.targetAgentId, cur);
    }

    // Knowledge: scenario knowledge seeds + items this agent initially holds.
    const knowledge = new Set(member.knowledgeSeeds);
    for (const info of scenario.informationItems) {
      if (info.initialHolderAgentIds.includes(member.agentId)) knowledge.add(info.informationId);
    }

    const topNeeds = profile
      ? [...NEEDS].sort((a, b) => profile.needs[b].sensitivity - profile.needs[a].sensitivity).slice(0, 3).map((n) => NEED_LABELS[n])
      : [];

    const loc = scenario.locations.find((l) => l.locationId === member.spawnLocationId);

    return {
      agentId: member.agentId,
      displayName: names.get(member.agentId) ?? member.agentId,
      hasPersona: !!profile,
      prototypeRole: member.prototypeRole,
      spawnLocationId: member.spawnLocationId,
      spawnBinding: loc ? loc.bindTo : null,
      drivePrimary: profile?.drives.primary ?? '',
      driveSecondary: profile?.drives.secondary ?? '',
      topNeeds,
      traitTags: profile?.personality.traitTags ?? [],
      relationships: [...rels.values()],
      beliefs: member.beliefSeeds,
      knowledge: [...knowledge],
    };
  });

  return {
    scenarioId: scenario.scenarioId,
    variantId: variant?.variantId ?? '',
    variantConditions: variant?.selections ?? {},
    agents,
    truthFacts: scenario.truthFacts,
    informationItems: scenario.informationItems,
    objective: scenario.objective,
    issues: validateScenario(scenario, { agentIds: opts.agentIds, anchorIds: opts.anchorIds }),
  };
}

// --- scenario package (split-file export) -----------------------------------

/**
 * Decompose a scenario into the split-file package Unity loads directly:
 * scenario.json (composed), employees / relationships / beliefs / knowledge /
 * interaction-anchors, plus the office layout. Built from the resolved run so the
 * package reflects persona baseline + scenario seeds together.
 */
export function buildScenarioPackage(scenario: Scenario, project: ProjectState): Record<string, unknown> {
  const run = resolveScenarioRun(scenario, {
    profiles: project.profiles ?? [],
    characters: project.characters.map((c) => ({ id: c.id, name: c.name })),
    agentIds: project.characters.map((c) => c.id),
  });
  const identityOf = new Map((project.profiles ?? []).map((p) => [p.agentId, p.identity]));

  const employees = run.agents.map((a) => {
    const id = identityOf.get(a.agentId);
    return {
      agentId: a.agentId,
      displayName: a.displayName,
      department: id?.department ?? '',
      role: id?.roleTitle ?? a.prototypeRole,
      title: id?.roleTitle ?? '',
      seniority: id?.seniority ?? '',
      ageBracket: id?.ageBand ?? '',
      personalityTags: a.traitTags,
      spawnLocationId: scenario.cast.find((c) => c.agentId === a.agentId)?.spawnLocationId ?? '',
    };
  });

  const relationships = run.agents.flatMap((a) =>
    a.relationships.map((r) => ({
      sourceAgentId: a.agentId,
      targetAgentId: r.targetAgentId,
      trust: r.trust,
      suspicion: r.suspicion,
      affinity: r.affinity,
      influence: r.influence,
      respect: r.respect,
      familiarity: r.familiarity,
      relationshipType: r.relationshipType ?? null,
      secret: r.secret ?? false,
      tags: r.tags,
      fromOverride: r.fromOverride,
    })),
  );

  const beliefs = scenario.cast.flatMap((c) =>
    c.beliefSeeds.map((b) => ({ agentId: c.agentId, topic: b.topic, claim: b.claim, stance: b.stance, confidence: b.confidence })),
  );

  const knowledge = {
    truthFacts: scenario.truthFacts,
    informationItems: scenario.informationItems,
    agentKnowledge: run.agents.map((a) => ({ agentId: a.agentId, knows: a.knowledge })),
  };

  const pkg: Record<string, unknown> = {
    'scenario.json': serializeScenario(scenario),
    'employees.json': employees,
    'relationships.json': relationships,
    'beliefs.json': beliefs,
    'knowledge.json': knowledge,
    // The drive + trait + relationship-type catalogs personas/edges reference by
    // id — shipped with the package so a scenario bundle is self-contained for the
    // sim to resolve them.
    'drives.json': project.drives,
    'traits.json': project.traits,
    'relationshipTypes.json': project.relationshipTypes,
  };
  if (project.scene) {
    pkg['office-layout.json'] = sceneToLayoutJson(project.scene, project);
    pkg['interaction-anchors.json'] = computeInteractionAnchors(project.scene, project);
  }
  return pkg;
}
