import { describe, it, expect } from 'vitest';
import {
  analyzeOrgCoverage,
  validateOrgScenarioCoverage,
  type ScenarioTemplate,
} from '../src/core/scenarioTemplate';
import { ROLE_TEMPLATES, THE_OFFICE_ROMANCE } from '../src/data/roleTemplates';
import { DEFAULT_PROFILES } from '../src/data/defaults';

/** A clone of a real template whose first required role nobody can fill. */
function impossibleTemplate(id: string): ScenarioTemplate {
  const t = structuredClone(THE_OFFICE_ROMANCE);
  t.templateId = id;
  const required = t.roles.find((r) => r.required)!;
  required.preconditions.push({ kind: 'trait', trait: '__no_such_trait__', mode: 'has' });
  return t;
}

describe('org scenario-coverage aggregation (Epic 3 / F3.5 S3.5.1)', () => {
  it('reports a well-covered org as fully castable', () => {
    const rep = analyzeOrgCoverage(ROLE_TEMPLATES, DEFAULT_PROFILES);
    expect(rep.totalCount).toBe(ROLE_TEMPLATES.length);
    expect(rep.castableCount).toBe(ROLE_TEMPLATES.length);
    expect(rep.coverageRatio).toBe(1);
    expect(rep.gaps).toEqual([]);
  });

  it('names the under-covered templates and the roles that cannot fill', () => {
    const library = [...ROLE_TEMPLATES, impossibleTemplate('impossible_one')];
    const rep = analyzeOrgCoverage(library, DEFAULT_PROFILES);
    expect(rep.totalCount).toBe(library.length);
    expect(rep.castableCount).toBe(ROLE_TEMPLATES.length); // the real ones still cast
    const gap = rep.gaps.find((g) => g.templateId === 'impossible_one')!;
    expect(gap).toBeTruthy();
    expect(gap.unfillableRequiredRoles.length).toBeGreaterThan(0);
  });

  it('an empty cast covers nothing', () => {
    const rep = analyzeOrgCoverage(ROLE_TEMPLATES, []);
    expect(rep.castableCount).toBe(0);
    expect(rep.coverageRatio).toBe(0);
    expect(rep.gaps).toHaveLength(ROLE_TEMPLATES.length);
  });

  it('an empty library is vacuously fully covered', () => {
    const rep = analyzeOrgCoverage([], DEFAULT_PROFILES);
    expect(rep.totalCount).toBe(0);
    expect(rep.coverageRatio).toBe(1);
    expect(rep.gaps).toEqual([]);
  });
});

describe('pre-export coverage gate (Epic 3 / F3.5 S3.5.2)', () => {
  it('a well-covered cast passes cleanly (no errors, no warnings)', () => {
    const v = validateOrgScenarioCoverage(ROLE_TEMPLATES, DEFAULT_PROFILES);
    expect(v.errors).toEqual([]);
    expect(v.warnings).toEqual([]);
  });

  it('blocks an org that can cast nothing, naming the gaps', () => {
    const v = validateOrgScenarioCoverage(ROLE_TEMPLATES, []);
    expect(v.errors).toHaveLength(1);
    expect(v.errors[0]).toContain('cannot generate any scenario');
    for (const t of ROLE_TEMPLATES) expect(v.errors[0]).toContain(t.templateId);
    expect(v.warnings).toEqual([]); // a block is not also a warning
  });

  it('warns (does not block) a thin-but-nonzero org, naming the gaps', () => {
    const library = [THE_OFFICE_ROMANCE, impossibleTemplate('impossible_one')]; // 1/2 castable
    const v = validateOrgScenarioCoverage(library, DEFAULT_PROFILES, { warnBelow: 1 });
    expect(v.errors).toEqual([]);
    expect(v.warnings).toHaveLength(1);
    expect(v.warnings[0]).toContain('impossible_one');
  });

  it('thresholds are tunable — blockAtOrBelow can escalate a warning into a block', () => {
    const library = [THE_OFFICE_ROMANCE, impossibleTemplate('impossible_one')]; // ratio 0.5
    const v = validateOrgScenarioCoverage(library, DEFAULT_PROFILES, { blockAtOrBelow: 0.5 });
    expect(v.errors).toHaveLength(1);
    expect(v.warnings).toEqual([]);
  });

  it('an empty library never blocks (nothing to satisfy)', () => {
    const v = validateOrgScenarioCoverage([], DEFAULT_PROFILES);
    expect(v.errors).toEqual([]);
    expect(v.warnings).toEqual([]);
  });
});
