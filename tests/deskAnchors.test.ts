import { describe, it, expect } from 'vitest';
import { computeOfficeAnchors, generateOfficeLayout, validateDeskCoverage } from '../src/core/layout';
import { defaultProject } from '../src/data/defaults';

describe('per-department desk anchors (Epic 1 / F1.2)', () => {
  it('seats each desk-agent and tags the anchor with its wing/department', () => {
    const project = defaultProject();
    const { scene } = generateOfficeLayout(project, 6, 7);
    const anchors = computeOfficeAnchors(scene, project);
    for (const id of ['janice', 'carl', 'linda']) {
      const a = anchors.find((x) => x.anchorId === `desk:${id}`)!;
      expect(a, `desk:${id}`).toBeDefined();
      expect(a.wingId).toBeTruthy();
      // The default cast is 'operations' with no tagged wing → the common/main wing.
      expect(a.departmentId).toBeNull();
    }
    expect(anchors.some((a) => a.anchorId === 'desk:manager')).toBe(false);
  });

  it('exposes spare desk anchors for later transfers', () => {
    const project = defaultProject();
    const { scene } = generateOfficeLayout(project, 6, 7);
    const spares = computeOfficeAnchors(scene, project).filter((a) => a.kind === 'spare-desk');
    expect(spares.length).toBeGreaterThan(0);
    for (const s of spares) expect(s.wingId).toBeTruthy();
  });

  it('resolves desks within the agent department wing when rooms are tagged', () => {
    const project = defaultProject();
    const { scene } = generateOfficeLayout(project, 6, 7);
    // Tag the cubicle-farm as the operations wing — the default cast's department.
    scene.rooms!.find((r) => r.id === 'cubicle-farm')!.departmentId = 'operations';
    const anchors = computeOfficeAnchors(scene, project);
    const janice = anchors.find((a) => a.anchorId === 'desk:janice')!;
    expect(janice.departmentId).toBe('operations');
    expect(janice.wingId).toBe('wing-operations');
    expect(janice.roomId).toBe('cubicle-farm');
  });

  it('desk ordering is deterministic for a given scene', () => {
    const project = defaultProject();
    const { scene } = generateOfficeLayout(project, 6, 7);
    expect(JSON.stringify(computeOfficeAnchors(scene, project))).toBe(
      JSON.stringify(computeOfficeAnchors(scene, project)),
    );
  });

  it('passes desk-coverage validation for the default office', () => {
    const project = defaultProject();
    const { scene } = generateOfficeLayout(project, 6, 7);
    expect(validateDeskCoverage(scene, project)).toEqual([]);
  });

  it('flags a wing that cannot seat its assigned cast', () => {
    const project = defaultProject(); // janice/carl/linda are 'operations'
    // A minimal scene whose only wing (operations) has no seatable floor at all.
    const scene = {
      cols: 2,
      rows: 2,
      floorIds: [[null, null], [null, null]],
      wallIds: [[null, null], [null, null]],
      entities: [],
      rooms: [{ id: 'tiny', label: 'Tiny', x: 0, y: 0, cols: 2, rows: 2, departmentId: 'operations' }],
      roomIds: [['tiny', 'tiny'], ['tiny', 'tiny']],
      source: 'generated' as const,
      generated: null,
    };
    const issues = validateDeskCoverage(scene, project);
    expect(issues.length).toBeGreaterThan(0);
    expect(issues[0]).toMatch(/short/);
  });
});
