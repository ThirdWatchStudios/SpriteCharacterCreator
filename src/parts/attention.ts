import type { ShapeSpec } from '../core/types';
import { circle } from '../core/geometry';
import { UI_PALETTE } from '../data/uiPalette';

/**
 * Attention puffs — the transient "event" register that floats above an agent
 * the MOMENT something notable happens (the active-loop §7 "attention layer").
 * Where the mood and activity badges show ongoing *state* ("Carl is frustrated",
 * "Dana is on break"), a puff marks the *transition* — "this just changed, here"
 * — and is the entry point to the read→act loop. The sim flashes it on and fades
 * it out (motion is sim-side); the tool ships only the static icon per category.
 *
 * Like the activity / mood / prop-status badges, this is a single SHARED,
 * agent-independent atlas the sim selects from at runtime, keyed off the puff's
 * stable id. Unknown ids draw nothing (free-text-with-fallback, per CONTRACT.md).
 *
 * Two rules from §7 shape the art:
 *   1. The set is FIXED and FEW — four categories, no open-ended catalog — because
 *      the vocabulary is itself a noise surface. Resist adding a fifth.
 *   2. The set is a salience hierarchy, and `harvestable` sits at the top: it is
 *      the player's verb-prompt ("a reading is capturable here, now"). It gets the
 *      most distinct, inviting silhouette of the set (the lone amber gem) plus a
 *      beacon glow, so the eye lands on it first on a busy floor.
 *
 * Silhouette is the design budget: at floor scale the OUTER shape reads before any
 * glyph, so each puff carries a different bubble silhouette (spark / shuriken /
 * round / gem), not just a different color — you can triage them with the glyphs
 * mushed out. Badge-local coords: (0,0) is the puff center, usable box roughly ±9.
 */

/**
 * The fixed puff vocabulary. Values ARE the catalog ids the sim binds against
 * (atlas frame keys === these strings), so they are stable and re-import-safe.
 */
export type AttentionPuff =
  | 'attn-emotion-spike'
  | 'attn-conflict'
  | 'attn-information'
  | 'attn-harvestable';

/** Canonical order. Also the set of cells emitted into the shared atlas. */
export const ATTENTION_PUFFS: AttentionPuff[] = [
  'attn-emotion-spike',
  'attn-conflict',
  'attn-information',
  'attn-harvestable',
];

export interface AttentionPuffArt {
  /** Outer silhouette fill — a literal puff color, not a palette token. */
  color: string;
  /** The outer bubble/burst path (badge-local, centered on 0,0). The silhouette. */
  shape: string;
  /** White symbol drawn on the shape, in badge-local coords. */
  glyph: ShapeSpec[];
  /**
   * Salience beacon: a soft colored halo behind the shape, reserved for the top
   * of the hierarchy (`harvestable`). Cheap "this is the call to action" glow.
   */
  beacon?: boolean;
}

const GLYPH = UI_PALETTE.onColor;
const C = UI_PALETTE.attention;
const gStroke = (d: string): ShapeSpec => ({ d, stroke: GLYPH, strokeWidth: 1.8, silhouette: false });
const gThin = (d: string): ShapeSpec => ({ d, stroke: GLYPH, strokeWidth: 1.4, silhouette: false });

/**
 * A regular N-point star/burst path, centered on (0,0), first point at `rot`
 * degrees. Pure (no RNG/clock), so snapshots stay deterministic. Used for the
 * spark (emotion) and shuriken (conflict) silhouettes — same generator, very
 * different point counts, so the two negative-event puffs don't read alike.
 */
function burst(points: number, outer: number, inner: number, rot = -90): string {
  const seg: string[] = [];
  const total = points * 2;
  for (let i = 0; i < total; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = ((rot + (180 / points) * i) * Math.PI) / 180;
    const x = +(r * Math.cos(a)).toFixed(2);
    const y = +(r * Math.sin(a)).toFixed(2);
    seg.push(`${i === 0 ? 'M' : 'L'} ${x} ${y}`);
  }
  return `${seg.join(' ')} Z`;
}

// A faceted gem (rotated, table-topped diamond) — the harvestable silhouette. The
// only clean angular shape in the set, so it pops against the round/spiky others.
const GEM = 'M -4.6 -5.6 H 4.6 L 8.2 -1.6 L 0 8.4 L -8.2 -1.6 Z';

/**
 * puff id → art. Colors are spread off the mood/activity emote palette so a puff
 * stacked over a mood/activity badge still reads as a separate thing, and the
 * negative-event pair (emotion rose / conflict red) is split by shape, not just
 * hue. Keep glyphs bold and few — they vanish at floor scale, where the
 * silhouette carries the read.
 */
export const ATTENTION_PUFF_ART: Record<AttentionPuff, AttentionPuffArt> = {
  // Emotion spike — an acute affect change just landed. Rose spark (a jolt),
  // glyph is an ECG-style spike peak so it reads "spike" even color-blind.
  'attn-emotion-spike': {
    color: C.emotionSpike,
    shape: burst(8, 8.6, 3.6),
    glyph: [gStroke('M -4.4 1.2 L -1.8 1.2 L -0.4 -3.6 L 1.2 3.6 L 2.4 0.8 L 4.4 0.8')],
  },

  // Conflict — a hostile / friction interaction just happened here. Danger-red
  // four-point shuriken (sharp clash silhouette, distinct from the 8-point spark),
  // glyph a bold white X = "versus / collision".
  'attn-conflict': {
    color: C.conflict,
    shape: burst(4, 8.8, 2.4),
    glyph: [
      { d: 'M -2.6 -2.6 L 2.6 2.6', stroke: GLYPH, strokeWidth: 2, silhouette: false },
      { d: 'M 2.6 -2.6 L -2.6 2.6', stroke: GLYPH, strokeWidth: 2, silhouette: false },
    ],
  },

  // Information — a secret / piece of info was just passed. Calm cool-teal round
  // bubble (the only smooth silhouette), glyph an envelope = "a note changed hands".
  'attn-information': {
    color: C.information,
    shape: circle(0, 0, 8),
    glyph: [gStroke('M -4.4 -2.8 H 4.4 V 2.8 H -4.4 Z'), gStroke('M -4.4 -2.8 L 0 0.8 L 4.4 -2.8')],
  },

  // Harvestable — a reading is capturable here, RIGHT NOW. The player's verb
  // prompt and the top of the salience hierarchy: the lone amber gem silhouette
  // with a beacon glow, faceted to read as "valuable — grab this".
  'attn-harvestable': {
    color: C.harvestable,
    shape: GEM,
    beacon: true,
    glyph: [
      gThin('M -8.2 -1.6 H 8.2'),
      gThin('M -4.6 -5.6 L -2.4 -1.6 M 4.6 -5.6 L 2.4 -1.6'),
      gThin('M -2.4 -1.6 L 0 8.4 M 2.4 -1.6 L 0 8.4'),
    ],
  },
};
