import type { FloorTemplate, ShapeSpec, WallTemplate } from '../core/types';
import { WALL_BITS } from '../core/types';
import { rr, circle } from '../core/geometry';
import { mulberry32 } from '../core/random';

/**
 * Wall + floor tile templates. Conventions:
 * - Tiles are 128 design units, centered on (64, 64).
 * - Walls: connected arms overdraw the tile edge by OVERHANG so the outline
 *   pass never draws an end-cap stroke at a tile seam — it gets clipped by the
 *   viewBox, and adjacent tiles continue the run.
 * - Floors: every shape is silhouette-free flat pattern, and anything near an
 *   edge is repeated at ±128 so the tile wraps seamlessly.
 */

const C = 64;
const OVERHANG = 16;

/** Axis-aligned arm rects for a neighbor mask, all `fill`-colored. */
function wallArms(mask: number, thickness: number, fill: string): ShapeSpec[] {
  const h = thickness / 2;
  const shapes: ShapeSpec[] = [{ d: rr(C - h, C - h, thickness, thickness, mask === 0 ? 5 : 0), fill }];
  if (mask & WALL_BITS.N) shapes.push({ d: rr(C - h, -OVERHANG, thickness, C + OVERHANG, 0), fill });
  if (mask & WALL_BITS.S) shapes.push({ d: rr(C - h, C, thickness, C + OVERHANG, 0), fill });
  if (mask & WALL_BITS.W) shapes.push({ d: rr(-OVERHANG, C - h, C + OVERHANG, thickness, 0), fill });
  if (mask & WALL_BITS.E) shapes.push({ d: rr(C, C - h, C + OVERHANG, thickness, 0), fill });
  return shapes;
}

/**
 * End-trim caps where a run terminates (cubicle-style): a side gets a cap only
 * when it is unconnected but the opposite side is connected.
 */
function endCaps(mask: number, thickness: number, fill: string): ShapeSpec[] {
  const h = thickness / 2;
  const caps: ShapeSpec[] = [];
  const cap = (x: number, y: number, w: number, hgt: number) => caps.push({ d: rr(x, y, w, hgt, 3), fill });
  if (!(mask & WALL_BITS.E) && mask & WALL_BITS.W) cap(C + h - 2, C - h - 2, 6, thickness + 4);
  if (!(mask & WALL_BITS.W) && mask & WALL_BITS.E) cap(C - h - 4, C - h - 2, 6, thickness + 4);
  if (!(mask & WALL_BITS.N) && mask & WALL_BITS.S) cap(C - h - 2, C - h - 4, thickness + 4, 6);
  if (!(mask & WALL_BITS.S) && mask & WALL_BITS.N) cap(C - h - 2, C + h - 2, thickness + 4, 6);
  return caps;
}

const officeWall: WallTemplate = {
  kind: 'wall',
  id: 'office-wall',
  label: 'Office wall',
  params: [{ key: 'thickness', label: 'Thickness', min: 12, max: 36, step: 2, default: 28 }],
  build(mask, params) {
    const t = params.thickness ?? 28;
    return wallArms(mask, t, '$primary');
  },
};

const glassPartition: WallTemplate = {
  kind: 'wall',
  id: 'glass-partition',
  label: 'Glass partition',
  params: [{ key: 'thickness', label: 'Thickness', min: 8, max: 16, step: 2, default: 10 }],
  build(mask, params) {
    const t = params.thickness ?? 10;
    const h = t / 2;
    const shapes: ShapeSpec[] = wallArms(mask, t, '$secondary').map((s) => ({ ...s, opacity: 0.6 }));
    // mullions: frame ticks along each arm
    const tick = (x: number, y: number, w: number, hgt: number) =>
      shapes.push({ d: rr(x, y, w, hgt, 1), fill: '$primary', silhouette: false });
    for (const off of [22, 64, 106]) {
      if (mask & WALL_BITS.N && off < 64) tick(C - h - 1, off - 2, t + 2, 4);
      if (mask & WALL_BITS.S && off > 64) tick(C - h - 1, off - 2, t + 2, 4);
      if (mask & WALL_BITS.W && off < 64) tick(off - 2, C - h - 1, 4, t + 2);
      if (mask & WALL_BITS.E && off > 64) tick(off - 2, C - h - 1, 4, t + 2);
    }
    // frame post at the junction
    shapes.push({ d: rr(C - h - 1, C - h - 1, t + 2, t + 2, 1.5), fill: '$primary', silhouette: false });
    return shapes;
  },
};

const cubiclePartition: WallTemplate = {
  kind: 'wall',
  id: 'cubicle-partition',
  label: 'Cubicle partition',
  params: [{ key: 'thickness', label: 'Thickness', min: 10, max: 18, step: 2, default: 14 }],
  build(mask, params) {
    const t = params.thickness ?? 14;
    const shapes = wallArms(mask, t, '$primary');
    // fabric inset
    const h = t / 2 - 3;
    if (mask & WALL_BITS.N) shapes.push({ d: rr(C - h, 0, h * 2, C, 0), fill: '#FFFFFF14', silhouette: false });
    if (mask & WALL_BITS.S) shapes.push({ d: rr(C - h, C, h * 2, 64, 0), fill: '#FFFFFF14', silhouette: false });
    if (mask & WALL_BITS.W) shapes.push({ d: rr(0, C - h, C, h * 2, 0), fill: '#FFFFFF14', silhouette: false });
    if (mask & WALL_BITS.E) shapes.push({ d: rr(C, C - h, 64, h * 2, 0), fill: '#FFFFFF14', silhouette: false });
    // end trim + junction post
    shapes.push(...endCaps(mask, t, '$secondary'));
    const bits = [WALL_BITS.N, WALL_BITS.E, WALL_BITS.S, WALL_BITS.W].filter((b) => mask & b).length;
    if (bits >= 3 || mask === 0) {
      shapes.push({ d: rr(C - t / 2 - 2, C - t / 2 - 2, t + 4, t + 4, 4), fill: '$secondary' });
    }
    return shapes;
  },
};

export const WALL_TEMPLATES: WallTemplate[] = [officeWall, glassPartition, cubiclePartition];

// ---------------------------------------------------------------------------
// Floors
// ---------------------------------------------------------------------------

const flat = (d: string, fill: string, opacity?: number): ShapeSpec => ({
  d,
  fill,
  opacity,
  silhouette: false,
});

const carpet: FloorTemplate = {
  kind: 'floor',
  id: 'carpet',
  label: 'Carpet',
  params: [
    { key: 'speckle', label: 'Speckle', min: 0, max: 3, step: 1, default: 2 },
    { key: 'seed', label: 'Pattern seed', min: 1, max: 9, step: 1, default: 3 },
  ],
  build(params) {
    const shapes: ShapeSpec[] = [flat(rr(0, 0, 128, 128, 0), '$primary')];
    const rng = mulberry32((params.seed ?? 3) * 7919);
    const count = (params.speckle ?? 2) * 22;
    for (let i = 0; i < count; i++) {
      const x = rng() * 128;
      const y = rng() * 128;
      const r = 1 + rng() * 1.4;
      const fill = rng() > 0.5 ? '$secondary' : '$accent';
      // draw wrapped copies so speckles tile seamlessly across edges
      for (const dx of [0, -128, 128]) {
        for (const dy of [0, -128, 128]) {
          if (x + dx > -4 && x + dx < 132 && y + dy > -4 && y + dy < 132) {
            shapes.push(flat(circle(x + dx, y + dy, r), fill, 0.55));
          }
        }
      }
    }
    return shapes;
  },
};

const carpetTiles: FloorTemplate = {
  kind: 'floor',
  id: 'carpet-tiles',
  label: 'Carpet tiles',
  params: [{ key: 'contrast', label: 'Checker contrast', min: 1, max: 4, step: 1, default: 2 }],
  build(params) {
    const alpha = (params.contrast ?? 2) * 0.06;
    const a = Math.round(alpha * 255).toString(16).padStart(2, '0');
    return [
      flat(rr(0, 0, 128, 128, 0), '$primary'),
      flat(rr(64, 0, 64, 64, 0), `#000000${a}`),
      flat(rr(0, 64, 64, 64, 0), `#000000${a}`),
      // seams
      { d: 'M 64 0 L 64 128 M 0 64 L 128 64', stroke: '#00000014', strokeWidth: 1.5, silhouette: false },
    ];
  },
};

const woodFloor: FloorTemplate = {
  kind: 'floor',
  id: 'wood-floor',
  label: 'Wood floor',
  params: [{ key: 'seed', label: 'Pattern seed', min: 1, max: 9, step: 1, default: 5 }],
  build(params) {
    const shapes: ShapeSpec[] = [flat(rr(0, 0, 128, 128, 0), '$primary')];
    const rng = mulberry32((params.seed ?? 5) * 104729);
    for (let row = 0; row < 8; row++) {
      const y = row * 16;
      // plank line
      shapes.push({ d: `M 0 ${y} L 128 ${y}`, stroke: '#00000018', strokeWidth: 1.5, silhouette: false });
      // one staggered end-seam per row, wrapped
      const sx = Math.floor(rng() * 8) * 16;
      for (const dx of [0, -128, 128]) {
        if (sx + dx >= -2 && sx + dx <= 130) {
          shapes.push({ d: `M ${sx + dx} ${y} L ${sx + dx} ${y + 16}`, stroke: '#00000018', strokeWidth: 1.5, silhouette: false });
        }
      }
      // occasional grain streak
      if (rng() > 0.5) {
        const gx = rng() * 100 + 10;
        shapes.push({ d: `M ${gx} ${y + 5} L ${gx + 14} ${y + 5}`, stroke: '#00000010', strokeWidth: 2, silhouette: false });
      }
    }
    return shapes;
  },
};

const linoleum: FloorTemplate = {
  kind: 'floor',
  id: 'linoleum',
  label: 'Linoleum',
  params: [{ key: 'grid', label: 'Tile size', min: 16, max: 64, step: 16, default: 32 }],
  build(params) {
    const g = params.grid ?? 32;
    const shapes: ShapeSpec[] = [flat(rr(0, 0, 128, 128, 0), '$primary')];
    for (let v = 0; v <= 128; v += g) {
      shapes.push({ d: `M ${v} 0 L ${v} 128`, stroke: '#00000012', strokeWidth: 2, silhouette: false });
      shapes.push({ d: `M 0 ${v} L 128 ${v}`, stroke: '#00000012', strokeWidth: 2, silhouette: false });
    }
    // soft sheen
    shapes.push(flat(rr(0, 0, 128, 14, 0), '#FFFFFF0A'));
    return shapes;
  },
};

const utilityVinyl: FloorTemplate = {
  kind: 'floor',
  id: 'utility-vinyl',
  label: 'Utility vinyl',
  params: [
    { key: 'grid', label: 'Tile size', min: 16, max: 64, step: 16, default: 32 },
    { key: 'scuff', label: 'Scuff', min: 0, max: 3, step: 1, default: 2 },
    { key: 'seed', label: 'Pattern seed', min: 1, max: 9, step: 1, default: 4 },
  ],
  build(params) {
    const g = params.grid ?? 32;
    const shapes: ShapeSpec[] = [flat(rr(0, 0, 128, 128, 0), '$primary')];
    for (let v = 0; v <= 128; v += g) {
      shapes.push({ d: `M ${v} 0 L ${v} 128`, stroke: '#00000010', strokeWidth: 1.5, silhouette: false });
      shapes.push({ d: `M 0 ${v} L 128 ${v}`, stroke: '#00000010', strokeWidth: 1.5, silhouette: false });
    }
    const rng = mulberry32((params.seed ?? 4) * 65537);
    const count = (params.scuff ?? 2) * 10;
    for (let i = 0; i < count; i++) {
      const x = rng() * 128;
      const y = rng() * 128;
      const w = 4 + rng() * 9;
      const fill = rng() > 0.45 ? '$secondary' : '$accent';
      for (const dx of [0, -128, 128]) {
        for (const dy of [0, -128, 128]) {
          if (x + dx > -12 && x + dx < 140 && y + dy > -4 && y + dy < 132) {
            shapes.push(flat(rr(x + dx, y + dy, w, 1.5, 1), fill, 0.34));
          }
        }
      }
    }
    shapes.push(flat(rr(0, 0, 128, 12, 0), '#FFFFFF08'));
    return shapes;
  },
};

const quietCarpet: FloorTemplate = {
  kind: 'floor',
  id: 'quiet-carpet',
  label: 'Quiet room carpet',
  params: [
    { key: 'weave', label: 'Weave', min: 1, max: 4, step: 1, default: 2 },
    { key: 'seed', label: 'Pattern seed', min: 1, max: 9, step: 1, default: 6 },
  ],
  build(params) {
    const shapes: ShapeSpec[] = [flat(rr(0, 0, 128, 128, 0), '$primary')];
    const step = 16;
    const opacity = 0.06 + (params.weave ?? 2) * 0.025;
    for (let v = -128; v <= 256; v += step) {
      shapes.push({ d: `M ${v} 0 L ${v + 128} 128`, stroke: '$secondary', strokeWidth: 1.2, opacity, silhouette: false });
      shapes.push({ d: `M ${v} 128 L ${v + 128} 0`, stroke: '$accent', strokeWidth: 1, opacity: opacity * 0.8, silhouette: false });
    }
    const rng = mulberry32((params.seed ?? 6) * 31337);
    for (let i = 0; i < 12; i++) {
      const x = rng() * 128;
      const y = rng() * 128;
      for (const dx of [0, -128, 128]) {
        for (const dy of [0, -128, 128]) {
          if (x + dx > -4 && x + dx < 132 && y + dy > -4 && y + dy < 132) {
            shapes.push(flat(circle(x + dx, y + dy, 1.1), '$secondary', 0.32));
          }
        }
      }
    }
    return shapes;
  },
};

export const FLOOR_TEMPLATES: FloorTemplate[] = [
  carpet,
  carpetTiles,
  woodFloor,
  linoleum,
  utilityVinyl,
  quietCarpet,
];

/** Human-readable name for a wall mask, used in atlas JSON. */
export function maskName(mask: number): string {
  if (mask === 0) return 'isolated';
  const dirs = [
    mask & WALL_BITS.N ? 'N' : '',
    mask & WALL_BITS.E ? 'E' : '',
    mask & WALL_BITS.S ? 'S' : '',
    mask & WALL_BITS.W ? 'W' : '',
  ].join('');
  const bits = dirs.length;
  if (bits === 1) return `end-${dirs}`;
  if (mask === 5) return 'straight-NS';
  if (mask === 10) return 'straight-EW';
  if (bits === 2) return `corner-${dirs}`;
  if (bits === 3) return `tee-${dirs}`;
  return 'cross';
}
