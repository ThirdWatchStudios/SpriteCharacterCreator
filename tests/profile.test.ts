import { describe, it, expect } from 'vitest';
import {
  applyDerived,
  applyFormativeEffects,
  clampProfile,
  createDefaultProfile,
  deriveAxes,
  derivePresence,
  ensurePresence,
  PRESENCE_CHANNELS,
  PRESENCE_STEADY_STATE,
  PRESENCE_TRANSITION,
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

  it('personas no longer carry beliefs/knowledge (moved to scenarios)', () => {
    const carl = DEFAULT_PROFILES.find((p) => p.agentId === 'carl')! as Record<string, unknown>;
    expect('startingBeliefs' in carl).toBe(false);
    expect('startingKnowledge' in carl).toBe(false);
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

describe('presence layer (how a body occupies space)', () => {
  it('the two registers partition the presence channels exactly (no drift)', () => {
    const union = [...PRESENCE_STEADY_STATE, ...PRESENCE_TRANSITION].sort();
    expect(union).toEqual([...PRESENCE_CHANNELS].sort());
    // disjoint
    expect(new Set(union).size).toBe(PRESENCE_CHANNELS.length);
  });

  it('createDefaultProfile seeds every presence channel in range and validates', () => {
    const p = createDefaultProfile(DEFAULT_CAST[0]);
    for (const c of PRESENCE_CHANNELS) {
      expect(p.presence[c].value).toBeGreaterThanOrEqual(0);
      expect(p.presence[c].value).toBeLessThanOrEqual(100);
    }
    expect(validateProfile(p, { agentIds })).toEqual([]);
  });

  it('derives presence from the spine and is idempotent', () => {
    const p = createDefaultProfile(DEFAULT_CAST[0]);
    p.personality.ocean.neuroticism = 90;
    p.personality.ocean.conscientiousness = 20;
    applyDerived(p);
    const expected = derivePresence(p.personality.ocean, p.personality.axes);
    // Anxious + undisciplined → restless and second-guessing.
    expect(p.presence.restlessness.value).toBe(expected.restlessness);
    expect(p.presence.commitment.value).toBe(expected.commitment);
    expect(p.presence.restlessness.value).toBeGreaterThan(60);
    expect(p.presence.commitment.value).toBeLessThan(40);
    const before = p.presence.latency.value;
    applyDerived(p);
    expect(p.presence.latency.value).toBe(before);
  });

  it('two different spines produce different presence (the long-term-vision case)', () => {
    const brisk = createDefaultProfile(DEFAULT_CAST[0]);
    brisk.personality.ocean.extraversion = 90;
    brisk.personality.axes.ambition = 90;
    applyDerived(brisk);
    const shy = createDefaultProfile(DEFAULT_CAST[0]);
    shy.personality.ocean.extraversion = 10;
    shy.personality.ocean.neuroticism = 85;
    applyDerived(shy);
    expect(brisk.presence.gaitSpeed.value).toBeGreaterThan(shy.presence.gaitSpeed.value);
    expect(shy.presence.latency.value).toBeGreaterThan(brisk.presence.latency.value);
    expect(shy.presence.personalSpace.value).toBeGreaterThan(brisk.presence.personalSpace.value);
  });

  it('does not clobber a hand-authored presence channel', () => {
    const p = createDefaultProfile(DEFAULT_CAST[0]);
    p.presence.commitment = { value: 12, authored: true };
    p.personality.ocean.neuroticism = 0; // would otherwise push commitment high
    applyDerived(p);
    expect(p.presence.commitment.value).toBe(12);
  });

  it('clampProfile pulls out-of-range presence values back into scale', () => {
    const p = createDefaultProfile(DEFAULT_CAST[0]);
    p.presence.gaitSpeed.value = 999;
    p.presence.latency.value = -50;
    clampProfile(p);
    expect(p.presence.gaitSpeed.value).toBe(100);
    expect(p.presence.latency.value).toBe(0);
  });

  it('serializeProfile resolves presence to plain numbers (no Derived wrappers)', () => {
    const carl = DEFAULT_PROFILES.find((p) => p.agentId === 'carl')!;
    const out = serializeProfile(carl) as any;
    for (const c of PRESENCE_CHANNELS) expect(typeof out.presence[c]).toBe('number');
    // The resolved values are bare numbers — no Derived wrapper survives export.
    expect(JSON.stringify(out.presence).includes('"authored"')).toBe(false);
  });

  it('ensurePresence backfills a profile that predates the layer, derived from spine', () => {
    const p = createDefaultProfile(DEFAULT_CAST[0]) as any;
    p.personality.ocean.openness = 95;
    p.personality.ocean.extraversion = 95;
    delete p.presence;
    ensurePresence(p);
    const expected = derivePresence(p.personality.ocean, p.personality.axes);
    expect(p.presence.attentiveness.value).toBe(expected.attentiveness);
    expect(p.presence.attentiveness.value).toBeGreaterThan(70); // curious + outgoing
  });

  it('ensurePresence is a no-op when presence already exists (never clobbers)', () => {
    const p = createDefaultProfile(DEFAULT_CAST[0]);
    p.presence.expressiveness = { value: 3, authored: true };
    ensurePresence(p);
    expect(p.presence.expressiveness.value).toBe(3);
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

  it('v5 strips legacy persona beliefs/knowledge', () => {
    const proj = defaultProject() as any;
    proj.version = 4;
    proj.profiles[0].startingBeliefs = [{ topic: 'x', claim: 'y', stance: 'accepts', confidence: 50 }];
    proj.profiles[0].startingKnowledge = ['info'];
    const migrated = migrateProject(proj)! as any;
    expect('startingBeliefs' in migrated.profiles[0]).toBe(false);
    expect('startingKnowledge' in migrated.profiles[0]).toBe(false);
  });

  it('v14 backfills the presence layer on profiles that predate it', () => {
    const proj = defaultProject() as any;
    proj.version = 13;
    for (const p of proj.profiles) delete p.presence;
    const migrated = migrateProject(proj)! as any;
    for (const p of migrated.profiles) {
      for (const c of PRESENCE_CHANNELS) expect(typeof p.presence[c].value).toBe('number');
    }
  });
});
