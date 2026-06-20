/**
 * The department entity + catalog (Epic 2, F2.1) — the single department/org
 * model the whole office-scale program references. A department is a structured,
 * project-level catalog entry (like drives / traits / relationshipTypes), so the
 * rest of the work can reference departments by **stable id** instead of the
 * free-text strings used today (`identity.department`, `employee metadata`).
 *
 * This is the seam Epic 0's per-department subculture cascade (F0.4) writes into
 * and Epic 3's structured `department` field (F3.1) references, and the org-chart
 * artifact (F2.2) groups by. Nothing outside Epic 2 defines departments.
 *
 * F2.1 scope is the entity + catalog + seed + mapping helpers. Converting the
 * persona/employee `department` fields from free text to catalog ids is F3.1;
 * the org-structure export + reporting lines are F2.2/F2.3.
 */

/**
 * Coarse functional grouping for a department. Free-text-with-fallback, like the
 * other office vocabularies (DEPARTMENTS / OWNERSHIP_KINDS etc.): the field stays
 * `string` on the entity so custom values survive, and this list is the suggested
 * set the cascade (F0.3) and the UI draw from.
 */
export const DEPARTMENT_CATEGORIES = [
  'leadership',
  'finance',
  'commercial',
  'technical',
  'operations',
  'administrative',
] as const;
export type DepartmentCategory = (typeof DEPARTMENT_CATEGORIES)[number];

/** A department — a structured catalog entry with a stable id. */
export interface DepartmentDefinition {
  /** Stable slug; referenced by personas/employees/org-structure. Never re-issued. */
  id: string;
  label: string;
  /** Free text; {@link DEPARTMENT_CATEGORIES} is the fallback vocabulary. */
  category: string;
  /**
   * Resolved per-department subculture (Epic 0, F0.4) — the company culture
   * biased by the department's function plus a bounded deviation, so a toxic team
   * can live inside a healthy firm. Optional: hand-authored/legacy departments omit
   * it. This is the E2 seam the culture-weighted persona generator (F0.5) reads.
   */
  subculture?: import('./company').CultureAxes;
}

/** Turn a free-text department name into a stable kebab-case id. */
export function slugifyDepartment(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Resolve a free-text department name to a catalog id, or null if it doesn't
 * map. Tries, in order: exact id match, case-insensitive label match, then
 * slugified-name-equals-id. Used by the F3.1 migration and the unmapped report;
 * read-only (never mutates the catalog).
 */
export function mapDepartmentNameToId(name: string, catalog: DepartmentDefinition[]): string | null {
  const trimmed = name.trim();
  if (!trimmed) return null;
  const byId = catalog.find((d) => d.id === trimmed);
  if (byId) return byId.id;
  const lower = trimmed.toLowerCase();
  const byLabel = catalog.find((d) => d.label.toLowerCase() === lower);
  if (byLabel) return byLabel.id;
  const slug = slugifyDepartment(trimmed);
  const bySlug = catalog.find((d) => d.id === slug);
  return bySlug ? bySlug.id : null;
}

/**
 * The free-text department names that don't resolve to any catalog id (deduped,
 * order-preserving) — what S2.1.2 surfaces for cleanup before F3.1 rewrites the
 * fields. Blank names are ignored.
 */
export function reportUnmappedDepartments(names: string[], catalog: DepartmentDefinition[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const name of names) {
    const trimmed = name.trim();
    const key = trimmed.toLowerCase();
    if (!trimmed || seen.has(key)) continue;
    seen.add(key);
    if (mapDepartmentNameToId(trimmed, catalog) === null) out.push(trimmed);
  }
  return out;
}

/**
 * Human-readable issues with a department catalog. Empty array = valid. Mirrors
 * the other catalog validators: stable ids must be present and unique.
 */
export function validateDepartmentCatalog(catalog: DepartmentDefinition[]): string[] {
  const issues: string[] = [];
  const seen = new Set<string>();
  for (const d of catalog) {
    if (!d.id) issues.push(`Department "${d.label || '(unnamed)'}" is missing an id.`);
    else if (seen.has(d.id)) issues.push(`Duplicate department id "${d.id}".`);
    seen.add(d.id);
    if (!d.label) issues.push(`Department "${d.id}" is missing a label.`);
  }
  return issues;
}
