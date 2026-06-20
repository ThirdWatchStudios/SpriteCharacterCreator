import { describe, it, expect } from 'vitest';
import { CULTURE_AXES, type CultureAxes } from '../src/core/company';
import { cultureToAxisTarget, populationDivergence, DIVERGENCE_THRESHOLD } from '../src/core/cultureWeighting';
import { generatePopulation } from '../src/core/employee';
import { generateEmployeePersona } from '../src/core/populationPersona';
import { DEFAULT_STYLE } from '../src/data/defaults';
import type { CharacterProfile } from '../src/core/profile';

const NEUTRAL: CultureAxes = Object.fromEntries(CULTURE_AXES.map((a) => [a, 50])) as CultureAxes;
const CUTTHROAT: CultureAxes = { ...NEUTRAL, cutthroat: 92, mercenary: 85, fear: 70 };
const COLLABORATIVE: CultureAxes = { ...NEUTRAL, cutthroat: 8, mercenary: 15, fear: 20 };

/** A fixed cohort of `n` `sales` employees, personas generated under `culture`. */
function cohort(culture: CultureAxes | undefined, n = 40): CharacterProfile[] {
  const pop = generatePopulation(n, 'sales', DEFAULT_STYLE, 'fixed-sales').employees;
  const target = culture ? cultureToAxisTarget(culture) : undefined;
  return pop.map((e) => {
    e.metadata.department = 'sales';
    return generateEmployeePersona(e, undefined, target);
  });
}

const meanAxis = (ps: CharacterProfile[], ax: string): number =>
  ps.reduce((s, p) => s + ((p.personality.axes as Record<string, number>)[ax] ?? 0), 0) / ps.length;

describe('F0.5 — culture → persona-axis target (S0.5.1)', () => {
  it('a neutral culture produces an all-neutral target (no bias)', () => {
    const target = cultureToAxisTarget(NEUTRAL);
    for (const v of Object.values(target)) expect(v).toBeCloseTo(50, 5);
  });

  it('shifts the persona axes in the culture-appropriate direction', () => {
    const t = cultureToAxisTarget(CUTTHROAT);
    expect(t.ambition!).toBeGreaterThan(50); // cutthroat/mercenary lift ambition
    expect(t.integrity!).toBeLessThan(50); // and cut integrity
  });

  it('a neutral target leaves selection identical to no weighting (bias not lock)', () => {
    const plain = cohort(undefined).map((p) => p.identity.prototypeRole);
    const neutral = cohort(NEUTRAL).map((p) => p.identity.prototypeRole);
    expect(neutral).toEqual(plain);
  });

  it('is deterministic for a culture', () => {
    expect(cohort(CUTTHROAT).map((p) => p.identity.prototypeRole)).toEqual(
      cohort(CUTTHROAT).map((p) => p.identity.prototypeRole),
    );
  });
});

describe('F0.5 — population divergence under company character (S0.5.2)', () => {
  it('the same department diverges measurably across contrasting cultures', () => {
    const div = populationDivergence(cohort(CUTTHROAT), cohort(COLLABORATIVE));
    expect(div).toBeGreaterThan(DIVERGENCE_THRESHOLD);
  });

  it('the shift is directional — cutthroat skews higher-ambition, lower-integrity', () => {
    const cut = cohort(CUTTHROAT);
    const collab = cohort(COLLABORATIVE);
    expect(meanAxis(cut, 'ambition')).toBeGreaterThan(meanAxis(collab, 'ambition'));
    expect(meanAxis(cut, 'integrity')).toBeLessThan(meanAxis(collab, 'integrity'));
  });

  it('still spreads across archetypes (never collapses to one)', () => {
    const distinct = new Set(cohort(CUTTHROAT).map((p) => p.identity.prototypeRole));
    expect(distinct.size).toBeGreaterThanOrEqual(2);
  });
});
