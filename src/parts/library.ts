import type { PartDef, Slot } from '../core/types';
import { rr, circle, ellipse, topCap } from '../core/geometry';

/**
 * Part library. Conventions:
 * - Coordinates are part-local; (0,0) is the part's anchor point.
 * - body parts anchor at the body center; the body capsule spans y -29..29.
 * - head/hair/face parts anchor at headCenter; the default head radius is 21.
 * - Fills use '$token' palette references; literals only for style-neutral detail.
 * - z order: body 10, outfit 20, body accessories 30, head 40, hair 50, face gear 60.
 */

const INK = '#2C2C2A'; // eyes / neutral hardware, deliberately palette-independent

// ---------------------------------------------------------------------------
// Bodies (anchor: body). Base capsule is filled with $outfitPrimary because in
// this art style clothing covers the torso, RimWorld-style.
// ---------------------------------------------------------------------------

const BODIES: PartDef[] = [
  {
    id: 'body-standard',
    label: 'Standard',
    slot: 'body',
    anchor: 'body',
    facings: {
      south: { z: 10, shapes: [{ d: rr(-28, -29, 56, 58, 24), fill: '$outfitPrimary' }] },
      north: { z: 10, shapes: [{ d: rr(-28, -29, 56, 58, 24), fill: '$outfitPrimary' }] },
      east: { z: 10, shapes: [{ d: rr(-22, -29, 44, 58, 20), fill: '$outfitPrimary' }] },
    },
  },
  {
    id: 'body-slim',
    label: 'Slim',
    slot: 'body',
    anchor: 'body',
    facings: {
      south: { z: 10, shapes: [{ d: rr(-23, -29, 46, 58, 21), fill: '$outfitPrimary' }] },
      north: { z: 10, shapes: [{ d: rr(-23, -29, 46, 58, 21), fill: '$outfitPrimary' }] },
      east: { z: 10, shapes: [{ d: rr(-18, -29, 36, 58, 17), fill: '$outfitPrimary' }] },
    },
  },
  {
    id: 'body-broad',
    label: 'Broad',
    slot: 'body',
    anchor: 'body',
    facings: {
      south: { z: 10, shapes: [{ d: rr(-32, -29, 64, 58, 26), fill: '$outfitPrimary' }] },
      north: { z: 10, shapes: [{ d: rr(-32, -29, 64, 58, 26), fill: '$outfitPrimary' }] },
      east: { z: 10, shapes: [{ d: rr(-25, -29, 50, 58, 22), fill: '$outfitPrimary' }] },
    },
  },
];

// ---------------------------------------------------------------------------
// Heads (anchor: headCenter). Includes the eyes so eye placement can match the
// head shape; glasses overlay separately.
// ---------------------------------------------------------------------------

const eyeS = (x: number, y: number) => ({ d: circle(x, y, 2.6), fill: INK, silhouette: false });

const BASE_HEADS: Array<{ id: string; label: string; d: string; eastD?: string }> = [
  { id: 'head-round', label: 'Round', d: circle(0, 0, 21) },
  { id: 'head-oval', label: 'Oval', d: ellipse(0, 0, 19, 22) },
  { id: 'head-boxy', label: 'Boxy', d: rr(-19, -20, 38, 40, 13) },
];

const HEADS: PartDef[] = BASE_HEADS.map(({ id, label, d }) => ({
  id,
  label,
  slot: 'head' as Slot,
  anchor: 'headCenter' as const,
  facings: {
    south: { z: 40, shapes: [{ d, fill: '$skin' }, eyeS(-8, 0), eyeS(8, 0)] },
    east: { z: 40, shapes: [{ d, fill: '$skin' }, eyeS(11, 0)] },
    north: { z: 40, shapes: [{ d, fill: '$skin' }] },
  },
}));

// ---------------------------------------------------------------------------
// Hair (anchor: headCenter, head radius 21).
// ---------------------------------------------------------------------------

const HAIR: PartDef[] = [
  {
    id: 'hair-none',
    label: 'None',
    slot: 'hair',
    anchor: 'headCenter',
    facings: {},
  },
  {
    id: 'hair-short',
    label: 'Short',
    slot: 'hair',
    anchor: 'headCenter',
    facings: {
      south: { z: 50, shapes: [{ d: topCap(21, -4), fill: '$hair' }] },
      east: {
        z: 50,
        shapes: [
          { d: topCap(21, -4), fill: '$hair' },
          { d: rr(-21, -6, 8, 14, 4), fill: '$hair' }, // back of head
        ],
      },
      north: { z: 50, shapes: [{ d: topCap(21, 7), fill: '$hair' }] },
    },
  },
  {
    id: 'hair-bob',
    label: 'Bob',
    slot: 'hair',
    anchor: 'headCenter',
    facings: {
      south: {
        z: 50,
        shapes: [
          {
            d:
              `M -23 -4 A 23 23 0 0 1 23 -4 L 23 14 L 12 14 L 12 -2 ` +
              `A 14 14 0 0 0 -12 -2 L -12 14 L -23 14 Z`,
            fill: '$hair',
          },
        ],
      },
      east: {
        z: 50,
        shapes: [
          { d: `M -23 -4 A 23 23 0 0 1 23 -4 L 23 6 L 14 12 L -14 14 L -23 14 Z`, fill: '$hair' },
        ],
      },
      north: {
        z: 50,
        shapes: [{ d: `M -23 -4 A 23 23 0 0 1 23 -4 L 23 16 L -23 16 Z`, fill: '$hair' }],
      },
    },
  },
  {
    id: 'hair-bun',
    label: 'Bun',
    slot: 'hair',
    anchor: 'headCenter',
    facings: {
      south: { z: 50, shapes: [{ d: topCap(21, -4), fill: '$hair' }, { d: circle(0, -26, 8), fill: '$hair' }] },
      east: {
        z: 50,
        shapes: [
          { d: topCap(21, -4), fill: '$hair' },
          { d: rr(-21, -6, 8, 12, 4), fill: '$hair' },
          { d: circle(-15, -19, 8), fill: '$hair' },
        ],
      },
      north: { z: 50, shapes: [{ d: topCap(21, 4), fill: '$hair' }, { d: circle(0, -26, 8), fill: '$hair' }] },
    },
  },
  {
    id: 'hair-curly',
    label: 'Curly',
    slot: 'hair',
    anchor: 'headCenter',
    facings: {
      south: {
        z: 50,
        shapes: [
          { d: topCap(21, -4), fill: '$hair' },
          { d: circle(-15, -9, 9), fill: '$hair' },
          { d: circle(-8, -16, 9), fill: '$hair' },
          { d: circle(0, -18, 9), fill: '$hair' },
          { d: circle(8, -16, 9), fill: '$hair' },
          { d: circle(15, -9, 9), fill: '$hair' },
        ],
      },
      east: {
        z: 50,
        shapes: [
          { d: topCap(21, -4), fill: '$hair' },
          { d: circle(-12, -12, 9), fill: '$hair' },
          { d: circle(-2, -17, 9), fill: '$hair' },
          { d: circle(9, -14, 9), fill: '$hair' },
          { d: circle(-17, -2, 8), fill: '$hair' },
        ],
      },
      north: {
        z: 50,
        shapes: [
          { d: topCap(21, 6), fill: '$hair' },
          { d: circle(-14, -10, 9), fill: '$hair' },
          { d: circle(0, -16, 10), fill: '$hair' },
          { d: circle(14, -10, 9), fill: '$hair' },
        ],
      },
    },
  },
  {
    id: 'hair-balding',
    label: 'Balding',
    slot: 'hair',
    anchor: 'headCenter',
    facings: {
      south: {
        z: 50,
        shapes: [
          { d: ellipse(-19, 3, 5, 9), fill: '$hair' },
          { d: ellipse(19, 3, 5, 9), fill: '$hair' },
        ],
      },
      east: { z: 50, shapes: [{ d: ellipse(-16, 3, 6, 9), fill: '$hair' }] },
      north: {
        z: 50,
        shapes: [
          { d: `M -20 -3 A 20 20 0 0 0 20 -3 L 20 10 L -20 10 Z`, fill: '$hair' },
        ],
      },
    },
  },
];

// ---------------------------------------------------------------------------
// Outfits (anchor: body). Drawn over the $outfitPrimary body capsule; body top
// edge is y = -29.
// ---------------------------------------------------------------------------

const OUTFITS: PartDef[] = [
  {
    id: 'outfit-tee',
    label: 'Crew tee',
    slot: 'outfit',
    anchor: 'body',
    facings: {
      south: { z: 20, shapes: [{ d: `M -8 -29 A 8 7 0 0 0 8 -29 Z`, fill: '$skin', silhouette: false }] },
      north: { z: 20, shapes: [] },
      east: { z: 20, shapes: [] },
    },
  },
  {
    id: 'outfit-blazer',
    label: 'Blazer',
    slot: 'outfit',
    anchor: 'body',
    facings: {
      south: {
        z: 20,
        shapes: [
          { d: `M -11 -29 L 0 -8 L 11 -29 Z`, fill: '$outfitSecondary', silhouette: false },
          { d: circle(0, 0, 1.8), fill: '#00000033', silhouette: false },
          { d: circle(0, 8, 1.8), fill: '#00000033', silhouette: false },
        ],
      },
      north: {
        z: 20,
        shapes: [{ d: `M 0 -26 L 0 24`, stroke: '#00000022', strokeWidth: 2, silhouette: false }],
      },
      east: {
        z: 20,
        shapes: [{ d: `M 12 -28 L 18 -12 L 21 -28 Z`, fill: '$outfitSecondary', silhouette: false }],
      },
    },
  },
  {
    id: 'outfit-polo',
    label: 'Polo',
    slot: 'outfit',
    anchor: 'body',
    facings: {
      south: {
        z: 20,
        shapes: [
          { d: `M -10 -29 L 0 -15 L 10 -29 Z`, fill: '$outfitSecondary', silhouette: false },
          { d: `M 0 -15 L 0 -6`, stroke: '#00000026', strokeWidth: 2, silhouette: false },
        ],
      },
      north: {
        z: 20,
        shapes: [{ d: rr(-11, -29, 22, 5, 2), fill: '$outfitSecondary', silhouette: false }],
      },
      east: {
        z: 20,
        shapes: [{ d: `M 11 -29 L 17 -17 L 20 -29 Z`, fill: '$outfitSecondary', silhouette: false }],
      },
    },
  },
  {
    id: 'outfit-cardigan',
    label: 'Cardigan',
    slot: 'outfit',
    anchor: 'body',
    facings: {
      south: {
        z: 20,
        shapes: [
          { d: `M -7 -29 L 0 -18 L 7 -29 Z`, fill: '$outfitSecondary', silhouette: false },
          { d: `M 0 -18 L 0 26`, stroke: '#00000030', strokeWidth: 2.5, silhouette: false },
          { d: circle(-3, -4, 1.6), fill: '#00000033', silhouette: false },
          { d: circle(-3, 6, 1.6), fill: '#00000033', silhouette: false },
        ],
      },
      north: { z: 20, shapes: [] },
      east: {
        z: 20,
        shapes: [{ d: `M 14 -24 L 14 20`, stroke: '#00000030', strokeWidth: 2.5, silhouette: false }],
      },
    },
  },
  {
    id: 'outfit-shirt-tie',
    label: 'Shirt & tie',
    slot: 'outfit',
    anchor: 'body',
    facings: {
      south: {
        z: 20,
        shapes: [
          { d: `M -11 -29 L 0 -11 L 11 -29 Z`, fill: '$outfitSecondary', silhouette: false },
          { d: `M -3.5 -28 L 3.5 -28 L 4.5 -10 L 0 -4 L -4.5 -10 Z`, fill: '$accent', silhouette: false },
        ],
      },
      north: {
        z: 20,
        shapes: [{ d: rr(-10, -29, 20, 4, 2), fill: '$outfitSecondary', silhouette: false }],
      },
      east: {
        z: 20,
        shapes: [
          { d: `M 12 -28 L 17 -14 L 20 -28 Z`, fill: '$outfitSecondary', silhouette: false },
          { d: `M 15 -22 L 18 -10 L 14 -8 Z`, fill: '$accent', silhouette: false },
        ],
      },
    },
  },
];

// ---------------------------------------------------------------------------
// Accessories.
// ---------------------------------------------------------------------------

const ACCESSORIES: PartDef[] = [
  {
    id: 'acc-glasses',
    label: 'Glasses',
    slot: 'accessory',
    anchor: 'headCenter',
    facings: {
      south: {
        z: 60,
        shapes: [
          { d: circle(-8, 0, 6), stroke: INK, strokeWidth: 2, silhouette: false },
          { d: circle(8, 0, 6), stroke: INK, strokeWidth: 2, silhouette: false },
          { d: `M -2 0 L 2 0`, stroke: INK, strokeWidth: 2, silhouette: false },
        ],
      },
      east: {
        z: 60,
        shapes: [
          { d: circle(11, 0, 6), stroke: INK, strokeWidth: 2, silhouette: false },
          { d: `M 5 -1 L -8 -3`, stroke: INK, strokeWidth: 2, silhouette: false },
        ],
      },
    },
  },
  {
    id: 'acc-lanyard',
    label: 'Lanyard',
    slot: 'accessory',
    anchor: 'body',
    facings: {
      south: {
        z: 30,
        shapes: [
          { d: `M -9 -28 L -4 -8 M 9 -28 L 4 -8`, stroke: '$accent', strokeWidth: 2.5, silhouette: false },
          { d: rr(-7, -8, 14, 11, 2), fill: '#F7F4EC', silhouette: false },
          { d: rr(-4.5, -5.5, 5, 6, 1), fill: '$skin', silhouette: false },
        ],
      },
      north: {
        z: 30,
        shapes: [{ d: `M -9 -27 A 11 6 0 0 0 9 -27`, stroke: '$accent', strokeWidth: 2.5, silhouette: false }],
      },
      east: {
        z: 30,
        shapes: [
          { d: `M 12 -27 L 14 -8`, stroke: '$accent', strokeWidth: 2.5, silhouette: false },
          { d: rr(10, -8, 9, 11, 2), fill: '#F7F4EC', silhouette: false },
        ],
      },
    },
  },
  {
    id: 'acc-mug',
    label: 'Coffee mug',
    slot: 'accessory',
    anchor: 'handRight',
    facings: {
      south: {
        z: 30,
        shapes: [
          { d: circle(9, 0, 4.5), stroke: '$accent', strokeWidth: 2.5 },
          { d: rr(-6, -7, 13, 14, 2), fill: '$accent' },
        ],
      },
      east: {
        z: 30,
        shapes: [
          { d: circle(8, 0, 4.5), stroke: '$accent', strokeWidth: 2.5 },
          { d: rr(-6, -7, 12, 14, 2), fill: '$accent' },
        ],
      },
    },
  },
  {
    id: 'acc-badge',
    label: 'Badge clip',
    slot: 'accessory',
    anchor: 'chest',
    facings: {
      south: {
        z: 30,
        shapes: [
          { d: rr(8, -4, 11, 8, 1.5), fill: '#F7F4EC', silhouette: false },
          { d: `M 13 -4 L 13 -8`, stroke: INK, strokeWidth: 1.5, silhouette: false },
        ],
      },
      east: {
        z: 30,
        shapes: [{ d: rr(8, -4, 8, 8, 1.5), fill: '#F7F4EC', silhouette: false }],
      },
    },
  },
  {
    id: 'acc-headset',
    label: 'Headset',
    slot: 'accessory',
    anchor: 'headCenter',
    facings: {
      south: {
        z: 60,
        shapes: [
          { d: `M -21 -6 A 22 22 0 0 1 21 -6`, stroke: INK, strokeWidth: 3, silhouette: false },
          { d: ellipse(-20, 0, 3.5, 5), fill: INK },
          { d: ellipse(20, 0, 3.5, 5), fill: INK },
          { d: `M 19 5 Q 16 14 6 12`, stroke: INK, strokeWidth: 2, silhouette: false },
          { d: circle(5, 12, 2.5), fill: INK, silhouette: false },
        ],
      },
      east: {
        z: 60,
        shapes: [
          { d: `M -18 -10 A 20 20 0 0 1 16 -12`, stroke: INK, strokeWidth: 3, silhouette: false },
          { d: ellipse(-2, -2, 4, 5.5), fill: INK },
          { d: `M 0 3 Q 6 12 14 10`, stroke: INK, strokeWidth: 2, silhouette: false },
          { d: circle(15, 10, 2.5), fill: INK, silhouette: false },
        ],
      },
      north: {
        z: 60,
        shapes: [
          { d: `M -21 -6 A 22 22 0 0 1 21 -6`, stroke: INK, strokeWidth: 3, silhouette: false },
          { d: ellipse(-20, 0, 3.5, 5), fill: INK },
          { d: ellipse(20, 0, 3.5, 5), fill: INK },
        ],
      },
    },
  },
];

export const PART_LIBRARY: PartDef[] = [...BODIES, ...HEADS, ...HAIR, ...OUTFITS, ...ACCESSORIES];

const byId = new Map(PART_LIBRARY.map((p) => [p.id, p]));

export function getPart(id: string): PartDef | undefined {
  return byId.get(id);
}

export function partsForSlot(slot: Slot): PartDef[] {
  return PART_LIBRARY.filter((p) => p.slot === slot);
}
