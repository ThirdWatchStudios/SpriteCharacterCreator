import { describe, it, expect } from 'vitest';
import { buildOrgStructure, deriveReportingLines, validateOrgStructure } from '../src/core/orgStructure';
import { buildScenarioPackage } from '../src/core/scenarioRun';
import { DEFAULT_SCENARIOS, defaultProject } from '../src/data/defaults';

describe('org-structure artifact (Epic 2 / F2.2)', () => {
  it('lists every department and resolves members by agentId', () => {
    const org = buildOrgStructure(defaultProject());
    // Visible structure carries every catalog department.
    expect(org.structure.departments).toHaveLength(13);
    expect(org.structure.departments.find((d) => d.id === 'operations')?.label).toBe('Operations');
    // Fogged contents groups the default cast by their (free-text) department.
    expect(org.contents.members.operations.sort()).toEqual(['carl', 'janice', 'linda']);
    expect(org.contents.members.management).toEqual(['manager']);
    expect(org.contents.unassigned).toEqual([]);
    expect(org.meta.departmentCount).toBe(13);
    expect(org.meta.memberCount).toBe(4);
  });

  it('keeps visible structure free of member data (the fog split)', () => {
    const org = buildOrgStructure(defaultProject());
    // structure.departments entries are id/label/category + the visible capability
    // grant (F2.4) — no member data (that stays fogged in contents).
    for (const d of org.structure.departments) {
      expect(Object.keys(d).sort()).toEqual(['capabilities', 'category', 'id', 'label']);
    }
    // Every department also has a (possibly empty) members entry in contents.
    for (const d of org.structure.departments) {
      expect(Array.isArray(org.contents.members[d.id])).toBe(true);
    }
  });

  it('routes personas with an unresolvable department to unassigned', () => {
    const p = defaultProject();
    p.profiles![0].identity.department = 'Skunkworks'; // not in the catalog
    const org = buildOrgStructure(p);
    expect(org.contents.unassigned).toContain(p.profiles![0].agentId);
    expect(org.meta.memberCount).toBe(3);
  });

  it('is deterministic', () => {
    expect(JSON.stringify(buildOrgStructure(defaultProject()))).toBe(
      JSON.stringify(buildOrgStructure(defaultProject())),
    );
  });
});

describe('reporting lines derived from manager/direct-report edges (F2.3)', () => {
  it('derives manager→report lines from typed edges into the artifact', () => {
    const p = defaultProject();
    const mgr = p.profiles!.find((x) => x.agentId === 'manager')!;
    // The manager's existing untyped edges to janice/carl become direct-reports.
    for (const r of mgr.relationships) if (r.targetAgentId === 'janice' || r.targetAgentId === 'carl') r.relationshipType = 'direct-report';
    const ids = new Set(p.profiles!.map((x) => x.agentId));

    const { lines, issues } = deriveReportingLines(p.profiles!, ids);
    expect(issues).toEqual([]);
    expect(lines).toContainEqual({ managerAgentId: 'manager', reportAgentId: 'janice' });
    expect(lines).toContainEqual({ managerAgentId: 'manager', reportAgentId: 'carl' });
    expect(buildOrgStructure(p).meta.reportingLineCount).toBe(2);
  });

  it('flags a report whose manager does not resolve', () => {
    const p = defaultProject();
    const carl = p.profiles!.find((x) => x.agentId === 'carl')!;
    carl.relationships.push({ ...carl.relationships[0], targetAgentId: 'ghost', relationshipType: 'manager' });
    const { issues } = deriveReportingLines(p.profiles!, new Set(p.profiles!.map((x) => x.agentId)));
    expect(issues.some((i) => i.includes('unknown manager') && i.includes('ghost'))).toBe(true);
  });

  it('flags conflicting managers for the same report', () => {
    const p = defaultProject();
    const janice = p.profiles!.find((x) => x.agentId === 'janice')!;
    for (const r of janice.relationships) if (r.targetAgentId === 'manager') r.relationshipType = 'manager'; // janice → manager
    const carl = p.profiles!.find((x) => x.agentId === 'carl')!;
    carl.relationships.push({ ...carl.relationships[0], targetAgentId: 'janice', relationshipType: 'direct-report' }); // carl also claims janice
    const { issues } = deriveReportingLines(p.profiles!, new Set(p.profiles!.map((x) => x.agentId)));
    expect(issues.some((i) => i.includes('conflicting managers'))).toBe(true);
  });
});

describe('org-structure validation (Epic 2 / F2.5)', () => {
  it('the shipped default organization passes (no errors)', () => {
    const v = validateOrgStructure(defaultProject());
    expect(v.errors).toEqual([]);
    // The many empty seed departments surface as warnings, not errors.
    expect(v.warnings.length).toBeGreaterThan(0);
  });

  it('blocks a persona whose department does not resolve', () => {
    const p = defaultProject();
    p.profiles![0].identity.department = 'Skunkworks';
    const v = validateOrgStructure(p);
    expect(v.errors.some((e) => e.includes('unresolved department') && e.includes('Skunkworks'))).toBe(true);
  });

  it('blocks a conflicting reporting line', () => {
    const p = defaultProject();
    const janice = p.profiles!.find((x) => x.agentId === 'janice')!;
    for (const r of janice.relationships) if (r.targetAgentId === 'manager') r.relationshipType = 'manager';
    const carl = p.profiles!.find((x) => x.agentId === 'carl')!;
    carl.relationships.push({ ...carl.relationships[0], targetAgentId: 'janice', relationshipType: 'direct-report' });
    expect(validateOrgStructure(p).errors.some((e) => e.includes('conflicting managers'))).toBe(true);
  });

  it('blocks a reporting cycle', () => {
    const p = defaultProject();
    // janice → carl (manager), carl → janice (manager): a 2-cycle.
    const janice = p.profiles!.find((x) => x.agentId === 'janice')!;
    janice.relationships.push({ ...janice.relationships[0], targetAgentId: 'carl', relationshipType: 'manager' });
    const carl = p.profiles!.find((x) => x.agentId === 'carl')!;
    carl.relationships.push({ ...carl.relationships[0], targetAgentId: 'janice', relationshipType: 'manager' });
    expect(validateOrgStructure(p).errors.some((e) => e.includes('cycle'))).toBe(true);
  });

  it('blocks a duplicate catalog id', () => {
    const p = defaultProject();
    p.departments.push({ id: 'sales', label: 'Field Sales', category: 'commercial' });
    expect(validateOrgStructure(p).errors.some((e) => e.includes('Duplicate'))).toBe(true);
  });

  it('resolves a head per populated department (seniority fallback when no edges)', () => {
    const org = buildOrgStructure(defaultProject());
    // No typed manager/direct-report edges in the default cast → no reporting lines…
    expect(org.contents.reportingLines).toEqual([]);
    // …but every populated department still resolves a head (seniority-tiebroken).
    expect(org.contents.heads.management).toBe('manager');
    expect(org.contents.heads.operations).toBe('janice'); // senior, first in member order
    // Empty departments resolve to null.
    expect(org.contents.heads.legal).toBeNull();
  });

  it('ships in the scenario package bundle', () => {
    const pkg = buildScenarioPackage(DEFAULT_SCENARIOS[0], defaultProject());
    expect(pkg['departments.json']).toBeDefined();
    const org = pkg['org-structure.json'] as ReturnType<typeof buildOrgStructure>;
    expect(org.structure.departments.length).toBeGreaterThan(0);
    expect(org.contents.members).toBeDefined();
  });
});
