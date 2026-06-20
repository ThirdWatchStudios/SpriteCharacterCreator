/**
 * Department subculture cascade (Epic 0, F0.4) — the tier between structure
 * (F0.3) and people (F0.5). Each generated department becomes a mini-personality:
 * it *inherits* the company culture, tilts by its function (Sales runs hotter
 * than Legal), and is allowed a bounded random deviation — so a toxic team can
 * exist inside a healthy firm. It also seeds named inter-department rivalries
 * from the company's factionalism, making the climate concrete before the
 * relationship graph (F0.6) is wired.
 *
 * Writes the resolved subculture onto Epic 2's {@link DepartmentDefinition}
 * (`subculture`) — the seam F0.5 reads without recomputation. Pure + deterministic
 * for the cascade seed. See …/05-f0-4-department-subculture-cascade.
 */
import { CULTURE_AXES, type Company, type CultureAxes, type CultureAxis } from './company';
import type { DepartmentDefinition } from './department';
import { clampUnit } from './profile';
import { mulberry32 } from './random';
import { seedToInt } from './employee';

/** ± deviation each axis may wander from the company baseline (the F0.4 budget). */
export const SUBCULTURE_DEVIATION_BUDGET = 15;

/**
 * Function-aware culture tilt per department category — a small fixed bias so a
 * department reads as its function before any random deviation. Partial: an
 * unlisted axis isn't tilted, an unknown category gets no tilt.
 */
const CATEGORY_CULTURE_BIAS: Record<string, Partial<Record<CultureAxis, number>>> = {
  leadership: { hierarchy: 12, secrecy: 8, fear: 5 },
  commercial: { cutthroat: 12, mercenary: 10, pace: 8 },
  technical: { pace: 8, hierarchy: -6, secrecy: 4 },
  finance: { secrecy: 8, cutthroat: 5, volatility: -5 },
  operations: { pace: 6, hierarchy: 4, volatility: -4 },
  administrative: { fear: 4, hierarchy: 4, cutthroat: -6 },
};

/**
 * Resolve one department's subculture: company culture + its function bias + a
 * per-axis deviation sampled within the budget. Deterministic per `(seed, dept,
 * axis)`. Pure — returns a fresh axes object.
 */
export function resolveSubculture(company: Company, dept: DepartmentDefinition, seed: number | string): CultureAxes {
  const bias = CATEGORY_CULTURE_BIAS[dept.category] ?? {};
  const out = {} as CultureAxes;
  for (const axis of CULTURE_AXES) {
    const rng = mulberry32(seedToInt(`${seed}|subc|${dept.id}|${axis}`));
    const deviation = (rng() * 2 - 1) * SUBCULTURE_DEVIATION_BUDGET;
    out[axis] = clampUnit(company.culture[axis] + (bias[axis] ?? 0) + deviation);
  }
  return out;
}

/**
 * Resolve every department's subculture and write it onto the department entity
 * (the E2 seam F0.5 reads). Mutates and returns the departments.
 */
export function resolveSubcultures(
  company: Company,
  departments: DepartmentDefinition[],
  seed: number | string,
): DepartmentDefinition[] {
  for (const d of departments) d.subculture = resolveSubculture(company, d, seed);
  return departments;
}

// --- inter-department rivalries (S0.4.3) ------------------------------------

/** A seeded tension between two departments — the concrete factionalism F0.6 wires. */
export interface DepartmentRivalry {
  /** Department ids, sorted so a pair is identified the same way regardless of order. */
  a: string;
  b: string;
  /** 0–100 intensity, scaled off the company's factionalism. */
  strength: number;
}

const pairKey = (a: string, b: string): string => [a, b].sort().join('~');

/**
 * Seed named inter-department rivalries from the company's factionalism. More and
 * stronger rivalries as factionalism climbs; cross-category pairs (Commercial vs
 * Technical) are preferred as the more plausible fault lines. Deterministic.
 */
export function seedDepartmentRivalries(
  company: Company,
  departments: DepartmentDefinition[],
  seed: number | string,
): DepartmentRivalry[] {
  const f = clampUnit(company.climate.factionalism.value);
  if (departments.length < 2 || f <= 0) return [];

  // Score every unordered pair: cross-category fault lines first, with a seeded jitter.
  const scored: Array<{ a: string; b: string; score: number }> = [];
  for (let i = 0; i < departments.length; i++) {
    for (let j = i + 1; j < departments.length; j++) {
      const a = departments[i];
      const b = departments[j];
      const crossCategory = a.category !== b.category ? 1 : 0;
      const jitter = mulberry32(seedToInt(`${seed}|rivalry|${pairKey(a.id, b.id)}`))();
      scored.push({ a: a.id, b: b.id, score: crossCategory + jitter });
    }
  }
  scored.sort((x, y) => y.score - x.score || pairKey(x.a, x.b).localeCompare(pairKey(y.a, y.b)));

  // Count scales with factionalism, capped by the department count (not every pair feuds).
  const cap = Math.min(scored.length, departments.length);
  const count = Math.round((f / 100) * cap);
  return scored.slice(0, count).map(({ a, b }) => {
    const sorted = [a, b].sort();
    const jitter = mulberry32(seedToInt(`${seed}|strength|${pairKey(a, b)}`))();
    return { a: sorted[0], b: sorted[1], strength: clampUnit(f * (0.7 + 0.3 * jitter)) };
  });
}
