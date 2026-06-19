import type { CharacterRecipe, Facing, Mood, ProjectState, PropInstance, TileInstance } from './types';
import { CANVAS } from './types';
import { composeCharacter, composeFloorTile, composeProp, composeWallTile, floorTileMarkup } from './compositor';
import { PROP_TEMPLATES } from '../props/templates';
import { MOOD_EMOTES } from '../parts/moods';

export type SceneBrush = 'floor' | 'wall' | 'prop' | 'character';
export type SceneFacing = Facing | 'west';
export type SceneRotation = 0 | 90 | 180 | 270;

export interface SceneRoom {
  id: string;
  label: string;
  x: number;
  y: number;
  cols: number;
  rows: number;
  /**
   * Department-catalog id this room's wing belongs to (Epic 1 F1.1). Optional —
   * a room without one falls into the implicit common/main wing, so existing
   * single-office templates are unchanged. The cascade (E0) / multi-wing
   * templates (F1.4) set it; `computeWings` groups by it.
   */
  departmentId?: string;
}

export interface SceneEntity {
  id: string;
  kind: 'prop' | 'character';
  x: number;
  y: number;
  refId: string;
  facing: SceneFacing;
  mood: Mood;
  rotation: SceneRotation;
}

export interface SceneState {
  cols: number;
  rows: number;
  floorIds: Array<Array<string | null>>;
  wallIds: Array<Array<string | null>>;
  entities: SceneEntity[];
  rooms?: SceneRoom[];
  roomIds?: Array<Array<string | null>>;
  source?: 'starter' | 'generated' | 'hand-authored';
  /** Set for generated layouts: same template + seed regenerates this exact office. */
  generated?: { templateId: string; seed: number };
}

const DEFAULT_COLS = 12;
const DEFAULT_ROWS = 8;

function grid<T>(cols: number, rows: number, value: T): T[][] {
  return Array.from({ length: rows }, () => Array.from({ length: cols }, () => value));
}

function firstId<T extends { id: string }>(items: T[], preferred: string): string | null {
  return items.find((item) => item.id === preferred)?.id ?? items[0]?.id ?? null;
}

function propId(project: ProjectState, preferred: string): string | null {
  return firstId(project.props, preferred);
}

function characterId(project: ProjectState, preferred: string): string | null {
  return firstId(project.characters, preferred);
}

/** A hand-authored starter scene that immediately tests sprites together. */
export function createDefaultScene(project: ProjectState): SceneState {
  const cols = DEFAULT_COLS;
  const rows = DEFAULT_ROWS;
  const carpet = firstId(project.floors, 'floor-carpet');
  const linoleum = firstId(project.floors, 'floor-linoleum') ?? carpet;
  const floorIds = grid(cols, rows, carpet);

  if (linoleum) {
    for (let y = 1; y <= 3; y++) {
      for (let x = 8; x <= 10; x++) floorIds[y][x] = linoleum;
    }
  }

  const officeWall = firstId(project.walls, 'wall-office');
  const cubicleWall = firstId(project.walls, 'wall-cubicle') ?? officeWall;
  const glassWall = firstId(project.walls, 'wall-glass') ?? officeWall;
  const wallIds = grid<string | null>(cols, rows, null);
  if (officeWall) {
    for (let x = 0; x < cols; x++) {
      wallIds[0][x] = officeWall;
      wallIds[rows - 1][x] = officeWall;
    }
    for (let y = 0; y < rows; y++) {
      wallIds[y][0] = officeWall;
      wallIds[y][cols - 1] = officeWall;
    }
  }
  if (cubicleWall) {
    for (const [x, y] of [
      [4, 2],
      [4, 3],
      [4, 4],
      [5, 4],
      [6, 4],
      [7, 4],
    ]) {
      wallIds[y][x] = cubicleWall;
    }
  }
  if (glassWall) {
    for (const [x, y] of [
      [7, 1],
      [7, 2],
      [7, 3],
    ]) {
      wallIds[y][x] = glassWall;
    }
  }

  const entities: SceneEntity[] = [];
  const addProp = (id: string, x: number, y: number, rotation: SceneRotation = 0) => {
    const refId = propId(project, id);
    if (refId) {
      entities.push({
        id: `scene-prop-${id}-${x}-${y}`,
        kind: 'prop',
        x,
        y,
        refId,
        facing: 'south',
        mood: 'normal',
        rotation,
      });
    }
  };
  const addCharacter = (id: string, x: number, y: number, mood: Mood, facing: SceneFacing = 'south') => {
    const refId = characterId(project, id);
    if (refId) entities.push({ id: `scene-character-${id}-${x}-${y}`, kind: 'character', x, y, refId, facing, mood, rotation: 0 });
  };

  addProp('prop-reception-desk', 2, 2);
  addProp('prop-desk', 5, 2);
  addProp('prop-desk-clutter', 5, 2);
  addProp('prop-office-chair', 5, 3);
  addProp('prop-printer', 3, 5);
  addProp('prop-door', 7, 3, 90);
  addProp('prop-open-door', 4, 4);
  addProp('prop-window', 7, 1, 90);
  addProp('prop-nameplate', 6, 1);
  addProp('prop-hvac-vent', 9, 0);
  addProp('prop-water-cooler', 8, 2);
  addProp('prop-coffee-machine', 9, 2);
  addProp('prop-fridge', 10, 2);
  addProp('prop-vending-machine', 10, 3);
  addProp('prop-rug', 8, 5);
  addProp('prop-conference-table', 8, 5);
  addProp('prop-couch', 10, 5);
  addProp('prop-office-plant', 2, 5);
  addCharacter('janice', 6, 5, 'suspicious', 'west');
  addCharacter('carl', 7, 5, 'curious', 'east');
  addCharacter('linda', 8, 4, 'defensive', 'south');
  addCharacter('manager', 9, 5, 'hostile', 'south');

  return { cols, rows, floorIds, wallIds, entities, source: 'starter' };
}

export function clearSceneCell(scene: SceneState, x: number, y: number): void {
  scene.floorIds[y][x] = null;
  scene.wallIds[y][x] = null;
  scene.entities = scene.entities.filter((entity) => entity.x !== x || entity.y !== y);
}

export function clearSceneBrush(scene: SceneState, x: number, y: number, brush: SceneBrush): void {
  if (brush === 'floor') scene.floorIds[y][x] = null;
  else if (brush === 'wall') scene.wallIds[y][x] = null;
  else if (brush === 'prop') {
    scene.entities = scene.entities.filter((entity) => entity.kind !== 'prop' || entity.x !== x || entity.y !== y);
  } else {
    scene.entities = scene.entities.filter((entity) => entity.kind !== 'character' || entity.x !== x || entity.y !== y);
  }
}

export function stampFloor(scene: SceneState, x: number, y: number, floor: TileInstance | undefined): void {
  if (floor) scene.floorIds[y][x] = floor.id;
}

export function stampWall(scene: SceneState, x: number, y: number, wall: TileInstance | undefined): void {
  if (wall) scene.wallIds[y][x] = wall.id;
}

export function stampProp(scene: SceneState, x: number, y: number, prop: PropInstance | undefined): void {
  if (!prop) return;
  scene.entities = scene.entities.filter((entity) => entity.kind !== 'prop' || entity.x !== x || entity.y !== y);
  scene.entities.push({
    id: `scene-prop-${Date.now().toString(36)}`,
    kind: 'prop',
    x,
    y,
    refId: prop.id,
    facing: 'south',
    mood: 'normal',
    rotation: 0,
  });
}

export function stampCharacter(
  scene: SceneState,
  x: number,
  y: number,
  recipe: CharacterRecipe | undefined,
  facing: SceneFacing,
  mood: Mood,
): void {
  if (!recipe) return;
  scene.entities = scene.entities.filter((entity) => entity.kind !== 'character' || entity.x !== x || entity.y !== y);
  scene.entities.push({
    id: `scene-character-${Date.now().toString(36)}`,
    kind: 'character',
    x,
    y,
    refId: recipe.id,
    facing,
    mood,
    rotation: 0,
  });
}

function wallAt(scene: SceneState, x: number, y: number): boolean {
  return Boolean(scene.wallIds[y]?.[x]);
}

/**
 * A threshold is an open tile sitting in a 1- or 2-tile gap within a wall run
 * (a doorway). The gap must be genuinely bounded — a far wall (distance 2)
 * only counts alongside a near wall on the opposite side — so a plain tile in
 * a 3-wide room between walls doesn't qualify.
 */
function isThreshold(scene: SceneState, x: number, y: number): boolean {
  if (wallAt(scene, x, y)) return false;
  const gap = (w1: boolean, w2: boolean, e1: boolean, e2: boolean) => (w1 && e1) || (w1 && e2) || (e1 && w2);
  return (
    gap(wallAt(scene, x - 1, y), wallAt(scene, x - 2, y), wallAt(scene, x + 1, y), wallAt(scene, x + 2, y)) ||
    gap(wallAt(scene, x, y - 1), wallAt(scene, x, y - 2), wallAt(scene, x, y + 1), wallAt(scene, x, y + 2))
  );
}

/**
 * For wall autotiling, a tile carrying a DOOR counts as a wall connection, so
 * the wall extends an arm up to the door frame instead of retracting to its
 * centre block and leaving a floor gap. Only real doors qualify — NOT every
 * threshold-shaped gap, or the 2-tile openings between cubicle partition
 * spines would sprout connector arms and lattice.
 */
function wallConnects(scene: SceneState, doors: Set<string>, x: number, y: number): boolean {
  return wallAt(scene, x, y) || doors.has(`${x},${y}`);
}

function wallMask(scene: SceneState, doors: Set<string>, x: number, y: number): number {
  return (
    (wallConnects(scene, doors, x, y - 1) ? 1 : 0) |
    (wallConnects(scene, doors, x + 1, y) ? 2 : 0) |
    (wallConnects(scene, doors, x, y + 1) ? 4 : 0) |
    (wallConnects(scene, doors, x - 1, y) ? 8 : 0)
  );
}

function svgAt(svg: string, x: number, y: number, rotation: SceneRotation = 0): string {
  const rotate = rotation ? ` rotate(${rotation} ${CANVAS / 2} ${CANVAS / 2})` : '';
  return `<g transform="translate(${x * CANVAS} ${y * CANVAS})${rotate}">${svg}</g>`;
}

function findProp(project: ProjectState, id: string): PropInstance | undefined {
  return project.props.find((prop) => prop.id === id);
}

function findCharacter(project: ProjectState, id: string): CharacterRecipe | undefined {
  return project.characters.find((recipe) => recipe.id === id);
}

function propProjection(prop: PropInstance | undefined): 'plan' | 'elevation' {
  return PROP_TEMPLATES.find((template) => template.id === prop?.templateId)?.projection ?? 'elevation';
}

export function composeSceneSvg(scene: SceneState, project: ProjectState, cellPixelSize: number): string {
  const width = scene.cols * CANVAS;
  const height = scene.rows * CANVAS;
  let body = `<rect width="${width}" height="${height}" fill="#181614"/>`;

  // Tiles carrying a door — walls extend an arm up to these (closes the gap
  // beside a door) but not to other gaps (keeps cubicle openings clean).
  const doorTiles = new Set<string>();
  for (const entity of scene.entities) {
    if (entity.kind === 'prop' && findProp(project, entity.refId)?.templateId === 'door') {
      doorTiles.add(`${entity.x},${entity.y}`);
    }
  }

  // Keep floors inside their wall bounds. Walls sit mid-tile, so every tile
  // near a wall resolves its floor PER QUADRANT: each 64x64 corner of the
  // tile shows the floor of the region it actually faces — the orthogonal
  // neighbor when one side is open, the diagonal neighbor at corners and
  // junctions, and nothing at all outside the building. Floor tiles are
  // seamless, so a borrowed quadrant matches the neighbor's tiles exactly
  // and every seam hides under a wall arm.
  const HALF = CANVAS / 2;
  const QUADS = [
    { dx: -1, dy: -1, x: 0, y: 0 },
    { dx: 1, dy: -1, x: HALF, y: 0 },
    { dx: -1, dy: 1, x: 0, y: HALF },
    { dx: 1, dy: 1, x: HALF, y: HALF },
  ];
  const markupCache = new Map<string, string>();
  const floorMarkup = (id: string): string => {
    if (!markupCache.has(id)) {
      const f = project.floors.find((item) => item.id === id);
      markupCache.set(id, f ? floorTileMarkup(f) : '');
    }
    return markupCache.get(id)!;
  };
  /** 'out' = off the grid, 'wall' = wall tile, otherwise the tile's floor id. */
  const cellInfo = (cx: number, cy: number): string | null => {
    if (cx < 0 || cy < 0 || cx >= scene.cols || cy >= scene.rows) return 'out';
    if (scene.wallIds[cy][cx]) return 'wall';
    return scene.floorIds[cy][cx];
  };

  for (let y = 0; y < scene.rows; y++) {
    for (let x = 0; x < scene.cols; x++) {
      const own = scene.floorIds[y][x];
      const isWall = wallAt(scene, x, y);
      // Quadrant splitting applies ONLY where a wall line passes through the
      // tile: wall tiles themselves, and thresholds (doorway gaps).
      const threshold = isThreshold(scene, x, y);
      const floor = project.floors.find((item) => item.id === own);
      if (!isWall && !threshold) {
        if (floor) body += svgAt(composeFloorTile(floor, project.style, CANVAS), x, y);
        continue;
      }

      const resolved = QUADS.map((q) => {
        const a = cellInfo(x + q.dx, y);
        const b = cellInfo(x, y + q.dy);
        const d = cellInfo(x + q.dx, y + q.dy);
        const dOpen = d !== 'wall' && d !== 'out';
        // bordering the outside: walls clip the world, open tiles keep their own floor
        if (a === 'out' || b === 'out') return isWall ? null : own;
        const aOpen = a !== 'wall';
        const bOpen = b !== 'wall';
        if (aOpen && bOpen) return dOpen ? d : a; // wrap-around region (e.g. wide doorways)
        if (aOpen) return a;
        if (bOpen) return b;
        return dOpen ? d : own; // fully cornered: diagonal room, else own
      });

      if (resolved.every((id) => id === own)) {
        if (floor) body += svgAt(composeFloorTile(floor, project.style, CANVAS), x, y);
        continue;
      }
      let cell = '';
      QUADS.forEach((q, i) => {
        const id = resolved[i];
        if (!id) return;
        cell +=
          `<svg x="${q.x}" y="${q.y}" width="${HALF}" height="${HALF}" ` +
          `viewBox="${q.x} ${q.y} ${HALF} ${HALF}">${floorMarkup(id)}</svg>`;
      });
      if (cell) body += svgAt(cell, x, y);
    }
  }

  for (let y = 0; y < scene.rows; y++) {
    for (let x = 0; x < scene.cols; x++) {
      const wall = project.walls.find((item) => item.id === scene.wallIds[y][x]);
      if (wall) body += svgAt(composeWallTile(wall, project.style, wallMask(scene, doorTiles, x, y), CANVAS), x, y);
    }
  }

  const props = scene.entities.filter((entity) => entity.kind === 'prop');
  for (const entity of props) {
    const prop = findProp(project, entity.refId);
    if (prop && propProjection(prop) === 'plan') {
      body += svgAt(composeProp(prop, project.style, CANVAS), entity.x, entity.y, entity.rotation);
    }
  }

  const ySorted = scene.entities
    .filter((entity) => entity.kind === 'character' || propProjection(findProp(project, entity.refId)) === 'elevation')
    .sort((a, b) => a.y - b.y || a.x - b.x);

  for (const entity of ySorted) {
    if (entity.kind === 'character') {
      const recipe = findCharacter(project, entity.refId);
      if (recipe) body += svgAt(composeCharacter(recipe, project.style, entity.facing, CANVAS, entity.mood), entity.x, entity.y);
    } else {
      const prop = findProp(project, entity.refId);
      if (prop) body += svgAt(composeProp(prop, project.style, CANVAS), entity.x, entity.y);
    }
  }

  body += ambientTint(scene, project, width, height);

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" ` +
    `width="${scene.cols * cellPixelSize}" height="${scene.rows * cellPixelSize}">${body}</svg>`
  );
}

/**
 * A whole-scene wash tinted by the dominant character mood, painted over
 * everything (characters included) at style.render.ambientTint opacity. Uses the
 * mood emote colors so the tint reads the same hue as the badges. 'normal' has
 * no emote color and never tints, so a calm room stays untinted; ties fall to
 * the first mood encountered in MOODS order.
 */
function ambientTint(scene: SceneState, project: ProjectState, width: number, height: number): string {
  const strength = project.style.render.ambientTint ?? 0;
  if (strength <= 0) return '';
  const counts = new Map<Mood, number>();
  for (const entity of scene.entities) {
    if (entity.kind !== 'character') continue;
    if (!MOOD_EMOTES[entity.mood]) continue; // skip 'normal' (no tint hue)
    counts.set(entity.mood, (counts.get(entity.mood) ?? 0) + 1);
  }
  let best: Mood | null = null;
  let bestCount = 0;
  for (const [mood, count] of counts) {
    if (count > bestCount) {
      best = mood;
      bestCount = count;
    }
  }
  if (!best) return '';
  const color = MOOD_EMOTES[best]!.color;
  return `<rect width="${width}" height="${height}" fill="${color}" opacity="${strength}"/>`;
}
