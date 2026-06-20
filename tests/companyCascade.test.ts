import { describe, it, expect } from 'vitest';
import { createDefaultCompany, type Company } from '../src/core/company';
import { cascadeCompany } from '../src/core/companyCascade';
import { buildOrgStructure, validateOrgStructure } from '../src/core/orgStructure';
import { DEFAULT_DEPARTMENTS, DEFAULT_STYLE } from '../src/data/defaults';
import type { CharacterProfile } from '../src/core/profile';

function company(over: { headcount?: number; hierarchy?: number; industry?: string; sizeBand?: string } = {}): Company {
  const c = createDefaultCompany('acme', 'Acme');
  c.identity.headcount = over.headcount ?? 40;
  c.identity.sizeBand = over.sizeBand ?? 'small';
  c.identity.industry = over.industry ?? 'Software';
  c.identity.foundedYear = 2015;
  if (over.hierarchy !== undefined) c.culture.hierarchy = over.hierarchy;
  return c;
}

const run = (c: Company) => cascadeCompany(c, { catalog: DEFAULT_DEPARTMENTS, style: DEFAULT_STYLE });

/** Longest manager chain in the derived org (chart depth). */
function maxReportingDepth(profiles: CharacterProfile[]): number {
  const managerOf = new Map<string, string>();
  for (const p of profiles) {
    for (const r of p.relationships) {
      if (r.relationshipType === 'manager') managerOf.set(p.agentId, r.targetAgentId);
    }
  }
  let max = 0;
  for (const p of profiles) {
    let d = 0;
    let cur: string | undefined = p.agentId;
    const seen = new Set<string>();
    while (cur && managerOf.has(cur) && !seen.has(cur)) {
      seen.add(cur);
      cur = managerOf.get(cur);
      d++;
    }
    max = Math.max(max, d);
  }
  return max;
}

describe('F0.3 — cascade structure realization', () => {
  it('produces a valid Epic 2 org-structure (S0.3.3)', () => {
    const res = run(company({ headcount: 50 }));
    const v = validateOrgStructure({ departments: res.departments, profiles: res.profiles, characters: [] });
    expect(v.errors).toEqual([]);
  });

  it('seats roughly the company headcount and gives every department a head', () => {
    const res = run(company({ headcount: 50 }));
    expect(res.profiles.length).toBe(50);
    const org = buildOrgStructure({ departments: res.departments, profiles: res.profiles });
    for (const d of res.departments) expect(org.contents.heads[d.id]).toBeTruthy();
    expect(org.contents.unassigned).toEqual([]);
  });

  it('is deterministic for a company', () => {
    const c = company({ headcount: 40 });
    const a = run(c).profiles.map((p) => [p.agentId, p.identity.seniority, p.relationships.map((r) => r.targetAgentId)]);
    const b = run(c).profiles.map((p) => [p.agentId, p.identity.seniority, p.relationships.map((r) => r.targetAgentId)]);
    expect(a).toEqual(b);
  });

  it('a hierarchical company yields a deeper chart than a flat one (S0.3.2)', () => {
    const flat = run(company({ headcount: 60, hierarchy: 5 }));
    const steep = run(company({ headcount: 60, hierarchy: 95 }));
    expect(maxReportingDepth(steep.profiles)).toBeGreaterThan(maxReportingDepth(flat.profiles));
  });

  it('a deliberately malformed cast fails the validation (S0.3.3)', () => {
    const res = run(company({ headcount: 30 }));
    // Break one persona's department so it no longer resolves to the catalog.
    res.profiles[0].identity.department = '__not_a_department__';
    const v = validateOrgStructure({ departments: res.departments, profiles: res.profiles, characters: [] });
    expect(v.errors.length).toBeGreaterThan(0);
  });

  it('wires history-seeded relationships without breaking the org-structure (F0.6)', () => {
    const c = company({ headcount: 60, industry: 'Software' });
    c.history = [
      { id: 'lay', title: 'Layoff', description: '', kind: 'layoff', when: 'recent', magnitude: 85, visibility: 'public', involvedDepartments: ['Engineering'] },
    ];
    c.climate.factionalism = { value: 80, authored: true };
    const res = cascadeCompany(c, { catalog: DEFAULT_DEPARTMENTS, style: DEFAULT_STYLE });
    // The history edge is present and traceable…
    const tagged = res.profiles.flatMap((p) => p.relationships.filter((r) => r.tags.includes('history:lay')));
    expect(tagged.length).toBeGreaterThan(0);
    expect(tagged.every((r) => r.relationshipType === 'rival')).toBe(true);
    // …and the social/history wiring did not corrupt the reporting chart.
    expect(validateOrgStructure({ departments: res.departments, profiles: res.profiles, characters: [] }).errors).toEqual([]);
  });
});
