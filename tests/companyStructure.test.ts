import { describe, it, expect } from 'vitest';
import { createDefaultCompany, type Company } from '../src/core/company';
import {
  deriveDepartments,
  deriveOrgShape,
  allocateHeadcount,
  deriveStructure,
  targetDepartmentCount,
} from '../src/core/companyStructure';
import { DEFAULT_DEPARTMENTS } from '../src/data/defaults';

/** A small company with overridable identity/culture for fast, focused tests. */
function company(over: Partial<Company['identity']> & { hierarchy?: number } = {}): Company {
  const c = createDefaultCompany('acme', 'Acme');
  c.identity.headcount = over.headcount ?? 40;
  c.identity.sizeBand = over.sizeBand ?? 'small';
  c.identity.industry = over.industry ?? 'Software';
  c.identity.foundedYear = over.foundedYear ?? 2015;
  if (over.hierarchy !== undefined) c.culture.hierarchy = over.hierarchy;
  return c;
}

const ids = (c: Company) => deriveDepartments(c, DEFAULT_DEPARTMENTS).map((d) => d.id);

describe('F0.3 — department-set derivation (S0.3.1)', () => {
  it('is deterministic for the same company', () => {
    const c = company();
    expect(ids(c)).toEqual(ids(c));
  });

  it('always includes leadership so a head can resolve', () => {
    expect(ids(company({ sizeBand: 'startup' }))).toContain('executive');
    expect(ids(company({ sizeBand: 'enterprise' }))).toContain('executive');
  });

  it('larger and older companies get more departments', () => {
    expect(ids(company({ sizeBand: 'startup' })).length).toBeLessThan(ids(company({ sizeBand: 'enterprise' })).length);
    const young = company({ sizeBand: 'midmarket', foundedYear: 2020 });
    const old = company({ sizeBand: 'midmarket', foundedYear: 1960 });
    expect(deriveDepartments(old, DEFAULT_DEPARTMENTS).length).toBeGreaterThan(
      deriveDepartments(young, DEFAULT_DEPARTMENTS).length,
    );
  });

  it('industry shapes which departments appear', () => {
    expect(ids(company({ industry: 'Software', sizeBand: 'small' }))).toContain('engineering');
    expect(ids(company({ industry: 'Finance', sizeBand: 'small' }))).toContain('finance');
    // Software leans engineering; a small Finance firm need not staff engineering.
    expect(ids(company({ industry: 'Finance', sizeBand: 'small' }))).not.toContain('engineering');
  });

  it('clamps to the catalog size and never goes below 2', () => {
    const big = company({ sizeBand: 'enterprise', headcount: 100000 });
    expect(deriveDepartments(big, DEFAULT_DEPARTMENTS).length).toBe(DEFAULT_DEPARTMENTS.length);
    expect(targetDepartmentCount(company({ sizeBand: 'startup' }), DEFAULT_DEPARTMENTS.length)).toBeGreaterThanOrEqual(2);
  });
});

describe('F0.3 — headcount allocation (S0.3.1)', () => {
  it('sums to the company headcount, with at least one seat each', () => {
    const c = company({ headcount: 73 });
    const depts = deriveDepartments(c, DEFAULT_DEPARTMENTS);
    const alloc = allocateHeadcount(c, depts);
    expect(Object.values(alloc).reduce((s, n) => s + n, 0)).toBe(73);
    for (const d of depts) expect(alloc[d.id]).toBeGreaterThanOrEqual(1);
  });

  it('is deterministic', () => {
    const c = company({ headcount: 73 });
    const depts = deriveDepartments(c, DEFAULT_DEPARTMENTS);
    expect(allocateHeadcount(c, depts)).toEqual(allocateHeadcount(c, depts));
  });
});

describe('F0.3 — org-chart shape from hierarchy axis (S0.3.2)', () => {
  it('flat companies are shallow and wide; hierarchical ones are deep and narrow', () => {
    const flat = deriveOrgShape(company({ hierarchy: 0 }));
    const steep = deriveOrgShape(company({ hierarchy: 100 }));
    expect(flat.depth).toBeLessThan(steep.depth);
    expect(flat.span).toBeGreaterThan(steep.span);
    expect(flat.ladder.length).toBe(flat.depth + 1);
    expect(steep.ladder.length).toBe(steep.depth + 1);
  });

  it('is monotonic in the hierarchy axis', () => {
    const depths = [0, 25, 50, 75, 100].map((h) => deriveOrgShape(company({ hierarchy: h })).depth);
    for (let i = 1; i < depths.length; i++) expect(depths[i]).toBeGreaterThanOrEqual(depths[i - 1]);
  });
});

describe('F0.3 — combined derivation', () => {
  it('deriveStructure bundles departments, headcount, and shape, deterministically', () => {
    const c = company({ headcount: 60 });
    const a = deriveStructure(c, DEFAULT_DEPARTMENTS);
    const b = deriveStructure(c, DEFAULT_DEPARTMENTS);
    expect(a).toEqual(b);
    expect(Object.keys(a.headcountByDept).sort()).toEqual(a.departments.map((d) => d.id).sort());
  });
});
