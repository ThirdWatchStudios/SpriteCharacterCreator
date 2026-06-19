import { describe, it, expect } from 'vitest';
import {
  mapDepartmentNameToId,
  reportUnmappedDepartments,
  slugifyDepartment,
  validateDepartmentCatalog,
} from '../src/core/department';
import { DEFAULT_DEPARTMENTS, DEFAULT_STYLE, defaultProject } from '../src/data/defaults';
import { migrateProject } from '../src/core/migrations';
import { CURRENT_SCHEMA_VERSION } from '../src/core/types';
import { generateEmployee } from '../src/core/employee';

describe('department catalog (Epic 2 / F2.1)', () => {
  it('the seed catalog is valid with unique stable ids', () => {
    expect(validateDepartmentCatalog(DEFAULT_DEPARTMENTS)).toEqual([]);
    const ids = DEFAULT_DEPARTMENTS.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('flags duplicate and missing ids', () => {
    const issues = validateDepartmentCatalog([
      { id: 'sales', label: 'Sales', category: 'commercial' },
      { id: 'sales', label: 'Field Sales', category: 'commercial' },
      { id: '', label: 'Mystery', category: 'operations' },
    ]);
    expect(issues.some((i) => i.includes('Duplicate'))).toBe(true);
    expect(issues.some((i) => i.includes('missing an id'))).toBe(true);
  });

  it('slugifies free-text names into stable kebab-case ids', () => {
    expect(slugifyDepartment('Customer Support')).toBe('customer-support');
    expect(slugifyDepartment('  R&D / Labs ')).toBe('r-d-labs');
    expect(slugifyDepartment('IT')).toBe('it');
  });

  it('maps free-text department names onto catalog ids (id, label, slug)', () => {
    expect(mapDepartmentNameToId('Customer Support', DEFAULT_DEPARTMENTS)).toBe('customer-support');
    expect(mapDepartmentNameToId('hr', DEFAULT_DEPARTMENTS)).toBe('hr'); // exact id
    expect(mapDepartmentNameToId('ENGINEERING', DEFAULT_DEPARTMENTS)).toBe('engineering'); // case-insensitive label
    expect(mapDepartmentNameToId('Procurement', DEFAULT_DEPARTMENTS)).toBeNull();
  });

  it('reports the unmapped free-text names for cleanup (deduped)', () => {
    const unmapped = reportUnmappedDepartments(['Sales', 'Procurement', 'procurement', 'Skunkworks', ''], DEFAULT_DEPARTMENTS);
    expect(unmapped).toEqual(['Procurement', 'Skunkworks']);
  });
});

describe('department catalog wiring', () => {
  it('the default project ships the seed catalog', () => {
    const p = defaultProject();
    expect(p.departments).toEqual(DEFAULT_DEPARTMENTS);
    expect(p.version).toBe(CURRENT_SCHEMA_VERSION);
  });

  it('default personas carry catalog ids, not free text (F3.1)', () => {
    const p = defaultProject();
    const byId = Object.fromEntries(p.departments.map((d) => [d.id, d]));
    for (const prof of p.profiles ?? []) {
      if (!prof.identity.department) continue;
      expect(byId[prof.identity.department], `${prof.agentId} department`).toBeDefined();
    }
    expect(p.profiles!.find((x) => x.agentId === 'janice')!.identity.department).toBe('operations');
    expect(p.profiles!.find((x) => x.agentId === 'manager')!.identity.department).toBe('management');
  });

  it('generated employee metadata.department is a catalog id (F3.1)', () => {
    expect(generateEmployee('SEED1', 'it', DEFAULT_STYLE).metadata.department).toBe('it');
    expect(generateEmployee('SEED1', 'accounting', DEFAULT_STYLE).metadata.department).toBe('accounting');
    expect(generateEmployee('SEED1', 'random', DEFAULT_STYLE).metadata.department).toBe('');
  });

  it('migration v11 rewrites free-text persona department to a catalog id (idempotent)', () => {
    const v10 = defaultProject() as Record<string, unknown>;
    v10.version = 10;
    const profs = v10.profiles as Array<{ agentId: string; identity: { department: string } }>;
    profs.find((x) => x.agentId === 'janice')!.identity.department = 'Operations'; // free-text label
    profs.find((x) => x.agentId === 'carl')!.identity.department = 'Skunkworks'; // unmapped custom

    const migrated = migrateProject(v10)!;
    const dep = (id: string) => migrated.profiles!.find((x) => x.agentId === id)!.identity.department;
    expect(dep('janice')).toBe('operations'); // mapped onto the seed id
    expect(dep('carl')).toBe('skunkworks'); // absorbed into the catalog, then rewritten to its id
    expect(migrated.departments.some((d) => d.id === 'skunkworks' && d.label === 'Skunkworks')).toBe(true);

    // Idempotent — re-migrating the already-id form is a no-op.
    const again = migrateProject({ ...migrated, version: 10 })!;
    expect(again.profiles!.find((x) => x.agentId === 'carl')!.identity.department).toBe('skunkworks');
  });

  it('migration seeds departments into a pre-v10 project and absorbs unmapped names', () => {
    // A minimal v9-shaped project missing the new catalog, with a custom dept.
    const v9 = defaultProject() as Record<string, unknown>;
    v9.version = 9;
    delete v9.departments;
    (v9.profiles as Array<{ identity: { department: string } }>)[0].identity.department = 'Skunkworks';

    const migrated = migrateProject(v9)!;
    expect(migrated.version).toBe(CURRENT_SCHEMA_VERSION);
    expect(validateDepartmentCatalog(migrated.departments)).toEqual([]);
    // Defaults are present...
    expect(migrated.departments.some((d) => d.id === 'sales')).toBe(true);
    // ...and the unmapped free-text dept was absorbed with a stable id.
    expect(migrated.departments.some((d) => d.id === 'skunkworks' && d.label === 'Skunkworks')).toBe(true);
  });
});
