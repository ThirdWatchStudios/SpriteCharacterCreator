import { describe, it, expect } from 'vitest';
import { generateCast, generatePersona, validatePersonaTemplate } from '../src/core/personaTemplate';
import { PERSONA_ARCHETYPES, THE_CLIMBER, THE_GOSSIP } from '../src/data/personaArchetypes';
import { DEFAULT_DRIVES, DEFAULT_TRAITS } from '../src/data/defaults';
import { validateProfile } from '../src/core/profile';
import { castTemplate, analyzeTemplateCoverage } from '../src/core/scenarioTemplate';
import { THE_CONTESTED_PROMOTION, THE_OFFICE_ROMANCE } from '../src/data/roleTemplates';

const catalogCtx = {
  driveIds: DEFAULT_DRIVES.map((d) => d.id),
  traitIds: DEFAULT_TRAITS.map((t) => t.id),
};

describe('persona archetypes — authoring validation', () => {
  it('every starter archetype is valid against the catalogs', () => {
    for (const a of PERSONA_ARCHETYPES) {
      expect(validatePersonaTemplate(a, catalogCtx), `archetype "${a.id}"`).toEqual([]);
    }
  });

  it('flags bad ranges and unknown catalog ids', () => {
    const issues = validatePersonaTemplate(
      { id: 'bad', label: 'Bad', description: '', spine: { axes: { ambition: [80, 20] } }, drivePool: { primary: ['no_such_drive'] }, traits: { required: ['no_such_trait'], pool: [], count: [1, 1] } },
      catalogCtx,
    );
    expect(issues.some((i) => i.includes('min > max'))).toBe(true);
    expect(issues.some((i) => i.includes('unknown drive'))).toBe(true);
    expect(issues.some((i) => i.includes('unknown trait'))).toBe(true);
  });
});

describe('generatePersona', () => {
  it('is deterministic (same template + seed → identical profile)', () => {
    expect(generatePersona(THE_CLIMBER, 'seed-A')).toEqual(generatePersona(THE_CLIMBER, 'seed-A'));
  });

  it('different seeds produce different personas', () => {
    expect(generatePersona(THE_CLIMBER, 'seed-A')).not.toEqual(generatePersona(THE_CLIMBER, 'seed-B'));
  });

  it('respects the archetype spine ranges, required traits, and exclusions', () => {
    for (let i = 0; i < 30; i++) {
      const p = generatePersona(THE_CLIMBER, `c${i}`);
      expect(p.personality.axes.ambition).toBeGreaterThanOrEqual(78);
      expect(p.personality.axes.ambition).toBeLessThanOrEqual(95);
      expect(p.personality.traitTags).toContain('ambitious');
      expect(p.personality.traitTags.length).toBeGreaterThanOrEqual(2);
      expect(p.personality.traitTags.length).toBeLessThanOrEqual(3);
      for (const banned of ['slacker', 'coaster', 'easygoing']) expect(p.personality.traitTags).not.toContain(banned);
      expect(THE_CLIMBER.drivePool.primary).toContain(p.drives.primary);
    }
  });

  it('produces a profile that passes validateProfile', () => {
    const p = generatePersona(THE_GOSSIP, 'g', { agentId: 'gossip1' });
    expect(validateProfile(p, { agentIds: ['gossip1'] })).toEqual([]);
  });

  it('derived fields are computed from the sampled spine (not left at the neutral default)', () => {
    // The Hothead's low agreeableness + high neuroticism should push temper up.
    const p = generatePersona(PERSONA_ARCHETYPES.find((a) => a.id === 'hothead')!, 'h');
    expect(p.personality.derivedAxes.temper.value).toBeGreaterThan(55);
  });
});

describe('blends', () => {
  it('a secondary archetype pulls the spine toward itself', () => {
    const seed = 'blend-seed';
    const pure = generatePersona(THE_CLIMBER, seed);
    const blended = generatePersona(THE_CLIMBER, seed, { blend: { template: THE_GOSSIP, weight: 0.4 } });
    // Gossip's low discretion drags the Climber's discretion down (spine is sampled
    // before needs, so the discretion draw uses the same rng value in both).
    expect(blended.personality.axes.discretion).toBeLessThan(pure.personality.axes.discretion);
  });

  it('a blended persona still validates', () => {
    const p = generatePersona(THE_CLIMBER, 'bx', { agentId: 'cx', blend: { template: THE_GOSSIP, weight: 0.4 } });
    expect(validateProfile(p, { agentIds: ['cx'] })).toEqual([]);
  });
});

describe('generateCast', () => {
  it('produces one deterministic persona per slot', () => {
    const slots = [
      { agentId: 'a', template: THE_CLIMBER },
      { agentId: 'b', template: THE_GOSSIP },
    ];
    const cast = generateCast(slots, 'cast-1');
    expect(cast.map((p) => p.agentId)).toEqual(['a', 'b']);
    expect(generateCast(slots, 'cast-1')).toEqual(cast); // deterministic
  });
});

describe('supply ↔ demand (and the deferred-relationships limitation)', () => {
  const cast = generateCast(
    PERSONA_ARCHETYPES.slice(0, 6).map((t, i) => ({ agentId: `agent${i}`, template: t })),
    'office-seed',
  );

  it('a purely-relational scenario cannot cast onto a fresh generated cast (no edges)', () => {
    // The Office Romance's lover roles have NO intrinsic preconditions — everyone is
    // eligible — so casting hinges entirely on relationships. Generated personas have
    // no baseline relationships yet (that wiring is a deferred pass), so no pair
    // satisfies the mutual-attraction precondition: the two lovers can't both seat.
    const result = castTemplate(THE_OFFICE_ROMANCE, cast);
    expect(result.ok).toBe(false);
    const loversSeated = result.report.assignments.filter((a) => (a.roleId === 'loverA' || a.roleId === 'loverB') && a.agentId).length;
    expect(loversSeated).toBeLessThan(2);
    expect(analyzeTemplateCoverage(THE_OFFICE_ROMANCE, cast).fullyCastable).toBe(false);
  });

  it('coverage also reports the Contested Promotion as not castable on this cast', () => {
    // A second, distinct gap the coverage tool surfaces: the starter archetypes
    // don't reliably produce an "ambitious + high-integrity" recipient or a "discreet
    // + high-integrity" authority — intrinsic under-supply, separate from relationships.
    expect(analyzeTemplateCoverage(THE_CONTESTED_PROMOTION, cast).fullyCastable).toBe(false);
  });
});
