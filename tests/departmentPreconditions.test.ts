import { describe, it, expect } from 'vitest';
import {
  castTemplate,
  validateScenarioTemplate,
  type ScenarioTemplate,
  type Precondition,
} from '../src/core/scenarioTemplate';
import { DEFAULT_CAST, DEFAULT_PROFILES } from '../src/data/defaults';
import { createDefaultProfile, type CharacterProfile } from '../src/core/profile';

/** A minimal valid template; spread overrides on top. */
const tpl = (over: Partial<ScenarioTemplate>): ScenarioTemplate => ({
  templateId: 't',
  title: 'T',
  summary: '',
  triggering: 'emerge',
  emotionalPayload: { targetEmotions: ['x'], description: '' },
  roles: [],
  roleSeeds: [],
  locations: [],
  roleSpawns: [],
  truthFacts: [],
  informationItems: [],
  interventionTypes: [],
  variants: [],
  defaultVariantId: '',
  objective: { objectiveId: 'o', label: '', category: 'culture', desiredPressure: '', intendedObservableBehavior: '', kpi: '', expectedEvidence: [] },
  ...over,
});

/** A required role with `roleId` and the given preconditions. */
const role = (roleId: string, preconditions: Precondition[]) => ({
  roleId,
  label: roleId,
  description: '',
  required: true,
  preconditions,
});

// Default cast departments: janice/carl/linda = operations, manager = management (F3.1 ids).
const profiles = DEFAULT_PROFILES;
const deptOf = (id: string) => profiles.find((p) => p.agentId === id)!.identity.department;

/** Clone a default profile and force its department (or '' for unassigned). */
const withDept = (recipeIdx: number, department: string): CharacterProfile => {
  const p = createDefaultProfile(DEFAULT_CAST[recipeIdx]);
  p.identity.department = department;
  return p;
};

describe('F4.2 — department-membership predicates (S4.2.1)', () => {
  it('`in` admits only members of the named department', () => {
    const t = tpl({ roles: [role('mgr', [{ kind: 'department', department: 'management', mode: 'in' }])] });
    const result = castTemplate(t, profiles);
    expect(result.report.candidatesByRole['mgr'].map((c) => c.agentId)).toEqual(['manager']);
    expect(result.report.assignments.find((a) => a.roleId === 'mgr')!.agentId).toBe('manager');
  });

  it('`notIn` forbids members of the named department', () => {
    const t = tpl({ roles: [role('outsider', [{ kind: 'department', department: 'operations', mode: 'notIn' }])] });
    const result = castTemplate(t, profiles);
    // everyone except the three operations members → just the manager.
    expect(result.report.candidatesByRole['outsider'].map((c) => c.agentId)).toEqual(['manager']);
  });

  it('an unassigned agent ("") is `in` nothing and `notIn` everything', () => {
    const cast = [withDept(0, ''), withDept(1, 'operations')];
    const inOps = castTemplate(tpl({ roles: [role('m', [{ kind: 'department', department: 'operations', mode: 'in' }])] }), cast);
    expect(inOps.report.candidatesByRole['m'].map((c) => c.agentId)).toEqual(['carl']);
    const notOps = castTemplate(tpl({ roles: [role('m', [{ kind: 'department', department: 'operations', mode: 'notIn' }])] }), cast);
    expect(notOps.report.candidatesByRole['m'].map((c) => c.agentId)).toEqual(['janice']);
  });

  it('a required department role that nobody satisfies fails the cast', () => {
    const t = tpl({ roles: [role('legal', [{ kind: 'department', department: 'legal', mode: 'in' }])] });
    const result = castTemplate(t, profiles);
    expect(result.ok).toBe(false);
    expect(result.report.unfilledRequired).toContain('legal');
  });
});

describe('F4.2 — cross-department predicate (S4.2.2)', () => {
  const crossTemplate = (relation: 'same' | 'different') =>
    tpl({
      templateId: `cross_${relation}`,
      roles: [
        role('a', []),
        role('b', [{ kind: 'crossDepartment', toRole: 'a', relation }]),
      ],
    });

  it('`different` casts the two slots into different departments', () => {
    const result = castTemplate(crossTemplate('different'), profiles);
    expect(result.ok).toBe(true);
    const a = result.report.assignments.find((x) => x.roleId === 'a')!.agentId!;
    const b = result.report.assignments.find((x) => x.roleId === 'b')!.agentId!;
    expect(deptOf(a)).not.toBe(deptOf(b));
    // the only cross-department pair in the default cast involves the manager.
    expect([a, b]).toContain('manager');
  });

  it('`different` rejects an all-same-department cast (cross-wing pairing impossible)', () => {
    // the three operations members only — no second department to pair against.
    const opsOnly = profiles.filter((p) => p.identity.department === 'operations');
    const result = castTemplate(crossTemplate('different'), opsOnly);
    expect(result.ok).toBe(false);
    expect(result.report.unfilledRequired).toContain('b');
  });

  it('`same` casts both slots into the same department', () => {
    const result = castTemplate(crossTemplate('same'), profiles);
    expect(result.ok).toBe(true);
    const a = result.report.assignments.find((x) => x.roleId === 'a')!.agentId!;
    const b = result.report.assignments.find((x) => x.roleId === 'b')!.agentId!;
    expect(deptOf(a)).toBe(deptOf(b));
    expect(deptOf(a)).toBe('operations');
  });

  it('a cross-department pairing never casts onto an agent with no department', () => {
    // one known department + one unassigned agent: `different` cannot be satisfied.
    const cast = [withDept(0, 'operations'), withDept(1, '')];
    const result = castTemplate(crossTemplate('different'), cast);
    expect(result.ok).toBe(false);
  });

  it('combines membership + cross-department: a manager paired with a non-manager', () => {
    const t = tpl({
      templateId: 'manager_and_report',
      roles: [
        role('boss', [{ kind: 'department', department: 'management', mode: 'in' }]),
        role('worker', [{ kind: 'crossDepartment', toRole: 'boss', relation: 'different' }]),
      ],
    });
    const result = castTemplate(t, profiles);
    expect(result.ok).toBe(true);
    expect(result.report.assignments.find((a) => a.roleId === 'boss')!.agentId).toBe('manager');
    const worker = result.report.assignments.find((a) => a.roleId === 'worker')!.agentId!;
    expect(deptOf(worker)).toBe('operations');
  });
});

describe('F4.2 — department precondition validation', () => {
  it('flags a department precondition with no department and a bad mode', () => {
    const t = tpl({ roles: [role('x', [{ kind: 'department', department: '', mode: 'sideways' as any }])] });
    const issues = validateScenarioTemplate(t);
    expect(issues.some((i) => i.includes('department precondition with no department'))).toBe(true);
    expect(issues.some((i) => i.includes('invalid mode'))).toBe(true);
  });

  it('flags a crossDepartment to an unknown role, a self-reference, and a bad relation', () => {
    const unknown = tpl({ roles: [role('x', [{ kind: 'crossDepartment', toRole: 'ghost', relation: 'different' }])] });
    expect(validateScenarioTemplate(unknown).some((i) => i.includes('unknown role "ghost"'))).toBe(true);

    const selfRef = tpl({ roles: [role('x', [{ kind: 'crossDepartment', toRole: 'x', relation: 'different' }])] });
    expect(validateScenarioTemplate(selfRef).some((i) => i.includes('references itself'))).toBe(true);

    const badRel = tpl({ roles: [role('a', []), role('b', [{ kind: 'crossDepartment', toRole: 'a', relation: 'adjacent' as any }])] });
    expect(validateScenarioTemplate(badRel).some((i) => i.includes('invalid relation'))).toBe(true);
  });

  it('a well-formed department + crossDepartment template validates clean', () => {
    const t = tpl({
      roles: [
        role('a', [{ kind: 'department', department: 'sales', mode: 'in' }]),
        role('b', [{ kind: 'crossDepartment', toRole: 'a', relation: 'different' }]),
      ],
    });
    expect(validateScenarioTemplate(t)).toEqual([]);
  });
});
