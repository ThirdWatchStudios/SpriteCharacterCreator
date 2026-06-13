import type {
  AnchorName,
  CharacterRecipe,
  Facing,
  PartVariant,
  PropInstance,
  PropPalette,
  ShapeSpec,
  StyleSheet,
} from './types';
import type { Mood, TileInstance } from './types';
import { CANVAS } from './types';
import { circle, ellipse } from './geometry';
import { getPart } from '../parts/library';
import type { MoodEmote } from '../parts/moods';
import { MOOD_EMOTES, MOOD_OVERLAYS } from '../parts/moods';
import { PROP_TEMPLATES } from '../props/templates';
import { FLOOR_TEMPLATES, WALL_TEMPLATES } from '../tiles/templates';

/**
 * Named attachment points in canvas coordinates, per facing. Moving an anchor
 * moves everything attached to it — parts are never positioned absolutely.
 */
const ANCHORS: Record<Facing, Record<AnchorName, { x: number; y: number }>> = {
  south: {
    body: { x: 64, y: 87 },
    neck: { x: 64, y: 58 },
    headCenter: { x: 64, y: 44 },
    aboveHead: { x: 64, y: 12 },
    chest: { x: 64, y: 80 },
    handRight: { x: 89, y: 99 },
  },
  east: {
    body: { x: 64, y: 87 },
    neck: { x: 64, y: 58 },
    headCenter: { x: 67, y: 44 },
    aboveHead: { x: 67, y: 12 },
    chest: { x: 64, y: 80 },
    handRight: { x: 80, y: 99 },
  },
  north: {
    body: { x: 64, y: 87 },
    neck: { x: 64, y: 58 },
    headCenter: { x: 64, y: 44 },
    aboveHead: { x: 64, y: 12 },
    chest: { x: 64, y: 80 },
    handRight: { x: 89, y: 99 },
  },
};

/** Anchors whose parts belong to the head group (scaled by headScale). */
const HEAD_ANCHORS: AnchorName[] = ['headCenter'];

type ResolveToken = (ref: string) => string;

function makeCharacterResolver(recipe: CharacterRecipe): ResolveToken {
  return (ref) => {
    if (!ref.startsWith('$')) return ref;
    const token = ref.slice(1) as keyof CharacterRecipe['palette'];
    return recipe.palette[token] ?? '#FF00FF'; // magenta = missing token, on purpose
  };
}

function makePropResolver(palette: PropPalette): ResolveToken {
  return (ref) => {
    if (!ref.startsWith('$')) return ref;
    return palette[ref.slice(1) as keyof PropPalette] ?? '#FF00FF';
  };
}

function shapeIsSilhouette(s: ShapeSpec): boolean {
  return s.silhouette !== false;
}

function emitColorShape(s: ShapeSpec, resolve: ResolveToken): string {
  const attrs: string[] = [`d="${s.d}"`];
  attrs.push(`fill="${s.fill ? resolve(s.fill) : 'none'}"`);
  if (s.stroke) {
    attrs.push(`stroke="${resolve(s.stroke)}"`);
    attrs.push(`stroke-width="${s.strokeWidth ?? 1.5}"`);
    attrs.push(`stroke-linecap="round" stroke-linejoin="round"`);
  }
  if (s.opacity !== undefined) attrs.push(`opacity="${s.opacity}"`);
  return `<path ${attrs.join(' ')}/>`;
}

function emitOutlineShape(s: ShapeSpec, style: StyleSheet): string {
  const { width, color } = style.outline;
  if (s.fill) {
    return (
      `<path d="${s.d}" fill="${color}" stroke="${color}" ` +
      `stroke-width="${width * 2}" stroke-linejoin="round" stroke-linecap="round"/>`
    );
  }
  // Stroke-only shape that participates in the silhouette (e.g. mug handle).
  return (
    `<path d="${s.d}" fill="none" stroke="${color}" ` +
    `stroke-width="${(s.strokeWidth ?? 1.5) + width * 2}" stroke-linejoin="round" stroke-linecap="round"/>`
  );
}

interface PlacedPart {
  variant: PartVariant;
  anchor: { x: number; y: number };
  group: 'body' | 'head';
}

/** Mood overlays paint over the head (z 40) but under hair (z 50). */
const MOOD_Z = 45;

function placeParts(recipe: CharacterRecipe, facing: Facing, mood: Mood): PlacedPart[] {
  const ids = [
    recipe.parts.body,
    recipe.parts.outfit,
    ...recipe.parts.accessories,
    recipe.parts.head,
    recipe.parts.hair,
  ];
  const placed: PlacedPart[] = [];
  for (const id of ids) {
    const part = getPart(id);
    if (!part) continue;
    const variant = part.facings[facing];
    if (!variant) continue;
    placed.push({
      variant,
      anchor: ANCHORS[facing][part.anchor],
      group: HEAD_ANCHORS.includes(part.anchor) ? 'head' : 'body',
    });
  }
  // Soft neck shadow cast by the head onto the chest — automatic for every
  // character, sized per facing, scales with bodyWidth via the body group.
  placed.push({
    variant: {
      shapes: [
        {
          d: ellipse(0, -22, facing === 'east' ? 9 : 12, 4),
          fill: '#00000018',
          silhouette: false,
        },
      ],
      z: 35,
    },
    anchor: ANCHORS[facing].body,
    group: 'body',
  });

  const moodShapes = MOOD_OVERLAYS[mood][facing];
  if (moodShapes && moodShapes.length > 0) {
    placed.push({
      variant: { shapes: moodShapes, z: MOOD_Z },
      anchor: ANCHORS[facing].headCenter,
      group: 'head',
    });
  }
  return placed.sort((a, b) => a.variant.z - b.variant.z);
}

function groupTransform(group: 'body' | 'head', facing: Facing, style: StyleSheet): string {
  if (group === 'head') {
    const neck = ANCHORS[facing].neck;
    const s = style.proportions.headScale;
    return `translate(${neck.x} ${neck.y}) scale(${s}) translate(${-neck.x} ${-neck.y})`;
  }
  const s = style.proportions.bodyWidth;
  return `translate(${CANVAS / 2} 0) scale(${s} 1) translate(${-CANVAS / 2} 0)`;
}

function renderPlaced(
  placed: PlacedPart[],
  facing: Facing,
  style: StyleSheet,
  resolve: ResolveToken,
): string {
  const partMarkup = (p: PlacedPart, emit: (s: ShapeSpec) => string, only?: 'silhouette') => {
    const shapes = p.variant.shapes.filter((s) => (only ? shapeIsSilhouette(s) : true));
    if (shapes.length === 0) return '';
    return `<g transform="translate(${p.anchor.x} ${p.anchor.y})">${shapes.map(emit).join('')}</g>`;
  };

  const wrapGroup = (group: 'body' | 'head', inner: string) =>
    inner ? `<g transform="${groupTransform(group, facing, style)}">${inner}</g>` : '';

  const outlineOn = style.outline.width > 0;

  if (style.outline.mode === 'per-part' && outlineOn) {
    // Outline each part just before painting it: internal edges get outlines too.
    const render = (group: 'body' | 'head') =>
      wrapGroup(
        group,
        placed
          .filter((p) => p.group === group)
          .map(
            (p) =>
              partMarkup(p, (s) => emitOutlineShape(s, style), 'silhouette') +
              partMarkup(p, (s) => emitColorShape(s, resolve)),
          )
          .join(''),
      );
    return render('body') + render('head');
  }

  // Silhouette mode: one unified outline underlay beneath all color.
  const layer = (emit: (s: ShapeSpec) => string, only?: 'silhouette') =>
    wrapGroup('body', placed.filter((p) => p.group === 'body').map((p) => partMarkup(p, emit, only)).join('')) +
    wrapGroup('head', placed.filter((p) => p.group === 'head').map((p) => partMarkup(p, emit, only)).join(''));

  const outline = outlineOn ? layer((s) => emitOutlineShape(s, style), 'silhouette') : '';
  const color = layer((s) => emitColorShape(s, resolve));
  return outline + color;
}

/** Style-neutral ink ringing the badge bubble — matches the face overlays. */
const BADGE_INK = '#2C2C2A';

/**
 * The overhead emote badge: a thought-bubble holding the mood glyph. Drawn in
 * canvas coords, undistorted by the body/head group transforms, so it reads
 * crisply at any zoom. Glyph fills/strokes are literal colors, so the resolver
 * is the identity.
 */
function emoteMarkup(emote: MoodEmote, ax: number, ay: number): string {
  const identity: ResolveToken = (ref) => ref;
  const tail =
    `<path d="${circle(0.5, 8.6, 1.7)}" fill="${emote.color}" stroke="${BADGE_INK}" stroke-width="1.2"/>` +
    `<path d="${circle(-0.8, 11.8, 1)}" fill="${emote.color}" stroke="${BADGE_INK}" stroke-width="1"/>`;
  const bubble = `<path d="${circle(0, 0, 8)}" fill="${emote.color}" stroke="${BADGE_INK}" stroke-width="1.5" stroke-linejoin="round"/>`;
  const glyph = emote.glyph.map((s) => emitColorShape(s, identity)).join('');
  return `<g transform="translate(${ax} ${ay})">${tail}${bubble}${glyph}</g>`;
}

function svgWrap(inner: string, pixelSize: number): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CANVAS} ${CANVAS}" ` +
    `width="${pixelSize}" height="${pixelSize}">${inner}</svg>`
  );
}

/** Render one character facing to an SVG string. West = east mirrored. */
export function composeCharacter(
  recipe: CharacterRecipe,
  style: StyleSheet,
  facing: Facing | 'west',
  pixelSize?: number,
  mood: Mood = 'normal',
  opts: { badge?: boolean } = {},
): string {
  const actual: Facing = facing === 'west' ? 'east' : facing;
  const placed = placeParts(recipe, actual, mood);
  let inner = renderPlaced(placed, actual, style, makeCharacterResolver(recipe));
  if (facing === 'west') {
    inner = `<g transform="translate(${CANVAS} 0) scale(-1 1)">${inner}</g>`;
  }
  // The badge sits outside the mirror so its glyph stays upright; mirror only
  // its anchor x so it tracks the head. Facing-independent, drawn above all.
  const emote = MOOD_EMOTES[mood];
  if ((opts.badge ?? true) && emote) {
    const a = ANCHORS[actual].aboveHead;
    inner += emoteMarkup(emote, facing === 'west' ? CANVAS - a.x : a.x, a.y);
  }
  return svgWrap(inner, pixelSize ?? style.render.baseSize);
}

/** Render one wall autotile segment (neighbor mask N=1,E=2,S=4,W=8). */
export function composeWallTile(
  wall: TileInstance,
  style: StyleSheet,
  mask: number,
  pixelSize?: number,
): string {
  const template = WALL_TEMPLATES.find((t) => t.id === wall.templateId);
  if (!template) return svgWrap('', pixelSize ?? style.render.baseSize);
  const shapes = template.build(mask, wall.params, wall.palette);
  const resolve = makePropResolver(wall.palette);
  const outline =
    style.outline.width > 0
      ? shapes
          .filter(shapeIsSilhouette)
          .map((s) => emitOutlineShape(s, style))
          .join('')
      : '';
  const color = shapes.map((s) => emitColorShape(s, resolve)).join('');
  return svgWrap(outline + color, pixelSize ?? style.render.baseSize);
}

/**
 * Raw floor shape markup (no svg wrapper). Callers must clip to the tile —
 * floor patterns draw wrapped copies past the tile edges for seamlessness.
 */
export function floorTileMarkup(floor: TileInstance): string {
  const template = FLOOR_TEMPLATES.find((t) => t.id === floor.templateId);
  if (!template) return '';
  const resolve = makePropResolver(floor.palette);
  return template.build(floor.params, floor.palette).map((s) => emitColorShape(s, resolve)).join('');
}

/** Render a floor tile: flat pattern, no outline pass, seamlessly tileable. */
export function composeFloorTile(floor: TileInstance, style: StyleSheet, pixelSize?: number): string {
  return svgWrap(floorTileMarkup(floor), pixelSize ?? style.render.baseSize);
}

/**
 * Render a whole demo room as ONE svg from a wall layout grid (1 = wall).
 * Masks are computed from neighbors; a single unified outline pass runs under
 * all cells, so runs read as continuous walls with no per-tile seams.
 */
export function composeWallRoom(
  wall: TileInstance,
  style: StyleSheet,
  layout: number[][],
  cellPixelSize: number,
): string {
  const template = WALL_TEMPLATES.find((t) => t.id === wall.templateId);
  const rows = layout.length;
  const cols = layout[0]?.length ?? 0;
  const width = cellPixelSize * cols;
  const height = cellPixelSize * rows;
  const head =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${cols * CANVAS} ${rows * CANVAS}" ` +
    `width="${width}" height="${height}">`;
  if (!template) return `${head}</svg>`;

  const at = (r: number, c: number) => layout[r]?.[c] === 1;
  const cells: Array<{ r: number; c: number; shapes: ShapeSpec[] }> = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!at(r, c)) continue;
      const mask = (at(r - 1, c) ? 1 : 0) | (at(r, c + 1) ? 2 : 0) | (at(r + 1, c) ? 4 : 0) | (at(r, c - 1) ? 8 : 0);
      cells.push({ r, c, shapes: template.build(mask, wall.params, wall.palette) });
    }
  }
  const resolve = makePropResolver(wall.palette);
  const place = (cell: { r: number; c: number }, inner: string) =>
    inner ? `<g transform="translate(${cell.c * CANVAS} ${cell.r * CANVAS})">${inner}</g>` : '';
  const outline =
    style.outline.width > 0
      ? cells.map((cell) => place(cell, cell.shapes.filter(shapeIsSilhouette).map((s) => emitOutlineShape(s, style)).join(''))).join('')
      : '';
  const color = cells.map((cell) => place(cell, cell.shapes.map((s) => emitColorShape(s, resolve)).join(''))).join('');
  return `${head}${outline}${color}</svg>`;
}

/** Render a floor tile repeated cols x rows in ONE svg to prove seamlessness. */
export function composeFloorRepeat(
  floor: TileInstance,
  _style: StyleSheet, // floors ignore outline style, kept for signature parity
  cols: number,
  rows: number,
  cellPixelSize: number,
): string {
  const template = FLOOR_TEMPLATES.find((t) => t.id === floor.templateId);
  const head =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${cols * CANVAS} ${rows * CANVAS}" ` +
    `width="${cellPixelSize * cols}" height="${cellPixelSize * rows}">`;
  if (!template) return `${head}</svg>`;
  const resolve = makePropResolver(floor.palette);
  const inner = template.build(floor.params, floor.palette).map((s) => emitColorShape(s, resolve)).join('');
  // solid backing in the base color kills antialiasing hairlines between copies
  let body = `<rect width="${cols * CANVAS}" height="${rows * CANVAS}" fill="${resolve('$primary')}"/>`;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      body += `<g transform="translate(${c * CANVAS} ${r * CANVAS})">${inner}</g>`;
    }
  }
  return `${head}${body}</svg>`;
}

/** Render a prop instance to an SVG string. */
export function composeProp(prop: PropInstance, style: StyleSheet, pixelSize?: number): string {
  const template = PROP_TEMPLATES.find((t) => t.id === prop.templateId);
  if (!template) return svgWrap('', pixelSize ?? style.render.baseSize);
  const shapes = template.build(prop.params, prop.palette);
  const resolve = makePropResolver(prop.palette);
  const outline =
    style.outline.width > 0
      ? shapes
          .filter(shapeIsSilhouette)
          .map((s) => emitOutlineShape(s, style))
          .join('')
      : '';
  const color = shapes.map((s) => emitColorShape(s, resolve)).join('');
  return svgWrap(outline + color, pixelSize ?? style.render.baseSize);
}
