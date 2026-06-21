import { describe, it, expect } from 'vitest';
import { computeWings, generateOfficeLayout, sceneToLayoutJson, validateDeskCoverage } from '../src/core/layout';
import type { SceneLayoutJson } from '../src/core/layout';
import type { SceneState } from '../src/core/scene';
import { defaultProject } from '../src/data/defaults';

// Procedural-spine footprint constants, mirrored from layout.ts.
const CORE_WIDTH = 8;
// Every composed office also carries the shared sim-bound common bays (manager
// office + break + conference) — counted alongside the department wings.
const COMMON_BAYS = 3;

const wallAt = (scene: SceneState, x: number, y: number): boolean => Boolean(scene.wallIds[y]?.[x]);

function doorCells(json: SceneLayoutJson): Array<{ x: number; y: number }> {
  return json.props.filter((p) => p.templateId === 'door').map((p) => ({ x: p.x, y: p.y }));
}

/** Every interior cell belongs to a room — no hole/gap inside the building shell. */
function assertNoGap(scene: SceneState): void {
  for (let y = 0; y < scene.rows; y++) {
    for (let x = 0; x < scene.cols; x++) {
      expect(scene.roomIds?.[y]?.[x], `cell ${x},${y} has no room`).not.toBeNull();
    }
  }
}

/** Room interiors (inset by 1) are pairwise disjoint — no overlap / crowding. */
function assertNoInteriorOverlap(scene: SceneState): void {
  const rooms = scene.rooms ?? [];
  const interior = (r: { x: number; y: number; cols: number; rows: number }) => ({
    x0: r.x + 1,
    y0: r.y + 1,
    x1: r.x + r.cols - 2,
    y1: r.y + r.rows - 2,
  });
  for (let i = 0; i < rooms.length; i++) {
    for (let j = i + 1; j < rooms.length; j++) {
      const a = interior(rooms[i]);
      const b = interior(rooms[j]);
      const overlap = a.x0 <= b.x1 && b.x0 <= a.x1 && a.y0 <= b.y1 && b.y0 <= a.y1;
      expect(overlap, `interiors of ${rooms[i].id} and ${rooms[j].id} overlap`).toBe(false);
    }
  }
}

/** Each doorway is a single-tile gap in a continuous wall run, with a door prop. */
function assertDoorwaysSingleTile(scene: SceneState, json: SceneLayoutJson): void {
  for (const d of doorCells(json)) {
    const inHorizontalWall = wallAt(scene, d.x - 1, d.y) && wallAt(scene, d.x + 1, d.y);
    const inVerticalWall = wallAt(scene, d.x, d.y - 1) && wallAt(scene, d.x, d.y + 1);
    expect(inHorizontalWall || inVerticalWall, `door ${d.x},${d.y} not in a 1-tile wall gap`).toBe(true);
    // the door cell itself is walkable (the wall was cleared)
    expect(wallAt(scene, d.x, d.y), `door cell ${d.x},${d.y} should be cleared`).toBe(false);
  }
}

/** Flood-fill from reception across non-wall cells reaches every room. */
function assertReachable(scene: SceneState): void {
  const reception = (scene.rooms ?? []).find((r) => (r.kind ?? r.id) === 'reception')!;
  const start = { x: reception.x + 1, y: reception.y + 1 };
  const seen = new Set<string>();
  const reachedRooms = new Set<string>();
  const stack = [start];
  while (stack.length) {
    const { x, y } = stack.pop()!;
    const k = `${x},${y}`;
    if (seen.has(k)) continue;
    if (x < 0 || y < 0 || x >= scene.cols || y >= scene.rows) continue;
    if (wallAt(scene, x, y)) continue;
    seen.add(k);
    const rid = scene.roomIds?.[y]?.[x];
    if (rid) reachedRooms.add(rid);
    stack.push({ x: x + 1, y }, { x: x - 1, y }, { x, y: y + 1 }, { x, y: y - 1 });
  }
  for (const room of scene.rooms ?? []) {
    expect(reachedRooms.has(room.id), `room ${room.id} unreachable from reception`).toBe(true);
  }
}

/** Badge readers mount on a wall cell (never floating in the corridor). */
function assertBadgesOnWalls(scene: SceneState, json: SceneLayoutJson): void {
  for (const p of json.props.filter((pr) => pr.templateId === 'badge-reader')) {
    expect(wallAt(scene, p.x, p.y), `badge reader ${p.x},${p.y} not on a wall`).toBe(true);
  }
}

describe('footprint scaling (Epic 1 / F1.4)', () => {
  it('scales to a valid office for any department count (S1.4.1)', () => {
    const project = defaultProject();
    for (const n of [1, 2, 4]) {
      const wingDepartmentIds = ['sales', 'engineering', 'it', 'hr'].slice(0, n);
      const { scene } = generateOfficeLayout(project, 6, 7, { wingDepartmentIds });
      const json = sceneToLayoutJson(scene, project);
      // Procedural footprint: a department office is wider than the reception core,
      // grows roughly with department count, at a fixed height (extras add jitter).
      expect(scene.cols, `cols for ${n} wings`).toBeGreaterThan(CORE_WIDTH + n * 4);
      expect(scene.rows).toBe(14);
      expect(json.cols).toBe(scene.cols);
      expect(json.rows).toBe(14);
    }
  });

  it('produces one wing per department plus a common wing, covering every room', () => {
    const project = defaultProject();
    const { scene } = generateOfficeLayout(project, 6, 7, { wingDepartmentIds: ['sales', 'engineering'] });
    const wings = computeWings(scene, project);
    expect(wings.find((w) => w.departmentId === 'sales')?.label).toBe('Sales');
    expect(wings.find((w) => w.departmentId === 'engineering')?.label).toBe('Engineering');
    expect(wings.find((w) => w.id === 'wing-common')).toBeDefined();
    const all = wings.flatMap((w) => w.roomIds).sort();
    expect(all).toEqual((scene.rooms ?? []).map((r) => r.id).sort());
  });

  it('generates without gaps or interior overlap (S1.4.1)', () => {
    const project = defaultProject();
    const { scene } = generateOfficeLayout(project, 6, 7, { wingDepartmentIds: ['sales', 'engineering', 'it'] });
    assertNoGap(scene);
    assertNoInteriorOverlap(scene);
  });

  it('keeps single wall lines between rooms (S1.4.2 — no double walls)', () => {
    const project = defaultProject();
    const { scene } = generateOfficeLayout(project, 6, 7, { wingDepartmentIds: ['sales', 'engineering', 'it'] });
    // Inclusive overlap-by-1 means adjacent rooms share ONE wall column. Scan each
    // band's interior row: no two consecutive interior columns are both walls.
    for (const y of [2, scene.rows - 3]) {
      for (let x = CORE_WIDTH; x < scene.cols - 2; x++) {
        expect(wallAt(scene, x, y) && wallAt(scene, x + 1, y), `double wall at ${x},${x + 1} row ${y}`).toBe(false);
      }
    }
  });

  it('connects every wing to reception via single-tile doorways (S1.4.2)', () => {
    const project = defaultProject();
    const { scene } = generateOfficeLayout(project, 6, 7, { wingDepartmentIds: ['sales', 'engineering', 'it'] });
    const json = sceneToLayoutJson(scene, project);
    // At least one doorway per bay (3 wings + the common bays) plus corridor junctions.
    expect(doorCells(json).length).toBeGreaterThanOrEqual(3 + COMMON_BAYS);
    assertDoorwaysSingleTile(scene, json);
    assertReachable(scene);
  });

  it('keeps badge readers wall-mounted across wings (S1.4.2)', () => {
    const project = defaultProject();
    const { scene } = generateOfficeLayout(project, 6, 7, { wingDepartmentIds: ['sales', 'engineering'] });
    assertBadgesOnWalls(scene, sceneToLayoutJson(scene, project));
  });

  it('seats the cast and passes desk-coverage in a multi-wing office (F1.2 across wings)', () => {
    const project = defaultProject(); // base cast (janice/carl/linda) are 'operations'
    const { scene } = generateOfficeLayout(project, 6, 7, { wingDepartmentIds: ['sales', 'operations'] });
    expect(validateDeskCoverage(scene, project)).toEqual([]);
    const anchors = sceneToLayoutJson(scene, project).anchors;
    const janice = anchors.find((a) => a.anchorId === 'desk:janice')!;
    expect(janice.departmentId).toBe('operations');
    expect(janice.wingId).toBe('wing-operations');
    // every wing exposes spare desks for later transfers (E41)
    expect(anchors.some((a) => a.kind === 'spare-desk' && a.wingId === 'wing-operations')).toBe(true);
  });

  it('is deterministic for a fixed seed + department set, order-sensitive (S1.4.1)', () => {
    const project = defaultProject();
    const a = sceneToLayoutJson(generateOfficeLayout(project, 6, 7, { wingDepartmentIds: ['sales', 'engineering'] }).scene, project);
    const b = sceneToLayoutJson(generateOfficeLayout(project, 6, 7, { wingDepartmentIds: ['sales', 'engineering'] }).scene, project);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    // reversing the department order yields a different office (order is honored)
    const c = sceneToLayoutJson(generateOfficeLayout(project, 6, 7, { wingDepartmentIds: ['engineering', 'sales'] }).scene, project);
    expect(JSON.stringify(c)).not.toBe(JSON.stringify(a));
  });

  it('is backward compatible — an empty/omitted wing list still takes the template path, byte for byte', () => {
    const project = defaultProject();
    const base = JSON.stringify(sceneToLayoutJson(generateOfficeLayout(project, 6, 7).scene, project));
    const emptyOpts = JSON.stringify(sceneToLayoutJson(generateOfficeLayout(project, 6, 7, {}).scene, project));
    const emptyList = JSON.stringify(sceneToLayoutJson(generateOfficeLayout(project, 6, 7, { wingDepartmentIds: [] }).scene, project));
    expect(emptyOpts).toBe(base);
    expect(emptyList).toBe(base);
    // and it stays the (non-composed) template path — now tagged into hero wings.
    const scene = generateOfficeLayout(project, 6, 7).scene;
    expect(scene.generated?.templateId).not.toBe('composed-wings');
    expect(computeWings(scene, project).length).toBeGreaterThan(1);
  });
});
