import { describe, it, expect } from 'vitest';
import {
  computeWings,
  generateOfficeLayout,
  sceneToLayoutJson,
  validatePopulationOccupancy,
} from '../src/core/layout';
import { generatePopulation, employeeRecipe } from '../src/core/employee';
import { generateEmployeePersona } from '../src/core/populationPersona';
import { defaultProject } from '../src/data/defaults';
import type { ProjectState } from '../src/core/types';
import type { SceneState } from '../src/core/scene';

/** A project with a promoted generated population across the given departments. */
function projectWithPopulation(depts: Array<{ id: string; count: number }>): ProjectState {
  const project = defaultProject();
  project.profiles ??= [];
  for (const { id, count } of depts) {
    const pop = generatePopulation(count, id, project.style, `seed-${id}`);
    for (const emp of pop.employees) {
      const recipe = employeeRecipe(emp);
      project.characters.push(recipe);
      project.profiles.push(generateEmployeePersona(emp, recipe));
    }
  }
  return project;
}

/** wing-id → department, and the wing each cell belongs to, for a generated scene. */
function wingLookup(scene: SceneState, project: ProjectState) {
  const wings = computeWings(scene, project);
  const wingOfRoom = new Map<string, (typeof wings)[number]>();
  for (const w of wings) for (const rid of w.roomIds) wingOfRoom.set(rid, w);
  const wingAt = (x: number, y: number) => wingOfRoom.get(scene.roomIds?.[y]?.[x] ?? '');
  return { wings, wingAt };
}

// The promoted generated population only (emp-* agents) — not the scripted base cast.
const popAgentIds = (project: ProjectState): string[] =>
  (project.profiles ?? [])
    .filter((p) => p.identity.department && p.agentId.startsWith('emp-'))
    .map((p) => p.agentId);

describe('department-tagged spawn (Epic 3 / F3.4)', () => {
  it('seats each generated agent inside its own department wing (S3.4.1)', () => {
    const project = projectWithPopulation([{ id: 'accounting', count: 2 }, { id: 'it', count: 2 }]);
    const deptOf = new Map((project.profiles ?? []).map((p) => [p.agentId, p.identity.department]));
    const { scene } = generateOfficeLayout(project, 6, 7);
    const { wingAt } = wingLookup(scene, project);

    let seated = 0;
    for (const id of popAgentIds(project)) {
      const entity = scene.entities.find((e) => e.kind === 'character' && e.refId === id);
      if (!entity) continue; // unseated (over capacity) — checked separately
      seated++;
      const wing = wingAt(entity.x, entity.y);
      expect(wing, `wing for ${id}`).toBeDefined();
      expect(wing!.departmentId).toBe(deptOf.get(id));
    }
    expect(seated).toBeGreaterThan(0);
  });

  it('auto-derives a wing per population department and scales the footprint', () => {
    const project = projectWithPopulation([{ id: 'accounting', count: 2 }, { id: 'it', count: 2 }]);
    const { scene } = generateOfficeLayout(project, 6, 7);
    const wings = computeWings(scene, project);
    expect(wings.find((w) => w.departmentId === 'accounting')).toBeDefined();
    expect(wings.find((w) => w.departmentId === 'it')).toBeDefined();
    expect(wings.find((w) => w.id === 'wing-common')).toBeDefined();
    // Procedural office: wider than the reception core, fixed height.
    expect(scene.cols).toBeGreaterThan(8);
    expect(scene.rows).toBe(14);
  });

  it('respects per-wing chair capacity and leaves transfer headroom', () => {
    const project = projectWithPopulation([{ id: 'accounting', count: 2 }, { id: 'it', count: 2 }]);
    const { scene } = generateOfficeLayout(project, 6, 7);
    const { wings, wingAt } = wingLookup(scene, project);
    const chairFor = (wingId: string) =>
      scene.entities.filter(
        (e) => e.kind === 'prop'
          && project.props.find((p) => p.id === e.refId)?.templateId === 'office-chair'
          && wingAt(e.x, e.y)?.id === wingId,
      ).length;
    const seatedFor = (wingId: string) =>
      scene.entities.filter(
        (e) => e.kind === 'character' && e.refId.startsWith('emp-') && wingAt(e.x, e.y)?.id === wingId,
      ).length;
    for (const wing of wings.filter((w) => w.departmentId)) {
      const chairs = chairFor(wing.id);
      // never fill the last 2 chairs — transfer headroom
      expect(seatedFor(wing.id)).toBeLessThanOrEqual(Math.max(0, chairs - 2));
    }
  });

  it('reports over-capacity rather than silently overflowing (S3.4.2)', () => {
    const project = projectWithPopulation([{ id: 'accounting', count: 25 }]);
    const { scene, occupancy } = generateOfficeLayout(project, 6, 7);
    expect(occupancy.length).toBeGreaterThan(0);
    expect(occupancy.join(' ')).toMatch(/unseated/);
    // the generated office and the standalone validator agree
    expect(validatePopulationOccupancy(scene, project)).toEqual(occupancy);
  });

  it('is deterministic for a fixed seed + project', () => {
    const a = sceneToLayoutJson(generateOfficeLayout(projectWithPopulation([{ id: 'it', count: 3 }]), 6, 7).scene, projectWithPopulation([{ id: 'it', count: 3 }]));
    const b = sceneToLayoutJson(generateOfficeLayout(projectWithPopulation([{ id: 'it', count: 3 }]), 6, 7).scene, projectWithPopulation([{ id: 'it', count: 3 }]));
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('is backward compatible — no promoted population uses the template path (not composed wings)', () => {
    const project = defaultProject(); // base cast only, no promoted population
    const result = generateOfficeLayout(project, 6, 7);
    expect(result.occupancy).toEqual([]);
    expect(result.coworkers.length).toBeGreaterThan(0); // throwaway filler still generated
    // The static template path (not the composed-wings packer) is used; the hero
    // cast tags it into operations/management wings + a shared common wing.
    expect(result.scene.generated?.templateId).not.toBe('composed-wings');
    const wings = computeWings(result.scene, project);
    expect(wings.some((w) => w.id === 'wing-common')).toBe(true);
  });
});
