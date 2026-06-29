/**
 * Presence presets — the starter set of body-language modifiers (see
 * src/core/profile.ts `applyPresencePreset` and docs/presence-profile.md §9). Each
 * is a small bundle of signed deltas folded over the spine-derived presence
 * baseline: "derive a base, then author on top." They are an authoring-time
 * convenience (like the persona archetypes in personaArchetypes.ts) — NOT a project
 * catalog and NOT exported. The sim only ever sees the resolved presence numbers in
 * profile.json, never which preset produced them.
 *
 * Deltas name only the channels a preset characterizes; everything else keeps
 * deriving from the spine. Magnitudes are deliberately moderate (~±10–25) so a
 * preset reads as a lean, not a slam to the rail; clampUnit handles any overflow.
 *
 * The seven match the emotional-expression set from the original brief — each is a
 * *manner* of moving (an adverb), never a behavior the sim runs.
 */
import type { PresencePreset } from '../core/profile';

export const CONFIDENT: PresencePreset = {
  id: 'confident',
  label: 'Confident',
  description: 'Brisk, controlled, comfortable closing distance; decisive with little hesitation.',
  deltas: {
    gaitSpeed: 20,
    gaitControl: 20,
    restlessness: -15,
    personalSpace: -15,
    expressiveness: 10,
    commitment: 25,
    latency: -20,
  },
};

export const RESERVED: PresencePreset = {
  id: 'reserved',
  label: 'Reserved',
  description: 'Contained and measured; keeps distance, gestures little, gives events less notice.',
  deltas: {
    expressiveness: -25,
    personalSpace: 20,
    restlessness: -10,
    gaitSpeed: -5,
    gaitControl: 10,
    latency: 10,
    attentiveness: -15,
  },
};

export const AWKWARD: PresencePreset = {
  id: 'awkward',
  label: 'Awkward',
  description: 'Uneven stops and starts, keeps a wide berth, hesitates and second-guesses motions.',
  deltas: {
    gaitControl: -25,
    personalSpace: 20,
    latency: 20,
    commitment: -20,
    restlessness: 10,
    expressiveness: -10,
    attentiveness: -10,
  },
};

export const NERVOUS: PresencePreset = {
  id: 'nervous',
  label: 'Nervous',
  description: 'Fidgety and hyper-aware; long pauses, weak follow-through, keeps others at arm’s length.',
  deltas: {
    restlessness: 25,
    latency: 20,
    commitment: -25,
    personalSpace: 15,
    gaitControl: -15,
    expressiveness: -10,
    attentiveness: 15,
  },
};

export const ENTHUSIASTIC: PresencePreset = {
  id: 'enthusiastic',
  label: 'Enthusiastic',
  description: 'Fast, animated, leans in and tracks everything; snappy with energy to spare.',
  deltas: {
    gaitSpeed: 20,
    expressiveness: 25,
    attentiveness: 20,
    personalSpace: -15,
    latency: -15,
    restlessness: 10,
    commitment: 10,
  },
};

export const TIRED: PresencePreset = {
  id: 'tired',
  label: 'Tired',
  description: 'Slow and sluggish; gestures little, lingers before acting, lets the world pass by.',
  deltas: {
    gaitSpeed: -25,
    expressiveness: -20,
    latency: 20,
    attentiveness: -20,
    restlessness: -15,
    commitment: -10,
    gaitControl: -10,
  },
};

export const PROFESSIONAL: PresencePreset = {
  id: 'professional',
  label: 'Professional',
  description: 'Composed and deliberate; controlled movement, contained gestures, follows through.',
  deltas: {
    gaitControl: 20,
    restlessness: -15,
    commitment: 20,
    expressiveness: -10,
    latency: 5,
    attentiveness: 10,
    personalSpace: 5,
  },
};

/** The starter presence presets, in UI display order. */
export const PRESENCE_PRESETS: PresencePreset[] = [
  CONFIDENT,
  RESERVED,
  AWKWARD,
  NERVOUS,
  ENTHUSIASTIC,
  TIRED,
  PROFESSIONAL,
];

/** Look up a preset by id (the way drives/traits resolve), or `undefined`. */
export function getPresencePreset(id: string): PresencePreset | undefined {
  return PRESENCE_PRESETS.find((p) => p.id === id);
}
