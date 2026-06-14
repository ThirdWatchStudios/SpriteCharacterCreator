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
