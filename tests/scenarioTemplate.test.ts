import { describe, it, expect } from 'vitest';
import {
  analyzeTemplateCoverage,
  castTemplate,
  serializeScenarioTemplate,
  validateScenarioTemplate,
  type ScenarioTemplate,
} from '../src/core/scenarioTemplate';
import { THE_OFFICE_ROMANCE } from '../src/data/roleTemplates';
import { DEFAULT_CAST, DEFAULT_PROFILES } from '../src/data/defaults';
import { defaultProject } from '../src/data/defaults';
import { createDefaultProfile, type Relationship } from '../src/core/profile';
import { validateScenario } from '../src/core/scenario';
import { computeOfficeAnchors, generateOfficeLayout } from '../src/core/layout';

// --- fixtures for the model-extension tests ---------------------------------

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

const relMk = (targetAgentId: string, familiarity: number): Relationship => ({
  targetAgentId, trust: 50, suspicion: 0, affinity: 0, influence: 0, respect: 50, familiarity, tags: [],
});

const profiles = DEFAULT_PROFILES;
const profileOf = (id: string) => profiles.find((p) => p.agentId === id)!;
const agentIds = profiles.map((p) => p.agentId);

describe('scenario template — authoring validation', () => {
  it('the reference Office Romance template is valid', () => {
    expect(validateScenarioTemplate(THE_OFFICE_ROMANCE)).toEqual([]);
  });

  it('flags a template with a missing role ref, no required role, and no payload', () => {
    const bad: ScenarioTemplate = {
      ...structuredClone(THE_OFFICE_ROMANCE),
      roles: [
        { roleId: 'a', label: 'A', description: '', required: false, preconditions: [{ kind: 'relationship', toRole: 'ghost', direction: 'mutual', axis: 'affinity', op: 'gte', value: 30 }] },
      ],
      emotionalPayload: { targetEmotions: [], description: '' },
    };
    const issues = validateScenarioTemplate(bad);
    expect(issues.some((i) => i.includes('unknown role "ghost"'))).toBe(true);
    expect(issues.some((i) => i.includes('no required role'))).toBe(true);
    expect(issues.some((i) => i.includes('emotional payload'))).toBe(true);
  });

  it('serializeScenarioTemplate stamps a template meta block', () => {
    const out = serializeScenarioTemplate(THE_OFFICE_ROMANCE) as any;
    expect(out.templateId).toBe('the_office_romance');
    expect(out.meta.artifact).toBe('scenario-template');
    expect(out.meta.generator).toBe('sprite-character-creator');
  });
});

describe('casting a template onto a cast', () => {
  it('casts the lovers onto the strongest-attraction pair (tie-break by fit)', () => {
    const result = castTemplate(THE_OFFICE_ROMANCE, profiles);
    expect(result.ok).toBe(true);
    const a = result.report.assignments.find((x) => x.roleId === 'loverA')!.agentId;
    const b = result.report.assignments.find((x) => x.roleId === 'loverB')!.agentId;
    // Carl↔Linda (affinity 80/80) beats Janice↔Manager (affinity 50/50).
    expect(new Set([a, b])).toEqual(new Set(['carl', 'linda']));
  });

  it('leaves the optional witness unfilled (a real coverage gap on this cast)', () => {
    const result = castTemplate(THE_OFFICE_ROMANCE, profiles);
    expect(result.report.unfilledOptional).toContain('witness');
    expect(result.report.assignments.find((x) => x.roleId === 'witness')!.agentId).toBeNull();
  });

  it('emits a fully-bound scenario: role refs rewritten to agent ids', () => {
    const { scenario } = castTemplate(THE_OFFICE_ROMANCE, profiles);
    expect(scenario).not.toBeNull();
    const s = scenario!;
    expect(s.cast.length).toBe(2); // lovers only; witness dropped
    // relationship overrides carry agent ids, not role ids.
    const carl = s.cast.find((c) => c.agentId === 'carl')!;
    const ov = carl.relationshipOverrides[0];
    expect(ov.targetAgentId).toBe('linda');
    expect(ov.affinity).toBe(90);
    expect(carl.beliefSeeds.some((b) => b.topic === 'office_romance')).toBe(true);
    // love_note (source = a lover) survives; spotted_together (source = witness) is dropped.
    const infoIds = s.informationItems.map((i) => i.informationId);
    expect(infoIds).toContain('love_note');
    expect(infoIds).not.toContain('spotted_together');
    // witness desk dropped; the lovers' desks remain.
    const locIds = s.locations.map((l) => l.locationId);
    expect(locIds).toContain('loverA_desk');
    expect(locIds).not.toContain('witness_desk');
  });

  it('the emitted scenario passes the existing validateScenario (bound path unbroken)', () => {
    const { scenario } = castTemplate(THE_OFFICE_ROMANCE, profiles);
    expect(validateScenario(scenario!, { agentIds })).toEqual([]);
  });

  it('the emitted scenario binds to a generated office (anchor resolution on)', () => {
    const project = defaultProject();
    const office = generateOfficeLayout(project, 6, 1);
    const anchorIds = computeOfficeAnchors(office.scene, project).map((a) => a.anchorId);
    const { scenario } = castTemplate(THE_OFFICE_ROMANCE, profiles, { anchorIds });
    // desk bindings resolve to desk:<lover> (e.g. desk:carl), rooms resolve too.
    expect(validateScenario(scenario!, { agentIds, anchorIds })).toEqual([]);
  });

  it('fails (ok=false, scenario null) when no pair satisfies a required role', () => {
    // Carl and Janice have no mutual attraction (carl→janice affinity -20).
    const result = castTemplate(THE_OFFICE_ROMANCE, [profileOf('carl'), profileOf('janice')]);
    expect(result.ok).toBe(false);
    expect(result.scenario).toBeNull();
    expect(result.report.unfilledRequired.length).toBeGreaterThan(0);
  });
});

describe('precondition matching', () => {
  it('intrinsic candidates for the witness are exactly the low-discretion agents', () => {
    const result = castTemplate(THE_OFFICE_ROMANCE, profiles);
    const witnessCands = result.report.candidatesByRole['witness'].map((c) => c.agentId).sort();
    // discretion ≤ 35 → carl (25) and linda (28); janice (62) and manager (82) excluded.
    expect(witnessCands).toEqual(['carl', 'linda']);
  });

  it('a relationship precondition rejects a too-weak edge', () => {
    // Lower the threshold-failing pair: manager↔carl (affinity 0) never qualifies.
    const result = castTemplate(THE_OFFICE_ROMANCE, [profileOf('manager'), profileOf('carl')]);
    expect(result.ok).toBe(false);
  });
});

describe('generated-cast coverage', () => {
  it('reports the cast can play the template but the witness slot is a gap', () => {
    const cov = analyzeTemplateCoverage(THE_OFFICE_ROMANCE, profiles);
    expect(cov.fullyCastable).toBe(true);
    expect(cov.unfillableRequiredRoles).toEqual([]);
    const witness = cov.perRole.find((r) => r.roleId === 'witness')!;
    // intrinsically eligible (2 low-discretion agents) but not co-castable —
    // the only eligible agents are the lovers themselves.
    expect(witness.intrinsicCandidateCount).toBe(2);
    expect(witness.relationalFillable).toBe(false);
    expect(cov.notes.some((n) => n.includes('witness'))).toBe(true);
  });

  it('flags an unfillable required role for a thin cast', () => {
    const cov = analyzeTemplateCoverage(THE_OFFICE_ROMANCE, [profileOf('carl'), profileOf('janice')]);
    expect(cov.fullyCastable).toBe(false);
    expect(cov.unfillableRequiredRoles.length).toBeGreaterThan(0);
  });
});

describe('aggregate ("to-everyone") preconditions', () => {
  // Janice = the outsider (no relationships → familiarity 0 to all, via missingAs).
  // Carl & Linda are familiar with each other (familiarity 90) but not the outsider.
  const outsider = createDefaultProfile(DEFAULT_CAST[0]); // janice, no edges
  const insiderA = createDefaultProfile(DEFAULT_CAST[1]); // carl
  const insiderB = createDefaultProfile(DEFAULT_CAST[2]); // linda
  insiderA.relationships = [relMk('linda', 90)];
  insiderB.relationships = [relMk('carl', 90)];
  const cast = [outsider, insiderA, insiderB];

  const outsiderTemplate = tpl({
    templateId: 'the_outsider',
    roles: [{ roleId: 'outsider', label: 'Outsider', description: '', required: true, preconditions: [{ kind: 'aggregate', axis: 'familiarity', reduce: 'avg', direction: 'outgoing', op: 'lte', value: 30 }] }],
    locations: [{ locationId: 'outsider_desk', displayName: '', tags: [], accessState: 'open', fallbackLocationId: '', bindRoomId: 'cubicle-farm', bindDeskOfRole: 'outsider' }],
    roleSpawns: [{ roleId: 'outsider', locationId: 'outsider_desk' }],
  });

  it('the template validates', () => {
    expect(validateScenarioTemplate(outsiderTemplate)).toEqual([]);
  });

  it('only the low-familiarity-to-everyone agent is eligible', () => {
    const result = castTemplate(outsiderTemplate, cast);
    expect(result.report.candidatesByRole['outsider'].map((c) => c.agentId)).toEqual(['janice']);
    expect(result.ok).toBe(true);
    expect(result.report.assignments.find((a) => a.roleId === 'outsider')!.agentId).toBe('janice');
  });

  it('a no-edge agent reads as maximally unfamiliar (missingAs default 0)', () => {
    // raise the threshold so an insider would qualify only if their missing edge to
    // the outsider were treated as neutral — it is not, so they still fail.
    const t = structuredClone(outsiderTemplate);
    (t.roles[0].preconditions[0] as any).value = 44; // carl/linda avg = (0+90)/2 = 45 > 44
    const result = castTemplate(t, cast);
    expect(result.report.candidatesByRole['outsider'].map((c) => c.agentId)).toEqual(['janice']);
  });
});

describe('absent / negative roles', () => {
  const profiles = DEFAULT_PROFILES;

  it('an absent required role resolves but is kept out of the emitted cast (Scapegoat)', () => {
    const scapegoatTemplate = tpl({
      templateId: 'the_scapegoat',
      family: 'blame',
      roles: [
        // the real culprit (low integrity) is off-scene — resolved + referenced, not cast.
        { roleId: 'culprit', label: 'Culprit', description: '', required: true, presence: 'absent', preconditions: [{ kind: 'axis', axis: 'integrity', op: 'lte', value: 45 }] },
        // the one left holding the blame (high openness, picked to be distinct).
        { roleId: 'scapegoat', label: 'Scapegoat', description: '', required: true, preconditions: [{ kind: 'axis', axis: 'openness', op: 'gte', value: 65 }] },
      ],
      locations: [{ locationId: 'scapegoat_desk', displayName: '', tags: [], accessState: 'open', fallbackLocationId: '', bindRoomId: 'cubicle-farm', bindDeskOfRole: 'scapegoat' }],
      roleSpawns: [{ roleId: 'scapegoat', locationId: 'scapegoat_desk' }],
      truthFacts: [{ truthId: 'who_did_it', topic: 'incident', statement: 'The culprit caused it.', subjectRoles: ['culprit'], objectiveValue: true, sourceRole: 'culprit' }],
    });
    expect(validateScenarioTemplate(scapegoatTemplate)).toEqual([]);

    const result = castTemplate(scapegoatTemplate, profiles);
    expect(result.ok).toBe(true);
    const culprit = result.report.assignments.find((a) => a.roleId === 'culprit')!;
    expect(culprit.agentId).toBe('carl'); // resolved…
    expect(culprit.presence).toBe('absent');
    // …but NOT an active cast member.
    const s = result.scenario!;
    expect(s.cast.map((c) => c.agentId)).toEqual(['linda']);
    // the absent culprit is still referenced as the truth source (off-scene reality).
    expect(s.truthFacts[0].sourceAgentId).toBe('carl');
    expect(s.truthFacts[0].subjectAgentIds).toEqual(['carl']);
    // and the emitted scenario is valid (carl is a known agent, just not in the cast).
    expect(validateScenario(s, { agentIds: profiles.map((p) => p.agentId) })).toEqual([]);
  });

  it('an absent OPTIONAL role resolves who to remove but never blocks the cast (Power Vacuum)', () => {
    const vacuumTemplate = tpl({
      templateId: 'the_power_vacuum',
      family: 'rivalry',
      roles: [
        { roleId: 'authority', label: 'Authority', description: '', required: false, presence: 'absent', preconditions: [{ kind: 'axis', axis: 'discretion', op: 'gte', value: 75 }] },
        { roleId: 'contenderA', label: 'Contender A', description: '', required: true, preconditions: [{ kind: 'axis', axis: 'ambition', op: 'gte', value: 70 }] },
        { roleId: 'contenderB', label: 'Contender B', description: '', required: true, preconditions: [{ kind: 'axis', axis: 'ambition', op: 'gte', value: 70 }] },
      ],
      locations: [
        { locationId: 'a_desk', displayName: '', tags: [], accessState: 'open', fallbackLocationId: '', bindRoomId: 'cubicle-farm', bindDeskOfRole: 'contenderA' },
        { locationId: 'b_desk', displayName: '', tags: [], accessState: 'open', fallbackLocationId: '', bindRoomId: 'cubicle-farm', bindDeskOfRole: 'contenderB' },
      ],
      roleSpawns: [{ roleId: 'contenderA', locationId: 'a_desk' }, { roleId: 'contenderB', locationId: 'b_desk' }],
    });
    expect(validateScenarioTemplate(vacuumTemplate)).toEqual([]);

    // With the manager present: authority resolves to them (the one to remove), but
    // is kept out of the active cast (the two contenders).
    const withManager = castTemplate(vacuumTemplate, profiles);
    expect(withManager.ok).toBe(true);
    const auth = withManager.report.assignments.find((a) => a.roleId === 'authority')!;
    expect(auth.agentId).toBe('manager');
    expect(auth.presence).toBe('absent');
    expect(withManager.scenario!.cast.map((c) => c.agentId).sort()).toEqual(['carl', 'janice']);

    // Without a qualifying authority: the vacuum stands — still castable, role null.
    const noManager = castTemplate(vacuumTemplate, profiles.filter((p) => p.agentId !== 'manager'));
    expect(noManager.ok).toBe(true);
    expect(noManager.report.assignments.find((a) => a.roleId === 'authority')!.agentId).toBeNull();
  });

  it('validation rejects spawning or desk-binding an absent role', () => {
    const bad = tpl({
      roles: [
        { roleId: 'ghost', label: 'Ghost', description: '', required: true, presence: 'absent', preconditions: [] },
        { roleId: 'real', label: 'Real', description: '', required: true, preconditions: [] },
      ],
      locations: [{ locationId: 'd', displayName: '', tags: [], accessState: 'open', fallbackLocationId: '', bindRoomId: 'cubicle-farm', bindDeskOfRole: 'ghost' }],
      roleSpawns: [{ roleId: 'ghost', locationId: 'd' }],
    });
    const issues = validateScenarioTemplate(bad);
    expect(issues.some((i) => i.includes('binds a desk to absent role'))).toBe(true);
    expect(issues.some((i) => i.includes('roleSpawn targets absent role'))).toBe(true);
  });
});

describe('template families', () => {
  it('the Office Romance is grouped under the attraction family and round-trips', () => {
    expect(THE_OFFICE_ROMANCE.family).toBe('attraction');
    expect((serializeScenarioTemplate(THE_OFFICE_ROMANCE) as any).family).toBe('attraction');
  });
});
