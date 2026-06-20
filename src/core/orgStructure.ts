/**
 * The org-structure export artifact (Epic 2, F2.2 + F2.3) — `org-structure.json`,
 * the loadable shape the sim renders as a known-structure, fogged-contents org
 * chart.
 *
 * The load-bearing idea (S2.2.2) is a clean **structure / contents split**:
 *   - `structure` — what the player always sees: which departments exist, their
 *     labels + categories. The sim can load this alone to draw the chart.
 *   - `contents` — what the sim fogs until a wing is reached: who is inside each
 *     department (members), the reporting lines, and the department heads.
 *
 * **Reporting lines are DERIVED, not authored (F2.3 decision).** The source of
 * truth is the existing `manager` / `direct-report` relationship edges (§3.7) —
 * no parallel authoring surface. `manager` means *the holder reports to the
 * target*; `direct-report` means *the target reports to the holder*. The
 * department **head** is the topmost member (one with no manager inside the
 * department), seniority-tiebroken — so every populated department resolves a
 * head even before any reporting edge is authored (the company cascade or the
 * author can add edges to sharpen it).
 *
 * The artifact is derived, not stored — the company cascade (Epic 0 F0.3)
 * populates the same catalog + personas this reads. Membership resolves each
 * persona's free-text `department` via the F2.1 catalog mapping (the id-rewrite
 * is F3.1); unresolved personas land in `unassigned`.
 */
import type { ProjectState } from './types';
import { SENIORITY, type CharacterProfile } from './profile';
import { mapDepartmentNameToId, validateDepartmentCatalog, type DepartmentDefinition } from './department';

/** A derived reporting edge: `reportAgentId` reports to `managerAgentId`. */
export interface ReportingLine {
  managerAgentId: string;
  reportAgentId: string;
}

/** The visible chart structure — safe to load without the member roster. */
export interface OrgStructureVisible {
  /**
   * Each department's id/label/category plus its capability/medium grant (F2.4) —
   * the visible "roughly what reaching this buys" the player sees while contents
   * stay fogged. `capabilities` is always present (empty when the department grants
   * nothing).
   */
  departments: { id: string; label: string; category: string; capabilities: string[] }[];
}

/** The fogged contents — revealed wing-by-wing by the sim. */
export interface OrgStructureContents {
  /** Member agentIds keyed by department id (every catalog department has an entry). */
  members: Record<string, string[]>;
  /** Personas whose `department` resolves to no catalog id (or is blank). */
  unassigned: string[];
  /** Derived manager→report edges (from the manager/direct-report relationship types). */
  reportingLines: ReportingLine[];
  /** The head agentId per department id (null when the department has no members). */
  heads: Record<string, string | null>;
}

export interface OrgStructureJson {
  structure: OrgStructureVisible;
  contents: OrgStructureContents;
  meta: { generator: string; schema: string; departmentCount: number; memberCount: number; reportingLineCount: number };
}

/** Seniority rank (intern < junior < senior < lead < manager); unknown → 0. */
function seniorityRank(s: string | undefined): number {
  const i = (SENIORITY as readonly string[]).indexOf(s ?? '');
  return i < 0 ? 0 : i;
}

/**
 * Derive reporting lines from the `manager` / `direct-report` relationship edges
 * (the F2.3 source of truth). Deterministic (profile order; first claim wins per
 * report). Flags a report with a conflicting or unresolvable manager (S2.3.2).
 */
export function deriveReportingLines(
  profiles: CharacterProfile[],
  knownAgentIds: Set<string>,
): { lines: ReportingLine[]; issues: string[] } {
  const managerOf = new Map<string, string>(); // report → manager (first claim wins)
  const issues: string[] = [];

  const claim = (report: string, manager: string, via: string): void => {
    if (report === manager) {
      issues.push(`"${report}" reports to itself (via ${via}).`);
      return;
    }
    const existing = managerOf.get(report);
    if (existing === undefined) managerOf.set(report, manager);
    else if (existing !== manager) issues.push(`"${report}" has conflicting managers "${existing}" and "${manager}" (via ${via}).`);
  };

  for (const p of profiles) {
    for (const r of p.relationships) {
      if (r.relationshipType === 'manager') claim(p.agentId, r.targetAgentId, 'manager edge');
      else if (r.relationshipType === 'direct-report') claim(r.targetAgentId, p.agentId, 'direct-report edge');
    }
  }

  const lines: ReportingLine[] = [];
  for (const [reportAgentId, managerAgentId] of managerOf) {
    if (!knownAgentIds.has(managerAgentId)) issues.push(`"${reportAgentId}" reports to unknown manager "${managerAgentId}".`);
    lines.push({ managerAgentId, reportAgentId });
  }
  return { lines, issues };
}

/**
 * The head of each department: the topmost member — one with no manager *inside*
 * the same department (reports up/out, or has no manager at all) — seniority-
 * tiebroken, then member order. Falls back to all members on an all-in-department
 * cycle. Null only for an empty department.
 */
export function deriveDepartmentHeads(
  departments: DepartmentDefinition[],
  members: Record<string, string[]>,
  lines: ReportingLine[],
  seniorityOf: Map<string, string>,
): Record<string, string | null> {
  const managerOf = new Map(lines.map((l) => [l.reportAgentId, l.managerAgentId]));
  const heads: Record<string, string | null> = {};
  for (const d of departments) {
    const mem = members[d.id] ?? [];
    const memSet = new Set(mem);
    const candidates = mem.filter((a) => {
      const m = managerOf.get(a);
      return m === undefined || !memSet.has(m);
    });
    const pool = candidates.length ? candidates : mem;
    let head: string | null = null;
    for (const a of pool) {
      if (head === null || seniorityRank(seniorityOf.get(a)) > seniorityRank(seniorityOf.get(head))) head = a;
    }
    heads[d.id] = head;
  }
  return heads;
}

/**
 * Build the org-structure artifact from the project's department catalog +
 * personas. Pure and deterministic. Every catalog department appears in both
 * `structure.departments` and `contents.members` (possibly empty), so the chart
 * and the fog map are always complete.
 */
export function buildOrgStructure(project: Pick<ProjectState, 'departments' | 'profiles'>): OrgStructureJson {
  const departments = project.departments ?? [];
  const profiles = project.profiles ?? [];

  const members: Record<string, string[]> = {};
  for (const d of departments) members[d.id] = [];
  const unassigned: string[] = [];

  let memberCount = 0;
  for (const p of profiles) {
    const id = p.identity.department ? mapDepartmentNameToId(p.identity.department, departments) : null;
    if (id && members[id]) {
      members[id].push(p.agentId);
      memberCount++;
    } else {
      unassigned.push(p.agentId);
    }
  }

  const knownAgentIds = new Set(profiles.map((p) => p.agentId));
  const { lines } = deriveReportingLines(profiles, knownAgentIds);
  const seniorityOf = new Map(profiles.map((p) => [p.agentId, p.identity.seniority]));
  const heads = deriveDepartmentHeads(departments, members, lines, seniorityOf);

  return {
    structure: {
      departments: departments.map((d) => ({ id: d.id, label: d.label, category: d.category, capabilities: d.capabilities ?? [] })),
    },
    contents: { members, unassigned, reportingLines: lines, heads },
    meta: {
      generator: 'sprite-character-creator',
      schema: '00-company-root-and-cascade.md',
      departmentCount: departments.length,
      memberCount,
      reportingLineCount: lines.length,
    },
  };
}

// --- validation (F2.5) ------------------------------------------------------

/** `errors` block export (a broken chart); `warnings` inform but don't block. */
export interface OrgValidation {
  errors: string[];
  warnings: string[];
}

/**
 * Validate the derived org structure so the sim never loads an inconsistent
 * chart (Epic 2, F2.5). Errors: a persona whose department doesn't resolve, a
 * duplicate/blank catalog id, a conflicting/unresolvable/cyclic reporting line,
 * a populated department with no head. Warnings: empty departments. Composes the
 * F2.1–F2.3 derivations; the in-app Export-all blocks on `errors`.
 */
export function validateOrgStructure(
  project: Pick<ProjectState, 'departments' | 'profiles' | 'characters'>,
): OrgValidation {
  const departments = project.departments ?? [];
  const profiles = project.profiles ?? [];
  const errors: string[] = [];
  const warnings: string[] = [];

  // Catalog integrity (unique, non-blank stable ids).
  errors.push(...validateDepartmentCatalog(departments));

  const org = buildOrgStructure({ departments, profiles });
  const nameOf = (agentId: string): string =>
    profiles.find((p) => p.agentId === agentId)?.identity.displayName || agentId;

  // Every persona's department resolves to a catalog id.
  for (const a of org.contents.unassigned) {
    const dept = profiles.find((p) => p.agentId === a)?.identity.department;
    errors.push(`"${nameOf(a)}" has an unresolved department${dept ? ` ("${dept}")` : ' (blank)'}.`);
  }

  // Reporting integrity — conflicts / self / unresolvable manager (the derive issues),
  // plus dangling report targets and cycles.
  const knownAgentIds = new Set<string>([
    ...(project.characters ?? []).map((c) => c.id),
    ...profiles.map((p) => p.agentId),
  ]);
  const { lines, issues } = deriveReportingLines(profiles, knownAgentIds);
  errors.push(...issues);
  for (const l of lines) {
    if (!knownAgentIds.has(l.reportAgentId)) errors.push(`Reporting line names unknown report "${l.reportAgentId}".`);
  }
  const managerOf = new Map(lines.map((l) => [l.reportAgentId, l.managerAgentId]));
  const inCycle = new Set<string>();
  for (const start of managerOf.keys()) {
    if (inCycle.has(start)) continue;
    const path: string[] = [];
    const seen = new Set<string>();
    let cur: string | undefined = start;
    while (cur !== undefined && !seen.has(cur)) {
      seen.add(cur);
      path.push(cur);
      cur = managerOf.get(cur);
    }
    if (cur !== undefined && seen.has(cur)) for (const n of path.slice(path.indexOf(cur))) inCycle.add(n);
  }
  if (inCycle.size) errors.push(`Reporting cycle detected among: ${[...inCycle].sort().join(', ')}.`);

  // Every populated department resolves a head; empty departments warn.
  for (const d of departments) {
    const mem = org.contents.members[d.id] ?? [];
    if (mem.length === 0) warnings.push(`Department "${d.label || d.id}" has no members.`);
    else if (!org.contents.heads[d.id]) errors.push(`Department "${d.label || d.id}" has members but no resolvable head.`);
  }

  return { errors, warnings };
}
