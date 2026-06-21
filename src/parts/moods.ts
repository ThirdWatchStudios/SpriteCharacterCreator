import type { Facing, Mood, ShapeSpec } from '../core/types';
import { UI_PALETTE } from '../data/uiPalette';

/**
 * Mood face overlays — eyebrows and mouths drawn over the head (anchor:
 * headCenter, head radius 21, eyes at (±8, 0) south / (11, 0) east). North has
 * no face, so moods render nothing from behind; the mood sheet still emits the
 * frame so engine-side indexing stays uniform.
 *
 * All shapes are style-neutral detail strokes (silhouette: false) in the same
 * ink as the eyes, so they survive palette and outline changes untouched.
 */

const INK = UI_PALETTE.ink;

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
      brow('M -12 -7 Q -8 -10 -4 -7'),
      brow('M 4 -7 Q 8 -10 12 -7'),
      { d: 'M -2 11 a 2 2.4 0 1 0 4 0 a 2 2.4 0 1 0 -4 0 Z', fill: INK, silhouette: false },
    ],
    east: [
      brow('M 6 -7 Q 10 -10 15 -7'),
      { d: 'M 12 11 a 2 2.4 0 1 0 4 0 a 2 2.4 0 1 0 -4 0 Z', fill: INK, silhouette: false },
    ],
  },

  // Worried: brows slanted up-and-out, short guarded mouth.
  defensive: {
    south: [
      brow('M -12 -8 L -4 -5'),
      brow('M 4 -5 L 12 -8'),
      mouth('M -3 11 L 3 11'),
    ],
    east: [brow('M 6 -5 L 15 -8'), mouth('M 12 11 L 17 11')],
  },

  // Angry: brows slanted down toward the nose, deep frown.
  hostile: {
    south: [
      brow('M -12 -8 L -4 -4'),
      brow('M 4 -4 L 12 -8'),
      mouth('M -5 13 Q 0 9 5 13'),
    ],
    east: [brow('M 6 -8 L 15 -4'), mouth('M 10 13 Q 14 9 17 13')],
  },

  // One brow up, one pressed down, squiggle mouth.
  confused: {
    south: [
      brow('M -12 -7 Q -8 -9 -4 -6'),
      brow('M 4 -5 L 12 -6'),
      mouth('M -4 11 Q -2 9 0 11 Q 2 13 4 11'),
    ],
    east: [brow('M 6 -6 Q 10 -8 14 -5'), mouth('M 10 11 Q 12 9 14 11 Q 16 13 17 11')],
  },
};

/**
 * Overhead emote badges — a large, color-coded symbol that floats above the
 * head. Where the face overlays carry expression at hero scale, the badge
 * carries readability at scene scale: it is facing-independent (drawn the same
 * from every angle, including north, where there is no face) and rendered
 * undistorted above all parts. `normal` has no badge so idle crowds stay clean.
 *
 * Glyphs are white strokes/fills sitting on the mood-colored bubble; the bubble
 * is ringed in the same style-neutral ink as the faces, so badges survive
 * palette and outline changes untouched. Coordinates are badge-local: (0,0) is
 * the bubble center, usable box roughly ±6.
 */
export interface MoodEmote {
  /** Bubble fill — a literal mood color, not a palette token. */
  color: string;
  /** Symbol drawn on the bubble, in badge-local coords. */
  glyph: ShapeSpec[];
}

const GLYPH = UI_PALETTE.onColor;
const gStroke = (d: string): ShapeSpec => ({ d, stroke: GLYPH, strokeWidth: 1.8, silhouette: false });
const gFill = (d: string): ShapeSpec => ({ d, fill: GLYPH, silhouette: false });
const gDot = (cx: number, cy: number): ShapeSpec =>
  gFill(`M ${cx - 1.1} ${cy} a 1.1 1.1 0 1 0 2.2 0 a 1.1 1.1 0 1 0 -2.2 0 Z`);

export const MOOD_EMOTES: Record<Mood, MoodEmote | null> = {
  normal: null,

  // Watching eye — almond lens with a pupil.
  suspicious: {
    color: UI_PALETTE.emote.moodSuspicious,
    glyph: [gStroke('M -5 0 Q 0 -2.6 5 0 Q 0 2.6 -5 0 Z'), gDot(0, 0)],
  },

  // Question mark.
  curious: {
    color: UI_PALETTE.emote.moodCurious,
    glyph: [gStroke('M -2.6 -2.8 Q -2.6 -5.4 0 -5.4 Q 2.8 -5.4 2.8 -3 Q 2.8 -1 0 0.6 L 0 2.2'), gDot(0, 4.4)],
  },

  // Exclamation mark.
  defensive: {
    color: UI_PALETTE.emote.moodDefensive,
    glyph: [gStroke('M 0 -5.2 L 0 1.6'), gDot(0, 4.2)],
  },

  // Scowl — furrowed brows over a frown. The vein-pop (💢) doesn't read at
  // badge scale, but angry brows are unmistakable.
  hostile: {
    color: UI_PALETTE.emote.moodHostile,
    glyph: [
      gStroke('M -5.5 -4.5 L -1 -1.5'),
      gStroke('M 5.5 -4.5 L 1 -1.5'),
      gStroke('M -3.2 4 Q 0 1.4 3.2 4'),
    ],
  },

  // Dizzy swirl.
  confused: {
    color: UI_PALETTE.emote.moodConfused,
    glyph: [gStroke('M 3.4 -1.2 Q 3.4 -4.4 0 -4.4 Q -4.4 -4.4 -4.4 0 Q -4.4 4.4 1 4.4 Q 5 4.4 5 -0.6')],
  },
};
