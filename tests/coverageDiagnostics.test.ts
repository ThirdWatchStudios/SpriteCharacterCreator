import { describe, it, expect } from 'vitest';
import {
  analyzeTemplateCoverage,
  analyzeOrgCoverage,
  validateOrgScenarioCoverage,
  type ScenarioTemplate,
  type Precondition,
} from '../src/core/scenarioTemplate';
import { ROLE_TEMPLATES } from '../src/data/roleTemplates';
import { DEFAULT_CAST, DEFAULT_PROFILES } from '../src/data/defaults';
import { createDefaultProfile, type CharacterProfile, type Relationship } from '../src/core/profile';

const tpl = (over: Partial<ScenarioTemplate>): ScenarioTemplate => ({
  templateId: 't', title: 'T', summary: '', triggering: 'emerge',
  emotionalPayload: { targetEmotions: ['x'], description: '' },
  roles: [], roleSeeds: [], locations: [], roleSpawns: [], truthFacts: [], informationItems: [],
  interventionTypes: [], variants: [], defaultVariantId: '',
  objective: { objectiveId: 'o', label: '', category: 'culture', desiredPressure: '', intendedObservableBehavior: '', kpi: '', expectedEvidence: [] },
  ...over,
});
const role = (roleId: string, preconditions: Precondition[], required = true) => ({ roleId, label: roleId, description: '', required, preconditions });

const managerEdge = (targetAgentId: string): Relationship => ({
  targetAgentId, relationshipType: 'manager', trust: 50, suspicion: 0, affinity: 0, influence: 0, respect: 50, familiarity: 50, tags: [],
});
function mkProfile(agentId: string, department: string, managerId?: string): CharacterProfile {
  const p = createDefaultProfile(DEFAULT_CAST[0]);
  p.agentId = agentId;
  p.identity.department = department;
  p.relationships = managerId ? [managerEdge(managerId)] : [];
  return p;
}

describe('F4.4 — naming department gaps in coverage (S4.4.2)', () => {
  it('names a department-membership precondition no member can satisfy', () => {
    // no default-cast member is in "legal".
    const t = tpl({ templateId: 'needs_legal', roles: [role('counsel', [{ kind: 'department', department: 'legal', mode: 'in' }])] });
    const cov = analyzeTemplateCoverage(t, DEFAULT_PROFILES);
    expect(cov.fullyCastable).toBe(false);
    const counsel = cov.perRole.find((r) => r.roleId === 'counsel')!;
    expect(counsel.unmetReasons.some((n) => n.includes('department "legal"') && n.includes('no members'))).toBe(true);
  });

  it('names a different-department predicate that an all-one-department cast cannot meet', () => {
    const opsOnly = DEFAULT_PROFILES.filter((p) => p.identity.department === 'operations'); // janice/carl/linda
    const t = tpl({ templateId: 'cross', roles: [role('a', []), role('b', [{ kind: 'crossDepartment', toRole: 'a', relation: 'different' }])] });
    const cov = analyzeTemplateCoverage(t, opsOnly);
    expect(cov.fullyCastable).toBe(false);
    const b = cov.perRole.find((r) => r.roleId === 'b')!;
    expect(b.unmetReasons.some((n) => n.includes('different department') && n.includes('"a"'))).toBe(true);
  });
});

describe('F4.4 — naming distance gaps in coverage (S4.4.2)', () => {
  it('names a distance threshold no eligible pairing reaches', () => {
    // x ← y is a 1-hop (16.67) reporting pair; a ≥90 threshold is unreachable.
    const cast = [mkProfile('x', 'sales'), mkProfile('y', 'eng', 'x')];
    const t = tpl({ templateId: 'far', roles: [role('a', []), role('b', [{ kind: 'distance', toRole: 'a', op: 'gte', value: 90 }])] });
    const cov = analyzeTemplateCoverage(t, cast);
    expect(cov.fullyCastable).toBe(false);
    const b = cov.perRole.find((r) => r.roleId === 'b')!;
    expect(b.unmetReasons.some((n) => n.includes('organizational distance gte 90') && n.includes('"a"'))).toBe(true);
  });

  it('does NOT flag a spatial-distance gap in coverage (no scene to evaluate against)', () => {
    // a spatial threshold is unknown without a scene → inert → the role still fills.
    const cast = [mkProfile('x', 'sales'), mkProfile('y', 'eng', 'x')];
    const t = tpl({ templateId: 'spatial', roles: [role('a', []), role('b', [{ kind: 'distance', toRole: 'a', source: 'spatial', op: 'gte', value: 90 }])] });
    const cov = analyzeTemplateCoverage(t, cast);
    expect(cov.fullyCastable).toBe(true);
    expect(cov.notes).toEqual([]);
  });
});

describe('F4.4 — org-coverage rollup carries the reasons (S4.4.1/S4.4.2)', () => {
  it('a well-covered org has no gaps and no reasons', () => {
    const rep = analyzeOrgCoverage(ROLE_TEMPLATES, DEFAULT_PROFILES);
    expect(rep.gaps).toEqual([]);
  });

  it('a gapped library surfaces the named reason in the gap and the gate message', () => {
    const needsLegal = tpl({ templateId: 'needs_legal', roles: [role('counsel', [{ kind: 'department', department: 'legal', mode: 'in' }])] });
    const library = [...ROLE_TEMPLATES, needsLegal];
    const rep = analyzeOrgCoverage(library, DEFAULT_PROFILES);
    const gap = rep.gaps.find((g) => g.templateId === 'needs_legal')!;
    expect(gap.reasons.some((r) => r.includes('department "legal"'))).toBe(true);

    // the reasons flow through to the export-gate warning string.
    const v = validateOrgScenarioCoverage(library, DEFAULT_PROFILES, { warnBelow: 1 });
    expect(v.warnings).toHaveLength(1);
    expect(v.warnings[0]).toContain('needs_legal');
    expect(v.warnings[0]).toContain('department "legal"');
  });
});
