import { describe, it, expect } from 'vitest';
import {
  castMemberFor,
  createDefaultScenario,
  serializeScenario,
  validateScenario,
  type Scenario,
} from '../src/core/scenario';
import { DEFAULT_CAST, DEFAULT_SCENARIOS, defaultProject } from '../src/data/defaults';
import { migrateProject, CURRENT_SCHEMA_VERSION } from '../src/core/migrations';
import { computeOfficeAnchors, generateOfficeLayout } from '../src/core/layout';
import { exportAll, type ExportSink } from '../src/core/exporter';
import { buildScenarioPackage, resolveScenarioRun } from '../src/core/scenarioRun';

const agentIds = DEFAULT_CAST.map((c) => c.id);
const promo = DEFAULT_SCENARIOS.find((s) => s.scenarioId === 'promotion_rumor_001')!;

describe('scenario model', () => {
  it('the default promotion_rumor_001 scenario validates against the cast', () => {
    expect(validateScenario(promo, { agentIds })).toEqual([]);
  });

  it("authors Carl's starting belief in the SCENARIO (the persona/scenario boundary)", () => {
    const carl = promo.cast.find((c) => c.agentId === 'carl')!;
    const seed = carl.beliefSeeds.find((b) => b.topic === 'janice_promotion')!;
    expect(seed.stance).toBe('suspects');
    expect(seed.confidence).toBe(33);
    // and the promotion-driven suspicion spike is a relationship OVERRIDE, not persona baseline
    const ov = carl.relationshipOverrides.find((r) => r.targetAgentId === 'janice')!;
    expect(ov.suspicion).toBe(100);
    expect(ov.affinity).toBe(-50);
  });

  it('the scenario is the sole home for the run belief (persona carries none)', () => {
    const carlProfile = defaultProject().profiles!.find((p) => p.agentId === 'carl')! as Record<string, unknown>;
    const inScenario = promo.cast.some((c) => c.beliefSeeds.some((b) => b.topic === 'janice_promotion'));
    expect(inScenario).toBe(true);
    expect('startingBeliefs' in carlProfile).toBe(false);
  });

  it('every cast spawn location is a declared, office-bound location', () => {
    const locIds = new Set(promo.locations.map((l) => l.locationId));
    for (const c of promo.cast) expect(locIds.has(c.spawnLocationId)).toBe(true);
    for (const l of promo.locations) expect(l.bindTo.roomId).toBeTruthy();
  });

  it('createDefaultScenario yields a valid (empty) scenario', () => {
    const s = createDefaultScenario('blank', 'Blank');
    expect(validateScenario(s, { agentIds })).toEqual([]);
  });

  it('flags unresolved cast, bad spawn, and incomplete variants', () => {
    const s = createDefaultScenario('bad', 'Bad');
    s.cast = [{ ...castMemberFor(DEFAULT_CAST[0]), agentId: 'ghost', spawnLocationId: 'nowhere' }];
    s.interventionTypes = [{ type: 'door', values: ['open'] }];
    s.variants = [{ variantId: 'v', selections: { door: 'locked', window: 'open' } }];
    s.defaultVariantId = 'missing';
    const issues = validateScenario(s, { agentIds });
    expect(issues.some((i) => i.includes('ghost'))).toBe(true);
    expect(issues.some((i) => i.includes('nowhere'))).toBe(true);
    expect(issues.some((i) => i.includes('undeclared value'))).toBe(true); // door=locked
    expect(issues.some((i) => i.includes('undeclared intervention type'))).toBe(true); // window
    expect(issues.some((i) => i.includes('defaultVariantId'))).toBe(true);
  });

  it('flags information referencing a missing truth fact and unknown holders', () => {
    const s = createDefaultScenario('info', 'Info');
    s.informationItems = [
      { informationId: 'x', topic: 't', claim: 'c', originType: 'rumor', truthId: 'no_such_truth', truthAlignment: 'false', sourceAgentId: 'janice', initialHolderAgentIds: ['ghost'] },
    ];
    const issues = validateScenario(s, { agentIds });
    expect(issues.some((i) => i.includes('no_such_truth'))).toBe(true);
    expect(issues.some((i) => i.includes('ghost'))).toBe(true);
  });

  it('serializeScenario stamps a meta block and round-trips the data', () => {
    const out = serializeScenario(promo) as any;
    expect(out.scenarioId).toBe('promotion_rumor_001');
    expect(out.meta.generator).toBe('sprite-character-creator');
    expect(out.variants.length).toBe(3);
  });
});

describe('scenario ↔ office anchor binding', () => {
  it('promotion_rumor_001 bindings resolve against a generated office (seed 1)', () => {
    const project = defaultProject();
    const office = generateOfficeLayout(project, 6, 1);
    const anchors = computeOfficeAnchors(office.scene, project);
    const ids = anchors.map((a) => a.anchorId);
    // per-agent desks + the rooms the scenario binds to all exist as anchors
    for (const id of ['desk:janice', 'desk:carl', 'desk:linda', 'cubicle-farm', 'manager-office', 'break-room', 'hallway']) {
      expect(ids).toContain(id);
    }
    // and with anchor resolution turned on, every location binding resolves
    expect(validateScenario(promo, { agentIds: project.characters.map((c) => c.id), anchorIds: ids })).toEqual([]);
  });

  it('guarantees all three desk anchors even on a small-cubicle-farm template (seed 7)', () => {
    // seed 7 (cross-hall-compact) only fits 2 desk pods; the fallback tops up
    // desk:linda from a free cubicle-farm cell so the cast always binds.
    const project = defaultProject();
    const office = generateOfficeLayout(project, 6, 7);
    const ids = computeOfficeAnchors(office.scene, project).map((a) => a.anchorId);
    for (const id of ['desk:janice', 'desk:carl', 'desk:linda']) expect(ids).toContain(id);
    expect(validateScenario(promo, { agentIds: project.characters.map((c) => c.id), anchorIds: ids })).toEqual([]);
  });

  it('emits one room anchor per room and excludes the manager from desk anchors', () => {
    const project = defaultProject();
    const office = generateOfficeLayout(project, 6, 1);
    const anchors = computeOfficeAnchors(office.scene, project);
    const rooms = office.scene.rooms ?? [];
    expect(anchors.filter((a) => a.kind === 'room').length).toBe(rooms.length);
    expect(anchors.some((a) => a.anchorId === 'desk:manager')).toBe(false);
  });

  it('flags a location bound to an anchor the office does not have', () => {
    const s = structuredClone(promo);
    s.locations.push({
      locationId: 'ghost_room',
      displayName: 'Ghost',
      tags: [],
      accessState: 'open',
      fallbackLocationId: '',
      bindTo: { anchorId: 'desk:nobody', roomId: 'cubicle-farm' },
    });
    const issues = validateScenario(s, { agentIds: DEFAULT_CAST.map((c) => c.id), anchorIds: ['cubicle-farm'] });
    expect(issues.some((i) => i.includes('desk:nobody'))).toBe(true);
  });
});

describe('scenario run resolver (studio↔sim parity)', () => {
  const project = defaultProject();
  const resolve = (variantId?: string) =>
    resolveScenarioRun(promo, {
      profiles: project.profiles!,
      characters: DEFAULT_CAST.map((c) => ({ id: c.id, name: c.name })),
      agentIds: agentIds,
      variantId,
    });

  it('layers scenario overrides on the persona baseline (baseline kept where not overridden)', () => {
    const carl = resolve().agents.find((a) => a.agentId === 'carl')!;
    const toJanice = carl.relationships.find((r) => r.targetAgentId === 'janice')!;
    expect(toJanice.suspicion).toBe(100); // scenario override wins
    expect(toJanice.affinity).toBe(-50); // scenario override wins
    expect(toJanice.trust).toBe(40); // baseline preserved (override did not set trust)
    expect(toJanice.fromOverride).toBe(true);
  });

  it('resolves beliefs from the scenario and knowledge from seeds + initial holders', () => {
    const carl = resolve().agents.find((a) => a.agentId === 'carl')!;
    expect(carl.beliefs.some((b) => b.topic === 'janice_promotion' && b.stance === 'suspects')).toBe(true);
    // rigged_promotion_claim is not a knowledgeSeed but Carl is its initial holder
    expect(carl.knowledge).toContain('rigged_promotion_claim');
    expect(carl.knowledge).toContain('official_promotion_notice');
    expect(carl.hasPersona).toBe(true);
  });

  it('applies the selected variant conditions', () => {
    const run = resolve('private_notification_break_room_locked');
    expect(run.variantConditions.promotion_information_entry).toBe('private_notification');
    expect(run.variantConditions.break_room_access).toBe('locked');
  });

  it('is clean for promotion_rumor_001 (no validation issues without anchor check)', () => {
    expect(resolve().issues).toEqual([]);
  });
});

describe('scenario export', () => {
  it('exportAll writes a split scenario package per authored scenario', async () => {
    const project = defaultProject();
    project.scene = generateOfficeLayout(project, 6, 1).scene; // office so anchors/interaction files emit
    const paths: string[] = [];
    const sink: ExportSink = { file: (p) => void paths.push(p) };
    // Stub rasterizer — we only care that the package JSON is emitted, not pixels.
    const rasterizer = { rasterizeSheet: async () => new Uint8Array([0]) };
    await exportAll(project, { sink, rasterizer });
    const dir = 'scenarios/promotion-rumor-001';
    for (const file of ['scenario.json', 'employees.json', 'relationships.json', 'relationshipTypes.json', 'beliefs.json', 'knowledge.json', 'interaction-anchors.json', 'office-layout.json']) {
      expect(paths).toContain(`${dir}/${file}`);
    }
  });

  it('ships the relationship-type catalog and the typed/secret edges in the package', () => {
    const project = defaultProject();
    const pkg = buildScenarioPackage(DEFAULT_SCENARIOS[0], project);
    const types = pkg['relationshipTypes.json'] as Array<{ id: string; thirdParty?: unknown }>;
    expect(types.some((t) => t.id === 'romance' && t.thirdParty)).toBe(true);
    const edges = pkg['relationships.json'] as Array<{ sourceAgentId: string; targetAgentId: string; relationshipType: string | null; secret: boolean }>;
    const lindaCarl = edges.find((e) => e.sourceAgentId === 'linda' && e.targetAgentId === 'carl');
    expect(lindaCarl?.relationshipType).toBe('romance');
    expect(lindaCarl?.secret).toBe(true);
  });
});

describe('scenarios migration (v3 → v4)', () => {
  it('backfills the scenarios collection for saves that predate it', () => {
    const legacy = defaultProject() as any;
    delete legacy.scenarios;
    legacy.version = 3;
    const migrated = migrateProject(legacy)!;
    expect(migrated.version).toBe(CURRENT_SCHEMA_VERSION);
    expect(migrated.scenarios?.some((s) => s.scenarioId === 'promotion_rumor_001')).toBe(true);
  });

  it('does not inject the default scenario into a project missing its cast', () => {
    const proj = defaultProject() as any;
    proj.version = 3;
    delete proj.scenarios;
    proj.characters = proj.characters.filter((c: any) => c.id !== 'carl'); // break the cast
    const migrated = migrateProject(proj)!;
    expect(migrated.scenarios?.length).toBe(0);
  });
});
