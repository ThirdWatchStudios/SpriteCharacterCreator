/**
 * History-seeded relationship wiring (Epic 0, F0.6) — the policy that fills the
 * F3.3 history-seeding hook. It reads a {@link Company}'s formative events + its
 * factionalism climate and produces concrete typed edges (resentment, rivalry,
 * alliance) plus the climate bias, so the relationship graph's *shape* is
 * explained by the company's past: a layoff round actually leaves resentment
 * edges between the teams it hit; a merger leaves us-vs-them rivalry across the
 * two sides; a record quarter leaves alliances.
 *
 * Mechanism vs. policy: the **mechanism** (how an edge is planted, how
 * factionalism skews the mix) lives in `relationshipGraph.ts` (F3.3). This module
 * is the **policy** — which event kind becomes which edge, on which agents — and
 * is the only place that reads the company model. Pure + deterministic.
 * See …/07-f0-6-history-seeded-relationship-and-climate-wiring.
 */
import type { Company, CompanyEvent } from './company';
import { mapDepartmentNameToId, type DepartmentDefinition } from './department';
import type { DepartmentRivalry } from './departmentSubculture';
import type { CharacterProfile } from './profile';
import { mulberry32, type Rng } from './random';
import { seedToInt } from './employee';
import {
  generateRelationshipGraph,
  type GraphClimate,
  type RelationshipGraphOptions,
  type SeededEdge,
} from './relationshipGraph';

/** How an event kind reads in the graph: a relationship type + whether it binds within or across departments. */
interface EdgePolicy {
  type: string;
  scope: 'within' | 'across';
}

/**
 * Event kind → the edge it leaves. Negative shocks leave `rival` resentment
 * within the teams they hit; mergers/acquisitions leave `rival` *across* the two
 * sides; wins + solidarity leave `ally`. Unmapped kinds default to within-team
 * rivalry (a shock with no happier reading). Reuses only the §3.7 catalog.
 */
const EVENT_EDGE_POLICY: Record<string, EdgePolicy> = {
  layoff: { type: 'rival', scope: 'within' },
  reorg: { type: 'rival', scope: 'within' },
  founder_exit: { type: 'rival', scope: 'within' },
  scandal: { type: 'rival', scope: 'within' },
  failed_product: { type: 'rival', scope: 'within' },
  new_ceo: { type: 'rival', scope: 'within' },
  return_to_office: { type: 'rival', scope: 'within' },
  merger: { type: 'rival', scope: 'across' },
  acquisition: { type: 'rival', scope: 'across' },
  union_drive: { type: 'ally', scope: 'within' },
  funding_round: { type: 'ally', scope: 'within' },
  ipo: { type: 'ally', scope: 'within' },
  record_quarter: { type: 'ally', scope: 'within' },
  pivot: { type: 'ally', scope: 'within' },
};
const DEFAULT_POLICY: EdgePolicy = { type: 'rival', scope: 'within' };

/** Max edges a single event seeds (scaled down by its magnitude). */
const EDGES_PER_EVENT = 4;
/** Max edges a single department rivalry seeds (scaled by its strength). */
const EDGES_PER_RIVALRY = 3;

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));
const pairKey = (a: string, b: string): string => [a, b].sort().join('~');

/** Group a cast by resolved department id (blank → its own bucket). */
function groupByDept(profiles: CharacterProfile[]): Map<string, CharacterProfile[]> {
  const by = new Map<string, CharacterProfile[]>();
  for (const p of profiles) {
    const key = p.identity.department || '__unassigned__';
    (by.get(key) ?? by.set(key, []).get(key)!).push(p);
  }
  return by;
}

/** Pick a within- or across-department agent pair from the involved groups; null if impossible. */
function pickPair(
  rng: Rng,
  groups: Array<{ id: string; members: CharacterProfile[] }>,
  scope: 'within' | 'across',
  used: Set<string>,
): [CharacterProfile, CharacterProfile] | null {
  const withMembers = groups.filter((g) => g.members.length > 0);
  const multi = withMembers.filter((g) => g.members.length >= 2);
  for (let attempt = 0; attempt < 12; attempt++) {
    let a: CharacterProfile | undefined;
    let b: CharacterProfile | undefined;
    if (scope === 'across' && withMembers.length >= 2) {
      const gi = Math.floor(rng() * withMembers.length);
      let gj = Math.floor(rng() * withMembers.length);
      if (gj === gi) gj = (gj + 1) % withMembers.length;
      a = withMembers[gi].members[Math.floor(rng() * withMembers[gi].members.length)];
      b = withMembers[gj].members[Math.floor(rng() * withMembers[gj].members.length)];
    } else if (multi.length) {
      const g = multi[Math.floor(rng() * multi.length)].members;
      a = g[Math.floor(rng() * g.length)];
      b = g[Math.floor(rng() * g.length)];
    }
    if (a && b && a.agentId !== b.agentId && !used.has(pairKey(a.agentId, b.agentId))) {
      used.add(pairKey(a.agentId, b.agentId));
      return [a, b];
    }
  }
  return null;
}

/**
 * Build the seed edges a company's formative events leave on the cast. Each event
 * attaches to plausible agents in its `involvedDepartments` (company-wide when
 * unset), tagged `history:<eventId>` for traceability, secret when the event is
 * not public. Deterministic for the seed.
 */
export function seedEdgesFromHistory(
  company: Company,
  profiles: CharacterProfile[],
  departments: DepartmentDefinition[],
  seed: number | string,
): SeededEdge[] {
  const byDept = groupByDept(profiles);
  const edges: SeededEdge[] = [];

  for (const event of company.history) {
    const policy = EVENT_EDGE_POLICY[event.kind] ?? DEFAULT_POLICY;
    const involvedIds = resolveInvolved(event, departments, byDept);
    const groups = (involvedIds.length ? involvedIds : [...byDept.keys()]).map((id) => ({
      id,
      members: byDept.get(id) ?? [],
    }));
    const pool = groups.reduce((s, g) => s + g.members.length, 0);
    if (pool < 2) continue;

    const count = clamp(Math.round((event.magnitude / 100) * EDGES_PER_EVENT), 1, EDGES_PER_EVENT);
    const secret = event.visibility !== 'public';
    const rng = mulberry32(seedToInt(`${seed}|hist|${event.id}`));
    const used = new Set<string>();
    for (let i = 0; i < count; i++) {
      const pair = pickPair(rng, groups, policy.scope, used);
      if (!pair) break;
      edges.push({
        sourceAgentId: pair[0].agentId,
        targetAgentId: pair[1].agentId,
        relationshipType: policy.type,
        secret,
        tags: [`history:${event.id}`],
      });
    }
  }
  return edges;
}

/** Resolve an event's involved department names to cast department ids that actually have members. */
function resolveInvolved(
  event: CompanyEvent,
  departments: DepartmentDefinition[],
  byDept: Map<string, CharacterProfile[]>,
): string[] {
  const out: string[] = [];
  for (const name of event.involvedDepartments ?? []) {
    const id = mapDepartmentNameToId(name, departments) ?? (byDept.has(name) ? name : null);
    if (id && byDept.has(id) && !out.includes(id)) out.push(id);
  }
  return out;
}

/**
 * Build the seed edges the F0.4 department rivalries leave — `rival` edges across
 * the feuding teams, scaled by rivalry strength, tagged `rivalry:<a>~<b>`.
 */
export function seedEdgesFromRivalries(
  rivalries: DepartmentRivalry[],
  profiles: CharacterProfile[],
  seed: number | string,
): SeededEdge[] {
  const byDept = groupByDept(profiles);
  const edges: SeededEdge[] = [];
  for (const riv of rivalries) {
    const groups = [
      { id: riv.a, members: byDept.get(riv.a) ?? [] },
      { id: riv.b, members: byDept.get(riv.b) ?? [] },
    ];
    if (!groups[0].members.length || !groups[1].members.length) continue;
    const count = clamp(Math.round((riv.strength / 100) * EDGES_PER_RIVALRY), 1, EDGES_PER_RIVALRY);
    const rng = mulberry32(seedToInt(`${seed}|riv|${pairKey(riv.a, riv.b)}`));
    const used = new Set<string>();
    for (let i = 0; i < count; i++) {
      const pair = pickPair(rng, groups, 'across', used);
      if (!pair) break;
      edges.push({
        sourceAgentId: pair[0].agentId,
        targetAgentId: pair[1].agentId,
        relationshipType: 'rival',
        tags: [`rivalry:${pairKey(riv.a, riv.b)}`],
      });
    }
  }
  return edges;
}

/** The graph climate bias a company supplies (S0.6.1) — its factionalism aggregate. */
export function companyGraphClimate(company: Company): GraphClimate {
  return { factionalism: company.climate.factionalism.value };
}

/**
 * Wire a generated company's relationship graph (F0.6): factionalism-biased
 * social ties + concrete edges seeded from formative events and department
 * rivalries. Reporting is left to the cascade (so the F0.3 chart depth survives),
 * hence `reportProbability: 0`. Mutates and returns the profiles. Deterministic.
 */
export function wireCompanyRelationships(
  company: Company,
  profiles: CharacterProfile[],
  departments: DepartmentDefinition[],
  rivalries: DepartmentRivalry[],
  opts: Pick<RelationshipGraphOptions, 'seed' | 'relationshipTypes' | 'intraDensity' | 'interDensity'> = {},
): CharacterProfile[] {
  const seed = opts.seed ?? company.companyId;
  return generateRelationshipGraph(profiles, {
    seed,
    relationshipTypes: opts.relationshipTypes,
    intraDensity: opts.intraDensity,
    interDensity: opts.interDensity,
    reportProbability: 0, // the cascade owns reporting (multi-level depth, F0.3)
    climate: companyGraphClimate(company),
    seedEdges: [
      ...seedEdgesFromHistory(company, profiles, departments, seed),
      ...seedEdgesFromRivalries(rivalries, profiles, seed),
    ],
  });
}
