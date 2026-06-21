import type { CharacterRecipe, Mood, ProjectState, PropInstance, PropPlacement } from './types';
import type { SceneFacing, SceneRoom, SceneRotation, SceneState } from './scene';
import { WALL_BITS } from './types';
import type { Rng } from './random';
import { mulberry32, randomCharacter } from './random';
import { PROP_TEMPLATES } from '../props/templates';

export const GENERATED_COWORKER_PREFIX = 'layout-coworker-';

type RoomId =
  | 'reception'
  | 'manager-office'
  | 'break-room'
  | 'conference-room'
  | 'cubicle-farm'
  | 'hallway'
  | 'copy-room'
  | 'records-room'
  | 'focus-room'
  | 'waiting-nook'
  | 'storage-closet';

/** A room as authored in a template — its `id` IS its archetype. */
interface TemplateRoom {
  id: RoomId;
  label: string;
  x: number;
  y: number;
  cols: number;
  rows: number;
}

/**
 * A materialized room placed into a scene. `id` is the unique, addressable room
 * id; `kind` is the archetype the generator dispatches furnishing/floors/walls on.
 * In a single office `id === kind`; a composed multi-wing office (F1.4) makes ids
 * unique per wing (`cubicle-farm@sales`) while every wing's bullpen keeps
 * `kind: 'cubicle-farm'`.
 */
interface RoomSpec extends SceneRoom {
  id: string;
  kind: RoomId;
}

interface LayoutTemplate {
  id: string;
  label: string;
  rooms: TemplateRoom[];
  doors: Array<[number, number]>;
}

export interface GeneratedOfficeLayout {
  scene: SceneState;
  coworkers: CharacterRecipe[];
  seed: number;
  templateId: string;
  /** Wing over-capacity warnings for the generated population (F3.4); empty when every agent seated. */
  occupancy: string[];
}

/**
 * A named binding target in the office that a scenario location resolves to
 * (scenario_model.md). `room` anchors are one per room (id == roomId); `desk`
 * anchors are per-agent (`desk:<agentId>`), resolving the long-standing desk
 * granularity seam so the cast no longer collapses into one anonymous room.
 */
export type OfficeAnchorKind = 'room' | 'desk' | 'spare-desk';
export interface OfficeAnchor {
  anchorId: string;
  roomId: string;
  x: number;
  y: number;
  kind: OfficeAnchorKind;
  /** Which wing this anchor sits in (Epic 1 F1.2). Rooms + desks carry it. */
  wingId?: string;
  /** The wing's department id (null for the common/main wing). */
  departmentId?: string | null;
}

/**
 * Prop templates that are simulation *interaction* anchors (meaningful places the
 * sim can reason about), mapped to a stable interactionType. Scenery props (plants,
 * rugs, clutter, chairs, windows…) are deliberately omitted.
 */
export const INTERACTION_PROP_TYPES: Record<string, string> = {
  'water-cooler': 'water_cooler',
  'coffee-machine': 'coffee_machine',
  printer: 'printer',
  'conference-table': 'conference_table',
  'reception-desk': 'reception_desk',
  fridge: 'break_room_fridge',
  door: 'door',
  'mail-station': 'mail_station',
  'supply-cabinet': 'supply_cabinet',
  'vending-machine': 'vending_machine',
  whiteboard: 'whiteboard',
};

/** A meaningful interactive location derived from a placed prop. */
export interface InteractionAnchor {
  id: string;
  interactionType: string;
  roomId: string;
  x: number;
  y: number;
}

/**
 * A department **wing** — the addressable layout grouping of the rooms that
 * belong to one department (Epic 1 F1.1). The physical projection of the org
 * structure: the sim reveals the office wing by wing and measures distance
 * between them. `departmentId` is null for the implicit common/main wing (shared
 * rooms with no department, or the whole single-office default). `bounds` is the
 * wing's bounding box in grid cells.
 */
export interface LayoutWing {
  id: string;
  departmentId: string | null;
  label: string;
  roomIds: string[];
  bounds: { x: number; y: number; cols: number; rows: number };
}

/** Bounding box over a set of rooms. */
function wingBounds(rooms: SceneRoom[]): LayoutWing['bounds'] {
  if (!rooms.length) return { x: 0, y: 0, cols: 0, rows: 0 };
  const x0 = Math.min(...rooms.map((r) => r.x));
  const y0 = Math.min(...rooms.map((r) => r.y));
  const x1 = Math.max(...rooms.map((r) => r.x + r.cols));
  const y1 = Math.max(...rooms.map((r) => r.y + r.rows));
  return { x: x0, y: y0, cols: x1 - x0, rows: y1 - y0 };
}

/**
 * Group a scene's rooms into department wings (F1.1). Rooms carrying a
 * `departmentId` form one wing per department (labeled from the project catalog);
 * rooms without one fall into a single catch-all wing — `wing-main` ("Main
 * office") when it's the only wing (the backward-compatible single-office
 * default), or `wing-common` ("Common areas") alongside department wings.
 * Deterministic: wings follow first-appearance room order.
 */
export function computeWings(scene: SceneState, project?: ProjectState): LayoutWing[] {
  const rooms = scene.rooms ?? [];
  const labelOf = (id: string): string => project?.departments?.find((d) => d.id === id)?.label ?? id;

  const order: string[] = [];
  const byDept = new Map<string, SceneRoom[]>();
  const unassigned: SceneRoom[] = [];
  for (const room of rooms) {
    const dep = room.departmentId;
    if (dep) {
      if (!byDept.has(dep)) { byDept.set(dep, []); order.push(dep); }
      byDept.get(dep)!.push(room);
    } else {
      unassigned.push(room);
    }
  }

  const wings: LayoutWing[] = order.map((dep) => ({
    id: `wing-${dep}`,
    departmentId: dep,
    label: labelOf(dep),
    roomIds: byDept.get(dep)!.map((r) => r.id),
    bounds: wingBounds(byDept.get(dep)!),
  }));

  if (unassigned.length) {
    const onlyWing = wings.length === 0;
    wings.push({
      id: onlyWing ? 'wing-main' : 'wing-common',
      departmentId: null,
      label: onlyWing ? 'Main office' : 'Common areas',
      roomIds: unassigned.map((r) => r.id),
      bounds: wingBounds(unassigned),
    });
  }

  return wings;
}

/**
 * An undirected edge between two wings (Epic 1 F1.3). `wings` is the wing-id pair
 * (sorted, so the edge is stable); `doorways` is how many doorways physically join
 * them — a connection-strength/weight hint. The sim reads the edge list as a graph:
 * BFS from the entry wing gives both fog-of-war reveal order and wing-to-wing
 * (hop) distance.
 */
export interface WingConnectivityEdge {
  wings: [string, string];
  doorways: number;
}

/**
 * Derive the wing-adjacency graph from the generated **door topology** (F1.3): for
 * every doorway, the two rooms it joins (the open axis perpendicular to its wall
 * run) are mapped to their wings; a doorway between rooms in *different* wings is
 * an edge. Edges are aggregated (doorway count) and sorted by wing-id pair, so the
 * graph is deterministic for a given scene. A single-office scene has one wing and
 * no edges. Reachability isn't forced here — it's a property of the topology the
 * generator produces (the hallway corridor joins every wing) and is asserted in tests.
 */
export function computeWingConnectivity(scene: SceneState, project: ProjectState): WingConnectivityEdge[] {
  const wings = computeWings(scene, project);
  const wingOfRoom = new Map<string, string>();
  for (const w of wings) for (const rid of w.roomIds) wingOfRoom.set(rid, w.id);

  const isWall = (x: number, y: number): boolean => Boolean(scene.wallIds[y]?.[x]);
  const roomAt = (x: number, y: number): string | null => scene.roomIds?.[y]?.[x] ?? null;

  const counts = new Map<string, number>();
  for (const entity of scene.entities) {
    if (entity.kind !== 'prop') continue;
    if (project.props.find((p) => p.id === entity.refId)?.templateId !== 'door') continue;
    const { x, y } = entity;
    // The doorway opens along the axis whose neighbours are floor (not wall); the
    // wall run is the other axis. Mirrors `doorwayRotation`'s orientation test.
    const vOpen = !isWall(x, y - 1) && !isWall(x, y + 1);
    const hOpen = !isWall(x - 1, y) && !isWall(x + 1, y);
    const pair: Array<string | null> =
      vOpen && !hOpen
        ? [roomAt(x, y - 1), roomAt(x, y + 1)]
        : hOpen && !vOpen
          ? [roomAt(x - 1, y), roomAt(x + 1, y)]
          : vOpen
            ? [roomAt(x, y - 1), roomAt(x, y + 1)]
            : [roomAt(x - 1, y), roomAt(x + 1, y)];
    const [rA, rB] = pair;
    if (!rA || !rB) continue;
    const wA = wingOfRoom.get(rA);
    const wB = wingOfRoom.get(rB);
    if (!wA || !wB || wA === wB) continue;
    const key = [wA, wB].sort().join(' ');
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([key, doorways]) => {
      const [a, b] = key.split(' ');
      return { wings: [a, b] as [string, string], doorways };
    })
    .sort((e1, e2) => e1.wings[0].localeCompare(e2.wings[0]) || e1.wings[1].localeCompare(e2.wings[1]));
}

/** Derive interaction anchors from placed interaction props in a scene. */
export function computeInteractionAnchors(scene: SceneState, project: ProjectState): InteractionAnchor[] {
  const anchors: InteractionAnchor[] = [];
  for (const entity of scene.entities) {
    if (entity.kind !== 'prop') continue;
    const templateId = project.props.find((p) => p.id === entity.refId)?.templateId;
    const interactionType = templateId ? INTERACTION_PROP_TYPES[templateId] : undefined;
    if (!interactionType) continue;
    anchors.push({
      id: entity.id,
      interactionType,
      roomId: scene.roomIds?.[entity.y]?.[entity.x] ?? '',
      x: entity.x,
      y: entity.y,
    });
  }
  return anchors;
}

export interface SceneLayoutJson {
  version: 3;
  source: SceneState['source'];
  generated: { templateId: string; seed: number } | null;
  cols: number;
  rows: number;
  rooms: SceneRoom[];
  roomGrid: Array<Array<string | null>>;
  floors: Array<Array<string | null>>;
  walls: {
    grid: Array<Array<string | null>>;
    cells: Array<{ x: number; y: number; wallId: string; mask: number }>;
  };
  props: Array<{
    id: string;
    propId: string;
    templateId: string | null;
    name: string;
    x: number;
    y: number;
    rotation: SceneRotation;
    projection: 'plan' | 'elevation';
    placement: PropPlacement;
  }>;
  characterSpawns: Array<{
    id: string;
    characterId: string;
    name: string;
    x: number;
    y: number;
    facing: SceneFacing;
    mood: Mood;
    generatedCoworker: boolean;
  }>;
  /** Named binding targets a scenario's locations resolve to (rooms + per-agent desks). */
  anchors: OfficeAnchor[];
  /** Meaningful interactive locations derived from placed props (printer, water cooler, …). */
  interactionAnchors: InteractionAnchor[];
  /** Department wings — the rooms grouped by department (Epic 1 F1.1). */
  wings: LayoutWing[];
  /** Wing-to-wing adjacency derived from the door topology (Epic 1 F1.3). */
  connectivity: WingConnectivityEdge[];
}

const COLS = 22;
const ROWS = 14;

/**
 * Layout templates use INCLUSIVE shared-edge rects: adjacent rooms overlap by
 * one tile on their boundary, so both draw their perimeter onto the SAME wall
 * line. Never leave a one-tile gap between rooms — that's how double walls
 * happen.
 */
export const LAYOUT_TEMPLATES: LayoutTemplate[] = [
  {
    id: 'cross-hall-compact',
    label: 'Cross hall compact',
    rooms: [
      { id: 'reception', label: 'Reception', x: 0, y: 0, cols: 6, rows: 6 },
      { id: 'focus-room', label: 'Focus room', x: 5, y: 0, cols: 5, rows: 6 },
      { id: 'cubicle-farm', label: 'Cubicle farm', x: 9, y: 0, cols: 8, rows: 6 },
      { id: 'manager-office', label: 'Manager office', x: 16, y: 0, cols: 6, rows: 6 },
      { id: 'hallway', label: 'Hallway', x: 0, y: 5, cols: 22, rows: 5 },
      { id: 'copy-room', label: 'Copy room', x: 0, y: 9, cols: 5, rows: 5 },
      { id: 'break-room', label: 'Break room', x: 4, y: 9, cols: 6, rows: 5 },
      { id: 'conference-room', label: 'Conference room', x: 9, y: 9, cols: 13, rows: 5 },
    ],
    doors: [
      [2, 5],
      [7, 5],
      [13, 5],
      [18, 5],
      [2, 9],
      [7, 9],
      [15, 9],
    ],
  },
  {
    id: 'vertical-core-support',
    label: 'Vertical core support',
    rooms: [
      { id: 'reception', label: 'Reception', x: 0, y: 0, cols: 6, rows: 5 },
      { id: 'records-room', label: 'Records room', x: 0, y: 4, cols: 6, rows: 5 },
      { id: 'break-room', label: 'Break room', x: 0, y: 8, cols: 6, rows: 6 },
      { id: 'hallway', label: 'Hallway', x: 5, y: 0, cols: 4, rows: 14 },
      { id: 'cubicle-farm', label: 'Cubicle farm', x: 8, y: 0, cols: 14, rows: 7 },
      { id: 'conference-room', label: 'Conference room', x: 8, y: 6, cols: 7, rows: 8 },
      { id: 'manager-office', label: 'Manager office', x: 14, y: 6, cols: 8, rows: 8 },
    ],
    doors: [
      [5, 2],
      [5, 6],
      [5, 10],
      [8, 3],
      [11, 6],
      [17, 6],
    ],
  },
  {
    id: 'north-suite-small-break',
    label: 'North suite small break',
    rooms: [
      { id: 'reception', label: 'Reception', x: 0, y: 0, cols: 6, rows: 6 },
      { id: 'manager-office', label: 'Manager office', x: 5, y: 0, cols: 7, rows: 6 },
      { id: 'records-room', label: 'Records room', x: 11, y: 0, cols: 5, rows: 6 },
      { id: 'break-room', label: 'Break room', x: 15, y: 0, cols: 7, rows: 6 },
      { id: 'hallway', label: 'Hallway', x: 0, y: 5, cols: 22, rows: 5 },
      { id: 'cubicle-farm', label: 'Cubicle farm', x: 0, y: 9, cols: 14, rows: 5 },
      { id: 'conference-room', label: 'Conference room', x: 13, y: 9, cols: 9, rows: 5 },
    ],
    doors: [
      [2, 5],
      [8, 5],
      [13, 5],
      [18, 5],
      [5, 9],
      [11, 9],
      [17, 9],
    ],
  },
  {
    id: 'wide-front-nooks',
    label: 'Wide front nooks',
    rooms: [
      { id: 'reception', label: 'Reception', x: 0, y: 0, cols: 6, rows: 6 },
      { id: 'waiting-nook', label: 'Waiting nook', x: 5, y: 0, cols: 5, rows: 6 },
      { id: 'cubicle-farm', label: 'Cubicle farm', x: 9, y: 0, cols: 9, rows: 6 },
      { id: 'break-room', label: 'Break room', x: 17, y: 0, cols: 5, rows: 6 },
      { id: 'hallway', label: 'Hallway', x: 0, y: 5, cols: 22, rows: 5 },
      { id: 'conference-room', label: 'Conference room', x: 0, y: 9, cols: 10, rows: 5 },
      { id: 'storage-closet', label: 'Storage closet', x: 9, y: 9, cols: 4, rows: 5 },
      { id: 'manager-office', label: 'Manager office', x: 12, y: 9, cols: 10, rows: 5 },
    ],
    doors: [
      [2, 5],
      [7, 5],
      [13, 5],
      [19, 5],
      [5, 9],
      [11, 9],
      [17, 9],
    ],
  },
  {
    id: 'back-office-cluster',
    label: 'Back office cluster',
    rooms: [
      { id: 'reception', label: 'Reception', x: 0, y: 0, cols: 6, rows: 5 },
      { id: 'conference-room', label: 'Conference room', x: 5, y: 0, cols: 8, rows: 5 },
      { id: 'focus-room', label: 'Focus room', x: 12, y: 0, cols: 5, rows: 5 },
      { id: 'break-room', label: 'Break room', x: 16, y: 0, cols: 6, rows: 5 },
      { id: 'hallway', label: 'Hallway', x: 0, y: 4, cols: 22, rows: 5 },
      { id: 'copy-room', label: 'Copy room', x: 0, y: 8, cols: 5, rows: 6 },
      { id: 'cubicle-farm', label: 'Cubicle farm', x: 4, y: 8, cols: 12, rows: 6 },
      { id: 'manager-office', label: 'Manager office', x: 15, y: 8, cols: 7, rows: 6 },
    ],
    doors: [
      [2, 4],
      [9, 4],
      [14, 4],
      [19, 4],
      [2, 8],
      [9, 8],
      [18, 8],
    ],
  },
];

const COWORKER_DEPARTMENTS = ['Accounting', 'HR', 'Facilities', 'Operations', 'Sales', 'IT'];
const ROTATIONS: SceneRotation[] = [0, 90, 180, 270];
const FACINGS: SceneFacing[] = ['south', 'east', 'north', 'west'];
const AMBIENT_MOODS: Mood[] = ['normal', 'confused', 'curious', 'suspicious'];

function grid<T>(cols: number, rows: number, value: T): T[][] {
  return Array.from({ length: rows }, () => Array.from({ length: cols }, () => value));
}

function byPreferredId<T extends { id: string }>(items: T[], preferred: string, fallbackIndex = 0): T | undefined {
  return items.find((item) => item.id === preferred) ?? items[fallbackIndex];
}

function pick<T>(rng: Rng, items: T[]): T {
  return items[Math.floor(rng() * items.length)];
}

function chance(rng: Rng, probability: number): boolean {
  return rng() < probability;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function propBy(project: ProjectState, preferredId: string, templateId: string): PropInstance | undefined {
  return project.props.find((prop) => prop.id === preferredId) ?? project.props.find((prop) => prop.templateId === templateId);
}

function propProjection(prop: PropInstance | undefined): 'plan' | 'elevation' {
  return PROP_TEMPLATES.find((template) => template.id === prop?.templateId)?.projection ?? 'elevation';
}

function propPlacement(prop: PropInstance | undefined): PropPlacement {
  return PROP_TEMPLATES.find((template) => template.id === prop?.templateId)?.placement ?? 'floor';
}

function roomGrid(rooms: RoomSpec[], cols: number, rows: number): Array<Array<string | null>> {
  const cells = grid<string | null>(cols, rows, null);
  for (const room of rooms) {
    for (let y = room.y; y < room.y + room.rows; y++) {
      for (let x = room.x; x < room.x + room.cols; x++) cells[y][x] = room.id;
    }
  }
  return cells;
}

function fillFloor(scene: SceneState, roomId: string, floorId: string | null): void {
  if (!floorId) return;
  for (let y = 0; y < scene.rows; y++) {
    for (let x = 0; x < scene.cols; x++) {
      if (scene.roomIds?.[y]?.[x] === roomId) scene.floorIds[y][x] = floorId;
    }
  }
}

function setWall(scene: SceneState, x: number, y: number, wallId: string | null): void {
  if (!wallId || x < 0 || y < 0 || x >= scene.cols || y >= scene.rows) return;
  scene.wallIds[y][x] = wallId;
}

function wallLine(scene: SceneState, x1: number, y1: number, x2: number, y2: number, wallId: string | null): void {
  const dx = Math.sign(x2 - x1);
  const dy = Math.sign(y2 - y1);
  let x = x1;
  let y = y1;
  setWall(scene, x, y, wallId);
  while (x !== x2 || y !== y2) {
    x += dx;
    y += dy;
    setWall(scene, x, y, wallId);
  }
}

function clearWall(scene: SceneState, x: number, y: number): void {
  if (scene.wallIds[y]?.[x]) scene.wallIds[y][x] = null;
}

function wallAt(scene: SceneState, x: number, y: number): boolean {
  return Boolean(scene.wallIds[y]?.[x]);
}

function wallSlotRotation(scene: SceneState, x: number, y: number): SceneRotation {
  const horizontal = wallAt(scene, x - 1, y) || wallAt(scene, x + 1, y);
  const vertical = wallAt(scene, x, y - 1) || wallAt(scene, x, y + 1);
  return vertical && !horizontal ? 90 : 0;
}

function doorwayRotation(scene: SceneState, x: number, y: number): SceneRotation {
  const horizontalRun = wallAt(scene, x - 1, y) || wallAt(scene, x + 1, y);
  const verticalRun = wallAt(scene, x, y - 1) || wallAt(scene, x, y + 1);
  return verticalRun && !horizontalRun ? 90 : 0;
}

function wallForRoom(
  room: RoomSpec,
  officeWall: string | null,
  glassWall: string | null,
  themeWall?: (dep: string | undefined) => string | null,
): string | null {
  // A department's theme wall (F-themes) wins for its bullpen.
  const themed = themeWall?.(room.departmentId);
  if (themed) return themed;
  if (room.kind === 'manager-office' || room.kind === 'conference-room' || room.kind === 'focus-room') {
    return glassWall ?? officeWall;
  }
  return officeWall;
}

function floorForRoom(
  roomId: RoomId,
  floors: {
    carpet: string | null;
    lobby: string | null;
    wood: string | null;
    linoleum: string | null;
    utility: string | null;
    quiet: string | null;
  },
): string | null {
  if (roomId === 'reception') return floors.lobby;
  if (roomId === 'copy-room' || roomId === 'records-room' || roomId === 'storage-closet') return floors.utility;
  if (roomId === 'focus-room' || roomId === 'waiting-nook') return floors.quiet;
  if (roomId === 'manager-office' || roomId === 'conference-room') return floors.wood;
  if (roomId === 'break-room') return floors.linoleum;
  return floors.carpet;
}

function drawRoomWalls(
  scene: SceneState,
  rooms: RoomSpec[],
  officeWall: string | null,
  glassWall: string | null,
  themeWall?: (dep: string | undefined) => string | null,
): void {
  const maxX = scene.cols - 1;
  const maxY = scene.rows - 1;
  wallLine(scene, 0, 0, maxX, 0, officeWall);
  wallLine(scene, 0, maxY, maxX, maxY, officeWall);
  wallLine(scene, 0, 0, 0, maxY, officeWall);
  wallLine(scene, maxX, 0, maxX, maxY, officeWall);

  for (const room of rooms) {
    const wall = wallForRoom(room, officeWall, glassWall, themeWall);
    wallLine(scene, room.x, room.y, room.x + room.cols - 1, room.y, wall);
    wallLine(scene, room.x, room.y + room.rows - 1, room.x + room.cols - 1, room.y + room.rows - 1, wall);
    wallLine(scene, room.x, room.y, room.x, room.y + room.rows - 1, wall);
    wallLine(scene, room.x + room.cols - 1, room.y, room.x + room.cols - 1, room.y + room.rows - 1, wall);
  }

  // the building shell stays office wall — room wall types (glass) are
  // interior only, so re-assert the outer border last
  wallLine(scene, 0, 0, maxX, 0, officeWall);
  wallLine(scene, 0, maxY, maxX, maxY, officeWall);
  wallLine(scene, 0, 0, 0, maxY, officeWall);
  wallLine(scene, maxX, 0, maxX, maxY, officeWall);
}

function clearDoorways(scene: SceneState, doors: Array<[number, number]>): Array<{ x: number; y: number }> {
  const doorways: Array<{ x: number; y: number }> = [];
  // Single-tile doorways only: every gap gets exactly one door prop, which is
  // what walls connect to. Widening would clear a second tile with no door,
  // reopening a floor gap beside it.
  for (const [x, y] of doors) {
    clearWall(scene, x, y);
    doorways.push({ x, y });
  }
  return doorways;
}

function wallMask(scene: SceneState, x: number, y: number): number {
  return (
    (wallAt(scene, x, y - 1) ? WALL_BITS.N : 0) |
    (wallAt(scene, x + 1, y) ? WALL_BITS.E : 0) |
    (wallAt(scene, x, y + 1) ? WALL_BITS.S : 0) |
    (wallAt(scene, x - 1, y) ? WALL_BITS.W : 0)
  );
}

function decorateDoorways(
  scene: SceneState,
  project: ProjectState,
  doorways: Array<{ x: number; y: number }>,
  rng: Rng,
): void {
  for (const doorway of doorways) {
    const open = chance(rng, 0.62);
    addProp(
      scene,
      project,
      open ? 'open-door' : 'closed-door',
      open ? 'prop-open-door' : 'prop-door',
      'door',
      doorway.x,
      doorway.y,
      doorwayRotation(scene, doorway.x, doorway.y),
    );
    if (!chance(rng, 0.68)) continue;
    const adjacentWalls = [
      { x: doorway.x - 1, y: doorway.y },
      { x: doorway.x + 1, y: doorway.y },
      { x: doorway.x, y: doorway.y - 1 },
      { x: doorway.x, y: doorway.y + 1 },
    ].filter((cell) => wallAt(scene, cell.x, cell.y));
    const wall = adjacentWalls.length > 0 ? pick(rng, adjacentWalls) : undefined;
    if (wall) addWallSlotProp(scene, project, 'door-badge-reader', 'prop-badge-reader', 'badge-reader', wall.x, wall.y);
  }
}

function roomWallCells(scene: SceneState, room: RoomSpec): Array<{ x: number; y: number }> {
  const cells: Array<{ x: number; y: number }> = [];
  for (let x = room.x + 1; x < room.x + room.cols - 1; x++) {
    if (wallAt(scene, x, room.y)) cells.push({ x, y: room.y });
    if (wallAt(scene, x, room.y + room.rows - 1)) cells.push({ x, y: room.y + room.rows - 1 });
  }
  for (let y = room.y + 1; y < room.y + room.rows - 1; y++) {
    if (wallAt(scene, room.x, y)) cells.push({ x: room.x, y });
    if (wallAt(scene, room.x + room.cols - 1, y)) cells.push({ x: room.x + room.cols - 1, y });
  }
  return cells;
}

function addRoomWallFixture(
  scene: SceneState,
  project: ProjectState,
  room: RoomSpec,
  rng: Rng,
  key: string,
  preferredId: string,
  templateId: string,
): void {
  const cells = roomWallCells(scene, room).filter(
    (cell) =>
      !scene.entities.some(
        (entity) =>
          entity.kind === 'prop' &&
          entity.x === cell.x &&
          entity.y === cell.y &&
          project.props.find((prop) => prop.id === entity.refId)?.templateId === templateId,
      ),
  );
  if (cells.length > 0) {
    const cell = pick(rng, cells);
    addWallSlotProp(scene, project, key, preferredId, templateId, cell.x, cell.y);
  }
}

function decorateRoomWalls(scene: SceneState, project: ProjectState, rooms: RoomSpec[], rng: Rng): void {
  for (const room of rooms) {
    if ((room.kind === 'manager-office' || room.kind === 'conference-room' || room.kind === 'focus-room') && chance(rng, 0.85)) {
      addRoomWallFixture(scene, project, room, rng, `${room.id}-window`, 'prop-window', 'window');
    }
    if ((room.kind === 'manager-office' || room.kind === 'focus-room' || room.kind === 'records-room') && chance(rng, 0.75)) {
      addRoomWallFixture(scene, project, room, rng, `${room.id}-nameplate`, 'prop-nameplate', 'nameplate');
    }
    if ((room.kind === 'break-room' || room.kind === 'copy-room' || room.kind === 'hallway' || room.kind === 'storage-closet') && chance(rng, 0.62)) {
      addRoomWallFixture(scene, project, room, rng, `${room.id}-hvac`, 'prop-hvac-vent', 'hvac-vent');
    }
  }
}

function entityAt(scene: SceneState, x: number, y: number): boolean {
  return scene.entities.some((entity) => entity.x === x && entity.y === y);
}

function isBlocked(scene: SceneState, x: number, y: number): boolean {
  return wallAt(scene, x, y) || entityAt(scene, x, y);
}

// Cells kept walkable so furniture (and idle coworkers) never plug a doorway.
// Reset and recomputed per generation; the generator is the sole writer and runs
// synchronously, so module-level transient state stays deterministic.
let doorwayClearance = new Set<string>();

function reserved(x: number, y: number): boolean {
  return doorwayClearance.has(`${x},${y}`);
}

/**
 * The doorway throat: each doorway gap plus its non-wall orthogonal neighbours
 * (the floor tile you step onto on either side). Reserving these keeps a clear
 * passage so no floor prop or stationary coworker lands in the doorway.
 */
function computeDoorwayClearance(scene: SceneState, doorways: Array<{ x: number; y: number }>): Set<string> {
  const set = new Set<string>();
  for (const door of doorways) {
    for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const x = door.x + dx;
      const y = door.y + dy;
      if (x < 0 || y < 0 || x >= scene.cols || y >= scene.rows) continue;
      if (wallAt(scene, x, y)) continue; // walls already block; only floor throats matter
      set.add(`${x},${y}`);
    }
  }
  return set;
}

/**
 * Find a clear column along row `y` nearest `preferX`, skipping walls, occupied
 * cells, and reserved doorway throats. Used to nudge wall-anchored desks/tables
 * off a doorway instead of dropping them entirely.
 */
function clearAlongRow(scene: SceneState, box: { x0: number; x1: number }, y: number, preferX: number): number {
  for (let r = 0; r <= box.x1 - box.x0; r++) {
    for (const x of r === 0 ? [preferX] : [preferX - r, preferX + r]) {
      if (x < box.x0 || x > box.x1) continue;
      if (!wallAt(scene, x, y) && !reserved(x, y) && !isBlocked(scene, x, y)) return x;
    }
  }
  return preferX;
}

function interior(room: RoomSpec): { x0: number; x1: number; y0: number; y1: number } {
  return {
    x0: room.x + 1,
    x1: room.x + room.cols - 2,
    y0: room.y + 1,
    y1: room.y + room.rows - 2,
  };
}

function cellAt(room: RoomSpec, rx: number, ry: number): { x: number; y: number } {
  const box = interior(room);
  return {
    x: clamp(Math.round(box.x0 + (box.x1 - box.x0) * rx), box.x0, box.x1),
    y: clamp(Math.round(box.y0 + (box.y1 - box.y0) * ry), box.y0, box.y1),
  };
}

function findOpenNear(
  scene: SceneState,
  room: RoomSpec,
  origin: { x: number; y: number },
  rng: Rng,
  radius = 2,
): { x: number; y: number } | undefined {
  const box = interior(room);
  const candidates: Array<{ x: number; y: number }> = [];
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const x = clamp(origin.x + dx, box.x0, box.x1);
      const y = clamp(origin.y + dy, box.y0, box.y1);
      if (!candidates.some((cell) => cell.x === x && cell.y === y) && !isBlocked(scene, x, y) && !reserved(x, y)) {
        candidates.push({ x, y });
      }
    }
  }
  if (candidates.length === 0) return undefined;
  candidates.sort((a, b) => Math.abs(a.x - origin.x) + Math.abs(a.y - origin.y) - (Math.abs(b.x - origin.x) + Math.abs(b.y - origin.y)));
  const top = candidates.slice(0, Math.min(4, candidates.length));
  return pick(rng, top);
}

function addProp(
  scene: SceneState,
  project: ProjectState,
  key: string,
  preferredId: string,
  templateId: string,
  x: number,
  y: number,
  rotation: SceneRotation = 0,
): void {
  const prop = propBy(project, preferredId, templateId);
  if (!prop) return;
  const occupants = scene.entities.filter((entity) => entity.x === x && entity.y === y);
  const shareable = templateId === 'desk-clutter' || templateId === 'rug';
  const blockingOccupants = occupants.filter((entity) => {
    if (entity.kind === 'character') return true;
    const occupantTemplateId = project.props.find((p) => p.id === entity.refId)?.templateId;
    return occupantTemplateId !== 'desk-clutter' && occupantTemplateId !== 'rug';
  });
  if (propPlacement(prop) === 'wall-slot') {
    // a wall fixture must mount on a wall — never let it float on open floor.
    // doors are the exception: they sit in the cleared wall gap (a floor cell).
    if (templateId !== 'door' && !wallAt(scene, x, y)) return;
    if (occupants.some((entity) => entity.kind === 'prop' && project.props.find((p) => p.id === entity.refId)?.templateId === templateId)) return;
  } else {
    if (wallAt(scene, x, y)) return;
    if (reserved(x, y)) return; // keep doorway throats walkable
    if (!shareable && blockingOccupants.length > 0) return;
    if (occupants.some((entity) => entity.kind === 'character')) return;
    if (shareable && occupants.some((entity) => entity.kind === 'prop' && project.props.find((p) => p.id === entity.refId)?.templateId === templateId)) return;
  }
  scene.entities.push({
    id: `generated-prop-${key}-${x}-${y}`,
    kind: 'prop',
    x,
    y,
    refId: prop.id,
    facing: 'south',
    mood: 'normal',
    rotation,
  });
}

function addWallSlotProp(
  scene: SceneState,
  project: ProjectState,
  key: string,
  preferredId: string,
  templateId: string,
  x: number,
  y: number,
): void {
  if (!wallAt(scene, x, y)) return;
  addProp(scene, project, key, preferredId, templateId, x, y, wallSlotRotation(scene, x, y));
}

function addPropNear(
  scene: SceneState,
  project: ProjectState,
  room: RoomSpec,
  key: string,
  preferredId: string,
  templateId: string,
  rx: number,
  ry: number,
  rng: Rng,
  rotation: SceneRotation = 0,
): void {
  const cell = findOpenNear(scene, room, cellAt(room, rx, ry), rng);
  if (cell) addProp(scene, project, key, preferredId, templateId, cell.x, cell.y, rotation);
}

/**
 * Place an elevation prop flush against a horizontal room wall: the top interior
 * row first (back wall), falling back to the bottom row, scanning outward from
 * the preferred column for a clear, unreserved cell. Keeps against-wall fixtures
 * (supply cabinet, mail station) from drifting into the middle of a corridor.
 */
function addAgainstWall(
  scene: SceneState,
  project: ProjectState,
  room: RoomSpec,
  key: string,
  preferredId: string,
  templateId: string,
  rx: number,
  rotation: SceneRotation = 0,
): void {
  const box = interior(room);
  const preferX = clamp(Math.round(box.x0 + (box.x1 - box.x0) * rx), box.x0, box.x1);
  for (const y of [box.y0, box.y1]) {
    const x = clearAlongRow(scene, box, y, preferX);
    if (!wallAt(scene, x, y) && !reserved(x, y) && !isBlocked(scene, x, y)) {
      addProp(scene, project, key, preferredId, templateId, x, y, rotation);
      return;
    }
  }
}

/** Place a character. Seats (office chairs) are allowed; other props block. */
function addCharacter(
  scene: SceneState,
  project: ProjectState,
  recipe: CharacterRecipe | undefined,
  x: number,
  y: number,
  mood: Mood,
  facing: SceneFacing,
): void {
  if (!recipe || wallAt(scene, x, y)) return;
  const occupant = scene.entities.find((entity) => entity.x === x && entity.y === y);
  if (occupant?.kind === 'character') return;
  if (occupant && project.props.find((p) => p.id === occupant.refId)?.templateId !== 'office-chair') return;
  scene.entities.push({
    id: `generated-character-${recipe.id}-${x}-${y}`,
    kind: 'character',
    x,
    y,
    refId: recipe.id,
    facing,
    mood,
    rotation: 0,
  });
}

function openCells(scene: SceneState): Array<{ x: number; y: number }> {
  const cells: Array<{ x: number; y: number }> = [];
  for (let y = 1; y < scene.rows - 1; y++) {
    for (let x = 1; x < scene.cols - 1; x++) {
      if (!isBlocked(scene, x, y) && !reserved(x, y)) cells.push({ x, y });
    }
  }
  return cells;
}

/**
 * Pick a spawn cell: open floor in the preferred room, then any open floor,
 * then an unoccupied office chair (sitting). Never deletes furniture.
 */
function pickSpawnCell(
  scene: SceneState,
  project: ProjectState,
  rng: Rng,
  preferredRoom?: RoomId,
): { x: number; y: number } | undefined {
  const open = openCells(scene);
  const inRoom = open.filter((cell) => !preferredRoom || scene.roomIds?.[cell.y]?.[cell.x] === preferredRoom);
  if (inRoom.length > 0) return pick(rng, inRoom);
  if (open.length > 0) return pick(rng, open);

  const seats = scene.entities.filter(
    (entity) =>
      entity.kind === 'prop' &&
      project.props.find((p) => p.id === entity.refId)?.templateId === 'office-chair' &&
      !scene.entities.some((other) => other.kind === 'character' && other.x === entity.x && other.y === entity.y),
  );
  return seats.length > 0 ? pick(rng, seats) : undefined;
}

function spawnCharacter(
  scene: SceneState,
  project: ProjectState,
  recipe: CharacterRecipe | undefined,
  preferredRoom: RoomId,
  mood: Mood,
  facing: SceneFacing,
  rng: Rng,
): void {
  const cell = pickSpawnCell(scene, project, rng, preferredRoom);
  if (cell) addCharacter(scene, project, recipe, cell.x, cell.y, mood, facing);
}

function createGeneratedCoworkers(project: ProjectState, count: number, rng: Rng, seed: number): CharacterRecipe[] {
  return Array.from({ length: Math.max(0, Math.min(12, Math.floor(count))) }, (_, index) => {
    const recipe = randomCharacter(project.style, rng);
    const department = COWORKER_DEPARTMENTS[index % COWORKER_DEPARTMENTS.length];
    return {
      ...recipe,
      id: `${GENERATED_COWORKER_PREFIX}${seed.toString(36)}-${index + 1}`,
      name: `${recipe.name} from ${department}`,
    };
  });
}

/**
 * The promoted generated population (Epic 3) to seat by department (F3.4): cast
 * members carrying a non-empty department profile, excluding the scripted base cast
 * (janice/carl/linda/manager, which keep their authored spawns) and the throwaway
 * layout coworkers. Returned in cast order, with the agentId→department map.
 */
function collectGeneratedPopulation(project: ProjectState): { agents: CharacterRecipe[]; deptOf: Map<string, string> } {
  const baseCast = project.characters.filter((r) => !r.id.startsWith(GENERATED_COWORKER_PREFIX));
  const scripted = new Set(
    [
      baseCast.find((r) => r.id === 'janice') ?? baseCast[0],
      baseCast.find((r) => r.id === 'carl') ?? baseCast[1],
      baseCast.find((r) => r.id === 'linda') ?? baseCast[2],
      baseCast.find((r) => r.id === 'manager') ?? baseCast[3],
    ]
      .filter((r): r is CharacterRecipe => Boolean(r))
      .map((r) => r.id),
  );
  const deptOf = new Map((project.profiles ?? []).map((p) => [p.agentId, p.identity.department || '']));
  const agents = baseCast.filter((r) => !scripted.has(r.id) && (deptOf.get(r.id) ?? '') !== '');
  return { agents, deptOf };
}

function furnishReception(scene: SceneState, project: ProjectState, room: RoomSpec, rng: Rng): void {
  const box = interior(room);
  const area = (box.x1 - box.x0 + 1) * (box.y1 - box.y0 + 1);
  addPropNear(scene, project, room, 'reception-desk', 'prop-reception-desk', 'reception-desk', 0.38, 0.42, rng, pick(rng, ROTATIONS));
  const lounge = findOpenNear(scene, room, cellAt(room, 0.72, 0.72), rng);
  if (lounge) {
    addProp(scene, project, 'reception-rug', 'prop-rug', 'rug', lounge.x, lounge.y, pick(rng, [0, 90] as SceneRotation[]));
    addProp(scene, project, 'reception-couch', 'prop-couch', 'couch', lounge.x, lounge.y, pick(rng, ROTATIONS));
    // a facing chair makes the lounge read as a seating area in larger lobbies
    if (area >= 14) addPropNear(scene, project, room, 'reception-chair', 'prop-office-chair', 'office-chair', 0.5, 0.78, rng, 0);
  }
  // a plant always grounds the open lobby floor
  addPropNear(scene, project, room, 'reception-plant', 'prop-office-plant', 'office-plant', 0.85, 0.2, rng);
  if (area >= 16 && chance(rng, 0.5)) {
    addPropNear(scene, project, room, 'reception-printer', 'prop-printer', 'printer', 0.18, 0.78, rng);
  }
}

function furnishManagerOffice(scene: SceneState, project: ProjectState, room: RoomSpec, rng: Rng): SeatCell | undefined {
  const box = interior(room);
  // desk against the top wall, monitor facing into the room; the chair sits
  // south of the desk, so its backrest stays south (rotation 0), occupant faces north
  const deskX = clearAlongRow(scene, box, box.y0, clamp(Math.round((box.x0 + box.x1) / 2), box.x0, box.x1));
  addProp(scene, project, 'manager-desk', 'prop-desk', 'desk', deskX, box.y0, 180);
  addProp(scene, project, 'manager-desk-clutter', 'prop-desk-clutter', 'desk-clutter', deskX, box.y0, 180);
  addProp(scene, project, 'manager-chair', 'prop-office-chair', 'office-chair', deskX, box.y0 + 1, 0);
  if (chance(rng, 0.72)) addPropNear(scene, project, room, 'manager-files', 'prop-filing-cabinet', 'filing-cabinet', 0.9, 0.2, rng);
  if (chance(rng, 0.5)) addPropNear(scene, project, room, 'manager-plant', 'prop-office-plant', 'office-plant', 0.1, 0.2, rng);
  return { x: deskX, y: box.y0 + 1, facing: 'north' };
}

function furnishBreakRoom(scene: SceneState, project: ProjectState, room: RoomSpec, rng: Rng): void {
  const box = interior(room);
  const w = box.x1 - box.x0 + 1;
  const h = box.y1 - box.y0 + 1;
  const appliances = [
    ['fridge', 'prop-fridge', 'fridge'] as const,
    ['coffee-machine', 'prop-coffee-machine', 'coffee-machine'] as const,
    ['water-cooler', 'prop-water-cooler', 'water-cooler'] as const,
  ].sort(() => rng() - 0.5);
  // appliances line the top wall, elevation sprites against architecture
  const slots = [0.15, 0.5, 0.85];
  for (let i = 0; i < appliances.length; i++) {
    const [key, preferredId, templateId] = appliances[i];
    addPropNear(scene, project, room, key, preferredId, templateId, slots[i], 0.05, rng);
  }
  // A round lunch table anchors the open floor below the appliances, so the room
  // reads as a break area rather than an empty hall. Its own stools are part of
  // the sprite, so no separate chairs. Nudged off any doorway throat.
  if (w >= 2 && h >= 3) {
    const ty = clamp(box.y0 + Math.round(h * 0.6), box.y0 + 1, box.y1);
    const tx = clearAlongRow(scene, box, ty, clamp(Math.round((box.x0 + box.x1) / 2), box.x0 + 1, box.x1 - 1));
    addProp(scene, project, 'break-table', 'prop-break-table', 'break-table', tx, ty, 0);
  }
  if (chance(rng, 0.5)) addPropNear(scene, project, room, 'break-vending', 'prop-vending-machine', 'vending-machine', 0.9, 0.42, rng);
}

function furnishConferenceRoom(scene: SceneState, project: ProjectState, room: RoomSpec, rng: Rng): void {
  const tableCell = findOpenNear(scene, room, cellAt(room, 0.5, 0.5), rng);
  if (tableCell) {
    const rotation = pick(rng, [0, 90] as SceneRotation[]);
    addProp(scene, project, 'conference-rug', 'prop-rug', 'rug', tableCell.x, tableCell.y, rotation);
    addProp(scene, project, 'conference-table', 'prop-conference-table', 'conference-table', tableCell.x, tableCell.y, rotation);
  }
  addPropNear(scene, project, room, 'conference-whiteboard', 'prop-whiteboard', 'whiteboard', 0.9, 0.1, rng);
  if (chance(rng, 0.55)) addPropNear(scene, project, room, 'conference-plant', 'prop-office-plant', 'office-plant', 0.1, 0.8, rng);
}

function furnishCopyRoom(scene: SceneState, project: ProjectState, room: RoomSpec, rng: Rng): void {
  addPropNear(scene, project, room, 'copy-printer', 'prop-printer', 'printer', 0.35, 0.35, rng);
  addPropNear(scene, project, room, 'copy-files', 'prop-filing-cabinet', 'filing-cabinet', 0.78, 0.35, rng);
  if (room.cols >= 5 && room.rows >= 5 && chance(rng, 0.45)) {
    addPropNear(scene, project, room, 'copy-whiteboard', 'prop-whiteboard', 'whiteboard', 0.7, 0.82, rng);
  }
}

function furnishRecordsRoom(scene: SceneState, project: ProjectState, room: RoomSpec, rng: Rng): void {
  addPropNear(scene, project, room, 'records-files-a', 'prop-filing-cabinet', 'filing-cabinet', 0.25, 0.25, rng);
  addPropNear(scene, project, room, 'records-files-b', 'prop-filing-cabinet', 'filing-cabinet', 0.75, 0.25, rng);
  if (chance(rng, 0.55)) addRoomWallFixture(scene, project, room, rng, 'records-badge-reader', 'prop-badge-reader', 'badge-reader');
}

function furnishFocusRoom(scene: SceneState, project: ProjectState, room: RoomSpec, rng: Rng): SeatCell | undefined {
  const box = interior(room);
  const deskY = box.y0;
  const deskX = clearAlongRow(scene, box, deskY, clamp(Math.round((box.x0 + box.x1) / 2), box.x0, box.x1));
  addProp(scene, project, 'focus-desk', 'prop-desk', 'desk', deskX, deskY, 180);
  addProp(scene, project, 'focus-desk-clutter', 'prop-desk-clutter', 'desk-clutter', deskX, deskY, 180);
  addProp(scene, project, 'focus-chair', 'prop-office-chair', 'office-chair', deskX, Math.min(deskY + 1, box.y1), 0);
  if (chance(rng, 0.55)) addPropNear(scene, project, room, 'focus-whiteboard', 'prop-whiteboard', 'whiteboard', 0.85, 0.25, rng);
  return { x: deskX, y: Math.min(deskY + 1, box.y1), facing: 'north' };
}

function furnishWaitingNook(scene: SceneState, project: ProjectState, room: RoomSpec, rng: Rng): void {
  const lounge = findOpenNear(scene, room, cellAt(room, 0.62, 0.52), rng);
  if (lounge) {
    addProp(scene, project, 'waiting-rug', 'prop-rug', 'rug', lounge.x, lounge.y, pick(rng, [0, 90] as SceneRotation[]));
    addProp(scene, project, 'waiting-couch', 'prop-couch', 'couch', lounge.x, lounge.y, pick(rng, ROTATIONS));
  }
  addPropNear(scene, project, room, 'waiting-plant', 'prop-office-plant', 'office-plant', 0.18, 0.25, rng);
  addPropNear(scene, project, room, 'waiting-chair-a', 'prop-office-chair', 'office-chair', 0.55, 0.55, rng, pick(rng, ROTATIONS));
  if (room.cols >= 5 && chance(rng, 0.65)) {
    addPropNear(scene, project, room, 'waiting-chair-b', 'prop-office-chair', 'office-chair', 0.82, 0.55, rng, pick(rng, ROTATIONS));
  }
}

function furnishStorageCloset(scene: SceneState, project: ProjectState, room: RoomSpec, rng: Rng): void {
  addPropNear(scene, project, room, 'storage-files', 'prop-filing-cabinet', 'filing-cabinet', 0.5, 0.3, rng);
  if (chance(rng, 0.5)) addPropNear(scene, project, room, 'storage-printer', 'prop-printer', 'printer', 0.5, 0.75, rng);
}

interface SeatCell {
  x: number;
  y: number;
  facing: SceneFacing;
}

/**
 * Build the cubicle farm as a classic comb: partition spines every 3 columns
 * with a back run, one desk + chair per pod, opening onto an aisle. Uses the
 * autotile cubicle walls + the regular desk/chair props, so pods stay readable
 * at any zoom. Returns the seat cells so coworkers can be spawned sitting.
 */
/**
 * Give a bullpen its own amenities (F-amenities) — a water cooler + printer (+ a
 * plant) on free aisle cells so each department has interaction points of its own
 * instead of trekking to the core. Deterministic: spreads picks across the room's
 * open cells in (y,x) order; no-ops when the room is full. rng-free so it doesn't
 * perturb the seating stream.
 */
function furnishWingAmenities(scene: SceneState, project: ProjectState, room: RoomSpec): void {
  const open = openCells(scene)
    .filter((c) => scene.roomIds?.[c.y]?.[c.x] === room.id)
    .sort((a, b) => a.y - b.y || a.x - b.x);
  if (!open.length) return;
  const amenities: Array<[string, string]> = [
    ['prop-water-cooler', 'water-cooler'],
    ['prop-printer', 'printer'],
    ['prop-office-plant', 'office-plant'],
  ];
  amenities.forEach(([preferredId, templateId], i) => {
    const cell = open[Math.min(open.length - 1, Math.floor(((i + 0.5) / amenities.length) * open.length))];
    if (cell) addProp(scene, project, `wing-${templateId}-${room.id}`, preferredId, templateId, cell.x, cell.y);
  });
}

/**
 * Per-bullpen desk styles (F-deskvariety) — picked per room so no two department
 * wings read the same: dense rows, an open plan with a single comb + lounge space,
 * a crammed bullpen, or a sparse half-empty floor. `spacing` is the column stride
 * between pods (3 = back-to-back, 4 = an aisle between); `double` adds the bottom
 * comb; `vacancy` is the empty-desk chance.
 */
const DESK_STYLES: Array<{ spacing: number; double: boolean; vacancy: number }> = [
  { spacing: 3, double: true, vacancy: 0.12 }, // dense rows
  { spacing: 4, double: false, vacancy: 0.2 }, // open plan (one comb + lounge)
  { spacing: 3, double: true, vacancy: 0.05 }, // packed
  { spacing: 4, double: true, vacancy: 0.35 }, // sparse / hot-desk
];

function buildCubicleComb(scene: SceneState, project: ProjectState, room: RoomSpec, rng: Rng): SeatCell[] {
  const seats: SeatCell[] = [];
  const cubicleWall =
    byPreferredId(project.walls, 'wall-cubicle')?.id ?? byPreferredId(project.walls, 'wall-office')?.id ?? null;
  const box = interior(room);
  const width = box.x1 - box.x0 + 1;
  const height = box.y1 - box.y0 + 1;
  if (!cubicleWall || width < 4 || height < 3) return seats;
  const style = pick(rng, DESK_STYLES);

  // One comb against the top wall, a mirrored one against the bottom when the
  // room is deep enough AND the style wants two. Room walls ARE the pods' backs
  // and outer sides — never draw partitions adjacent to a parallel room wall, or
  // the autotiler fuses them into a ladder of sealed mini-cells. Pods repeat as
  // desk col / entry col / spine, strided by the style's spacing.
  const combs: Array<{ deskY: number; chairY: number; flipped: boolean }> = [
    { deskY: box.y0, chairY: box.y0 + 1, flipped: false },
  ];
  if (height >= 5 && style.double) combs.push({ deskY: box.y1, chairY: box.y1 - 1, flipped: true });

  for (const comb of combs) {
    const spineRows = [comb.deskY, comb.chairY];
    // the room-wall row this comb backs onto; gaps in it are doorways
    const backWallY = comb.flipped ? box.y1 + 1 : box.y0 - 1;
    const doorAt = (x: number) => !wallAt(scene, x, backWallY);

    for (let p = 0; ; p++) {
      const deskX = box.x0 + p * style.spacing;
      if (deskX > box.x1) break;
      const entryX = deskX + 1 <= box.x1 ? deskX + 1 : undefined;
      const spineX = deskX + 2;
      // spine must stay clear of the right room wall (no fusing) and of doors
      if (spineX <= box.x1 - 1 && !doorAt(spineX)) {
        for (const y of spineRows) setWall(scene, spineX, y, cubicleWall);
      }
      // keep doorways in the back wall walkable: no furniture under a gap
      if (doorAt(deskX) || (entryX !== undefined && doorAt(entryX))) continue;
      // and skip the whole pod if the desk/chair would block a doorway throat
      // (a side/front entrance), so no coworker gets seated in a doorway
      if (reserved(deskX, comb.deskY) || reserved(deskX, comb.chairY)) continue;
      if (chance(rng, style.vacancy)) continue; // the vacant cubicle sells the office
      const rotation: SceneRotation = comb.flipped ? 180 : 0;
      addProp(scene, project, `cubicle-desk-${comb.deskY}-${p}`, 'prop-desk', 'desk', deskX, comb.deskY, rotation);
      if (chance(rng, 0.46)) {
        addProp(scene, project, `cubicle-clutter-${comb.deskY}-${p}`, 'prop-desk-clutter', 'desk-clutter', deskX, comb.deskY, rotation);
      }
      addProp(scene, project, `cubicle-chair-${comb.chairY}-${p}`, 'prop-office-chair', 'office-chair', deskX, comb.chairY, rotation);
      seats.push({ x: deskX, y: comb.chairY, facing: comb.flipped ? 'south' : 'north' });
      if (entryX !== undefined && chance(rng, 0.25)) {
        addProp(scene, project, `cubicle-files-${comb.deskY}-${p}`, 'prop-filing-cabinet', 'filing-cabinet', entryX, comb.deskY, 0);
      }
    }
  }

  // shared printer at the end of the aisle
  if (chance(rng, 0.5)) {
    const aisleY = combs.length === 2 ? Math.floor((box.y0 + box.y1) / 2) : Math.min(combs[0].chairY + 1, box.y1);
    if (!isBlocked(scene, box.x1, aisleY)) {
      addProp(scene, project, 'cubicle-printer', 'prop-printer', 'printer', box.x1, aisleY, 0);
    }
  }
  return seats;
}

function furnishHallway(scene: SceneState, project: ProjectState, room: RoomSpec, rng: Rng): void {
  // badge readers mount on a wall — never free-standing in the corridor
  addRoomWallFixture(scene, project, room, rng, 'hall-badge-reader', 'prop-badge-reader', 'badge-reader');
  // Supply cabinet + mail station are the visible counterparts of the sim's
  // hallway interaction anchors (anchor:hallway:supply_cabinet / :mail_station),
  // so place them unconditionally — the anchors must always resolve to a prop.
  // Snap them flush against a wall so they don't float mid-corridor.
  addAgainstWall(scene, project, room, 'hall-supply-cabinet', 'prop-supply-cabinet', 'supply-cabinet', 0.3);
  addAgainstWall(scene, project, room, 'hall-mail-station', 'prop-mail-station', 'mail-station', 0.6);
  if (chance(rng, 0.5)) addPropNear(scene, project, room, 'hall-plant', 'prop-office-plant', 'office-plant', 0.1, 0.5, rng);
}

/** Width of the reception entrance core at the left of a composed office. */
const CORE_WIDTH = 8;

/** The geometry of a generated office: its rooms, doorway cells, and footprint. */
interface ComposedLayout {
  rooms: RoomSpec[];
  doors: Array<[number, number]>;
  cols: number;
  rows: number;
  templateId: string;
}

/**
 * The shared rooms every composed office carries so it stays sim-complete — the
 * sim binds locations to these ids and the scripted scenario references them. They
 * are untagged, so they fall into the `wing-common` catch-all (no extra wing/edge
 * counts); the `manager-office` is where the manager seats. `management` is never a
 * department bullpen — the manager lives in the manager office (see composeWingLayout).
 */
const COMPOSED_COMMON_BAYS: Array<{ id: RoomId; kind: RoomId; label: string }> = [
  { id: 'manager-office', kind: 'manager-office', label: 'Manager office' },
  { id: 'break-room', kind: 'break-room', label: 'Break room' },
  { id: 'conference-room', kind: 'conference-room', label: 'Conference room' },
];

/** Min/base/max bullpen width for the procedural tiler (inclusive overlap-by-1). */
const ROOM_MIN_W = 7;
const ROOM_BASE_W = 9;
const ROOM_MAX_W = 15;
/** Rows the central spine corridor occupies (y .. y+2); top band above, bottom below. */
const SPINE_Y = 6;

/**
 * Partition a side's inner span into `n` varied room widths (seeded), each ≥ ROOM_MIN_W
 * and ≤ ROOM_MAX_W, summing so the side tiles to the same office width as the other
 * side (`sum(w) = spanInner + n` under inclusive overlap-by-1). Varying per side and
 * per room is what stops the office reading as one uniform comb.
 */
function partitionRoomWidths(spanInner: number, n: number, rng: Rng): number[] {
  if (n <= 0) return [];
  const total = spanInner + n;
  const w = new Array<number>(n).fill(ROOM_MIN_W);
  let rem = total - ROOM_MIN_W * n;
  let guard = rem + n * (ROOM_MAX_W - ROOM_MIN_W);
  while (rem > 0 && guard-- > 0) {
    const i = Math.floor(rng() * n);
    if (w[i] < ROOM_MAX_W) {
      w[i]++;
      rem--;
    }
  }
  // Any remainder the caps couldn't absorb spills onto the first room (keeps the sum exact).
  if (rem > 0) w[0] += rem;
  return w;
}

type Bay = { id: RoomId; kind: RoomId; label: string; departmentId: string | undefined };

/**
 * Lay one block: a horizontal corridor at `spineY` with its bays budding off both
 * sides (top band rows 0..spineY, bottom spineY+2..end), tiled at varied widths
 * with staggered single-tile doorways. Returns the rooms/doors and the block's
 * right-edge column. Deterministic given the rng.
 */
function layBlock(bays: Bay[], blockStartX: number, spineY: number, corridorId: string, rows: number, rng: Rng): {
  rooms: RoomSpec[];
  doors: Array<[number, number]>;
  rightX: number;
} {
  const top = bays.filter((_, i) => i % 2 === 0);
  const bottom = bays.filter((_, i) => i % 2 === 1);
  const span = Math.max(top.length, bottom.length, 1) * (ROOM_BASE_W - 1);
  const topW = partitionRoomWidths(span, top.length, rng);
  const bottomW = partitionRoomWidths(span, bottom.length, rng);
  const rooms: RoomSpec[] = [
    { id: corridorId, kind: 'hallway', label: 'Hallway', x: blockStartX, y: spineY, cols: span + 1, rows: 3 },
  ];
  const doors: Array<[number, number]> = [];
  const lay = (side: Bay[], widths: number[], y: number, height: number, doorY: number): void => {
    let x = blockStartX;
    side.forEach((bay, i) => {
      const w = widths[i];
      // Wing-to-wing door (F-crossdoors): sometimes punch a door through the shared
      // vertical wall to the previous room, so paths run room→room, not only via the
      // corridor — a connected graph rather than a comb of dead-ends.
      if (i > 0 && rng() < 0.4) {
        const dr = y + 1 + Math.floor(rng() * Math.max(1, height - 2));
        doors.push([x, dr]); // x is the seam column shared with the previous room
      }
      rooms.push({ ...bay, x, y, cols: w, rows: height });
      const lo = x + 1;
      const hi = x + w - 2;
      const doorX = hi > lo ? lo + Math.floor(rng() * (hi - lo + 1)) : x + Math.floor(w / 2);
      doors.push([doorX, doorY]);
      x += w - 1;
    });
  };
  lay(top, topW, 0, spineY + 1, spineY);
  lay(bottom, bottomW, spineY + 2, rows - (spineY + 2), spineY + 2);
  return { rooms, doors, rightX: blockStartX + span };
}

/**
 * Procedural **meandering-spine** office (F-procedural): department bullpens + the
 * shared sim-bound rooms (manager office / break / conference) **bud off both sides**
 * of a corridor at varied widths/depths with staggered doorways. With ≥4 bays the
 * spine **bends**: two blocks sit at different corridor heights joined by a
 * full-height **cross corridor**, so the hallway steps (an S/Z spine) instead of
 * running straight — reads like a generated floorplan, not a column of cubicles.
 * Reception is the full-height left entrance; `management` maps to the manager
 * office, never a bullpen. Seeded ⇒ deterministic.
 */
function composeWingLayout(project: ProjectState, wingDepartmentIds: string[], rng: Rng): ComposedLayout {
  const rows = ROWS;
  const startX = CORE_WIDTH - 1; // bays share reception's right wall
  const labelOf = (id: string): string => project.departments?.find((d) => d.id === id)?.label ?? id;

  const deptBays: Bay[] = wingDepartmentIds
    .filter((dep) => dep !== 'management')
    .map((dep) => ({ id: `cubicle-farm@${dep}` as RoomId, kind: 'cubicle-farm' as RoomId, label: `${labelOf(dep)} bullpen`, departmentId: dep }));
  const allBays: Bay[] = [...deptBays, ...COMPOSED_COMMON_BAYS.map((b) => ({ ...b, departmentId: undefined }))];
  // Sprinkle small non-bullpen rooms among the bays for room-type variety (F-subrooms):
  // a quiet focus room, a copy room — interspersed at seeded positions, common-wing.
  const extras: Bay[] = [];
  if (rng() < 0.55) extras.push({ id: 'focus-room', kind: 'focus-room', label: 'Focus room', departmentId: undefined });
  if (rng() < 0.4) extras.push({ id: 'copy-room', kind: 'copy-room', label: 'Copy room', departmentId: undefined });
  for (const ex of extras) allBays.splice(Math.floor(rng() * (allBays.length + 1)), 0, ex);

  const reception: RoomSpec = { id: 'reception', kind: 'reception', label: 'Reception', x: 0, y: 0, cols: CORE_WIDTH, rows };

  // Small office: a single straight spine. Larger: split into two blocks at
  // different corridor heights joined by a full-height cross corridor (the bend).
  if (allBays.length < 4) {
    const b = layBlock(allBays, startX, SPINE_Y, 'hallway', rows, rng);
    return {
      rooms: [reception, ...b.rooms],
      doors: [[startX, SPINE_Y + 1], ...b.doors],
      cols: b.rightX + 1,
      rows,
      templateId: 'composed-wings',
    };
  }

  const split = Math.ceil(allBays.length / 2);
  const [spineL, spineR] = rng() < 0.5 ? [5, 7] : [7, 5];
  const left = layBlock(allBays.slice(0, split), startX, spineL, 'hallway', rows, rng);
  const crossX = left.rightX; // full-height cross corridor sits here (3 wide)
  const right = layBlock(allBays.slice(split), crossX + 2, spineR, 'hallway-east', rows, rng);
  const crossHall: RoomSpec = { id: 'hallway-cross', kind: 'hallway', label: 'Hallway', x: crossX, y: 0, cols: 3, rows };

  return {
    rooms: [reception, crossHall, ...left.rooms, ...right.rooms],
    doors: [
      [startX, spineL + 1], // reception → left spine
      [crossX, spineL + 1], // left spine → cross corridor
      [crossX + 2, spineR + 1], // cross corridor → right spine
      ...left.doors,
      ...right.doors,
    ],
    cols: right.rightX + 1,
    rows,
    templateId: 'composed-wings',
  };
}

export interface GenerateOfficeOptions {
  /**
   * Department ids to pack as wings (F1.4). Order is honored verbatim (left to
   * right) for determinism. Empty/omitted ⇒ the single-office templates, byte
   * for byte as before.
   */
  wingDepartmentIds?: string[];
  /**
   * Fill every desk instead of holding `SPARE_DESKS_PER_WING` empty per wing — used
   * by the golden baseline so the hero cast and supporting population all seat even
   * in tight wings. Default false (reserve spares for later transfers, E41).
   */
  denseSeating?: boolean;
}

/**
 * Room→department tagger for the hero (non-generated) office template path (F1.1).
 * The seated base cast's shared department flavors the seating rooms (bullpen /
 * focus); the manager's department flavors the manager office; every other room
 * stays common. Returns null whenever the tag can't be derived (no department, or
 * the base cast spans several departments), so a department-less cast collapses to
 * the single implicit wing exactly as before.
 */
function heroRoomDepartments(project: ProjectState, deptOf: Map<string, string>): (kind: string) => string | undefined {
  const base = project.characters.filter((r) => !r.id.startsWith(GENERATED_COWORKER_PREFIX));
  const managerDept = deptOf.get('manager') || '';
  const bullpenDepts = new Set(
    base.filter((r) => r.id !== 'manager').map((r) => deptOf.get(r.id) || '').filter(Boolean),
  );
  const bullpenDept = bullpenDepts.size === 1 ? [...bullpenDepts][0] : '';
  return (kind: string): string | undefined => {
    if (kind === 'manager-office') return managerDept || undefined;
    // Only the bullpen joins the department wing; the focus room stays common.
    if (kind === 'cubicle-farm') return bullpenDept || undefined;
    return undefined;
  };
}

export function generateOfficeLayout(
  project: ProjectState,
  coworkerCount: number,
  seed?: number,
  options?: GenerateOfficeOptions,
): GeneratedOfficeLayout {
  const actualSeed = seed ?? Math.floor(Math.random() * 0x7fffffff);
  const rng = mulberry32(actualSeed);

  // F3.4: the promoted generated population seats into its department's wing. Auto-
  // derive a wing per department present in the population (catalog order), unless
  // the caller overrides via the F1.4 control. Branch on data, NOT rng, so the
  // single-office path's rng stream (template pick first) stays byte-identical.
  const { agents: population, deptOf: populationDeptOf } = collectGeneratedPopulation(project);
  const populationMode = population.length > 0;
  const override = (options?.wingDepartmentIds ?? []).filter(Boolean);
  const wingDepartmentIds = override.length
    ? override
    : (project.departments ?? [])
        .map((d) => d.id)
        .filter((id) => population.some((r) => populationDeptOf.get(r.id) === id));
  let rooms: RoomSpec[];
  let doors: Array<[number, number]>;
  let cols: number;
  let rows: number;
  let templateId: string;
  if (wingDepartmentIds.length) {
    ({ rooms, doors, cols, rows, templateId } = composeWingLayout(project, wingDepartmentIds, rng));
  } else {
    const template = pick(rng, LAYOUT_TEMPLATES);
    // Tag the hero office's rooms onto the cast's departments (F1.1) so a plain
    // office — no added population — still reads as real wings: the bullpen is the
    // seated base cast's shared department, the manager office is the manager's,
    // everything else is common. A department-less cast yields null tags → the
    // single implicit wing, byte-for-byte as before.
    const tagFor = heroRoomDepartments(project, populationDeptOf);
    rooms = template.rooms.map((room) => ({ ...room, kind: room.id, departmentId: tagFor(room.id) }));
    doors = template.doors;
    cols = COLS;
    rows = ROWS;
    templateId = template.id;
  }

  const officeWall = byPreferredId(project.walls, 'wall-office')?.id ?? null;
  const glassWall = byPreferredId(project.walls, 'wall-glass')?.id ?? officeWall;
  const carpet = byPreferredId(project.floors, 'floor-carpet')?.id ?? null;
  const lobby = byPreferredId(project.floors, 'floor-carpet-tiles')?.id ?? carpet;
  const wood = byPreferredId(project.floors, 'floor-wood')?.id ?? carpet;
  const linoleum = byPreferredId(project.floors, 'floor-linoleum')?.id ?? carpet;
  const utility = byPreferredId(project.floors, 'floor-utility-vinyl')?.id ?? linoleum;
  const quiet = byPreferredId(project.floors, 'floor-quiet-carpet')?.id ?? carpet;

  const scene: SceneState = {
    cols,
    rows,
    floorIds: grid(cols, rows, carpet),
    wallIds: grid<string | null>(cols, rows, null),
    entities: [],
    rooms,
    roomIds: roomGrid(rooms, cols, rows),
    source: 'generated',
    generated: { templateId, seed: actualSeed },
  };

  const floorSet = { carpet, lobby, wood, linoleum, utility, quiet };
  // A department's theme floor (F-themes) overrides the room-kind default, so each
  // wing reads as its own place; unresolved/absent themes fall back to the default.
  const deptById = new Map((project.departments ?? []).map((d) => [d.id, d]));
  const themeFloor = (dep: string | null | undefined): string | null => {
    const id = dep ? deptById.get(dep)?.theme?.floor : undefined;
    return id ? byPreferredId(project.floors, id)?.id ?? null : null;
  };
  const themeWall = (dep: string | undefined): string | null => {
    const id = dep ? deptById.get(dep)?.theme?.wall : undefined;
    return id ? byPreferredId(project.walls, id)?.id ?? null : null;
  };
  for (const room of rooms.filter((item) => item.kind !== 'hallway')) {
    fillFloor(scene, room.id, themeFloor(room.departmentId) ?? floorForRoom(room.kind, floorSet));
  }
  // hallway fills LAST so shared boundary tiles show hallway carpet — reads as
  // a consistent corridor border instead of random floor strips under walls
  for (const room of rooms.filter((item) => item.kind === 'hallway')) {
    fillFloor(scene, room.id, floorForRoom(room.kind, floorSet));
  }

  drawRoomWalls(scene, rooms, officeWall, glassWall, themeWall);
  const doorways = clearDoorways(scene, doors);
  // reserve the doorway throats before anything is furnished, so no desk or
  // idle coworker ends up plugging a doorway
  doorwayClearance = computeDoorwayClearance(scene, doorways);
  decorateDoorways(scene, project, doorways, rng);
  decorateRoomWalls(scene, project, rooms, rng);

  let managerSeat: SeatCell | undefined;
  const seats: SeatCell[] = [];
  for (const room of rooms) {
    if (room.kind === 'reception') furnishReception(scene, project, room, rng);
    else if (room.kind === 'manager-office') managerSeat = furnishManagerOffice(scene, project, room, rng);
    else if (room.kind === 'break-room') furnishBreakRoom(scene, project, room, rng);
    else if (room.kind === 'conference-room') furnishConferenceRoom(scene, project, room, rng);
    else if (room.kind === 'cubicle-farm') {
      seats.push(...buildCubicleComb(scene, project, room, rng));
      furnishWingAmenities(scene, project, room);
    }
    else if (room.kind === 'hallway') furnishHallway(scene, project, room, rng);
    else if (room.kind === 'copy-room') furnishCopyRoom(scene, project, room, rng);
    else if (room.kind === 'records-room') furnishRecordsRoom(scene, project, room, rng);
    else if (room.kind === 'focus-room') {
      const seat = furnishFocusRoom(scene, project, room, rng);
      if (seat) seats.push(seat);
    } else if (room.kind === 'waiting-nook') furnishWaitingNook(scene, project, room, rng);
    else if (room.kind === 'storage-closet') furnishStorageCloset(scene, project, room, rng);
  }

  const baseCast = project.characters.filter((recipe) => !recipe.id.startsWith(GENERATED_COWORKER_PREFIX));
  // Population mode seats the existing promoted cast (already in project.characters),
  // so no throwaway coworkers are fabricated; otherwise keep the quick-office filler.
  const coworkers = populationMode ? [] : createGeneratedCoworkers(project, coworkerCount, rng, actualSeed);
  const manager = baseCast.find((r) => r.id === 'manager') ?? baseCast[3];
  const heroNonManager = [
    baseCast.find((r) => r.id === 'janice') ?? baseCast[0],
    baseCast.find((r) => r.id === 'carl') ?? baseCast[1],
    baseCast.find((r) => r.id === 'linda') ?? baseCast[2],
  ].filter((r): r is CharacterRecipe => Boolean(r));

  if (populationMode) {
    // The manager takes the manager office (the management wing); the hero
    // non-manager cast seat into their own department wing alongside the generated
    // population (F3.4) — in a composed office 'cubicle-farm' is suffixed per
    // department, so the wing seater (not template room ids) places them.
    if (managerSeat) addCharacter(scene, project, manager, managerSeat.x, managerSeat.y, 'hostile', managerSeat.facing);
    else spawnCharacter(scene, project, manager, 'manager-office', 'hostile', pick(rng, FACINGS), rng);
    seatGeneratedPopulation(scene, project, [...heroNonManager, ...population], populationDeptOf, seats, rng, !options?.denseSeating);
  } else {
    // Template path — unchanged rng order (janice, carl, linda, manager, filler).
    spawnCharacter(scene, project, heroNonManager[0], 'hallway', 'suspicious', pick(rng, FACINGS), rng);
    spawnCharacter(scene, project, heroNonManager[1], chance(rng, 0.5) ? 'break-room' : 'cubicle-farm', 'curious', pick(rng, FACINGS), rng);
    spawnCharacter(scene, project, heroNonManager[2], chance(rng, 0.5) ? 'conference-room' : 'cubicle-farm', 'defensive', pick(rng, FACINGS), rng);
    if (managerSeat) addCharacter(scene, project, manager, managerSeat.x, managerSeat.y, 'hostile', managerSeat.facing);
    else spawnCharacter(scene, project, manager, 'manager-office', 'hostile', pick(rng, FACINGS), rng);
    const coworkerRooms: RoomId[] = [
      'cubicle-farm',
      'hallway',
      'break-room',
      'conference-room',
      'copy-room',
      'focus-room',
      'waiting-nook',
    ];
    const freeSeats = [...seats];
    for (const coworker of coworkers) {
      // most coworkers sit at their cubicle, facing the desk
      if (freeSeats.length > 0 && chance(rng, 0.7)) {
        const seat = freeSeats.splice(Math.floor(rng() * freeSeats.length), 1)[0];
        addCharacter(scene, project, coworker, seat.x, seat.y, pick(rng, AMBIENT_MOODS), seat.facing);
        continue;
      }
      const cell = pickSpawnCell(scene, project, rng, pick(rng, coworkerRooms));
      if (cell) addCharacter(scene, project, coworker, cell.x, cell.y, pick(rng, AMBIENT_MOODS), pick(rng, FACINGS));
    }
  }

  return { scene, coworkers, seed: actualSeed, templateId, occupancy: validatePopulationOccupancy(scene, project) };
}

/** A seatable cell in a wing — a desk prop cell, then open floor as fallback. */
interface DeskCell {
  x: number;
  y: number;
  roomId: string;
}

/** Rooms whose floor is seating space; a wing seats its cast here (never in the manager's office). */
const SEATING_ROOM_IDS = new Set<string>(['cubicle-farm', 'focus-room']);
/** Spare desk anchors emitted per wing for later transfers (E41). */
const SPARE_DESKS_PER_WING = 2;

/**
 * The deterministic seat cells of one wing: its desk-prop cells first (y,x order),
 * then open floor in the wing's seating rooms as fallback — generalizing the old
 * cubicle-farm-only logic to any wing (F1.2). The manager's office is never a
 * seating room.
 */
function wingSeatCells(scene: SceneState, project: ProjectState, wing: LayoutWing): DeskCell[] {
  // A room's archetype drives seating; in a composed office `kind` differs from
  // the (unique) `id`, so match on `kind` but collect the unique `id`s that
  // `scene.roomIds` cells actually carry. Hand-authored rooms fall back to `id`.
  const kindOf = (r: SceneRoom): string => r.kind ?? r.id;
  const roomsInWing = (scene.rooms ?? []).filter((r) => wing.roomIds.includes(r.id));
  const seating = roomsInWing.filter((r) => SEATING_ROOM_IDS.has(kindOf(r)));
  const base = (seating.length ? seating : roomsInWing).filter((r) => kindOf(r) !== 'manager-office');
  const useIds = new Set(base.map((r) => r.id));

  const roomAt = (x: number, y: number): string => scene.roomIds?.[y]?.[x] ?? '';
  const cells: DeskCell[] = [];
  const used = new Set<string>();

  const deskCells = scene.entities
    .filter((e) => e.kind === 'prop' && project.props.find((p) => p.id === e.refId)?.templateId === 'desk')
    .map((e) => ({ x: e.x, y: e.y, roomId: roomAt(e.x, e.y) }))
    .filter((c) => useIds.has(c.roomId))
    .sort((a, b) => a.y - b.y || a.x - b.x);
  for (const c of deskCells) {
    const k = `${c.x},${c.y}`;
    if (!used.has(k)) { used.add(k); cells.push(c); }
  }

  // Floor fallback — open floor in the seating rooms, deterministic y,x order.
  for (let y = 0; y < scene.rows; y++) {
    for (let x = 0; x < scene.cols; x++) {
      const rid = roomAt(x, y);
      if (!useIds.has(rid) || scene.wallIds[y][x] || !scene.floorIds[y][x]) continue;
      const k = `${x},${y}`;
      if (!used.has(k)) { used.add(k); cells.push({ x, y, roomId: rid }); }
    }
  }
  return cells;
}

interface WingDeskPlan {
  wing: LayoutWing;
  cells: DeskCell[];
  assigned: Array<{ agentId: string; cell: DeskCell }>;
  /** Assigned agents that didn't get a cell (wing over capacity). */
  shortfall: number;
}

/**
 * Plan desk assignments per wing: each non-manager base-cast agent is seated in
 * its **department's** wing (the catch-all wing when its department has none),
 * deterministically (cast order × y,x cell order). Shared by the anchor emitter
 * and the coverage validator.
 */
function planDesks(scene: SceneState, project: ProjectState): WingDeskPlan[] {
  const wings = computeWings(scene, project);
  if (!wings.length) return [];
  const deptOf = new Map((project.profiles ?? []).map((p) => [p.agentId, p.identity.department || '']));
  const deskAgents = project.characters.filter(
    (recipe) => !recipe.id.startsWith(GENERATED_COWORKER_PREFIX) && recipe.id !== 'manager',
  );
  const fallbackWing = wings.find((w) => w.departmentId === null) ?? wings[0];
  const wingForDept = (dep: string): LayoutWing => wings.find((w) => w.departmentId === dep) ?? fallbackWing;

  const cellsByWing = new Map(wings.map((w) => [w.id, wingSeatCells(scene, project, w)]));
  const cursor = new Map<string, number>();
  const assignedByWing = new Map<string, Array<{ agentId: string; cell: DeskCell }>>();
  const wantByWing = new Map<string, number>();

  for (const recipe of deskAgents) {
    const wing = wingForDept(deptOf.get(recipe.id) ?? '');
    wantByWing.set(wing.id, (wantByWing.get(wing.id) ?? 0) + 1);
    const cells = cellsByWing.get(wing.id) ?? [];
    const i = cursor.get(wing.id) ?? 0;
    cursor.set(wing.id, i + 1);
    const cell = cells[i];
    if (!cell) continue; // wing over capacity — surfaced as shortfall
    (assignedByWing.get(wing.id) ?? assignedByWing.set(wing.id, []).get(wing.id)!).push({ agentId: recipe.id, cell });
  }

  return wings.map((wing) => {
    const cells = cellsByWing.get(wing.id) ?? [];
    const want = wantByWing.get(wing.id) ?? 0;
    return { wing, cells, assigned: assignedByWing.get(wing.id) ?? [], shortfall: Math.max(0, want - cells.length) };
  });
}

/**
 * Derive the named anchors a scenario binds to from a scene. Emits one `room`
 * anchor per room, one `desk:<agentId>` anchor per base-cast member seated **in
 * its own department's wing** (the manager binds to their office, so is excluded),
 * and a few `spare-desk:<wingId>:<n>` anchors per wing for later transfers (E41).
 * Every anchor carries its wing/department identity. Stable, deterministic ids.
 */
export function computeOfficeAnchors(scene: SceneState, project: ProjectState): OfficeAnchor[] {
  const anchors: OfficeAnchor[] = [];
  const wings = computeWings(scene, project);
  const wingOfRoom = new Map<string, LayoutWing>();
  for (const w of wings) for (const rid of w.roomIds) wingOfRoom.set(rid, w);

  for (const room of scene.rooms ?? []) {
    const w = wingOfRoom.get(room.id);
    anchors.push({
      anchorId: room.id,
      roomId: room.id,
      x: Math.floor(room.x + room.cols / 2),
      y: Math.floor(room.y + room.rows / 2),
      kind: 'room',
      wingId: w?.id,
      departmentId: w?.departmentId ?? null,
    });
  }

  for (const plan of planDesks(scene, project)) {
    for (const { agentId, cell } of plan.assigned) {
      anchors.push({ anchorId: `desk:${agentId}`, roomId: cell.roomId, x: cell.x, y: cell.y, kind: 'desk', wingId: plan.wing.id, departmentId: plan.wing.departmentId });
    }
    // Spare desks: the next free cells beyond the assigned ones (≥1 where capacity allows).
    const start = plan.assigned.length;
    const spares = Math.min(SPARE_DESKS_PER_WING, plan.cells.length - start);
    for (let n = 0; n < spares; n++) {
      const cell = plan.cells[start + n];
      anchors.push({ anchorId: `spare-desk:${plan.wing.id}:${n + 1}`, roomId: cell.roomId, x: cell.x, y: cell.y, kind: 'spare-desk', wingId: plan.wing.id, departmentId: plan.wing.departmentId });
    }
  }

  return anchors;
}

/**
 * Flag wings that cannot seat their assigned cast (F1.2 / S1.2.3) — fewer desks
 * (incl. floor fallback) than agents routed to the wing. Empty array = every wing
 * seats its people. Surfaced in the studio before export.
 */
export function validateDeskCoverage(scene: SceneState, project: ProjectState): string[] {
  return planDesks(scene, project)
    .filter((plan) => plan.shortfall > 0)
    .map((plan) => `Wing "${plan.wing.label}" must seat ${plan.assigned.length + plan.shortfall} agents but has only ${plan.cells.length} desk(s) — ${plan.shortfall} short.`);
}

/** Office-chair prop cells inside a wing, grouped by the wing they sit in. */
function chairsByWing(scene: SceneState, project: ProjectState, wings: LayoutWing[]): Map<string, number> {
  const wingOfRoom = new Map<string, string>();
  for (const w of wings) for (const rid of w.roomIds) wingOfRoom.set(rid, w.id);
  const roomAt = (x: number, y: number): string => scene.roomIds?.[y]?.[x] ?? '';
  const counts = new Map<string, number>();
  for (const e of scene.entities) {
    if (e.kind !== 'prop') continue;
    if (project.props.find((p) => p.id === e.refId)?.templateId !== 'office-chair') continue;
    const wingId = wingOfRoom.get(roomAt(e.x, e.y));
    if (wingId) counts.set(wingId, (counts.get(wingId) ?? 0) + 1);
  }
  return counts;
}

/** The wing a department's agents seat in — the department's own wing, else the common/main wing. */
function wingIdForDept(wings: LayoutWing[], dep: string): string | undefined {
  if (!wings.length) return undefined;
  return wings.find((w) => w.departmentId === dep)?.id ?? wings.find((w) => w.departmentId === null)?.id ?? wings[0].id;
}

/**
 * Seat the generated population (F3.4): partition the wing chair `seats` by wing,
 * then assign each agent to a free chair in its department's wing (cast order ×
 * seat y,x), leaving SPARE_DESKS_PER_WING chairs per wing as transfer headroom.
 * Deterministic — only the mood is an rng draw. Agents over capacity stay unseated
 * (surfaced by validatePopulationOccupancy).
 */
function seatGeneratedPopulation(
  scene: SceneState,
  project: ProjectState,
  population: CharacterRecipe[],
  deptOf: Map<string, string>,
  seats: SeatCell[],
  rng: Rng,
  reserveSpares = true,
): void {
  const wings = computeWings(scene, project);
  if (!wings.length) return;
  const wingOfRoom = new Map<string, string>();
  for (const w of wings) for (const rid of w.roomIds) wingOfRoom.set(rid, w.id);
  const roomAt = (x: number, y: number): string => scene.roomIds?.[y]?.[x] ?? '';

  const seatsByWing = new Map<string, SeatCell[]>();
  for (const seat of [...seats].sort((a, b) => a.y - b.y || a.x - b.x)) {
    const wingId = wingOfRoom.get(roomAt(seat.x, seat.y));
    if (!wingId) continue;
    (seatsByWing.get(wingId) ?? seatsByWing.set(wingId, []).get(wingId)!).push(seat);
  }

  // A chair cell carries an office-chair prop you sit ON; only a CHARACTER already
  // there (e.g. a base-cast spawn) blocks the seat.
  const takenByCharacter = (x: number, y: number): boolean =>
    scene.entities.some((e) => e.kind === 'character' && e.x === x && e.y === y);

  // Open floor cells per wing, for standing fallback when desks run out (varied
  // desk styles leave some wings short of chairs — the agent still belongs there).
  const standByWing = new Map<string, Array<{ x: number; y: number }>>();
  for (const cell of openCells(scene)) {
    const wingId = wingOfRoom.get(roomAt(cell.x, cell.y));
    if (wingId) (standByWing.get(wingId) ?? standByWing.set(wingId, []).get(wingId)!).push(cell);
  }
  const standCursor = new Map<string, number>();
  const standFallback = (agent: CharacterRecipe, wingId: string): boolean => {
    const cells = standByWing.get(wingId) ?? [];
    let j = standCursor.get(wingId) ?? 0;
    while (j < cells.length && takenByCharacter(cells[j].x, cells[j].y)) j++;
    standCursor.set(wingId, j + 1);
    if (j >= cells.length) return false;
    addCharacter(scene, project, agent, cells[j].x, cells[j].y, pick(rng, AMBIENT_MOODS), pick(rng, FACINGS));
    return true;
  };

  const cursor = new Map<string, number>();
  for (const agent of population) {
    const wingId = wingIdForDept(wings, deptOf.get(agent.id) ?? '');
    if (!wingId) continue;
    const wingSeats = seatsByWing.get(wingId) ?? [];
    const capacity = reserveSpares ? Math.max(0, wingSeats.length - SPARE_DESKS_PER_WING) : wingSeats.length;
    let i = cursor.get(wingId) ?? 0;
    while (i < capacity && takenByCharacter(wingSeats[i].x, wingSeats[i].y)) i++;
    cursor.set(wingId, i + 1);
    if (i >= capacity) {
      // Out of desks. In dense mode (golden) stand them in their own wing rather
      // than drop them; when reserving spares (default), leave the headroom.
      if (!reserveSpares) standFallback(agent, wingId);
      continue;
    }
    const seat = wingSeats[i];
    addCharacter(scene, project, agent, seat.x, seat.y, pick(rng, AMBIENT_MOODS), seat.facing);
  }
}

/**
 * Flag wings whose generated population (F3.4) exceeds the seatable chairs minus
 * the transfer headroom. Empty array = every generated agent has a plausible home.
 * Auto-derived wings guarantee no empty wing, so this covers the over-capacity end.
 * Surfaced in the studio before export.
 */
export function validatePopulationOccupancy(scene: SceneState, project: ProjectState): string[] {
  const { agents, deptOf } = collectGeneratedPopulation(project);
  if (!agents.length) return [];
  const wings = computeWings(scene, project);
  if (!wings.length) return [];

  const chairs = chairsByWing(scene, project, wings);
  const labelOf = (id: string): string => wings.find((w) => w.id === id)?.label ?? id;
  const demand = new Map<string, number>();
  for (const agent of agents) {
    const wingId = wingIdForDept(wings, deptOf.get(agent.id) ?? '');
    if (wingId) demand.set(wingId, (demand.get(wingId) ?? 0) + 1);
  }

  const issues: string[] = [];
  for (const [wingId, want] of demand) {
    const chairCount = chairs.get(wingId) ?? 0;
    const capacity = Math.max(0, chairCount - SPARE_DESKS_PER_WING);
    if (want > capacity) {
      issues.push(
        `Wing "${labelOf(wingId)}" must seat ${want} generated agent(s) but has ${chairCount} chair(s) (${capacity} after headroom) — ${want - capacity} unseated.`,
      );
    }
  }
  return issues;
}

export function sceneToLayoutJson(scene: SceneState, project: ProjectState): SceneLayoutJson {
  const wallCells: SceneLayoutJson['walls']['cells'] = [];
  for (let y = 0; y < scene.rows; y++) {
    for (let x = 0; x < scene.cols; x++) {
      const wallId = scene.wallIds[y][x];
      if (wallId) wallCells.push({ x, y, wallId, mask: wallMask(scene, x, y) });
    }
  }

  return {
    version: 3,
    source: scene.source,
    generated: scene.generated ?? null,
    cols: scene.cols,
    rows: scene.rows,
    rooms: scene.rooms ?? [],
    roomGrid: scene.roomIds ?? grid<string | null>(scene.cols, scene.rows, null),
    floors: scene.floorIds,
    walls: {
      grid: scene.wallIds,
      cells: wallCells,
    },
    props: scene.entities
      .filter((entity) => entity.kind === 'prop')
      .map((entity) => {
        const prop = project.props.find((item) => item.id === entity.refId);
        return {
          id: entity.id,
          propId: entity.refId,
          templateId: prop?.templateId ?? null,
          name: prop?.name ?? 'Missing prop',
          x: entity.x,
          y: entity.y,
          rotation: entity.rotation,
          projection: propProjection(prop),
          placement: propPlacement(prop),
        };
      }),
    characterSpawns: scene.entities
      .filter((entity) => entity.kind === 'character')
      .map((entity) => {
        const recipe = project.characters.find((item) => item.id === entity.refId);
        return {
          id: entity.id,
          characterId: entity.refId,
          name: recipe?.name ?? 'Missing character',
          x: entity.x,
          y: entity.y,
          facing: entity.facing,
          mood: entity.mood,
          generatedCoworker: entity.refId.startsWith(GENERATED_COWORKER_PREFIX),
        };
      }),
    anchors: computeOfficeAnchors(scene, project),
    interactionAnchors: computeInteractionAnchors(scene, project),
    wings: computeWings(scene, project),
    connectivity: computeWingConnectivity(scene, project),
  };
}
