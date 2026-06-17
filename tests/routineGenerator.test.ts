import { describe, it, expect } from 'vitest';
import {
  CANONICAL_LOCATION_IDS,
  generateRoutine,
  resolveRoutineContext,
} from '../src/core/routineGenerator';
import { ON_BLOCKED_LOCATION, createDefaultProfile, type CharacterProfile } from '../src/core/profile';
import { DEFAULT_PROFILES, DEFAULT_SCENARIOS } from '../src/data/defaults';
import type { CharacterRecipe } from '../src/core/types';

const recipe = (id: string): CharacterRecipe => ({
  id,
  name: id,
  parts: { body: '', head: '', hair: '', outfit: '', accessories: [] },
  palette: { skin: '#000', hair: '#000', outfitPrimary: '#000', outfitSecondary: '#000', accent: '#000' },
});

const toMin = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

const canonicalCtx = (p: CharacterProfile) => resolveRoutineContext(p);

describe('routine generation', () => {
  it('is deterministic: same profile + context + seed → identical routine', () => {
    const p = createDefaultProfile(recipe('carl'));
    const a = generateRoutine(p, canonicalCtx(p));
    const b = generateRoutine(p, canonicalCtx(p));
    expect(a).toEqual(b);
  });

  it('produces a contiguous, gap-free, non-overlapping day from 09:00 to 17:00', () => {
    for (const base of DEFAULT_PROFILES) {
      const blocks = generateRoutine(base, canonicalCtx(base));
      expect(blocks.length).toBeGreaterThan(0);
      expect(blocks[0].startTime).toBe('09:00');
      expect(blocks[blocks.length - 1].endTime).toBe('17:00');
      for (let i = 0; i < blocks.length; i++) {
        expect(toMin(blocks[i].endTime)).toBeGreaterThan(toMin(blocks[i].startTime));
        if (i > 0) expect(blocks[i].startTime).toBe(blocks[i - 1].endTime); // no gaps, no overlaps
      }
    }
  });

  it('always includes a lunch block (never one degenerate work block)', () => {
    for (const base of DEFAULT_PROFILES) {
      const blocks = generateRoutine(base, canonicalCtx(base));
      expect(blocks.some((b) => b.activity === 'lunch')).toBe(true);
    }
  });

  it('emits valid on-blocked responses and HH:MM times', () => {
    const p = createDefaultProfile(recipe('carl'));
    for (const b of generateRoutine(p, canonicalCtx(p))) {
      expect(ON_BLOCKED_LOCATION).toContain(b.onBlockedLocation);
      expect(b.startTime).toMatch(/^\d{2}:\d{2}$/);
      expect(b.endTime).toMatch(/^\d{2}:\d{2}$/);
    }
  });

  it('a restless persona takes more break time than a disciplined one', () => {
    const restless = createDefaultProfile(recipe('restless'));
    restless.needs.rest.baseline = 10;
    restless.needs.rest.sensitivity = 90;
    restless.personality.ocean.conscientiousness = 20;

    const disciplined = createDefaultProfile(recipe('disciplined'));
    disciplined.needs.rest.baseline = 90;
    disciplined.needs.rest.sensitivity = 10;
    disciplined.personality.ocean.conscientiousness = 90;

    const breakMin = (p: CharacterProfile) =>
      generateRoutine(p, canonicalCtx(p))
        .filter((b) => b.activity === 'break')
        .reduce((sum, b) => sum + (toMin(b.endTime) - toMin(b.startTime)), 0);

    expect(breakMin(restless)).toBeGreaterThan(breakMin(disciplined));
  });

  it('canonical context puts a non-manager at their own <agentId>_desk', () => {
    const p = createDefaultProfile(recipe('carl'));
    const ctx = resolveRoutineContext(p);
    expect(ctx.deskLocationId).toBe('carl_desk');
    expect(ctx.breakLocationId).toBe('break_room');
    expect(CANONICAL_LOCATION_IDS).toContain(ctx.fallbackLocationId);
  });

  it('canonical context puts a manager in the manager office, working there', () => {
    const p = createDefaultProfile(recipe('manager'));
    p.identity.seniority = 'manager';
    const ctx = resolveRoutineContext(p);
    expect(ctx.deskLocationId).toBe('manager_office');
    const blocks = generateRoutine(p, ctx);
    expect(blocks.some((b) => b.locationId === 'manager_office' && b.activity === 'monitoring')).toBe(true);
  });

  it('scenario-aware: every generated location resolves to a declared scenario location', () => {
    const scenario = DEFAULT_SCENARIOS[0];
    const declared = new Set(scenario.locations.map((l) => l.locationId));
    for (const base of DEFAULT_PROFILES) {
      const ctx = resolveRoutineContext(base, scenario);
      // The desk should bind to this agent's real scenario location, not a guess.
      expect(declared.has(ctx.deskLocationId)).toBe(true);
      for (const b of generateRoutine(base, ctx)) {
        expect(declared.has(b.locationId)).toBe(true);
      }
    }
  });
});
