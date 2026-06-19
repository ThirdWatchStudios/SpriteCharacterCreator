import { describe, it, expect } from 'vitest';
import { computeWings, generateOfficeLayout, sceneToLayoutJson } from '../src/core/layout';
import { defaultProject } from '../src/data/defaults';

describe('department wing grouping (Epic 1 / F1.1)', () => {
  it('a single-office template exports one implicit wing covering every room', () => {
    const project = defaultProject();
    const { scene } = generateOfficeLayout(project, 6, 7);
    const wings = computeWings(scene, project);
    expect(wings).toHaveLength(1);
    expect(wings[0].id).toBe('wing-main');
    expect(wings[0].departmentId).toBeNull();
    // Every room is accounted for in the implicit wing.
    expect(wings[0].roomIds.sort()).toEqual((scene.rooms ?? []).map((r) => r.id).sort());
  });

  it('groups rooms by departmentId and resolves labels from the catalog', () => {
    const project = defaultProject();
    const { scene } = generateOfficeLayout(project, 6, 7);
    const rooms = scene.rooms!;
    // Tag the work + leadership rooms onto departments; leave the rest common.
    rooms.find((r) => r.id === 'cubicle-farm')!.departmentId = 'engineering';
    rooms.find((r) => r.id === 'manager-office')!.departmentId = 'management';

    const wings = computeWings(scene, project);
    const eng = wings.find((w) => w.departmentId === 'engineering')!;
    const mgmt = wings.find((w) => w.departmentId === 'management')!;
    const common = wings.find((w) => w.departmentId === null)!;

    expect(eng.id).toBe('wing-engineering');
    expect(eng.label).toBe('Engineering'); // from the F2.1 catalog
    expect(eng.roomIds).toContain('cubicle-farm');
    expect(mgmt.label).toBe('Management');
    expect(common.id).toBe('wing-common');
    // Union of all wing rooms is still the full room set.
    const all = wings.flatMap((w) => w.roomIds).sort();
    expect(all).toEqual(rooms.map((r) => r.id).sort());
  });

  it('wing bounds enclose their rooms', () => {
    const project = defaultProject();
    const { scene } = generateOfficeLayout(project, 6, 7);
    scene.rooms!.find((r) => r.id === 'cubicle-farm')!.departmentId = 'engineering';
    const eng = computeWings(scene, project).find((w) => w.departmentId === 'engineering')!;
    const farm = scene.rooms!.find((r) => r.id === 'cubicle-farm')!;
    expect(eng.bounds.x).toBeLessThanOrEqual(farm.x);
    expect(eng.bounds.x + eng.bounds.cols).toBeGreaterThanOrEqual(farm.x + farm.cols);
  });

  it('office-layout.json carries the wings block at schema version 3', () => {
    const project = defaultProject();
    const { scene } = generateOfficeLayout(project, 6, 7);
    const json = sceneToLayoutJson(scene, project);
    expect(json.version).toBe(3);
    expect(json.wings.length).toBeGreaterThan(0);
    expect(json.wings[0].roomIds.length).toBeGreaterThan(0);
  });

  it('is deterministic for a given scene', () => {
    const project = defaultProject();
    const { scene } = generateOfficeLayout(project, 6, 7);
    expect(JSON.stringify(computeWings(scene, project))).toBe(JSON.stringify(computeWings(scene, project)));
  });
});
