/**
 * Routine generation — stamp out a coherent *default daily routine* for a persona
 * from what the profile already knows (needs, OCEAN spine, identity), instead of
 * authoring every block by hand.
 *
 * Like {@link generatePersona}, this is a **pure, seeded, deterministic** function:
 * the same profile + context + seed always yields the same routine. It produces a
 * deliberately *soft / coarse* day — a handful of meaningful blocks (settle in,
 * a break or two, lunch, work, wrap-up) — NOT a minute-by-minute timetable. The
 * sim's Epic 20 spec (F20.3.5) explicitly warns the routine "must not become a
 * full workday simulator"; the schedule is a soft pull, and deviation from it is
 * itself evidence.
 *
 * The tool does not model time — it emits `"HH:MM"` strings that the sim maps onto
 * its compressed office-day clock (CONTRACT.md §3.2; Epic 20). `locationId` /
 * `activity` are free-text the sim owns; we resolve real ids from the active
 * scenario when one is selected, and otherwise fall back to the canonical office.
 */
import { mulberry32, type Rng } from './random';
import { seedToInt } from './employee';
import type { CharacterProfile } from './profile';
import { clampUnit, type RoutineBlock, type OnBlockedLocation } from './profile';
import type { Scenario } from './scenario';

// --- the office day ----------------------------------------------------------

const DAY_START = 9 * 60; // 09:00
const DAY_END = 17 * 60; // 17:00
const LUNCH_START = 12 * 60; // 12:00 (nominal; jittered per persona)

/** Canonical office locations the prototype sim defines (Experiment 001 fixture). */
export const CANONICAL_LOCATION_IDS = [
  'janice_desk',
  'carl_desk',
  'linda_desk',
  'manager_office',
  'break_room',
  'hallway',
] as const;

/**
 * The resolved vocabulary a routine is generated against. The UI builds this from
 * the active scenario (real, declared locations) or the canonical fallback, so the
 * generator itself stays decoupled from scenario shape and easy to test.
 */
export interface RoutineContext {
  /** Where this agent works from (their desk, or the manager's office). */
  deskLocationId: string;
  /** A social/break location (break room). Breaks land here for social personas. */
  breakLocationId: string;
  /** A meeting location (conference room), when the office has one. */
  meetingLocationId: string | null;
  /** Fallback when a block's location is blocked (hallway). */
  fallbackLocationId: string;
}

// --- context resolution ------------------------------------------------------

const isManager = (p: CharacterProfile): boolean =>
  p.identity.seniority === 'manager' || p.identity.department === 'Management';

const hasTag = (l: { tags: string[] }, tag: string): boolean => l.tags.includes(tag);

/**
 * Resolve the location vocabulary for an agent. Scenario-aware: when a scenario is
 * passed, prefer its declared locations (matched by the agent's desk anchor, by tag,
 * or by id convention); otherwise fall back to the canonical office.
 */
export function resolveRoutineContext(profile: CharacterProfile, scenario?: Scenario): RoutineContext {
  const agentId = profile.agentId;
  const manager = isManager(profile);
  const deskGuess = manager ? 'manager_office' : `${agentId}_desk`;

  if (!scenario || !scenario.locations.length) {
    return {
      deskLocationId: deskGuess,
      breakLocationId: 'break_room',
      meetingLocationId: null,
      fallbackLocationId: 'hallway',
    };
  }

  const locs = scenario.locations;
  const byId = (id: string) => locs.find((l) => l.locationId === id);
  const first = (pred: (l: (typeof locs)[number]) => boolean) => locs.find(pred);

  // Desk: the agent's spawn, a location bound to their desk anchor, or the id convention.
  const cast = scenario.cast.find((c) => c.agentId === agentId);
  const desk =
    (cast?.spawnLocationId ? byId(cast.spawnLocationId) : undefined) ??
    first((l) => l.bindTo?.anchorId === `desk:${agentId}`) ??
    byId(deskGuess) ??
    (manager ? first((l) => hasTag(l, 'truth_source')) : undefined);

  const breakLoc =
    first((l) => hasTag(l, 'social')) ??
    first((l) => l.locationId.includes('break')) ??
    byId('break_room');

  const meeting =
    first((l) => hasTag(l, 'meeting')) ??
    first((l) => l.locationId.includes('conference') || l.locationId.includes('meeting')) ??
    null;

  const fallback =
    first((l) => hasTag(l, 'fallback')) ??
    first((l) => l.locationId.includes('hallway')) ??
    byId('hallway');

  return {
    deskLocationId: desk?.locationId ?? deskGuess,
    breakLocationId: breakLoc?.locationId ?? 'break_room',
    meetingLocationId: meeting?.locationId ?? null,
    fallbackLocationId: fallback?.locationId ?? 'hallway',
  };
}

// --- generation --------------------------------------------------------------

const pad = (n: number): string => String(n).padStart(2, '0');
const toHHMM = (mins: number): string => `${pad(Math.floor(mins / 60))}:${pad(mins % 60)}`;
const jitter = (rng: Rng, span: number): number => Math.round((rng() - 0.5) * 2 * span);

interface Seg {
  start: number;
  end: number;
  locationId: string;
  activity: string;
  onBlockedLocation: OnBlockedLocation;
}

/**
 * Generate a soft default daily routine for a persona. Deterministic in
 * `(profile, context, seed)`. Breaks scale with the persona's rest need; whether
 * they're social (break room) vs. solitary (at desk) scales with extraversion and
 * belonging; conscientiousness tightens the schedule. Managers spend desk time in
 * their office and take a floor walk in place of a morning break.
 */
export function generateRoutine(
  profile: CharacterProfile,
  ctx: RoutineContext,
  seed: number | string = profile.agentId,
): RoutineBlock[] {
  const rng = mulberry32(typeof seed === 'number' ? seed >>> 0 : seedToInt(seed));

  const ext = profile.personality.ocean.extraversion;
  const cons = profile.personality.ocean.conscientiousness;
  const rest = profile.needs.rest;
  const belonging = profile.needs.belonging;
  const manager = isManager(profile);

  // How much this persona wants to step away from work (0–100). A low rest baseline
  // or high rest sensitivity pulls up; conscientiousness pulls down.
  const restPull = clampUnit((100 - rest.baseline) * 0.5 + rest.sensitivity * 0.5 - (cons - 50) * 0.4);
  // Whether a break is social (break room) or solitary (stays at desk).
  const socialPull = clampUnit(ext * 0.55 + belonging.sensitivity * 0.3 + (100 - belonging.baseline) * 0.15);

  const breakLen = 10 + Math.round(restPull / 10); // 10–20 min
  const breakLocation = socialPull >= 50 ? ctx.breakLocationId : ctx.deskLocationId;

  const specials: Seg[] = [];

  // Lunch — everyone gets one, so a routine is never one degenerate block. Length and
  // exact start scale with the rest need.
  const lunchLen = 30 + Math.round((restPull / 100) * 30); // 30–60 min
  const lunchStart = LUNCH_START + jitter(rng, 15);
  specials.push({
    start: lunchStart,
    end: lunchStart + lunchLen,
    locationId: ctx.breakLocationId,
    activity: 'lunch',
    onBlockedLocation: 'reroute_to_fallback',
  });

  // Morning break — a manager takes a floor walk instead (presence/monitoring).
  if (restPull + jitter(rng, 15) > 35) {
    const start = 10 * 60 + 15 + jitter(rng, 20);
    specials.push(
      manager
        ? { start, end: start + breakLen, locationId: ctx.fallbackLocationId, activity: 'walk', onBlockedLocation: 'return_to_desk' }
        : { start, end: start + breakLen, locationId: breakLocation, activity: 'break', onBlockedLocation: 'wait_in_hallway' },
    );
  }

  // Afternoon break — slightly easier to trigger (afternoon fatigue).
  if (restPull + jitter(rng, 15) > 28) {
    const start = 15 * 60 + jitter(rng, 25);
    specials.push({ start, end: start + breakLen, locationId: breakLocation, activity: 'break', onBlockedLocation: 'wait_in_hallway' });
  }

  // A standing meeting for those who'd convene one — when the office has a room for it.
  if (ctx.meetingLocationId && (manager || profile.personality.axes.ambition >= 65) && rng() > 0.4) {
    const start = 11 * 60 + jitter(rng, 15);
    specials.push({ start, end: start + 30, locationId: ctx.meetingLocationId, activity: 'meeting', onBlockedLocation: 'skip_block' });
  }

  return assembleDay(specials, ctx, manager);
}

/**
 * Lay the special blocks onto the 09:00–17:00 day, filling the gaps with desk work.
 * Overlapping specials are dropped (first-placed wins); zero/negative-length blocks
 * are discarded; the result is contiguous and clamped to the workday.
 */
function assembleDay(specials: Seg[], ctx: RoutineContext, manager: boolean): RoutineBlock[] {
  const sorted = [...specials].filter((s) => s.end > s.start).sort((a, b) => a.start - b.start);

  const deskWork = (start: number, end: number): Seg => ({
    start,
    end,
    locationId: ctx.deskLocationId,
    activity: manager ? 'monitoring' : 'work',
    onBlockedLocation: 'return_to_desk',
  });

  const out: Seg[] = [];
  let cursor = DAY_START;
  for (const seg of sorted) {
    const start = Math.max(seg.start, DAY_START);
    const end = Math.min(seg.end, DAY_END);
    if (start < cursor || end <= start) continue; // overlaps an already-placed block
    if (start > cursor) out.push(deskWork(cursor, start));
    out.push({ ...seg, start, end });
    cursor = end;
  }
  if (cursor < DAY_END) out.push(deskWork(cursor, DAY_END));

  return out.map((s) => ({
    startTime: toHHMM(s.start),
    endTime: toHHMM(s.end),
    locationId: s.locationId,
    activity: s.activity,
    onBlockedLocation: s.onBlockedLocation,
  }));
}
