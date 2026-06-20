import { describe, it, expect } from 'vitest';
import { createDefaultCompany, type Company, type CompanyEvent } from '../src/core/company';
import { rankScenarioEligibility, HISTORY_FAMILY_MAP } from '../src/core/scenarioEligibility';
import { ROLE_TEMPLATES, THE_OFFICE_ROMANCE } from '../src/data/roleTemplates';
import { DEFAULT_PROFILES } from '../src/data/defaults';

const event = (kind: string, id: string, over: Partial<CompanyEvent> = {}): CompanyEvent => ({
  id, title: id, description: '', kind, when: 'recent', magnitude: 80, visibility: 'public', involvedDepartments: [], ...over,
});

function company(history: CompanyEvent[]): Company {
  const c = createDefaultCompany('acme', 'Acme');
  c.history = history;
  return c;
}

const rank = (history: CompanyEvent[]) => rankScenarioEligibility(company(history), ROLE_TEMPLATES, DEFAULT_PROFILES);
const salienceOf = (history: CompanyEvent[], templateId: string) =>
  rank(history).ranked.find((s) => s.templateId === templateId)!.salience;

describe('F0.7 — history kind → scenario family mapping (S0.7.1)', () => {
  it('documents a mapping for the formative-event kinds', () => {
    for (const kind of ['reorg', 'layoff', 'founder_exit', 'scandal', 'new_ceo']) {
      expect(HISTORY_FAMILY_MAP[kind]?.length).toBeGreaterThan(0);
    }
  });

  it('an unknown event kind falls back gracefully (no heat, no throw)', () => {
    const report = rank([event('__not_a_real_kind__', 'x')]);
    expect(report.hot).toEqual([]);
    for (const s of report.ranked) expect(s.salience).toBe(0);
  });
});

describe('F0.7 — eligibility & salience bias (S0.7.2)', () => {
  it('a leadership shake-up makes the promotion-rumor template run hot', () => {
    const report = rank([event('founder_exit', 'fx'), event('new_ceo', 'nc')]);
    expect(report.hot[0].templateId).toBe('the_contested_promotion'); // family 'rumor'
    expect(report.hot[0].salience).toBeGreaterThan(0);
    expect(report.hot[0].groundedBy).toEqual(expect.arrayContaining(['fx', 'nc']));
  });

  it('a different history surfaces different hot scenarios', () => {
    const leadership = rank([event('founder_exit', 'fx')]).hot.map((h) => h.templateId);
    const backToOffice = rank([event('return_to_office', 'rto')]).hot.map((h) => h.templateId);
    expect(leadership).toContain('the_contested_promotion');
    expect(backToOffice).toContain('the_office_romance'); // family 'attraction'
    expect(leadership).not.toEqual(backToOffice);
  });

  it('recent events run hotter than old ones', () => {
    const recent = salienceOf([event('new_ceo', 'r', { when: 'recent' })], 'the_contested_promotion');
    const old = salienceOf([event('new_ceo', 'o', { when: 'at_founding' })], 'the_contested_promotion');
    expect(recent).toBeGreaterThan(old);
  });

  it('only castable templates are surfaced as hot (respects coverage)', () => {
    // An empty cast can cast nothing → nothing is hot even when history points at it.
    const report = rankScenarioEligibility(company([event('founder_exit', 'fx')]), ROLE_TEMPLATES, []);
    expect(report.hot).toEqual([]);
    expect(report.ranked.every((s) => !s.castable)).toBe(true);
    // …but salience (the history signal) is still computed.
    expect(report.ranked.find((s) => s.templateId === 'the_contested_promotion')!.salience).toBeGreaterThan(0);
  });

  it('a template with no family is never hot', () => {
    const familyless = { ...THE_OFFICE_ROMANCE, templateId: 'no_family', family: undefined };
    const report = rankScenarioEligibility(company([event('return_to_office', 'rto')]), [familyless], DEFAULT_PROFILES);
    expect(report.ranked[0].salience).toBe(0);
    expect(report.hot).toEqual([]);
  });

  it('is deterministic', () => {
    const h = [event('scandal', 's'), event('reorg', 'r')];
    expect(rank(h)).toEqual(rank(h));
  });
});
