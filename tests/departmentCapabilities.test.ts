import { describe, it, expect } from 'vitest';
import {
  DEPARTMENT_CAPABILITIES,
  CATEGORY_CAPABILITIES,
  defaultCapabilitiesForCategory,
} from '../src/core/department';
import { buildOrgStructure } from '../src/core/orgStructure';
import { DEFAULT_DEPARTMENTS, DEFAULT_STYLE, DEFAULT_RELATIONSHIP_TYPES, defaultProject } from '../src/data/defaults';
import { createDefaultCompany } from '../src/core/company';
import { cascadeCompany } from '../src/core/companyCascade';

const capsOf = (depts: { id: string; capabilities?: string[] }[], id: string) =>
  depts.find((d) => d.id === id)?.capabilities ?? [];

describe('F2.4 — capability/medium tags (S2.4.2)', () => {
  it('defaultCapabilitiesForCategory follows the functional table and returns a copy', () => {
    expect(defaultCapabilitiesForCategory('technical')).toEqual(['email', 'im', 'logs']);
    expect(defaultCapabilitiesForCategory('administrative')).toEqual(['personnel_records']);
    expect(defaultCapabilitiesForCategory('operations')).toEqual(['badge_logs', 'cameras']);
    // unknown category grants nothing (absent-safe)
    expect(defaultCapabilitiesForCategory('made_up')).toEqual([]);
    // returns a fresh array — mutation can't corrupt the shared map
    defaultCapabilitiesForCategory('technical').push('hacked');
    expect(CATEGORY_CAPABILITIES.technical).toEqual(['email', 'im', 'logs']);
  });

  it('the seed catalog is tagged by category (IT→email/logs, HR→records, Facilities→badge/cameras)', () => {
    expect(capsOf(DEFAULT_DEPARTMENTS, 'it')).toEqual(['email', 'im', 'logs']);
    expect(capsOf(DEFAULT_DEPARTMENTS, 'hr')).toEqual(['personnel_records']);
    expect(capsOf(DEFAULT_DEPARTMENTS, 'facilities')).toEqual(['badge_logs', 'cameras']);
    expect(capsOf(DEFAULT_DEPARTMENTS, 'sales')).toEqual(['crm']);
    // every suggested medium is a real vocabulary entry
    for (const d of DEFAULT_DEPARTMENTS) for (const c of d.capabilities ?? []) {
      expect(DEPARTMENT_CAPABILITIES as readonly string[]).toContain(c);
    }
  });

  it('surfaces capabilities in the visible org chart (the player sees what reaching it buys)', () => {
    const org = buildOrgStructure(defaultProject());
    const it = org.structure.departments.find((d) => d.id === 'it')!;
    expect(it.capabilities).toEqual(['email', 'im', 'logs']);
    // always present, even when empty — absent-safe
    for (const d of org.structure.departments) expect(Array.isArray(d.capabilities)).toBe(true);
  });

  it('a hand-authored department with no tags is absent-safe (grants nothing)', () => {
    const project = defaultProject();
    project.departments.push({ id: 'skunkworks', label: 'Skunkworks', category: 'technical', capabilities: [] });
    const org = buildOrgStructure(project);
    expect(org.structure.departments.find((d) => d.id === 'skunkworks')!.capabilities).toEqual([]);
  });

  it('generated companies carry capability tags through the cascade (surveillance-ready)', () => {
    const c = createDefaultCompany('acme', 'Acme');
    c.identity.headcount = 40; c.identity.industry = 'Software';
    const result = cascadeCompany(c, {
      catalog: DEFAULT_DEPARTMENTS, style: DEFAULT_STYLE, relationshipTypes: DEFAULT_RELATIONSHIP_TYPES, seed: 'cap-1',
    });
    // every generated department resolves a (non-undefined) capability grant
    for (const d of result.departments) expect(Array.isArray(d.capabilities)).toBe(true);
    // and the technical/admin defaults survived if those departments were derived
    const it = result.departments.find((d) => d.id === 'it');
    if (it) expect(it.capabilities).toEqual(['email', 'im', 'logs']);
  });
});
