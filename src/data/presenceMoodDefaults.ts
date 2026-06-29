/**
 * Default mood-expression templates — the "typical" way a body physically expresses
 * each mood, as sparse presence deltas over the baseline (see CONTRACT.md §5.8 and
 * core/profile.ts `PresenceMoodMap`). These are a starting point the author stamps
 * with "fill typical" and then varies per character — the whole point of the system
 * is that the SAME mood looks different on different bodies, so these are defaults to
 * diverge from, not a contract. Like the presence presets, this is an authoring-time
 * library: NOT a project catalog and NOT exported. `normal` is the baseline (no map).
 *
 * Magnitudes are moderate (~±10–25) so a mood reads as a lean, not a slam; deltas are
 * bipolar and clamped on apply.
 */
import type { Mood } from '../core/types';
import type { PresenceChannel } from '../core/profile';

export const DEFAULT_MOOD_EXPRESSION: Record<Mood, Partial<Record<PresenceChannel, number>>> = {
  // Baseline — no modulation.
  normal: {},
  // Guarded and watchful: keeps distance, scans, holds back.
  suspicious: { personalSpace: 20, attentiveness: 20, expressiveness: -10, gaitControl: 5, commitment: -5 },
  // Drawn in and tracking: leans toward, quick to notice, a touch faster.
  curious: { attentiveness: 25, personalSpace: -10, gaitSpeed: 5, latency: -5, expressiveness: 5 },
  // Braced and contained: more space, tighter control, less open, a little keyed up.
  defensive: { personalSpace: 20, gaitControl: 10, expressiveness: -15, restlessness: 10, commitment: -5 },
  // Closing in, fast and animated: less space, quicker, bigger, decisive.
  hostile: { restlessness: 20, personalSpace: -20, gaitSpeed: 15, latency: -15, expressiveness: 15, commitment: 10 },
  // Hesitant and fumbling: long pauses, second-guesses, loose control.
  confused: { latency: 20, commitment: -20, gaitControl: -15, restlessness: 15, attentiveness: 5 },
};

/** The default deltas for a mood (a fresh object), or `{}` for the baseline / unknown. */
export function moodExpressionDefault(mood: Mood): Partial<Record<PresenceChannel, number>> {
  return { ...(DEFAULT_MOOD_EXPRESSION[mood] ?? {}) };
}
