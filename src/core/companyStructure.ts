/**
 * Structure derivation (Epic 0, F0.3) — the first cascade tier below the company
 * root. Turns a {@link Company}'s *character* (size, industry, age, hierarchy
 * axis) into the org's **shape**: which departments exist, how the headcount
 * splits across them, and how deep/wide the reporting chart runs. It emits into
 * **Epic 2's** one department model (`DepartmentDefinition`) and feeds the
 * org-structure artifact downstream tiers realize — it adds no second org model.
 *
 * Pure and deterministic: same `(company, catalog, seed)` → same structure. The
 * company is itself seeded (F0.2), so a `(archetype, seed)` reproduces the whole
 * structure. See docs/office-scale/epics/epic-00-…/04-f0-3-structure-derivation.
 */
import type { Company } from './company';
import type { DepartmentDefinition } from './department';
import { SENIORITY, type Seniority } from './profile';
import { mulberry32 } from './random';
import { seedToInt } from './employee';

// --- department-set derivation (S0.3.1) -------------------------------------

/**
 * Industry → the department ids that industry leans on, in priority order. Free
 * text with a fallback: an unknown industry just uses the universal spine. Ids
 * reference the Epic 2 catalog (see `DEFAULT_DEPARTMENTS`); any id missing from
 * the passed catalog is skipped, so a trimmed catalog still derives cleanly.
 */
const INDUSTRY_DEPARTMENTS: Record<string, string[]> = {
  Software: ['engineering', 'it', 'sales', 'marketing', 'customer-support'],
  Finance: ['finance', 'accounting', 'legal', 'sales', 'it'],
  Manufacturing: ['operations', 'engineering', 'facilities', 'sales', 'accounting'],
  Retail: ['sales', 'customer-support', 'operations', 'marketing', 'facilities'],
  Healthcare: ['operations', 'hr', 'legal', 'finance', 'it'],
  Media: ['marketing', 'sales', 'engineering', 'operations', 'legal'],
  Consulting: ['sales', 'finance', 'hr', 'it', 'operations'],
  Logistics: ['operations', 'facilities', 'customer-support', 'it', 'sales'],
  Energy: ['engineering', 'operations', 'legal', 'facilities', 'finance'],
  Nonprofit: ['operations', 'hr', 'marketing', 'finance', 'facilities'],
  Government: ['operations', 'legal', 'hr', 'finance', 'facilities'],
};

/** The always-present spine — every org has leadership + the back-office basics. */
const CORE_DEPARTMENTS = ['executive', 'hr', 'finance', 'it'];
/** Universal fallback fill order when industry + core don't reach the target count. */
const UNIVERSAL_FILL = [
  'management', 'operations', 'sales', 'marketing', 'customer-support',
  'engineering', 'accounting', 'facilities', 'legal',
];

/** Coarse company "scale" → a baseline department count, lifted a notch by age. */
const SIZE_DEPARTMENT_COUNT: Record<string, number> = {
  startup: 3,
  small: 5,
  midmarket: 7,
  large: 10,
  enterprise: 13,
};

/** A founded-year older than this many years bumps the department count by one. */
const OLD_COMPANY_AGE = 25;
/** "Now" for the age bump — the studio's content clock, not wall time (determinism). */
const REFERENCE_YEAR = 2025;

/** The target number of departments for a company (clamped to the catalog size). */
export function targetDepartmentCount(company: Company, catalogSize: number): number {
  const base = SIZE_DEPARTMENT_COUNT[company.identity.sizeBand] ?? Math.round(clamp(company.identity.headcount / 12, 3, 13));
  const ageBump = REFERENCE_YEAR - company.identity.foundedYear >= OLD_COMPANY_AGE ? 1 : 0;
  return Math.max(2, Math.min(catalogSize, base + ageBump));
}

/**
 * Derive the department set from company size + industry, drawn from the Epic 2
 * catalog. Larger/older companies get more departments; the industry shapes
 * *which* ones. Leadership is always present so the org-chart can resolve a head.
 */
export function deriveDepartments(
  company: Company,
  catalog: DepartmentDefinition[],
  _seed: number | string = 'structure',
): DepartmentDefinition[] {
  const byId = new Map(catalog.map((d) => [d.id, d]));
  const target = targetDepartmentCount(company, catalog.length);

  // Priority order: core spine, then industry-preferred, then universal fill.
  const industry = INDUSTRY_DEPARTMENTS[company.identity.industry] ?? [];
  const ordered: string[] = [];
  const push = (id: string): void => {
    if (!ordered.includes(id) && byId.has(id)) ordered.push(id);
  };
  CORE_DEPARTMENTS.forEach(push);
  industry.forEach(push);
  UNIVERSAL_FILL.forEach(push);
  // Anything still in the catalog but not yet ordered (custom catalogs), in catalog order.
  catalog.forEach((d) => push(d.id));

  return ordered.slice(0, target).map((id) => byId.get(id)!);
}

// --- headcount allocation (S0.3.1) ------------------------------------------

/** Relative staffing weight per functional category — leadership is lean, delivery is heavy. */
const CATEGORY_WEIGHT: Record<string, number> = {
  leadership: 0.4,
  finance: 1,
  administrative: 1,
  technical: 2,
  commercial: 2,
  operations: 1.5,
};

/**
 * Split the company headcount across the derived departments, weighted by
 * functional category (delivery teams larger than leadership). Every department
 * gets at least one seat; the remainder is distributed largest-share-first so the
 * totals are exact and deterministic.
 */
export function allocateHeadcount(
  company: Company,
  departments: DepartmentDefinition[],
  seed: number | string = 'headcount',
): Record<string, number> {
  const total = Math.max(departments.length, Math.round(company.identity.headcount));
  const weights = departments.map((d) => CATEGORY_WEIGHT[d.category] ?? 1);
  const weightSum = weights.reduce((s, w) => s + w, 0);

  // Floor each share, then hand out the leftover seats to the largest fractional parts.
  const raw = departments.map((d, i) => ({ id: d.id, exact: (weights[i] / weightSum) * total }));
  const alloc: Record<string, number> = {};
  let used = 0;
  for (const r of raw) {
    alloc[r.id] = Math.max(1, Math.floor(r.exact));
    used += alloc[r.id];
  }
  // Reconcile to the exact total (the per-dept floor of 1 can over- or under-shoot).
  const rng = mulberry32(seedToInt(`${seed}|alloc`));
  const order = [...raw].sort((a, b) => (b.exact % 1) - (a.exact % 1) || rng() - 0.5);
  let delta = total - used;
  for (let i = 0; delta > 0; i = (i + 1) % order.length) { alloc[order[i].id]++; delta--; }
  for (let i = 0; delta < 0; i = (i + 1) % order.length) {
    if (alloc[order[i].id] > 1) { alloc[order[i].id]--; delta++; }
  }
  return alloc;
}

// --- org-chart shape (S0.3.2) -----------------------------------------------

/**
 * The reporting-chart shape derived from the Hierarchy↔Flat culture axis. A flat
 * company is shallow + wide (few seniority tiers, many reports per manager); a
 * hierarchical one is deep + narrow. The cascade's reporting wiring consumes
 * `ladder` (the seniority tiers in play) + `span` to realize the chart.
 */
export interface OrgShape {
  /** Number of reporting levels, 1 (flat) … 4 (steep). */
  depth: number;
  /** Target reports per manager — wide when flat, narrow when hierarchical. */
  span: number;
  /** The seniority tiers in use, senior-most last; length = depth + 1. */
  ladder: Seniority[];
}

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

/** Derive the reporting depth/span from the company's hierarchy axis. Pure. */
export function deriveOrgShape(company: Company): OrgShape {
  const h = clamp(company.culture.hierarchy, 0, 100);
  // Flat (0) → depth 1; hierarchical (100) → depth 4.
  const depth = clamp(Math.round(1 + (h / 100) * 3), 1, SENIORITY.length - 1);
  // Wide when flat (~10), narrow when hierarchical (~3).
  const span = clamp(Math.round(10 - (h / 100) * 7), 3, 10);
  // The senior-most `depth + 1` tiers (e.g. depth 1 → ['lead','manager'] style top slice).
  const ladder = SENIORITY.slice(SENIORITY.length - (depth + 1)) as unknown as Seniority[];
  return { depth, span, ladder };
}

// --- combined derivation ----------------------------------------------------

export interface DerivedStructure {
  departments: DepartmentDefinition[];
  headcountByDept: Record<string, number>;
  orgShape: OrgShape;
}

/**
 * Derive the whole org structure (departments + headcount split + chart shape)
 * from a company. Deterministic for `(company, catalog, seed)`; the company seed
 * carries through. This is the F0.3 product the cascade orchestrator realizes
 * into personas + a validated Epic 2 org-structure artifact.
 */
export function deriveStructure(
  company: Company,
  catalog: DepartmentDefinition[],
  seed: number | string = 'structure',
): DerivedStructure {
  const departments = deriveDepartments(company, catalog, seed);
  return {
    departments,
    headcountByDept: allocateHeadcount(company, departments, seed),
    orgShape: deriveOrgShape(company),
  };
}

/**
 * Assign a seniority to the `n`th member (of `count`) of a department, following
 * the org-shape ladder: the senior-most member is the head, the rest spread down
 * the tiers. Deterministic. Used by the cascade to realize chart depth.
 */
export function seniorityForIndex(shape: OrgShape, index: number, count: number): Seniority {
  const { ladder } = shape;
  if (count <= 1 || ladder.length === 1) return ladder[ladder.length - 1];
  // Member 0 is the most senior (head); fill the remaining tiers top-down by share.
  if (index === 0) return ladder[ladder.length - 1];
  // Distribute the rest across the lower tiers, widening toward the bottom.
  const lower = ladder.slice(0, ladder.length - 1);
  const tier = Math.min(lower.length - 1, Math.floor(((index - 1) / (count - 1)) * lower.length));
  return lower[lower.length - 1 - tier];
}
