import { describe, it, expect } from 'vitest';
import { castTemplate, validateScenarioTemplate, analyzeOrgCoverage } from '../src/core/scenarioTemplate';
import { rankScenarioEligibility } from '../src/core/scenarioEligibility';
import { ROLE_TEMPLATES, THE_POWER_VACUUM, THE_SCAPEGOAT, THE_VIRAL_PRAISE } from '../src/data/roleTemplates';
import { DEFAULT_PROFILES, DEFAULT_DEPARTMENTS, DEFAULT_STYLE, DEFAULT_RELATIONSHIP_TYPES } from '../src/data/defaults';
import { createDefaultCompany, type CompanyEvent } from '../src/core/company';
import { cascadeCompany } from '../src/core/companyCascade';
import { validateScenario } from '../src/core/scenario';

const NEW = [THE_POWER_VACUUM, THE_SCAPEGOAT, THE_VIRAL_PRAISE];
const agentIds = DEFAULT_PROFILES.map((p) => p.agentId);

/**
 * A generated multi-department org carrying the given formative history. `cutthroat`
 * tunes the culture: a competitive org has ambitious rivals (power/celebration), a
 * collaborative one has the agreeable, fair-minded people a blame inquiry needs.
 */
function orgWith(history: CompanyEvent[], cutthroat = 60, seed = 'lib-1') {
  const c = createDefaultCompany('acme', 'Acme');
  c.identity.headcount = 60; c.identity.industry = 'Software'; c.culture.cutthroat = cutthroat;
  c.history = history;
  return cascadeCompany(c, {
    catalog: DEFAULT_DEPARTMENTS, style: DEFAULT_STYLE, relationshipTypes: DEFAULT_RELATIONSHIP_TYPES,
    scenarioLibrary: ROLE_TEMPLATES, maxSeats: 64, seed,
  });
}
const event = (kind: string, id: string): CompanyEvent => ({ id, title: id, description: '', kind, when: 'recent', magnitude: 85, visibility: 'public', involvedDepartments: [] });

describe('library growth — the new templates are valid and cast on the default cast', () => {
  for (const t of NEW) {
    it(`${t.templateId} validates clean`, () => {
      expect(validateScenarioTemplate(t)).toEqual([]);
    });
    it(`${t.templateId} casts on the default four and emits a valid scenario`, () => {
      const result = castTemplate(t, DEFAULT_PROFILES);
      expect(result.ok).toBe(true);
      expect(validateScenario(result.scenario!, { agentIds })).toEqual([]);
    });
  }

  it('the whole library is still fully castable by the default cast (coverage stays 1)', () => {
    const rep = analyzeOrgCoverage(ROLE_TEMPLATES, DEFAULT_PROFILES);
    expect(rep.coverageRatio).toBe(1);
  });

  it('the library now spans six families', () => {
    expect(new Set(ROLE_TEMPLATES.map((t) => t.family))).toEqual(
      new Set(['attraction', 'rumor', 'rivalry', 'power', 'blame', 'celebration']),
    );
  });
});

describe('library growth — each new family runs hot for its grounding history', () => {
  it('a reorg makes the power vacuum hot (competitive org)', () => {
    const org = orgWith([event('reorg', 'rg')], 75);
    const hot = rankScenarioEligibility(org.company, ROLE_TEMPLATES, org.profiles).hot.map((h) => h.templateId);
    expect(hot).toContain('the_power_vacuum'); // reorg → 'power'
  });

  it('a failed product makes the scapegoat hot (collaborative org has a fair authority)', () => {
    const org = orgWith([event('failed_product', 'fp')], 30);
    const hot = rankScenarioEligibility(org.company, ROLE_TEMPLATES, org.profiles).hot.map((h) => h.templateId);
    expect(hot).toContain('the_scapegoat'); // failed_product → 'blame'
  });

  it('an IPO makes the viral praise hot (competitive org has rivals)', () => {
    const org = orgWith([event('ipo', 'ip')], 75);
    const hot = rankScenarioEligibility(org.company, ROLE_TEMPLATES, org.profiles).hot.map((h) => h.templateId);
    expect(hot).toContain('the_viral_praise'); // ipo → 'celebration'
  });
});

describe('library growth — the absent-role templates keep their off-scene principal out of the cast', () => {
  it('the power vacuum names but does not cast the vacated authority', () => {
    const result = castTemplate(THE_POWER_VACUUM, DEFAULT_PROFILES);
    const authority = result.report.assignments.find((a) => a.roleId === 'authority')!;
    expect(authority.presence).toBe('absent');
    if (authority.agentId) expect(result.scenario!.cast.map((c) => c.agentId)).not.toContain(authority.agentId);
  });

  it('the scapegoat names the off-scene culprit as the truth source but keeps them off-cast', () => {
    const result = castTemplate(THE_SCAPEGOAT, DEFAULT_PROFILES);
    const culprit = result.report.assignments.find((a) => a.roleId === 'culprit')!;
    expect(culprit.presence).toBe('absent');
    expect(culprit.agentId).toBeTruthy();
    expect(result.scenario!.cast.map((c) => c.agentId)).not.toContain(culprit.agentId);
    expect(result.scenario!.truthFacts[0].sourceAgentId).toBe(culprit.agentId);
  });
});
