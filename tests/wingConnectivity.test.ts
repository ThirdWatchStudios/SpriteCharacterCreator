import { describe, it, expect } from 'vitest';
import { computeWingConnectivity, computeWings, generateOfficeLayout, sceneToLayoutJson } from '../src/core/layout';
import type { WingConnectivityEdge } from '../src/core/layout';
import { defaultProject } from '../src/data/defaults';

/** Every wing reachable from every other wing across the edge graph (BFS). */
function isConnected(wingIds: string[], edges: WingConnectivityEdge[]): boolean {
  if (wingIds.length <= 1) return true;
  const adj = new Map<string, string[]>(wingIds.map((id) => [id, []]));
  for (const e of edges) {
    adj.get(e.wings[0])?.push(e.wings[1]);
    adj.get(e.wings[1])?.push(e.wings[0]);
  }
  const seen = new Set<string>([wingIds[0]]);
  const queue = [wingIds[0]];
  while (queue.length) {
    for (const n of adj.get(queue.shift()!) ?? []) {
      if (!seen.has(n)) { seen.add(n); queue.push(n); }
    }
  }
  return seen.size === wingIds.length;
}

describe('wing connectivity graph (Epic 1 / F1.3)', () => {
  it('a single-office layout has one wing and no edges', () => {
    const project = defaultProject();
    const { scene } = generateOfficeLayout(project, 6, 7);
    const wings = computeWings(scene, project);
    const edges = computeWingConnectivity(scene, project);
    expect(wings).toHaveLength(1);
    expect(edges).toEqual([]);
    expect(isConnected(wings.map((w) => w.id), edges)).toBe(true);
  });

  it('connects every department wing to the common (hallway) wing (S1.3.1)', () => {
    const project = defaultProject();
    const { scene } = generateOfficeLayout(project, 6, 7, { wingDepartmentIds: ['sales', 'engineering', 'it'] });
    const edges = computeWingConnectivity(scene, project);
    // each of the 3 department wings joins the common wing through its doorway
    expect(edges).toHaveLength(3);
    for (const dep of ['sales', 'engineering', 'it']) {
      const edge = edges.find((e) => e.wings.includes(`wing-${dep}`));
      expect(edge, `edge for wing-${dep}`).toBeDefined();
      expect(edge!.wings).toContain('wing-common');
      expect(edge!.doorways).toBeGreaterThan(0);
    }
  });

  it('produces a connected graph — every wing reachable from every other (S1.3.1)', () => {
    const project = defaultProject();
    const { scene } = generateOfficeLayout(project, 6, 7, { wingDepartmentIds: ['sales', 'engineering', 'it', 'hr'] });
    const wings = computeWings(scene, project).map((w) => w.id);
    const edges = computeWingConnectivity(scene, project);
    expect(isConnected(wings, edges)).toBe(true);
  });

  it('is emitted in office-layout.json and matches the topology (S1.3.2)', () => {
    const project = defaultProject();
    const { scene } = generateOfficeLayout(project, 6, 7, { wingDepartmentIds: ['sales', 'engineering'] });
    const json = sceneToLayoutJson(scene, project);
    expect(json.version).toBe(3);
    expect(json.connectivity).toEqual(computeWingConnectivity(scene, project));
    // edges only reference wings that exist in the wings[] block
    const wingIds = new Set(json.wings.map((w) => w.id));
    for (const e of json.connectivity) {
      expect(wingIds.has(e.wings[0]) && wingIds.has(e.wings[1])).toBe(true);
    }
  });

  it('supports reveal-order traversal and hop distance from the entry wing (S1.3.2)', () => {
    const project = defaultProject();
    const { scene } = generateOfficeLayout(project, 6, 7, { wingDepartmentIds: ['sales', 'engineering', 'it'] });
    const edges = computeWingConnectivity(scene, project);
    // BFS from the common (entry) wing: department wings are all 1 hop away.
    const adj = new Map<string, string[]>();
    for (const e of edges) {
      (adj.get(e.wings[0]) ?? adj.set(e.wings[0], []).get(e.wings[0])!).push(e.wings[1]);
      (adj.get(e.wings[1]) ?? adj.set(e.wings[1], []).get(e.wings[1])!).push(e.wings[0]);
    }
    const dist = new Map<string, number>([['wing-common', 0]]);
    const queue = ['wing-common'];
    while (queue.length) {
      const cur = queue.shift()!;
      for (const n of adj.get(cur) ?? []) {
        if (!dist.has(n)) { dist.set(n, dist.get(cur)! + 1); queue.push(n); }
      }
    }
    for (const dep of ['sales', 'engineering', 'it']) {
      expect(dist.get(`wing-${dep}`)).toBe(1);
    }
  });

  it('is deterministic for a given scene', () => {
    const project = defaultProject();
    const { scene } = generateOfficeLayout(project, 6, 7, { wingDepartmentIds: ['sales', 'engineering'] });
    expect(JSON.stringify(computeWingConnectivity(scene, project))).toBe(
      JSON.stringify(computeWingConnectivity(scene, project)),
    );
  });
});
