/**
 * Department-aware persona generation (Epic 3, F3.2) — the bridge that turns the
 * population generator's **visual DNA** (`employee.ts`) into **full personas**
 * (`personaTemplate.ts`). A generated department is no longer sprites + metadata;
 * it is real people with drives/traits/needs/axes, skewed by the department's
 * function (the F3.2 *department-flavored archetype* decision, S3.2.2).
 *
 * Lives in its own module on purpose: `personaTemplate` already imports
 * `employee` (for `seedToInt`), so wiring the two together here avoids an import
 * cycle. Deterministic — the same employee (+ recipe) always yields the same
 * persona, so a generated cohort is reproducible.
 */
import { mulberry32 } from './random';
import { seedToInt, employeeRecipe, type EmployeeDefinition } from './employee';
import { generatePersona } from './personaTemplate';
import { DEPARTMENT_ARCHETYPES, PERSONA_ARCHETYPES } from '../data/personaArchetypes';
import type { PersonaTemplate } from './personaTemplate';
import type { CharacterProfile } from './profile';
import type { CharacterRecipe } from './types';

const ARCHETYPE_BY_ID = new Map(PERSONA_ARCHETYPES.map((a) => [a.id, a]));

/**
 * The culture-weighting hook (F0.5 seam). An optional **persona-axis target** —
 * `{ ambition: 72, integrity: 30, … }` over the OCEAN + game axes — biases which
 * archetypes get picked toward the company/department culture. Kept generic on
 * purpose: Epic 3 stays free of company types; Epic 0 (`cultureWeighting.ts`)
 * translates culture → this target. Absent or all-neutral → no bias (the F3.2
 * behavior). "Bias not lock": the alignment factor is bounded, never zero.
 */
export type AxisTarget = Partial<Record<string, number>>;

/** The midpoint of each axis range an archetype's spine declares (absent → neutral 50). */
function templateAxisMid(t: PersonaTemplate): Record<string, number> {
  const mid: Record<string, number> = {};
  const add = (obj?: Record<string, readonly [number, number]>): void => {
    if (obj) for (const [k, [lo, hi]] of Object.entries(obj)) mid[k] = (lo + hi) / 2;
  };
  add(t.spine.ocean as Record<string, readonly [number, number]> | undefined);
  add(t.spine.axes as Record<string, readonly [number, number]> | undefined);
  return mid;
}

/**
 * How well an archetype matches the axis target, as a multiplicative weight
 * factor in [0.25, 4]. Only axes the culture actually pushes (target far from 50)
 * carry weight, so a neutral target leaves every factor at 1.
 */
function alignmentFactor(t: PersonaTemplate, target: AxisTarget): number {
  const mid = templateAxisMid(t);
  let dsum = 0;
  let wsum = 0;
  for (const [axis, tv] of Object.entries(target)) {
    if (tv === undefined) continue;
    const emphasis = Math.abs(tv - 50) / 50; // 0 (neutral) … 1 (extreme)
    if (emphasis <= 0.001) continue;
    dsum += emphasis * Math.abs((mid[axis] ?? 50) - tv);
    wsum += emphasis;
  }
  if (wsum <= 0) return 1;
  const similarity = 1 - dsum / wsum / 100; // 0 … 1
  // Steep, bounded curve: aligned archetypes dominate the pool, misaligned ones
  // stay possible (never zero) — "bias not lock" with real leverage.
  return 0.1 + 6 * similarity ** 3;
}

/** The weighted `{ template, weight }` archetype pool for a department, optionally culture-biased. */
function archetypePool(
  departmentId: string,
  axisTarget?: AxisTarget,
): Array<{ template: PersonaTemplate; weight: number }> {
  const weights = DEPARTMENT_ARCHETYPES[departmentId];
  const base = weights
    ? Object.entries(weights)
        .map(([id, weight]) => ({ template: ARCHETYPE_BY_ID.get(id), weight }))
        .filter((e): e is { template: PersonaTemplate; weight: number } => !!e.template)
    : // No department flavor (blank or unmapped) → uniform over all archetypes.
      PERSONA_ARCHETYPES.map((template) => ({ template, weight: 1 }));
  if (!axisTarget) return base;
  return base.map((e) => ({ template: e.template, weight: e.weight * alignmentFactor(e.template, axisTarget) }));
}

/** Weighted archetype pick from a seeded rng. */
function pickArchetype(rng: () => number, pool: Array<{ template: PersonaTemplate; weight: number }>): PersonaTemplate {
  const total = pool.reduce((s, e) => s + Math.max(0, e.weight), 0);
  if (total <= 0) return pool[0].template;
  let r = rng() * total;
  for (const e of pool) {
    r -= Math.max(0, e.weight);
    if (r <= 0) return e.template;
  }
  return pool[pool.length - 1].template;
}

/**
 * Generate a full {@link CharacterProfile} for a generated employee, drawing a
 * department-flavored archetype and binding it to the employee's appearance.
 * Pass the cast `recipe` when promoting into the project so the persona's
 * `agentId` matches the cast member; otherwise a recipe is synthesized from the
 * employee. The persona's `department` is set to the employee's catalog id (F3.1).
 */
export function generateEmployeePersona(
  emp: EmployeeDefinition,
  recipe?: CharacterRecipe,
  axisTarget?: AxisTarget,
): CharacterProfile {
  const bound = recipe ?? employeeRecipe(emp);
  const departmentId = emp.metadata.department || '';
  const rng = mulberry32(seedToInt(`${emp.visualSeed}|persona|${departmentId}`));
  const template = pickArchetype(rng, archetypePool(departmentId, axisTarget));

  const profile = generatePersona(template, seedToInt(`${emp.visualSeed}|${template.id}`), {
    agentId: bound.id,
    name: emp.name,
    recipe: bound,
  });
  profile.identity.department = departmentId;
  profile.identity.displayName = emp.name;
  return profile;
}

// --- cohort distinctiveness metric (S3.2.2) ---------------------------------

export interface CohortVariety {
  count: number;
  /** Distinct (archetype + primary drive + trait-set) signatures. */
  distinctSignatures: number;
  /** distinctSignatures / count — 1 = everyone reads differently, low = reskins. */
  varietyRatio: number;
  distinctArchetypes: number;
  distinctPrimaryDrives: number;
}

/** A persona's "reads-as" signature — what makes one cohort member legibly distinct. */
function personaSignature(p: CharacterProfile): string {
  return [p.identity.prototypeRole, p.drives.primary, [...p.personality.traitTags].sort().join('+')].join('|');
}

/**
 * Measure how legibly distinct a generated cohort is (S3.2.2). A healthy
 * department-flavored cohort spreads across several archetypes and drives rather
 * than collapsing into near-duplicates; `varietyRatio` is the headline number.
 */
export function cohortVariety(profiles: CharacterProfile[]): CohortVariety {
  const count = profiles.length;
  const sigs = new Set(profiles.map(personaSignature));
  const archetypes = new Set(profiles.map((p) => p.identity.prototypeRole));
  const drives = new Set(profiles.map((p) => p.drives.primary));
  return {
    count,
    distinctSignatures: sigs.size,
    varietyRatio: count ? sigs.size / count : 0,
    distinctArchetypes: archetypes.size,
    distinctPrimaryDrives: drives.size,
  };
}
