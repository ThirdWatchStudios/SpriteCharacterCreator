import { describe, it, expect } from 'vitest';
import {
  applyDerived,
  applyFormativeEffects,
  clampProfile,
  createDefaultProfile,
  deriveAxes,
  serializeProfile,
  validateProfile,
  type FormativeEvent,
} from '../src/core/profile';
import { DEFAULT_CAST, DEFAULT_PROFILES, defaultProject } from '../src/data/defaults';
import { migrateProject, CURRENT_SCHEMA_VERSION } from '../src/core/migrations';

const agentIds = DEFAULT_CAST.map((c) => c.id);

describe('character profiles', () => {
  it('every default cast profile validates against the cast', () => {
    for (const profile of DEFAULT_PROFILES) {
      expect(validateProfile(profile, { agentIds })).toEqual([]);
    }
  });

  it('there is one profile per default cast member, keyed by agentId', () => {
    expect(DEFAULT_PROFILES.map((p) => p.agentId).sort()).toEqual([...agentIds].sort());
  });

  it('preserves the prototype suspicion seed for Carl (confidence 1 → 33)', () => {
    const carl = DEFAULT_PROFILES.find((p) => p.agentId === 'carl')!;
    const seed = carl.startingBeliefs.find((b) => b.topic === 'janice_promotion')!;
    expect(seed.stance).toBe('suspects');
    expect(seed.confidence).toBe(33);
  });

  it('createDefaultProfile yields a valid neutral profile linked to its recipe', () => {
    const p = createDefaultProfile(DEFAULT_CAST[0]);
    expect(p.agentId).toBe(DEFAULT_CAST[0].id);
    expect(p.spriteBinding.characterConfigId).toBe(DEFAULT_CAST[0].id);
    expect(validateProfile(p, { agentIds })).toEqual([]);
  });

  it('derives game axes from the spine and is idempotent', () => {
    const p = createDefaultProfile(DEFAULT_CAST[0]);
    p.personality.ocean.neuroticism = 80;
    p.personality.ocean.agreeableness = 20;
    applyDerived(p);
    const expected = deriveAxes(p.personality.ocean, p.personality.axes);
    expect(p.personality.derivedAxes.temper.value).toBe(expected.temper);
    expect(p.personality.derivedAxes.grudgeHolding.value).toBe(expected.grudgeHolding);
    const before = p.personality.derivedAxes.temper.value;
    applyDerived(p);
    expect(p.personality.derivedAxes.temper.value).toBe(before);
  });

  it('does not clobber a hand-authored (overridden) derived value', () => {
    const p = createDefaultProfile(DEFAULT_CAST[0]);
    p.personality.derivedAxes.temper = { value: 7, authored: true };
    p.personality.ocean.neuroticism = 100;
    applyDerived(p);
    expect(p.personality.derivedAxes.temper.value).toBe(7);
  });

  it('clampProfile pulls out-of-range values back into scale', () => {
    const p = createDefaultProfile(DEFAULT_CAST[0]);
    p.personality.ocean.openness = 999;
    p.relationships.push({
      targetAgentId: DEFAULT_CAST[1].id,
      trust: 250,
      suspicion: -5,
      affinity: -400,
      influence: 50,
      respect: 50,
      familiarity: 50,
      tags: [],
    });
    clampProfile(p);
    expect(p.personality.ocean.openness).toBe(100);
    expect(p.relationships[0].trust).toBe(100);
    expect(p.relationships[0].suspicion).toBe(0);
    expect(p.relationships[0].affinity).toBe(-100);
  });

  it('flags unresolved relationship targets and off-catalog subjects', () => {
    const p = createDefaultProfile(DEFAULT_CAST[0]);
    p.relationships.push({
      targetAgentId: 'ghost',
      trust: 50,
      suspicion: 0,
      affinity: 0,
      influence: 0,
      respect: 50,
      familiarity: 50,
      tags: [],
    });
    p.preferences.push({ subjectId: 'not_a_subject', valence: 10 });
    const issues = validateProfile(p, { agentIds });
    expect(issues.some((i) => i.includes('ghost'))).toBe(true);
    expect(issues.some((i) => i.includes('not_a_subject'))).toBe(true);
  });

  it('serializeProfile resolves derived fields to plain numbers and drops authoring flags', () => {
    const carl = DEFAULT_PROFILES.find((p) => p.agentId === 'carl')!;
    const out = serializeProfile(carl) as any;
    expect(out.agentId).toBe('carl');
    expect(typeof out.personality.axes.temper).toBe('number');
    expect(typeof out.reactionTendencies.gossip).toBe('number');
    expect(typeof out.temperament.volatility).toBe('number');
    // No Derived wrappers leak into the consumer form.
    expect(JSON.stringify(out).includes('"authored"')).toBe(false);
  });
});

describe('formative-event apply engine', () => {
  const ev = (effects: FormativeEvent['effects']): FormativeEvent => ({
    id: 'e',
    title: 'T',
    description: '',
    when: '',
    involvedAgentIds: [],
    visibility: 'private',
    knownToAgentIds: [],
    effects,
  });

  it('add op adjusts an existing relationship axis and a need baseline', () => {
    const p = createDefaultProfile(DEFAULT_CAST[1]); // carl
    p.relationships.push({ targetAgentId: 'janice', trust: 50, suspicion: 60, affinity: 0, influence: 0, respect: 50, familiarity: 50, tags: [] });
    p.needs.recognition.baseline = 40;
    const report = applyFormativeEffects(p, [
      ev([
        { targetKind: 'relationship_axis', targetRef: 'janice:suspicion', op: 'add', value: 40 },
        { targetKind: 'need_baseline', targetRef: 'recognition', op: 'add', value: -20 },
      ]),
    ]);
    expect(p.relationships[0].suspicion).toBe(100); // 60 + 40
    expect(p.needs.recognition.baseline).toBe(20); // 40 - 20
    expect(report.applied.length).toBe(2);
    expect(report.skipped).toEqual([]);
  });

  it('creates a missing relationship/preference target on apply', () => {
    const p = createDefaultProfile(DEFAULT_CAST[0]);
    applyFormativeEffects(p, [
      ev([
        { targetKind: 'relationship_axis', targetRef: 'carl:affinity', op: 'set', value: -80 },
        { targetKind: 'preference', targetRef: 'overtime', op: 'set', value: -100 },
      ]),
    ]);
    expect(p.relationships.find((r) => r.targetAgentId === 'carl')?.affinity).toBe(-80);
    expect(p.preferences.find((pr) => pr.subjectId === 'overtime')?.valence).toBe(-100);
  });

  it('nudge moves a fraction toward the endpoint', () => {
    const p = createDefaultProfile(DEFAULT_CAST[0]);
    p.personality.ocean.openness = 50;
    applyFormativeEffects(p, [ev([{ targetKind: 'personality_axis', targetRef: 'openness', op: 'nudge', value: 20 }])]);
    expect(p.personality.ocean.openness).toBe(60); // 50 + 0.2*(100-50)
  });

  it('adds trait tags, sets drives, and skips unresolvable / non-numeric effects', () => {
    const p = createDefaultProfile(DEFAULT_CAST[0]);
    const report = applyFormativeEffects(p, [
      ev([
        { targetKind: 'trait_tag', targetRef: '', op: 'set', value: 'jaded' },
        { targetKind: 'drive', targetRef: 'primary', op: 'set', value: 'protect_status' },
        { targetKind: 'belief', targetRef: 'no_such_topic', op: 'add', value: 10 },
        { targetKind: 'personality_axis', targetRef: 'ambition', op: 'add', value: 'NaNish' },
      ]),
    ]);
    expect(p.personality.traitTags).toContain('jaded');
    expect(p.drives.primary).toBe('protect_status');
    expect(report.skipped.length).toBe(2); // missing belief topic + non-numeric axis value
  });

  it('compounds when applied twice (one-shot semantics)', () => {
    const p = createDefaultProfile(DEFAULT_CAST[0]);
    p.needs.rest.baseline = 50;
    const e = ev([{ targetKind: 'need_baseline', targetRef: 'rest', op: 'add', value: 10 }]);
    applyFormativeEffects(p, [e]);
    applyFormativeEffects(p, [e]);
    expect(p.needs.rest.baseline).toBe(70); // 50 + 10 + 10
  });
});

describe('profiles migration (v2 → v3)', () => {
  it('backfills the profiles collection for saves that predate it', () => {
    const legacy = defaultProject() as any;
    delete legacy.profiles;
    legacy.version = 2;
    const migrated = migrateProject(legacy)!;
    expect(migrated.version).toBe(CURRENT_SCHEMA_VERSION);
    expect(migrated.profiles?.map((p) => p.agentId).sort()).toEqual([...agentIds].sort());
  });

  it('does not clobber a user-authored profile during backfill', () => {
    const proj = defaultProject() as any;
    proj.version = 2;
    proj.profiles = [{ ...createDefaultProfile(DEFAULT_CAST[0]), identity: { ...createDefaultProfile(DEFAULT_CAST[0]).identity, bio: 'KEEP ME' } }];
    const migrated = migrateProject(proj)!;
    const janice = migrated.profiles!.find((p) => p.agentId === 'janice')!;
    expect(janice.identity.bio).toBe('KEEP ME');
    // The other cast members still get seeded.
    expect(migrated.profiles!.length).toBe(agentIds.length);
  });
});
