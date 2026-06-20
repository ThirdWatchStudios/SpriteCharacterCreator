/**
 * The company cascade orchestrator (Epic 0, Pass 2) — the top-down pipeline that
 * turns a generated {@link Company} root into a populated org: structure (F0.3) →
 * subcultures (F0.4) → culture-weighted people (F0.5) → history-seeded
 * relationships (F0.6). It composes the existing Epic 2/3 generators rather than
 * adding new models, and every stage is deterministic for the cascade seed.
 *
 * This file lands incrementally with the F0.3–F0.6 features; today it realizes
 * **F0.3**: derive departments + headcount + org-chart shape, generate a persona
 * per seat, assign seniority down the org-shape ladder, and wire reporting so the
 * result is a *valid* Epic 2 org-structure (`buildOrgStructure`/`validateOrgStructure`).
 * Persona *bodies* come from the existing F3.2 generator here; F0.5 swaps in the
 * culture-weighted variant, F0.6 the history-seeded relationship graph.
 */
import type { Company } from './company';
import type { DepartmentDefinition } from './department';
import { deriveStructure, seniorityForIndex, type DerivedStructure } from './companyStructure';
import { resolveSubcultures, seedDepartmentRivalries, type DepartmentRivalry } from './departmentSubculture';
import { cultureToAxisTarget } from './cultureWeighting';
import { wireCompanyRelationships } from './historyEdges';
import { rankScenarioEligibility, type EligibilityReport } from './scenarioEligibility';
import type { ScenarioTemplate } from './scenarioTemplate';
import { generatePopulation, employeeRecipe, getProfile, type EmployeeDefinition } from './employee';
import { generateEmployeePersona } from './populationPersona';
import { SENIORITY, type CharacterProfile, type RelationshipTypeDefinition } from './profile';
import type { CharacterRecipe, StyleSheet } from './types';

export interface CascadeOptions {
  /** The Epic 2 department catalog to draw from (e.g. DEFAULT_DEPARTMENTS). */
  catalog: DepartmentDefinition[];
  /** The active style sheet (visual DNA generation). */
  style: StyleSheet;
  /** Cascade seed — defaults to the company id so a company reproduces its org. */
  seed?: string | number;
  /** The relationship-type catalog (for F0.6 secret/third-party flags). Optional. */
  relationshipTypes?: RelationshipTypeDefinition[];
  /** The scenario-template library — when given, the result carries F0.7 eligibility. */
  scenarioLibrary?: ScenarioTemplate[];
}

export interface CascadeResult {
  company: Company;
  /** The derived department catalog (the subset the cascade populated). */
  departments: DepartmentDefinition[];
  /** Generated personas, seated + seniority-ranked + reporting-wired. */
  profiles: CharacterProfile[];
  /** The F0.3 derivation (department set, headcount split, org-chart shape). */
  structure: DerivedStructure;
  /** Seeded inter-department rivalries (F0.4) — the factionalism F0.6 wires. */
  rivalries: DepartmentRivalry[];
  /** History-seeded scenario eligibility (F0.7) — present when a `scenarioLibrary` was given. */
  eligibility?: EligibilityReport;
}

const seniorityRank = (s: string): number => Math.max(0, (SENIORITY as readonly string[]).indexOf(s));

/** A stable, unique agent id for the `i`-th seat of a department. */
const seatId = (companyId: string, deptId: string, i: number): string =>
  `${companyId}-${deptId}-${String(i + 1).padStart(3, '0')}`;

/** Add a `manager`/`direct-report` edge pair (report → manager). Idempotent. */
function wireReports(report: CharacterProfile, manager: CharacterProfile): void {
  if (report.agentId === manager.agentId) return;
  if (!report.relationships.some((r) => r.relationshipType === 'manager' && r.targetAgentId === manager.agentId)) {
    report.relationships.push(reportEdge(manager.agentId, 'manager'));
  }
  if (!manager.relationships.some((r) => r.relationshipType === 'direct-report' && r.targetAgentId === report.agentId)) {
    manager.relationships.push(reportEdge(report.agentId, 'direct-report'));
  }
}

/** A neutral reporting edge — the org-chart cares only about type + target. */
function reportEdge(targetAgentId: string, type: 'manager' | 'direct-report') {
  return {
    targetAgentId,
    trust: 55, suspicion: 0, affinity: 10, influence: type === 'manager' ? 40 : 15, respect: 65, familiarity: 55,
    relationshipType: type,
    tags: [] as string[],
  };
}

/**
 * Wire a department's members into a reporting chain that realizes the org-shape
 * depth: each member reports to a member in the nearest tier above (round-robined
 * for span); the senior-most member (index 0) is the head and reports to no one
 * inside the department. Strictly-up edges → no cycles. Returns the head.
 */
function wireDepartment(members: CharacterProfile[]): CharacterProfile {
  // Senior-most first; ties keep generation order (deterministic).
  const sorted = [...members].sort((a, b) => seniorityRank(b.identity.seniority) - seniorityRank(a.identity.seniority));
  const head = sorted[0];
  // Bucket placed members by seniority rank so each report finds the nearest tier up.
  const placedByRank = new Map<number, CharacterProfile[]>();
  const cursor = new Map<number, number>(); // round-robin pointer per tier
  const place = (p: CharacterProfile): void => {
    const r = seniorityRank(p.identity.seniority);
    (placedByRank.get(r) ?? placedByRank.set(r, []).get(r)!).push(p);
  };
  place(head);
  for (const m of sorted.slice(1)) {
    const r = seniorityRank(m.identity.seniority);
    // The nearest occupied tier strictly above this member's rank.
    const higher = [...placedByRank.keys()].filter((k) => k > r).sort((a, b) => a - b)[0];
    const tier = higher !== undefined ? placedByRank.get(higher)! : [head];
    const idx = (cursor.get(higher ?? -1) ?? 0) % tier.length;
    cursor.set(higher ?? -1, idx + 1);
    wireReports(m, tier[idx]);
    place(m);
  }
  return head;
}

/**
 * Run the F0.3 structure tier of the cascade: derive the org structure from the
 * company and realize it as a populated, reporting-wired cast. Deterministic.
 * The result's `profiles` + `departments` form a valid Epic 2 org-structure.
 */
export function cascadeCompany(company: Company, opts: CascadeOptions): CascadeResult {
  const seed = String(opts.seed ?? company.companyId);
  const structure = deriveStructure(company, opts.catalog, seed);
  // F0.4 — resolve each department's subculture onto the entity + seed rivalries.
  resolveSubcultures(company, structure.departments, seed);
  const rivalries = seedDepartmentRivalries(company, structure.departments, seed);

  const profiles: CharacterProfile[] = [];
  const headsByDept: Record<string, CharacterProfile> = {};

  for (const dept of structure.departments) {
    const count = structure.headcountByDept[dept.id] ?? 0;
    if (count <= 0) continue;
    // Visual DNA uses the nearest generation profile (falls back to 'random').
    const visualProfile = getProfile(dept.id).id;
    const pop = generatePopulation(count, visualProfile, opts.style, `${seed}:${dept.id}`);
    // F0.5 — bias archetype selection by the department's resolved subculture.
    const axisTarget = dept.subculture ? cultureToAxisTarget(dept.subculture) : undefined;

    const members: CharacterProfile[] = pop.employees.map((emp: EmployeeDefinition, i) => {
      emp.metadata.department = dept.id; // F3.2 archetype flavor + persona department
      const recipe: CharacterRecipe = { ...employeeRecipe(emp), id: seatId(company.companyId, dept.id, i) };
      const persona = generateEmployeePersona(emp, recipe, axisTarget);
      persona.identity.seniority = seniorityForIndex(structure.orgShape, i, count);
      return persona;
    });

    headsByDept[dept.id] = wireDepartment(members);
    profiles.push(...members);
  }

  // Company spine: each non-executive department head reports to the executive head.
  const execHead = headsByDept['executive'];
  if (execHead) {
    for (const [deptId, head] of Object.entries(headsByDept)) {
      if (deptId !== 'executive') wireReports(head, execHead);
    }
  }

  // F0.6 — factionalism-biased social ties + concrete edges from history + rivalries.
  wireCompanyRelationships(company, profiles, structure.departments, rivalries, {
    seed,
    relationshipTypes: opts.relationshipTypes,
  });

  // F0.7 — rank the scenario library by how the company's history makes it hot.
  const eligibility = opts.scenarioLibrary
    ? rankScenarioEligibility(company, opts.scenarioLibrary, profiles)
    : undefined;

  return { company, departments: structure.departments, profiles, structure, rivalries, eligibility };
}
