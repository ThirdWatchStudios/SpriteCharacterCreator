import { describe, it, expect } from 'vitest';
import { createDefaultCompany, CULTURE_AXES, type Company } from '../src/core/company';
import {
  resolveSubculture,
  resolveSubcultures,
  seedDepartmentRivalries,
  SUBCULTURE_DEVIATION_BUDGET,
} from '../src/core/departmentSubculture';
import type { DepartmentDefinition } from '../src/core/department';

const DEPTS: DepartmentDefinition[] = [
  { id: 'executive', label: 'Executive', category: 'leadership' },
  { id: 'sales', label: 'Sales', category: 'commercial' },
  { id: 'engineering', label: 'Engineering', category: 'technical' },
  { id: 'hr', label: 'HR', category: 'administrative' },
  { id: 'finance', label: 'Finance', category: 'finance' },
];

/** A company with a chosen factionalism (authored so derivation won't clobber it). */
function company(factionalism = 50): Company {
  const c = createDefaultCompany('acme', 'Acme');
  c.climate.factionalism = { value: factionalism, authored: true };
  return c;
}

describe('F0.4 — per-department subculture (S0.4.1)', () => {
  it('inherits the company culture biased within the deviation budget', () => {
    const c = company();
    const sub = resolveSubculture(c, DEPTS[1], 'seed'); // Sales (commercial)
    const maxBias = 12; // largest CATEGORY_CULTURE_BIAS magnitude
    for (const axis of CULTURE_AXES) {
      const delta = Math.abs(sub[axis] - c.culture[axis]);
      // clampUnit can shrink the delta, never grow it past bias + budget.
      expect(delta).toBeLessThanOrEqual(maxBias + SUBCULTURE_DEVIATION_BUDGET + 0.001);
      expect(sub[axis]).toBeGreaterThanOrEqual(0);
      expect(sub[axis]).toBeLessThanOrEqual(100);
    }
  });

  it('two departments in the same company resolve distinct subcultures', () => {
    const c = company();
    const sales = resolveSubculture(c, DEPTS[1], 'seed');
    const eng = resolveSubculture(c, DEPTS[2], 'seed');
    expect(CULTURE_AXES.some((a) => sales[a] !== eng[a])).toBe(true);
  });

  it('is deterministic for the cascade seed', () => {
    const c = company();
    expect(resolveSubculture(c, DEPTS[1], 'seed')).toEqual(resolveSubculture(c, DEPTS[1], 'seed'));
  });

  it('writes the subculture onto the department entity for F0.5 to read (S0.4.2)', () => {
    const c = company();
    const depts = resolveSubcultures(c, structuredClone(DEPTS), 'seed');
    for (const d of depts) {
      expect(d.subculture).toBeDefined();
      for (const a of CULTURE_AXES) expect(typeof d.subculture![a]).toBe('number');
    }
  });
});

describe('F0.4 — inter-department rivalries (S0.4.3)', () => {
  it('seeds more and stronger rivalries as factionalism climbs', () => {
    const low = seedDepartmentRivalries(company(20), DEPTS, 'seed');
    const high = seedDepartmentRivalries(company(90), DEPTS, 'seed');
    expect(high.length).toBeGreaterThan(low.length);
    const avg = (rs: { strength: number }[]) => (rs.length ? rs.reduce((s, r) => s + r.strength, 0) / rs.length : 0);
    expect(avg(high)).toBeGreaterThan(avg(low));
  });

  it('produces no rivalries at zero factionalism, and is deterministic', () => {
    expect(seedDepartmentRivalries(company(0), DEPTS, 'seed')).toEqual([]);
    expect(seedDepartmentRivalries(company(70), DEPTS, 'seed')).toEqual(
      seedDepartmentRivalries(company(70), DEPTS, 'seed'),
    );
  });

  it('rivalries reference real departments and are not self-pairs', () => {
    const ids = new Set(DEPTS.map((d) => d.id));
    for (const r of seedDepartmentRivalries(company(80), DEPTS, 'seed')) {
      expect(ids.has(r.a)).toBe(true);
      expect(ids.has(r.b)).toBe(true);
      expect(r.a).not.toBe(r.b);
    }
  });
});
