/**
 * Floor-overlay style spec (Epic 36 — ui_visual_design.md "Visual Language").
 *
 * The in-world floor overlays (relationship arcs, pressure halos, traveling
 * information packets, belief tints, selection/scan framing) are drawn by the
 * **Shapes** GPU-vector layer in the game, immediate-mode, from sim state every
 * frame — so the tool cannot author them as assets. But ART DIRECTION stays
 * tool-side (the project rule that style stays tweakable post-build): this file
 * is the look spec the Shapes layer reads. Same split as conversation-style.json
 * — tool owns the look, the runtime owns the drawing.
 *
 * Colors reference theme.uss `--wc-*` tokens (see uiPalette.ts) so the floor and
 * the chrome resolve one palette. One channel per concept; the FORM (line vs
 * marker-tint vs halo vs token vs flash vs scan) distinguishes channels, so hues
 * may repeat across them.
 */

/**
 * Layered bloom drawn UNDER the core stroke — a wide, soft, low-alpha pass that
 * makes a thin vector line read against a busy floor. This is the single biggest
 * "pop" lever, and it is STATIC (no motion), so it enriches state lines without
 * violating the motion-encodes-events rule.
 */
export interface OverlayGlow {
  /** Theme token for the underlay; omit to reuse the channel's own color. */
  color?: string;
  /** Underlay width as a multiple of the core stroke weight. */
  widthMul: number;
  /** Peak alpha of the bloom (0..1). */
  alpha: number;
}

/**
 * Directional treatment along an arc-line. `speedHz: 0` is a STILL gradient
 * (direction without animation — safe for state lines); `speedHz > 0` travels
 * and is therefore reserved for event/active channels per the motion rule.
 */
export interface OverlayFlow {
  /** Which way the gradient/pips point: who-trusts-whom, which way info moved. */
  direction: 'a-to-b' | 'b-to-a' | 'bidirectional';
  /** Travel speed in arc-lengths/sec. 0 = static gradient, no animation. */
  speedHz: number;
  /** Optional pips riding the arc (only meaningful when speedHz > 0). */
  pip?: { radius: number; spacingMul: number; color?: string };
}

/** Per-agent anchor so a tie reads as a BOND between two people, not a stray stroke. */
export interface OverlayEndpoints {
  cap: 'pip' | 'ring' | 'none';
  radius: number;
  /** Omit to reuse the channel color. */
  color?: string;
}

/**
 * Emotion-keyed agitation — high-frequency wobble that encodes HEAT (an active,
 * intensifying tie), distinct from event motion. Reserved for escalated/hostile
 * channels; calm state lines leave this unset and stay still.
 */
export interface OverlayJitter {
  ampPx: number;
  freqHz: number;
}

export interface OverlayChannel {
  /** Human-readable concept from the Visual Language table. */
  concept: string;
  /** How Shapes draws it. */
  form:
    | 'arc-line'
    | 'marker-tint'
    | 'halo'
    | 'carried-token'
    | 'flash'
    | 'scan-framing';
  /** Motion discipline: stillness encodes state, motion encodes events. */
  motion: 'still' | 'pulse' | 'single-pulse' | 'dash-offset' | 'travels-path' | 'scanline';
  /** Soft bloom under the core stroke (static richness — the main legibility lever). */
  glow?: OverlayGlow;
  /** Directional gradient / traveling pips along an arc-line. */
  flow?: OverlayFlow;
  /** Per-agent anchors so a tie reads as a bond between two people. */
  endpoints?: OverlayEndpoints;
  /** Emotion-keyed agitation (heat) for active/escalated ties. */
  jitter?: OverlayJitter;
  /**
   * Per-channel focus override. When the sim has a selection, relevant edges
   * bloom (focusWeightMul) and irrelevant ones recede (dimAlpha). Omit to use
   * the global `focus` defaults from overlayStyleJson.
   */
  focusWeightMul?: number;
  dimAlpha?: number;
  [extra: string]: unknown;
}

/**
 * The default floor-overlay vocabulary. Weights/dashes/motion are the tweakable
 * art direction; `color`/`axis` reference `--wc-*` theme tokens.
 */
export const DEFAULT_OVERLAY_STYLE: Record<string, OverlayChannel> = {
  trust: {
    concept: 'Trust',
    form: 'arc-line',
    color: '--wc-trust',
    // Pure state → stays still. Its "pop" is all static: a soft bloom, a
    // directional gradient (no travel), and pips anchored on both agents so the
    // tie reads as a bond. Strength still drives weight.
    motion: 'still',
    weightByStrength: true,
    minWeight: 1.5,
    maxWeight: 6,
    dash: null,
    glow: { color: '--wc-trust', widthMul: 3.5, alpha: 0.22 },
    flow: { direction: 'bidirectional', speedHz: 0 },
    endpoints: { cap: 'pip', radius: 2.5, color: '--wc-trust' },
  },
  suspicion: {
    concept: 'Suspicion / conflict',
    form: 'arc-line',
    color: '--wc-suspicion',
    escalateColor: '--wc-hostility',
    // Semi-active tie: a scrolling dash reads as wariness. As it escalates toward
    // hostility the sim cross-fades to escalateColor and applies the jitter (heat).
    motion: 'dash-offset',
    weight: 2.5,
    dash: [6, 4],
    glow: { color: '--wc-suspicion', widthMul: 3, alpha: 0.18 },
    flow: { direction: 'a-to-b', speedHz: 0.6, pip: { radius: 1.5, spacingMul: 4 } },
    endpoints: { cap: 'ring', radius: 3, color: '--wc-hostility' },
    jitter: { ampPx: 1.2, freqHz: 7 },
  },
  belief: {
    concept: 'Belief drift',
    form: 'marker-tint',
    motion: 'still',
    axis: { truth: '--wc-belief-truth', rumor: '--wc-belief-rumor' },
  },
  pressure: {
    concept: 'Pressure / stress',
    form: 'halo',
    color: '--wc-pressure',
    motion: 'pulse',
    intensity: 'pulse-rate',
    minPulseHz: 0.3,
    maxPulseHz: 1.6,
    maxConcurrentPerAgent: 1,
  },
  information: {
    concept: 'Information possession',
    form: 'carried-token',
    color: '--wc-information',
    motion: 'travels-path',
    tokenRadius: 3,
  },
  change: {
    concept: 'Recent change',
    form: 'flash',
    color: '--wc-change',
    motion: 'single-pulse',
    durationMs: 450,
  },
  surveillance: {
    concept: 'Surveillance attention',
    form: 'scan-framing',
    color: '--wc-surveillance',
    motion: 'scanline',
    alpha: 0.15,
  },
};

/** Exported descriptor — the Shapes floor layer reads this to draw overlays. */
export function overlayStyleJson(channels: Record<string, OverlayChannel> = DEFAULT_OVERLAY_STYLE) {
  return {
    kind: 'floor-overlay-style' as const,
    generator: 'sprite-character-creator',
    schema: 'ui_visual_design.md#visual-language',
    renderer: 'shapes',
    /** Two protective rules from the design doc. */
    rules: {
      motionEncodesEvents: true, // motion = events, stillness = state
      oneDominantPressurePerAgent: true,
    },
    /**
     * Focus model: the floor only "pops" when it stops competing with itself.
     * When the sim has a selection, edges touching it bloom (focusWeightMul) and
     * everything else recedes (dimAlpha). Sim owns the selection state; these are
     * the tweakable art-direction values. A channel may override via its own
     * focusWeightMul / dimAlpha.
     */
    focus: {
      focusWeightMul: 1.6,
      dimAlpha: 0.18,
      fadeMs: 180,
    },
    channels,
    meta: {
      note:
        'The Shapes floor layer draws these from sim state each frame; the tool owns the ' +
        'look, not the drawing. Colors reference theme.uss --wc-* tokens so floor and chrome ' +
        'share one palette. One channel per concept; the form distinguishes channels.',
    },
  };
}
