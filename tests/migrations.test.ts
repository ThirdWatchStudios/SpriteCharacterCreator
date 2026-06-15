import { describe, it, expect } from 'vitest';
import { CURRENT_SCHEMA_VERSION, migrateProject, normalizePixelScale } from '../src/core/migrations';
import { DEFAULT_CAST, DEFAULT_STYLE, defaultProject } from '../src/data/defaults';

describe('migrateProject', () => {
  it('passes a current default project through and stamps the version', () => {
    const migrated = migrateProject(defaultProject());
    expect(migrated).not.toBeNull();
    expect(migrated!.version).toBe(CURRENT_SCHEMA_VERSION);
    expect(migrated!.props.length).toBeGreaterThan(0);
  });

  it('backfills collections missing from a legacy save', () => {
    // A pre-walls/floors save: just a cast + style, no version.
    const legacy = {
      style: structuredClone(DEFAULT_STYLE),
      characters: structuredClone(DEFAULT_CAST),
    };
    const migrated = migrateProject(legacy);
    expect(migrated).not.toBeNull();
    expect(migrated!.version).toBe(CURRENT_SCHEMA_VERSION);
    expect(migrated!.props.length).toBeGreaterThan(0);
    expect(migrated!.walls.length).toBeGreaterThan(0);
    expect(migrated!.floors.length).toBeGreaterThan(0);
    expect(migrated!.stylePresets.length).toBeGreaterThan(0);
  });

  it('adds newly-shipped default props to an old project that predates them', () => {
    const old = defaultProject();
    old.props = old.props.filter((prop) => prop.templateId !== 'mail-station');
    const migrated = migrateProject(old);
    expect(migrated!.props.some((prop) => prop.templateId === 'mail-station')).toBe(true);
  });

  it('reconciles a legacy the-manager recipe id and remaps its scene refs (v2)', () => {
    const legacy = defaultProject();
    legacy.version = 1;
    legacy.characters.find((c) => c.id === 'manager')!.id = 'the-manager';
    legacy.scene = {
      cols: 1,
      rows: 1,
      floorIds: [[null]],
      wallIds: [[null]],
      source: 'generated',
      entities: [{ id: 'e', kind: 'character', x: 0, y: 0, refId: 'the-manager', facing: 'south', mood: 'hostile', rotation: 0 }],
    };
    const migrated = migrateProject(legacy)!;
    expect(migrated.characters.some((c) => c.id === 'manager')).toBe(true);
    expect(migrated.characters.some((c) => c.id === 'the-manager')).toBe(false);
    expect(migrated.scene!.entities[0].refId).toBe('manager');
    expect(migrated.version).toBe(CURRENT_SCHEMA_VERSION);
  });

  it('seeds the drive catalog and absorbs persona-referenced drive ids (v6)', () => {
    const legacy = defaultProject();
    legacy.version = 5;
    delete (legacy as { drives?: unknown }).drives; // pre-v6 save had no catalog
    // A persona referencing a custom drive id not in the default catalog.
    legacy.profiles![0].drives.primary = 'invent_something_weird';
    const migrated = migrateProject(legacy)!;
    expect(migrated.version).toBe(CURRENT_SCHEMA_VERSION);
    expect(migrated.drives.length).toBeGreaterThan(0);
    expect(migrated.drives.some((d) => d.id === 'advance_career')).toBe(true); // seeded
    expect(migrated.drives.some((d) => d.id === 'invent_something_weird')).toBe(true); // absorbed, not lost
  });

  it('seeds the trait catalog and absorbs persona-referenced trait ids (v7)', () => {
    const legacy = defaultProject();
    legacy.version = 6;
    delete (legacy as { traits?: unknown }).traits; // pre-v7 save had no catalog
    legacy.profiles![0].personality.traitTags = ['gossip', 'a_made_up_trait'];
    const migrated = migrateProject(legacy)!;
    expect(migrated.version).toBe(CURRENT_SCHEMA_VERSION);
    expect(migrated.traits.length).toBeGreaterThan(0);
    expect(migrated.traits.some((t) => t.id === 'gossip')).toBe(true); // seeded
    expect(migrated.traits.some((t) => t.id === 'a_made_up_trait')).toBe(true); // absorbed
  });

  it('seeds the new render fields on the style and every preset (v8)', () => {
    const legacy = defaultProject();
    legacy.version = 7;
    // A pre-v8 save: the render block lacks the shadow/tint fields.
    delete (legacy.style.render as { contactShadow?: number }).contactShadow;
    delete (legacy.style.render as { ambientTint?: number }).ambientTint;
    for (const preset of legacy.stylePresets) {
      delete (preset.style.render as { contactShadow?: number }).contactShadow;
      delete (preset.style.render as { ambientTint?: number }).ambientTint;
    }
    const migrated = migrateProject(legacy)!;
    expect(migrated.version).toBe(CURRENT_SCHEMA_VERSION);
    expect(migrated.style.render.contactShadow).toBe(DEFAULT_STYLE.render.contactShadow);
    expect(migrated.style.render.ambientTint).toBe(DEFAULT_STYLE.render.ambientTint);
    expect(migrated.stylePresets.every((p) => typeof p.style.render.contactShadow === 'number')).toBe(true);
    expect(migrated.stylePresets.every((p) => typeof p.style.render.ambientTint === 'number')).toBe(true);
  });

  it('seeds the relationship-type catalog and absorbs edge-referenced ids (v9)', () => {
    const legacy = defaultProject();
    legacy.version = 8;
    delete (legacy as { relationshipTypes?: unknown }).relationshipTypes; // pre-v9 save
    // An edge referencing a custom bond type not in the default catalog.
    legacy.profiles![0].relationships = [
      { targetAgentId: legacy.characters[1].id, trust: 50, suspicion: 0, affinity: 0, influence: 0, respect: 50, familiarity: 50, relationshipType: 'frenemy', tags: [] },
    ];
    const migrated = migrateProject(legacy)!;
    expect(migrated.version).toBe(CURRENT_SCHEMA_VERSION);
    expect(migrated.relationshipTypes.length).toBeGreaterThan(0);
    expect(migrated.relationshipTypes.some((t) => t.id === 'romance')).toBe(true); // seeded
    expect(migrated.relationshipTypes.some((t) => t.id === 'frenemy')).toBe(true); // absorbed
  });

  it('refuses a project from a newer schema version', () => {
    const future = { ...defaultProject(), version: CURRENT_SCHEMA_VERSION + 1 };
    expect(migrateProject(future)).toBeNull();
  });

  it('rejects junk that is not a project', () => {
    expect(migrateProject(null)).toBeNull();
    expect(migrateProject('nope')).toBeNull();
    expect(migrateProject({})).toBeNull();
    expect(migrateProject({ characters: [], style: DEFAULT_STYLE })).toBeNull();
  });

  it('clamps pixel scale to a sane range', () => {
    expect(normalizePixelScale(0)).toBe(1);
    expect(normalizePixelScale(99)).toBe(8);
    expect(normalizePixelScale(Number.NaN)).toBe(1);
    expect(normalizePixelScale(2)).toBe(2);
  });
});
