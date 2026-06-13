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
      south: { z: 10, shapes: [{ d: rr(-28, -29, 56, 58, 24), fill: '$outfitPrimary' }, { d: ellipse(0, 20, 18, 8), fill: '#00000012', silhouette: false }] },
      north: { z: 10, shapes: [{ d: rr(-28, -29, 56, 58, 24), fill: '$outfitPrimary' }, { d: ellipse(0, 20, 18, 8), fill: '#00000012', silhouette: false }] },
      east: { z: 10, shapes: [{ d: rr(-22, -29, 44, 58, 20), fill: '$outfitPrimary' }, { d: ellipse(0, 20, 12, 8), fill: '#00000012', silhouette: false }] },
    },
  },
  {
    id: 'body-slim',
    label: 'Slim',
    slot: 'body',
    anchor: 'body',
    facings: {
      south: { z: 10, shapes: [{ d: rr(-23, -29, 46, 58, 21), fill: '$outfitPrimary' }, { d: ellipse(0, 20, 13, 8), fill: '#00000012', silhouette: false }] },
      north: { z: 10, shapes: [{ d: rr(-23, -29, 46, 58, 21), fill: '$outfitPrimary' }, { d: ellipse(0, 20, 13, 8), fill: '#00000012', silhouette: false }] },
      east: { z: 10, shapes: [{ d: rr(-18, -29, 36, 58, 17), fill: '$outfitPrimary' }, { d: ellipse(0, 20, 11, 8), fill: '#00000012', silhouette: false }] },
    },
  },
  {
    id: 'body-broad',
    label: 'Broad',
    slot: 'body',
    anchor: 'body',
    facings: {
      south: { z: 10, shapes: [{ d: rr(-32, -29, 64, 58, 26), fill: '$outfitPrimary' }, { d: ellipse(0, 20, 20, 8), fill: '#00000012', silhouette: false }] },
      north: { z: 10, shapes: [{ d: rr(-32, -29, 64, 58, 26), fill: '$outfitPrimary' }, { d: ellipse(0, 20, 20, 8), fill: '#00000012', silhouette: false }] },
      east: { z: 10, shapes: [{ d: rr(-25, -29, 50, 58, 22), fill: '$outfitPrimary' }, { d: ellipse(0, 20, 15, 8), fill: '#00000012', silhouette: false }] },
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
  { id: 'head-long', label: 'Long', d: ellipse(0, 1, 17, 24), eastD: ellipse(1, 1, 16, 24) },
  {
    id: 'head-angular',
    label: 'Angular',
    d: `M -16 -17 L 9 -20 L 19 -8 L 17 12 L 7 22 L -10 20 L -20 8 L -20 -7 Z`,
    eastD: `M -13 -18 L 8 -20 L 19 -8 L 17 12 L 6 22 L -11 18 L -18 4 Z`,
  },
  {
    id: 'head-soft-square',
    label: 'Soft square',
    d: rr(-18, -19, 36, 41, 9),
    eastD: rr(-16, -19, 33, 41, 9),
  },
];

const HEADS: PartDef[] = BASE_HEADS.map(({ id, label, d, eastD }) => ({
  id,
  label,
  slot: 'head' as Slot,
  anchor: 'headCenter' as const,
  facings: {
    south: { z: 40, shapes: [{ d, fill: '$skin' }, eyeS(-8, 0), eyeS(8, 0)] },
    east: { z: 40, shapes: [{ d: eastD ?? d, fill: '$skin' }, eyeS(11, 0)] },
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
      south: { z: 50, shapes: [{ d: topCap(21, -8), fill: '$hair' }] },
      east: {
        z: 50,
        shapes: [
          { d: topCap(21, -8), fill: '$hair' },
          { d: rr(-21, -9, 8, 17, 4), fill: '$hair' }, // back of head
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
      south: { z: 50, shapes: [{ d: topCap(21, -8), fill: '$hair' }, { d: circle(0, -26, 8), fill: '$hair' }] },
      east: {
        z: 50,
        shapes: [
          { d: topCap(21, -8), fill: '$hair' },
          { d: rr(-21, -9, 8, 15, 4), fill: '$hair' },
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
          { d: topCap(21, -8), fill: '$hair' },
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
          { d: topCap(21, -8), fill: '$hair' },
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
          { d: ellipse(-19.5, 5, 4.5, 7.5), fill: '$hair' },
          { d: ellipse(19.5, 5, 4.5, 7.5), fill: '$hair' },
        ],
      },
      east: { z: 50, shapes: [{ d: ellipse(-16, 5, 5.5, 7.5), fill: '$hair' }] },
      north: {
        z: 50,
        shapes: [
          { d: `M -20 -3 A 20 20 0 0 0 20 -3 L 20 10 L -20 10 Z`, fill: '$hair' },
        ],
      },
    },
  },
  {
    id: 'hair-side-part',
    label: 'Side part',
    slot: 'hair',
    anchor: 'headCenter',
    facings: {
      south: {
        z: 50,
        shapes: [
          { d: topCap(21, -7), fill: '$hair' },
          { d: `M -19 -6 C -7 -18 8 -19 20 -7 L 15 1 C 5 -7 -6 -8 -17 1 Z`, fill: '$hair' },
          { d: `M -5 -15 C -3 -8 -2 -2 -2 7`, stroke: '#00000024', strokeWidth: 1.6, silhouette: false },
        ],
      },
      east: {
        z: 50,
        shapes: [
          { d: topCap(21, -7), fill: '$hair' },
          { d: rr(-21, -8, 8, 16, 4), fill: '$hair' },
          { d: `M -6 -16 C 6 -16 16 -10 19 -3 L 12 2 C 5 -4 -3 -5 -11 0 Z`, fill: '$hair' },
        ],
      },
      north: {
        z: 50,
        shapes: [
          { d: topCap(21, 5), fill: '$hair' },
          { d: `M -19 0 C -7 9 8 9 20 1 L 20 13 L -20 13 Z`, fill: '$hair' },
        ],
      },
    },
  },
  {
    id: 'hair-pixie',
    label: 'Pixie',
    slot: 'hair',
    anchor: 'headCenter',
    facings: {
      south: {
        z: 50,
        shapes: [
          { d: topCap(21, -5), fill: '$hair' },
          { d: `M -18 -4 L -10 3 L -3 -2 L 4 4 L 11 -2 L 19 2 L 18 -8 L -17 -8 Z`, fill: '$hair' },
        ],
      },
      east: {
        z: 50,
        shapes: [
          { d: topCap(21, -5), fill: '$hair' },
          { d: rr(-20, -7, 8, 15, 4), fill: '$hair' },
          { d: `M 3 -9 L 17 -2 L 12 4 L 2 0 Z`, fill: '$hair' },
        ],
      },
      north: { z: 50, shapes: [{ d: topCap(21, 8), fill: '$hair' }] },
    },
  },
  {
    id: 'hair-ponytail',
    label: 'Ponytail',
    slot: 'hair',
    anchor: 'headCenter',
    facings: {
      south: {
        z: 50,
        shapes: [
          { d: topCap(21, -8), fill: '$hair' },
          { d: ellipse(0, -23, 7, 8), fill: '$hair' },
          { d: `M -5 -24 C -3 -36 5 -36 6 -24 Z`, fill: '$hair' },
        ],
      },
      east: {
        z: 50,
        shapes: [
          { d: topCap(21, -8), fill: '$hair' },
          { d: rr(-21, -9, 8, 16, 4), fill: '$hair' },
          { d: ellipse(-18, -18, 7, 8), fill: '$hair' },
          { d: `M -20 -22 C -30 -28 -31 -15 -21 -12 Z`, fill: '$hair' },
        ],
      },
      north: {
        z: 50,
        shapes: [
          { d: topCap(21, 5), fill: '$hair' },
          { d: ellipse(0, -20, 8, 8), fill: '$hair' },
          { d: `M -5 -19 C -7 -33 7 -33 5 -19 Z`, fill: '$hair' },
        ],
      },
    },
  },
  {
    id: 'hair-long-straight',
    label: 'Long straight',
    slot: 'hair',
    anchor: 'headCenter',
    facings: {
      south: {
        z: 50,
        shapes: [
          { d: `M -23 -5 A 23 23 0 0 1 23 -5 L 23 29 L 14 29 L 11 -2 A 12 12 0 0 0 -11 -2 L -14 29 L -23 29 Z`, fill: '$hair' },
        ],
      },
      east: {
        z: 50,
        shapes: [
          { d: `M -22 -5 A 23 23 0 0 1 23 -5 L 21 21 L 12 30 L -18 30 L -23 10 Z`, fill: '$hair' },
        ],
      },
      north: {
        z: 50,
        shapes: [{ d: `M -23 -4 A 23 23 0 0 1 23 -4 L 23 31 L -23 31 Z`, fill: '$hair' }],
      },
    },
  },
  {
    id: 'hair-coils',
    label: 'Coils',
    slot: 'hair',
    anchor: 'headCenter',
    facings: {
      south: {
        z: 50,
        shapes: [
          { d: circle(-18, -7, 8), fill: '$hair' },
          { d: circle(-11, -16, 9), fill: '$hair' },
          { d: circle(0, -19, 10), fill: '$hair' },
          { d: circle(11, -16, 9), fill: '$hair' },
          { d: circle(18, -7, 8), fill: '$hair' },
          { d: circle(-19, 3, 7), fill: '$hair' },
          { d: circle(19, 3, 7), fill: '$hair' },
        ],
      },
      east: {
        z: 50,
        shapes: [
          { d: circle(-16, -8, 8), fill: '$hair' },
          { d: circle(-7, -17, 9), fill: '$hair' },
          { d: circle(4, -18, 10), fill: '$hair' },
          { d: circle(15, -10, 8), fill: '$hair' },
          { d: circle(-18, 2, 7), fill: '$hair' },
        ],
      },
      north: {
        z: 50,
        shapes: [
          { d: circle(-17, -6, 8), fill: '$hair' },
          { d: circle(-8, -15, 9), fill: '$hair' },
          { d: circle(4, -17, 10), fill: '$hair' },
          { d: circle(16, -8, 8), fill: '$hair' },
          { d: topCap(21, 8), fill: '$hair' },
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
        shapes: [{ d: `M 9 -28 L 14 -13 L 17 -28 Z`, fill: '$outfitSecondary', silhouette: false }],
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
        shapes: [{ d: `M 8 -29 L 13 -18 L 16 -29 Z`, fill: '$outfitSecondary', silhouette: false }],
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
          { d: `M 9 -28 L 13 -15 L 16 -28 Z`, fill: '$outfitSecondary', silhouette: false },
          { d: `M 11 -23 L 14 -11 L 10 -9 Z`, fill: '$accent', silhouette: false },
        ],
      },
    },
  },
  {
    id: 'outfit-hoodie',
    label: 'Hoodie',
    slot: 'outfit',
    anchor: 'body',
    facings: {
      south: {
        z: 20,
        shapes: [
          { d: `M -18 -28 Q 0 -39 18 -28 L 10 -13 Q 0 -19 -10 -13 Z`, fill: '$outfitSecondary', silhouette: false },
          { d: `M -4 -29 L -9 -7 M 4 -29 L 9 -7`, stroke: '#00000030', strokeWidth: 2, silhouette: false },
          { d: rr(-11, 7, 22, 12, 5), fill: '$outfitSecondary', silhouette: false },
        ],
      },
      north: {
        z: 20,
        shapes: [
          { d: `M -18 -28 Q 0 -40 18 -28 L 14 -8 Q 0 -18 -14 -8 Z`, fill: '$outfitSecondary', silhouette: false },
          { d: rr(-9, 8, 18, 10, 4), fill: '#00000018', silhouette: false },
        ],
      },
      east: {
        z: 20,
        shapes: [
          { d: `M 8 -29 Q 21 -27 18 -12 L 10 -15 Z`, fill: '$outfitSecondary', silhouette: false },
          { d: `M 13 -25 L 15 -7`, stroke: '#00000030', strokeWidth: 2, silhouette: false },
        ],
      },
    },
  },
  {
    id: 'outfit-suit-jacket',
    label: 'Suit jacket',
    slot: 'outfit',
    anchor: 'body',
    facings: {
      south: {
        z: 20,
        shapes: [
          { d: `M -18 -28 L -4 25 L 0 4 L 4 25 L 18 -28 L 8 -28 L 0 -12 L -8 -28 Z`, fill: '$outfitSecondary', silhouette: false },
          { d: `M -4 -28 L 0 -15 L 4 -28 Z`, fill: '$skin', silhouette: false },
          { d: `M -2 -16 L 2 -16 L 4 9 L 0 15 L -4 9 Z`, fill: '$accent', silhouette: false },
          { d: circle(7, 5, 1.7), fill: '#0000003A', silhouette: false },
          { d: circle(7, 14, 1.7), fill: '#0000003A', silhouette: false },
        ],
      },
      north: {
        z: 20,
        shapes: [
          { d: `M 0 -26 L 0 26`, stroke: '#0000002E', strokeWidth: 2, silhouette: false },
          { d: rr(-12, -29, 24, 5, 2), fill: '$outfitSecondary', silhouette: false },
        ],
      },
      east: {
        z: 20,
        shapes: [
          { d: `M 8 -28 L 15 -12 L 18 -28 Z`, fill: '$outfitSecondary', silhouette: false },
          { d: `M 11 -21 L 14 -8 L 11 -5 Z`, fill: '$accent', silhouette: false },
          { d: circle(12, 7, 1.7), fill: '#0000003A', silhouette: false },
        ],
      },
    },
  },
  {
    id: 'outfit-dress',
    label: 'Dress',
    slot: 'outfit',
    anchor: 'body',
    facings: {
      south: {
        z: 20,
        shapes: [
          { d: `M -9 -29 L 0 -16 L 9 -29 Z`, fill: '$skin', silhouette: false },
          { d: `M -15 -16 L -28 29 L 28 29 L 15 -16 Z`, fill: '$outfitSecondary', silhouette: false },
          { d: `M -17 8 L 17 8`, stroke: '#00000026', strokeWidth: 2, silhouette: false },
        ],
      },
      north: {
        z: 20,
        shapes: [
          { d: `M -15 -16 L -27 29 L 27 29 L 15 -16 Z`, fill: '$outfitSecondary', silhouette: false },
        ],
      },
      east: {
        z: 20,
        shapes: [
          { d: `M 7 -28 L 13 -15 L 17 -28 Z`, fill: '$skin', silhouette: false },
          { d: `M -10 -16 L -18 29 L 21 29 L 13 -16 Z`, fill: '$outfitSecondary', silhouette: false },
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
          { d: `M 10 -27 L 12 -8`, stroke: '$accent', strokeWidth: 2.5, silhouette: false },
          { d: rr(7, -8, 9, 11, 2), fill: '#F7F4EC', silhouette: false },
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
  {
    id: 'acc-watch',
    label: 'Watch',
    slot: 'accessory',
    anchor: 'handRight',
    facings: {
      south: {
        z: 31,
        shapes: [
          { d: `M -2 -8 L -2 8`, stroke: INK, strokeWidth: 3, silhouette: false },
          { d: circle(-2, 0, 3.5), fill: '$accent', silhouette: false },
        ],
      },
      east: {
        z: 31,
        shapes: [
          { d: `M -3 -7 L -3 7`, stroke: INK, strokeWidth: 3, silhouette: false },
          { d: circle(-3, 0, 3.5), fill: '$accent', silhouette: false },
        ],
      },
      north: {
        z: 31,
        shapes: [
          { d: `M -2 -8 L -2 8`, stroke: INK, strokeWidth: 3, silhouette: false },
          { d: circle(-2, 0, 3), fill: '$accent', silhouette: false },
        ],
      },
    },
  },
  {
    id: 'acc-earbuds',
    label: 'Earbuds',
    slot: 'accessory',
    anchor: 'headCenter',
    facings: {
      south: {
        z: 60,
        shapes: [
          { d: circle(-18, 2, 2.6), fill: '#F7F4EC', silhouette: false },
          { d: circle(18, 2, 2.6), fill: '#F7F4EC', silhouette: false },
          { d: `M -17 4 Q -10 13 -2 15 M 17 4 Q 10 13 2 15`, stroke: '#F7F4EC', strokeWidth: 1.6, silhouette: false },
        ],
      },
      east: {
        z: 60,
        shapes: [
          { d: circle(17, 2, 2.6), fill: '#F7F4EC', silhouette: false },
          { d: `M 17 4 Q 12 13 5 15`, stroke: '#F7F4EC', strokeWidth: 1.6, silhouette: false },
        ],
      },
      north: {
        z: 60,
        shapes: [
          { d: circle(-18, 2, 2.3), fill: '#F7F4EC', silhouette: false },
          { d: circle(18, 2, 2.3), fill: '#F7F4EC', silhouette: false },
        ],
      },
    },
  },
  {
    id: 'acc-clipboard',
    label: 'Clipboard',
    slot: 'accessory',
    anchor: 'handRight',
    facings: {
      south: {
        z: 32,
        shapes: [
          { d: rr(-9, -15, 18, 24, 2), fill: '#8B5A2B' },
          { d: rr(-6, -11, 12, 17, 1), fill: '#F7F4EC', silhouette: false },
          { d: rr(-4, -18, 8, 5, 2), fill: INK, silhouette: false },
          { d: `M -3 -5 L 4 -5 M -3 0 L 5 0`, stroke: '#00000035', strokeWidth: 1.2, silhouette: false },
        ],
      },
      east: {
        z: 32,
        shapes: [
          { d: rr(-7, -15, 15, 24, 2), fill: '#8B5A2B' },
          { d: rr(-4, -11, 9, 17, 1), fill: '#F7F4EC', silhouette: false },
          { d: rr(-2, -18, 7, 5, 2), fill: INK, silhouette: false },
        ],
      },
      north: {
        z: 32,
        shapes: [
          { d: rr(-8, -14, 16, 22, 2), fill: '#8B5A2B' },
          { d: rr(-5, -10, 10, 15, 1), fill: '#F7F4EC', silhouette: false },
        ],
      },
    },
  },
  {
    id: 'acc-coffee-tray',
    label: 'Coffee run',
    slot: 'accessory',
    anchor: 'handRight',
    facings: {
      south: {
        z: 32,
        shapes: [
          { d: rr(-14, -2, 24, 12, 3), fill: '#B8893B' },
          { d: circle(-7, -4, 4.2), fill: '$accent' },
          { d: circle(3, -4, 4.2), fill: '$outfitSecondary' },
          { d: `M -10 -9 L -4 -9 M 0 -9 L 6 -9`, stroke: '#F7F4EC', strokeWidth: 2, silhouette: false },
        ],
      },
      east: {
        z: 32,
        shapes: [
          { d: rr(-12, -1, 21, 11, 3), fill: '#B8893B' },
          { d: circle(-5, -4, 4), fill: '$accent' },
          { d: circle(4, -4, 4), fill: '$outfitSecondary' },
        ],
      },
      north: {
        z: 32,
        shapes: [
          { d: rr(-13, -1, 23, 11, 3), fill: '#B8893B' },
          { d: circle(-6, -4, 4), fill: '$accent' },
          { d: circle(4, -4, 4), fill: '$outfitSecondary' },
        ],
      },
    },
  },
  {
    id: 'acc-paper-stack',
    label: 'Stack of papers',
    slot: 'accessory',
    anchor: 'handRight',
    facings: {
      south: {
        z: 32,
        shapes: [
          { d: rr(-11, -12, 21, 25, 1.5), fill: '#DCE6EC' },
          { d: rr(-8, -15, 21, 25, 1.5), fill: '#F7F4EC' },
          { d: `M -4 -7 L 8 -7 M -4 -2 L 8 -2 M -4 3 L 5 3`, stroke: '#00000030', strokeWidth: 1.3, silhouette: false },
        ],
      },
      east: {
        z: 32,
        shapes: [
          { d: rr(-9, -12, 18, 24, 1.5), fill: '#DCE6EC' },
          { d: rr(-6, -15, 18, 24, 1.5), fill: '#F7F4EC' },
          { d: `M -2 -7 L 6 -7 M -2 -2 L 6 -2`, stroke: '#00000030', strokeWidth: 1.3, silhouette: false },
        ],
      },
      north: {
        z: 32,
        shapes: [
          { d: rr(-10, -12, 20, 24, 1.5), fill: '#DCE6EC' },
          { d: rr(-7, -15, 20, 24, 1.5), fill: '#F7F4EC' },
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
