/**
 * Culture-weighted persona generation (Epic 0, F0.5) — the policy that turns a
 * company/department's *culture* into a bias over Epic 3's persona archetypes, so
 * the people diverge by company character (a cutthroat-finance Sales team skews
 * high-ambition / low-integrity). It is a **weighting layer**, not a new persona
 * model: it maps the 7 culture axes onto a persona-axis target that the F3.2
 * generator's culture-weighting hook consumes ("bias not lock").
 *
 * Pure + deterministic. Epic 3 stays free of company types — only this module
 * (Epic 0) knows both vocabularies. See …/06-f0-5-culture-weighted-persona-generation.
 */
import { CULTURE_AXES, type CultureAxes, type CultureAxis } from './company';
import { clampUnit, type CharacterProfile } from './profile';
import type { AxisTarget } from './populationPersona';

/**
 * How each culture axis tilts the persona axes (per unit of culture deviation
 * from neutral). Keys are persona axes — OCEAN (`openness`…`neuroticism`) + the
 * primary game axes (`ambition`, `integrity`, `loyalty`, `discretion`). Signs
 * follow the charged (high) pole of each culture axis; see CULTURE_AXIS_POLES.
 */
const INFLUENCE: Record<CultureAxis, Partial<Record<string, number>>> = {
  cutthroat: { ambition: 1, integrity: -1, agreeableness: -0.7 },
  mercenary: { ambition: 0.8, loyalty: -1, integrity: -0.5 },
  hierarchy: { conscientiousness: 0.6, discretion: 0.5, ambition: 0.3 },
  secrecy: { discretion: 1, openness: -0.6 },
  volatility: { neuroticism: 0.8, conscientiousness: -0.5 },
  pace: { neuroticism: 0.7, conscientiousness: 0.3 }, // burnout pole
  fear: { neuroticism: 0.8, openness: -0.5, loyalty: 0.3 },
};

/** Max shift (points off neutral 50) a single fully-extreme culture axis can apply. */
const SCALE = 30;

/**
 * Translate a resolved culture (a company culture or a department subculture)
 * into the persona-axis target the F3.2 generator weights archetype selection by.
 * Neutral culture → an all-50 target → no bias. Deterministic + pure.
 */
export function cultureToAxisTarget(culture: CultureAxes): AxisTarget {
  const target: Record<string, number> = {};
  for (const ca of CULTURE_AXES) {
    const dev = (culture[ca] - 50) / 50; // -1 … 1
    for (const [pa, inf] of Object.entries(INFLUENCE[ca])) {
      target[pa] = (target[pa] ?? 50) + SCALE * (inf ?? 0) * dev;
    }
  }
  for (const k of Object.keys(target)) target[k] = clampUnit(target[k]);
  return target;
}

// --- divergence metric (S0.5.2) ---------------------------------------------

/** The archetype distribution (prototypeRole share) of a cohort. */
function archetypeDistribution(cohort: CharacterProfile[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const p of cohort) counts.set(p.identity.prototypeRole, (counts.get(p.identity.prototypeRole) ?? 0) + 1);
  const n = cohort.length || 1;
  for (const [k, v] of counts) counts.set(k, v / n);
  return counts;
}

/**
 * How far two cohorts' persona distributions diverge — total-variation distance
 * over the archetype mix, 0 (identical) … 1 (disjoint). Used to prove company
 * character actually shifts the population (S0.5.2). The documented threshold for
 * "measurably different" is {@link DIVERGENCE_THRESHOLD}.
 */
export function populationDivergence(a: CharacterProfile[], b: CharacterProfile[]): number {
  const da = archetypeDistribution(a);
  const db = archetypeDistribution(b);
  let tvd = 0;
  for (const key of new Set([...da.keys(), ...db.keys()])) tvd += Math.abs((da.get(key) ?? 0) - (db.get(key) ?? 0));
  return tvd / 2;
}

/** Two cohorts of the same department under contrasting companies should clear this. */
export const DIVERGENCE_THRESHOLD = 0.2;
