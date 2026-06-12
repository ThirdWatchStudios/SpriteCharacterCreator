import type { Facing, Mood, ShapeSpec } from '../core/types';

/**
 * Mood face overlays — eyebrows and mouths drawn over the head (anchor:
 * headCenter, head radius 21, eyes at (±8, 0) south / (11, 0) east). North has
 * no face, so moods render nothing from behind; the mood sheet still emits the
 * frame so engine-side indexing stays uniform.
 *
 * All shapes are style-neutral detail strokes (silhouette: false) in the same
 * ink as the eyes, so they survive palette and outline changes untouched.
 */

const INK = '#2C2C2A';

const brow = (d: string): ShapeSpec => ({ d, stroke: INK, strokeWidth: 2, silhouette: false });
const mouth = (d: string): ShapeSpec => ({ d, stroke: INK, strokeWidth: 2, silhouette: false });

export const MOOD_OVERLAYS: Record<Mood, Partial<Record<Facing, ShapeSpec[]>>> = {
  // Eyes-only neutral face, RimWorld-style.
  normal: {},

  // Narrowed: flat brows pressed low, tight frown.
  suspicious: {
    south: [
      brow('M -12 -6 L -4 -5'),
      brow('M 4 -5 L 12 -6'),
      mouth('M -4 12 Q 0 10 4 12'),
    ],
    east: [brow('M 5 -5 L 15 -6'), mouth('M 11 12 Q 14 10 17 12')],
  },

  // Raised brows, small round mouth.
  curious: {
    south: [
      brow('M -12 -9 Q -8 -12 -4 -9'),
      brow('M 4 -9 Q 8 -12 12 -9'),
      { d: 'M -2 11 a 2 2.4 0 1 0 4 0 a 2 2.4 0 1 0 -4 0 Z', fill: INK, silhouette: false },
    ],
    east: [
      brow('M 6 -9 Q 10 -12 15 -9'),
      { d: 'M 12 11 a 2 2.4 0 1 0 4 0 a 2 2.4 0 1 0 -4 0 Z', fill: INK, silhouette: false },
    ],
  },

  // Worried: brows slanted up-and-out, short guarded mouth.
  defensive: {
    south: [
      brow('M -12 -9 L -4 -6'),
      brow('M 4 -6 L 12 -9'),
      mouth('M -3 11 L 3 11'),
    ],
    east: [brow('M 6 -6 L 15 -9'), mouth('M 12 11 L 17 11')],
  },

  // Angry: brows slanted down toward the nose, deep frown.
  hostile: {
    south: [
      brow('M -12 -9 L -4 -5'),
      brow('M 4 -5 L 12 -9'),
      mouth('M -5 13 Q 0 9 5 13'),
    ],
    east: [brow('M 6 -9 L 15 -5'), mouth('M 10 13 Q 14 9 17 13')],
  },

  // One brow up, one pressed down, squiggle mouth.
  confused: {
    south: [
      brow('M -12 -9 Q -8 -11 -4 -8'),
      brow('M 4 -5 L 12 -6'),
      mouth('M -4 11 Q -2 9 0 11 Q 2 13 4 11'),
    ],
    east: [brow('M 6 -8 Q 10 -10 14 -7'), mouth('M 10 11 Q 12 9 14 11 Q 16 13 17 11')],
  },
};
