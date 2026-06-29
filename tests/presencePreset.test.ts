import { describe, it, expect } from 'vitest';
import {
  applyDerived,
  applyPresencePreset,
  createDefaultProfile,
  PRESENCE_CHANNELS,
  serializeProfile,
  validateProfile,
  type PresencePreset,
} from '../src/core/profile';
import { CONFIDENT, NERVOUS, PRESENCE_PRESETS, getPresencePreset } from '../src/data/presencePresets';
import { DEFAULT_CAST } from '../src/data/defaults';

const agentIds = DEFAULT_CAST.map((c) => c.id);

describe('presence presets', () => {
  it('every starter preset is valid: unique id, known channels, in-range deltas', () => {
    const ids = new Set<string>();
    for (const preset of PRESENCE_PRESETS) {
      expect(ids.has(preset.id)).toBe(false);
      ids.add(preset.id);
      for (const [channel, delta] of Object.entries(preset.deltas)) {
        expect(PRESENCE_CHANNELS).toContain(channel);
        expect(Math.abs(delta as number)).toBeLessThanOrEqual(100);
      }
    }
    expect(getPresencePreset('confident')).toBe(CONFIDENT);
    expect(getPresencePreset('nope')).toBeUndefined();
  });

  it('folds deltas over the derived baseline and marks touched channels authored', () => {
    const p = createDefaultProfile(DEFAULT_CAST[0]); // neutral spine → presence ~50
    const baseCommitment = p.presence.commitment.value;
    const report = applyPresencePreset(p, CONFIDENT);
    expect(p.presence.commitment.value).toBe(Math.min(100, baseCommitment + 25));
    expect(p.presence.commitment.authored).toBe(true);
    // Untouched channel stays derived (not authored).
    expect(p.presence.attentiveness.authored).toBe(false);
    expect(report.applied.some((a) => a.channel === 'commitment' && a.delta === 25)).toBe(true);
    expect(validateProfile(p, { agentIds })).toEqual([]);
  });

  it('a preset survives re-derivation and export (authored channels are sticky)', () => {
    const p = createDefaultProfile(DEFAULT_CAST[0]);
    applyPresencePreset(p, NERVOUS);
    const afterPreset = p.presence.restlessness.value;
    applyDerived(p); // e.g. an unrelated spine edit triggers a re-derive
    expect(p.presence.restlessness.value).toBe(afterPreset);
    const out = serializeProfile(p) as any;
    expect(out.presence.restlessness).toBe(afterPreset); // export resolves it, doesn't wipe it
  });

  it('clamps when a delta would push a channel past the rail', () => {
    const p = createDefaultProfile(DEFAULT_CAST[0]);
    // authored so the baseline re-derive preserves it; +25 then overshoots → clamp.
    p.presence.commitment = { value: 90, authored: true };
    applyPresencePreset(p, CONFIDENT);
    expect(p.presence.commitment.value).toBe(100);
  });

  it('stacks: a second preset folds over the first', () => {
    const p = createDefaultProfile(DEFAULT_CAST[0]);
    applyPresencePreset(p, NERVOUS); // latency +20
    const afterFirst = p.presence.latency.value;
    const slowLinger: PresencePreset = { id: 't', label: 'T', description: '', deltas: { latency: 10 } };
    applyPresencePreset(p, slowLinger); // +10 more, over the now-authored value
    expect(p.presence.latency.value).toBe(Math.min(100, afterFirst + 10));
  });

  it('opposite presets move a channel in opposite directions from the same baseline', () => {
    const confident = createDefaultProfile(DEFAULT_CAST[0]);
    const nervous = createDefaultProfile(DEFAULT_CAST[0]);
    applyPresencePreset(confident, CONFIDENT); // commitment +25, latency -20
    applyPresencePreset(nervous, NERVOUS); // commitment -25, latency +20
    expect(confident.presence.commitment.value).toBeGreaterThan(nervous.presence.commitment.value);
    expect(nervous.presence.latency.value).toBeGreaterThan(confident.presence.latency.value);
  });
});
