import type { StyleSheet } from '../core/types';

/**
 * Canonical Water Cooler palette — the single source of truth for every color
 * the tool emits as UI. World sprites tint per-recipe (skin/hair/outfit…); THIS
 * is the shared, semantic set that UI chrome (theme.uss / theme.json) and the
 * diegetic emote/icon masks both resolve, so the framing UI and the world agree
 * without sharing a pipeline. See docs/ui-art-plan.md.
 *
 * Repointed literals live here now — do not edit a hex in two places:
 *   - INK in parts/library.ts and parts/moods.ts        -> ink
 *   - GLYPH white in parts/activities.ts and parts/moods.ts -> onColor
 *   - badge bubble fills in parts/activities.ts          -> emote.*
 *   - badge bubble fills in parts/moods.ts               -> emote.*
 */

// Base hues — spread around the wheel for crowd legibility. The emote bubbles
// and the semantic status colors both draw from these, so status.info IS the
// working blue, status.danger IS the hostile red, etc. — they coincide by
// construction rather than by eye.
const BLUE = '#4C84E0';
const GREEN = '#46C07A';
const PURPLE = '#9B6CF0';
const AMBER = '#E0A03A';
const ORANGE = '#E0772F';
const GREY = '#8A9099';
const TEAL = '#2FA98F';
const SKY = '#5B8DEF';
const INDIGO = '#6E5BC4';
const AZURE = '#3E78C8';
const RED = '#CE4038';

export const UI_PALETTE = {
  /** Near-black ink — eyes, hardware, bubble rings, and UI text. */
  ink: '#2C2C2A',
  /** White sitting on a colored fill (glyph-on-bubble, text-on-accent). */
  onColor: '#FFFFFF',
  /** Warm paper surface + raised panel — chrome backgrounds. */
  surface: '#F4F1EA',
  panel: '#FFFFFF',
  /** Primary action color for chrome. */
  accent: BLUE,
  /** Semantic status colors for chrome (badges, toasts, validation). */
  status: {
    info: BLUE,
    positive: GREEN,
    warning: AMBER,
    danger: RED,
    neutral: GREY,
  },
  /** Diegetic overhead-emote bubble hues (activity + mood badges). */
  emote: {
    work: BLUE,
    talking: GREEN,
    meeting: PURPLE,
    break: AMBER,
    lunch: ORANGE,
    idle: GREY,
    walk: TEAL,
    monitoring: SKY,
    moodSuspicious: INDIGO,
    moodCurious: AZURE,
    moodDefensive: AMBER,
    moodHostile: RED,
    moodConfused: TEAL,
  },
} as const;

/**
 * The exported theme as a flat `name -> hex` map. Framework-neutral, so uGUI
 * (theme.json) and UI Toolkit (theme.uss) emit the same palette. `line` is the
 * project's ACTUAL outline color, not a constant, so the theme reflects the
 * world it ships beside.
 */
export function themeColors(style: StyleSheet): Record<string, string> {
  return {
    ink: UI_PALETTE.ink,
    'on-color': UI_PALETTE.onColor,
    line: style.outline.color,
    surface: UI_PALETTE.surface,
    panel: UI_PALETTE.panel,
    accent: UI_PALETTE.accent,
    'status-info': UI_PALETTE.status.info,
    'status-positive': UI_PALETTE.status.positive,
    'status-warning': UI_PALETTE.status.warning,
    'status-danger': UI_PALETTE.status.danger,
    'status-neutral': UI_PALETTE.status.neutral,
    'emote-work': UI_PALETTE.emote.work,
    'emote-talking': UI_PALETTE.emote.talking,
    'emote-meeting': UI_PALETTE.emote.meeting,
    'emote-break': UI_PALETTE.emote.break,
    'emote-lunch': UI_PALETTE.emote.lunch,
    'emote-idle': UI_PALETTE.emote.idle,
    'emote-walk': UI_PALETTE.emote.walk,
    'emote-monitoring': UI_PALETTE.emote.monitoring,
    'emote-mood-suspicious': UI_PALETTE.emote.moodSuspicious,
    'emote-mood-curious': UI_PALETTE.emote.moodCurious,
    'emote-mood-defensive': UI_PALETTE.emote.moodDefensive,
    'emote-mood-hostile': UI_PALETTE.emote.moodHostile,
    'emote-mood-confused': UI_PALETTE.emote.moodConfused,
  };
}

/** UI Toolkit theme: `:root` custom properties (`--wc-<name>`). */
export function themeUss(style: StyleSheet): string {
  const vars = Object.entries(themeColors(style))
    .map(([name, hex]) => `  --wc-${name}: ${hex};`)
    .join('\n');
  return (
    '/* The Water Cooler — generated UI theme. Single source of truth: the tool\n' +
    '   palette (src/data/uiPalette.ts). Do not hand-edit; re-export from Terrarium. */\n' +
    `:root {\n${vars}\n}\n`
  );
}

/** Framework-neutral theme for uGUI / non-USS consumers. */
export function themeJson(style: StyleSheet): string {
  return JSON.stringify({ palette: themeColors(style) }, null, 2);
}
