import type { ShapeSpec } from '../core/types';
import { circle } from '../core/geometry';
import { UI_PALETTE } from '../data/uiPalette';

/**
 * Activity badges — overhead status emotes that say *what* an agent is doing
 * where it stopped (working, talking, on break...). They are the activity
 * sibling of the mood emotes in moods.ts: a color-coded symbol on a bubble,
 * drawn facing-independently above the head, legible at scene scale.
 *
 * Unlike moods (per-character face overlays painted on each head), an activity
 * badge does not depend on who it floats over — "working" looks identical over
 * anyone. So the export is a single SHARED atlas the sim blits above any agent,
 * keyed off that agent's routine `activity` string. The tool owns this
 * vocabulary; the sim selects and places at runtime. Unknown activity ids draw
 * nothing (free-text-with-fallback, per CONTRACT.md).
 *
 * Badge-local coords: (0,0) is the bubble center, usable box roughly ±6.
 */

/** Activities with a badge. The blank/unknown state ('none') draws nothing. */
export type Activity =
  | 'none'
  | 'work'
  | 'talking'
  | 'meeting'
  | 'break'
  | 'lunch'
  | 'idle'
  | 'walk'
  | 'monitoring';

/** Canonical order. Also the set of cells emitted into the shared atlas. */
export const ACTIVITIES: Activity[] = [
  'none',
  'work',
  'talking',
  'meeting',
  'break',
  'lunch',
  'idle',
  'walk',
  'monitoring',
];

export interface ActivityBadge {
  /** Bubble fill — a literal activity color, not a palette token. */
  color: string;
  /** Symbol drawn on the bubble, in badge-local coords. */
  glyph: ShapeSpec[];
}

const GLYPH = UI_PALETTE.onColor;
const gStroke = (d: string): ShapeSpec => ({ d, stroke: GLYPH, strokeWidth: 1.8, silhouette: false });
const gThin = (d: string): ShapeSpec => ({ d, stroke: GLYPH, strokeWidth: 1.3, silhouette: false });
const gFill = (d: string): ShapeSpec => ({ d, fill: GLYPH, silhouette: false });
const gRing = (cx: number, cy: number, r: number): ShapeSpec => gStroke(circle(cx, cy, r));

/**
 * activity id → badge, or null for the blank state. Keep these legible at badge
 * scale: bold single symbols, no fine detail. Colors are spread across the
 * wheel so adjacent activities stay distinguishable in a crowd, and kept clear
 * of the mood-emote palette so a stacked mood + activity pair reads as two
 * distinct things.
 */
export const ACTIVITY_BADGES: Record<Activity, ActivityBadge | null> = {
  // No badge — a settled/unspecified agent stays clean, same rule as mood 'normal'.
  none: null,

  // Monitor on a stand — "at the desk, working".
  work: {
    color: UI_PALETTE.emote.work,
    glyph: [
      gStroke('M -4.5 -4 L 4.5 -4 L 4.5 1.5 L -4.5 1.5 Z'),
      gStroke('M 0 1.5 L 0 3.6'),
      gStroke('M -2.6 4 L 2.6 4'),
    ],
  },

  // Speech bubble with a tail — "talking".
  talking: {
    color: UI_PALETTE.emote.talking,
    glyph: [gStroke('M -4.6 -3 H 4.6 V 1.4 H -1.6 L -3.6 3.8 L -2.8 1.4 H -4.6 Z')],
  },

  // Two heads + shoulders — "in a meeting" (a group, distinct from 1:1 talking).
  meeting: {
    color: UI_PALETTE.emote.meeting,
    glyph: [
      gFill(circle(-2.6, -1.8, 1.5)),
      gFill(circle(2.6, -1.8, 1.5)),
      gStroke('M -5 4 Q -5 0.6 -2.6 0.6 Q -0.2 0.6 -0.2 4'),
      gStroke('M 0.2 4 Q 0.2 0.6 2.6 0.6 Q 5 0.6 5 4'),
    ],
  },

  // Coffee cup with handle + steam — "on a break".
  break: {
    color: UI_PALETTE.emote.break,
    glyph: [
      gStroke('M -3.4 -1.2 H 2.6 V 1.4 Q 2.6 3.8 -0.4 3.8 Q -3.4 3.8 -3.4 1.4 Z'),
      gStroke('M 2.6 -0.4 Q 4.6 -0.4 4.6 1 Q 4.6 2.2 3 2.2'),
      gThin('M -1.4 -2.4 Q -0.4 -3.2 -1.4 -4.4'),
      gThin('M 0.8 -2.4 Q 1.8 -3.2 0.8 -4.4'),
    ],
  },

  // Fork + knife — "at lunch".
  lunch: {
    color: UI_PALETTE.emote.lunch,
    glyph: [
      gStroke('M -3 -4 L -3 4'),
      gStroke('M -4.6 -4 L -4.6 -1.6 Q -4.6 -0.6 -3 -0.6 Q -1.4 -0.6 -1.4 -1.6 L -1.4 -4'),
      gStroke('M 3.4 -4 L 3.4 4'),
      gStroke('M 3.4 -4 Q 4.8 -3.2 4.8 -1 Q 4.8 -0.6 3.4 -0.6'),
    ],
  },

  // Two z's — "idle".
  idle: {
    color: UI_PALETTE.emote.idle,
    glyph: [
      gStroke('M -4 0.8 L -1.6 0.8 L -4 3.2 L -1.6 3.2'),
      gStroke('M -0.2 -3.8 L 3.8 -3.8 L -0.2 0.2 L 3.8 0.2'),
    ],
  },

  // Motion chevrons — "walking / in transit".
  walk: {
    color: UI_PALETTE.emote.walk,
    glyph: [gStroke('M -3.4 -4 L 0.6 0 L -3.4 4'), gStroke('M 0.6 -4 L 4.6 0 L 0.6 4')],
  },

  // Magnifier — "supervising / monitoring" (manager default).
  monitoring: {
    color: UI_PALETTE.emote.monitoring,
    glyph: [gRing(-1, -1, 3), { d: 'M 1.2 1.2 L 4.4 4.4', stroke: GLYPH, strokeWidth: 2.2, silhouette: false }],
  },
};
