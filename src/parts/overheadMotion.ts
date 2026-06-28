/**
 * Overhead-badge motion intent — the tool owns the badge *vocabulary*, so it also
 * owns each badge's motion *intent*: a small, sim-readable recommendation for how a
 * badge should enter, idle, and leave, plus where it sits in the salience hierarchy.
 *
 * The sim still owns the actual animation (easing curves, exact timings, the flash/
 * fade/scale-by-magnitude, the per-frame salience budget) — this is INTENT, not a
 * keyframe track. Shipping it here means every overhead icon animates *consistently*
 * (a conflict puff pops the same way everywhere) without each one being hand-tuned in
 * sim code, and the relative importance of two stacked badges is authored, not guessed.
 *
 * Discipline mirrors the floor-overlay grammar (overlayStyle.ts): ongoing STATE badges
 * (mood, activity) enter/leave softly and DON'T nag with a loop; an alert STATE
 * (prop-status) is allowed a gentle pulse because demanding attention is its whole job;
 * transient EVENT puffs pop and fade, and only the top-of-hierarchy `harvestable` puff
 * gets an ongoing shimmer — it is the player's call-to-action beacon.
 */

import { MOODS, type Mood } from '../core/types';
import { ACTIVITIES, type Activity } from './activities';
import { MOOD_EMOTES } from './moods';
import { PROP_STATUSES, type PropStatus } from './propStatus';
import { type AttentionPuff } from './attention';

/** How a badge appears. */
export type BadgeIntro = 'pop-scale' | 'fade-in' | 'rise';
/** What it does while shown. `none` = perfectly still (state discipline). */
export type BadgeLoop = 'none' | 'bob' | 'pulse' | 'shimmer';
/** How it leaves. `hold` = stays until the sim explicitly clears it. */
export type BadgeOutro = 'fade-out' | 'pop-out' | 'hold';

export interface OverheadMotionIntent {
  intro: BadgeIntro;
  loop: BadgeLoop;
  outro: BadgeOutro;
  /**
   * Relative importance, higher wins. The sim uses it for the salience budget
   * (which badge survives when too many compete), draw order, and base scale.
   */
  salienceTier: number;
}

/** Build a uniform id→intent map for a homogeneous family. */
function uniform<T extends string>(ids: readonly T[], intent: OverheadMotionIntent): Record<T, OverheadMotionIntent> {
  return Object.fromEntries(ids.map((id) => [id, intent])) as Record<T, OverheadMotionIntent>;
}

/** Ongoing affect state — settle in/out, no nagging loop. */
const MOOD_INTENT: OverheadMotionIntent = { intro: 'fade-in', loop: 'none', outro: 'fade-out', salienceTier: 2 };
/** Ongoing activity state — the quietest layer; soft and still. */
const ACTIVITY_INTENT: OverheadMotionIntent = { intro: 'fade-in', loop: 'none', outro: 'fade-out', salienceTier: 1 };
/** Alert state — pops in and pulses, because demanding attention is the point. */
const PROP_STATUS_INTENT: OverheadMotionIntent = { intro: 'pop-scale', loop: 'pulse', outro: 'fade-out', salienceTier: 3 };

/** Emoted moods only (`normal` has no emote, so no badge to animate). */
const EMOTED_MOODS = MOODS.filter((m) => MOOD_EMOTES[m]);
/** Badged activities only (`none` draws nothing). */
const BADGED_ACTIVITIES = ACTIVITIES.filter((a) => a !== 'none');

export const MOOD_MOTION: Record<string, OverheadMotionIntent> = uniform(EMOTED_MOODS as Mood[], MOOD_INTENT);
export const ACTIVITY_MOTION: Record<string, OverheadMotionIntent> = uniform(BADGED_ACTIVITIES as Activity[], ACTIVITY_INTENT);
export const PROP_STATUS_MOTION: Record<string, OverheadMotionIntent> = uniform(PROP_STATUSES as PropStatus[], PROP_STATUS_INTENT);

/**
 * Transient event puffs — all pop-and-fade, but the salience tier is the §7
 * hierarchy: information < emotion-spike < conflict < harvestable. Only the
 * top-tier harvestable beacon earns an ongoing shimmer + a `hold` outro (it stays
 * until captured), because it is the player's verb-prompt.
 */
export const ATTENTION_MOTION: Record<AttentionPuff, OverheadMotionIntent> = {
  'attn-information': { intro: 'pop-scale', loop: 'none', outro: 'fade-out', salienceTier: 1 },
  'attn-emotion-spike': { intro: 'pop-scale', loop: 'none', outro: 'fade-out', salienceTier: 2 },
  'attn-conflict': { intro: 'pop-scale', loop: 'none', outro: 'fade-out', salienceTier: 3 },
  'attn-harvestable': { intro: 'pop-scale', loop: 'shimmer', outro: 'hold', salienceTier: 4 },
};
