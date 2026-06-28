import type {
  AnchorName,
  CharacterRecipe,
  Facing,
  PaletteToken,
  PartVariant,
  PropInstance,
  PropPalette,
  ShapeSpec,
  StyleSheet,
} from './types';
import type { Mood, TileInstance } from './types';
import { CANVAS, MOODS } from './types';
import { circle, ellipse } from './geometry';
import { getPart } from '../parts/library';
import { MOOD_EMOTES, MOOD_OVERLAYS } from '../parts/moods';
import type { Activity } from '../parts/activities';
import { ACTIVITY_BADGES } from '../parts/activities';
import { PROP_STATUS_BADGES, type PropStatus } from '../parts/propStatus';
import { ATTENTION_PUFF_ART, type AttentionPuff, type AttentionPuffArt } from '../parts/attention';
import { getIcon } from '../parts/icons';
import { PROP_TEMPLATES } from '../props/templates';
import { FLOOR_TEMPLATES, WALL_TEMPLATES } from '../tiles/templates';

/**
 * Named attachment points in canvas coordinates, per facing. Moving an anchor
 * moves everything attached to it — parts are never positioned absolutely.
 */
const ANCHORS: Record<Facing, Record<AnchorName, { x: number; y: number }>> = {
  south: {
    body: { x: 64, y: 87 },
    neck: { x: 64, y: 58 },
    headCenter: { x: 64, y: 44 },
    aboveHead: { x: 64, y: 12 },
    chest: { x: 64, y: 80 },
    handRight: { x: 89, y: 99 },
  },
  east: {
    body: { x: 64, y: 87 },
    neck: { x: 64, y: 58 },
    headCenter: { x: 67, y: 44 },
    aboveHead: { x: 67, y: 12 },
    chest: { x: 64, y: 80 },
    handRight: { x: 80, y: 99 },
  },
  north: {
    body: { x: 64, y: 87 },
    neck: { x: 64, y: 58 },
    headCenter: { x: 64, y: 44 },
    aboveHead: { x: 64, y: 12 },
    chest: { x: 64, y: 80 },
    handRight: { x: 89, y: 99 },
  },
};

/** Anchors whose parts belong to the head group (scaled by headScale). */
const HEAD_ANCHORS: AnchorName[] = ['headCenter'];

type ResolveToken = (ref: string) => string;

function makeCharacterResolver(recipe: CharacterRecipe): ResolveToken {
  return (ref) => {
    if (!ref.startsWith('$')) return ref;
    const token = ref.slice(1) as keyof CharacterRecipe['palette'];
    return recipe.palette[token] ?? '#FF00FF'; // magenta = missing token, on purpose
  };
}

function makePropResolver(palette: PropPalette): ResolveToken {
  return (ref) => {
    if (!ref.startsWith('$')) return ref;
    return palette[ref.slice(1) as keyof PropPalette] ?? '#FF00FF';
  };
}

function shapeIsSilhouette(s: ShapeSpec): boolean {
  return s.silhouette !== false;
}

function emitColorShape(s: ShapeSpec, resolve: ResolveToken): string {
  const attrs: string[] = [`d="${s.d}"`];
  attrs.push(`fill="${s.fill ? resolve(s.fill) : 'none'}"`);
  if (s.stroke) {
    attrs.push(`stroke="${resolve(s.stroke)}"`);
    attrs.push(`stroke-width="${s.strokeWidth ?? 1.5}"`);
    attrs.push(`stroke-linecap="round" stroke-linejoin="round"`);
  }
  if (s.opacity !== undefined) attrs.push(`opacity="${s.opacity}"`);
  return `<path ${attrs.join(' ')}/>`;
}

function emitOutlineShape(s: ShapeSpec, style: StyleSheet): string {
  const { width, color } = style.outline;
  if (s.fill) {
    return (
      `<path d="${s.d}" fill="${color}" stroke="${color}" ` +
      `stroke-width="${width * 2}" stroke-linejoin="round" stroke-linecap="round"/>`
    );
  }
  // Stroke-only shape that participates in the silhouette (e.g. mug handle).
  return (
    `<path d="${s.d}" fill="none" stroke="${color}" ` +
    `stroke-width="${(s.strokeWidth ?? 1.5) + width * 2}" stroke-linejoin="round" stroke-linecap="round"/>`
  );
}

interface PlacedPart {
  variant: PartVariant;
  anchor: { x: number; y: number };
  group: 'body' | 'head';
}

/** Mood overlays paint over the head (z 40) but under hair (z 50). */
const MOOD_Z = 45;

function placeParts(recipe: CharacterRecipe, facing: Facing, mood: Mood): PlacedPart[] {
  const ids = [
    recipe.parts.body,
    recipe.parts.outfit,
    ...recipe.parts.accessories,
    recipe.parts.head,
    recipe.parts.hair,
  ];
  const placed: PlacedPart[] = [];
  for (const id of ids) {
    const part = getPart(id);
    if (!part) continue;
    const variant = part.facings[facing];
    if (!variant) continue;
    placed.push({
      variant,
      anchor: ANCHORS[facing][part.anchor],
      group: HEAD_ANCHORS.includes(part.anchor) ? 'head' : 'body',
    });
  }
  // Soft neck shadow cast by the head onto the chest — automatic for every
  // character, sized per facing, scales with bodyWidth via the body group.
  placed.push({
    variant: {
      shapes: [
        {
          d: ellipse(0, -22, facing === 'east' ? 9 : 12, 4),
          fill: '#00000018',
          silhouette: false,
        },
      ],
      z: 35,
    },
    anchor: ANCHORS[facing].body,
    group: 'body',
  });

  const moodShapes = MOOD_OVERLAYS[mood][facing];
  if (moodShapes && moodShapes.length > 0) {
    placed.push({
      variant: { shapes: moodShapes, z: MOOD_Z },
      anchor: ANCHORS[facing].headCenter,
      group: 'head',
    });
  }
  return placed.sort((a, b) => a.variant.z - b.variant.z);
}

function groupTransform(group: 'body' | 'head', facing: Facing, style: StyleSheet): string {
  if (group === 'head') {
    const neck = ANCHORS[facing].neck;
    const s = style.proportions.headScale;
    return `translate(${neck.x} ${neck.y}) scale(${s}) translate(${-neck.x} ${-neck.y})`;
  }
  const s = style.proportions.bodyWidth;
  return `translate(${CANVAS / 2} 0) scale(${s} 1) translate(${-CANVAS / 2} 0)`;
}

function renderPlaced(
  placed: PlacedPart[],
  facing: Facing,
  style: StyleSheet,
  resolve: ResolveToken,
): string {
  const partMarkup = (p: PlacedPart, emit: (s: ShapeSpec) => string, only?: 'silhouette') => {
    const shapes = p.variant.shapes.filter((s) => (only ? shapeIsSilhouette(s) : true));
    if (shapes.length === 0) return '';
    return `<g transform="translate(${p.anchor.x} ${p.anchor.y})">${shapes.map(emit).join('')}</g>`;
  };

  const wrapGroup = (group: 'body' | 'head', inner: string) =>
    inner ? `<g transform="${groupTransform(group, facing, style)}">${inner}</g>` : '';

  const outlineOn = style.outline.width > 0;

  if (style.outline.mode === 'per-part' && outlineOn) {
    // Outline each part just before painting it: internal edges get outlines too.
    const render = (group: 'body' | 'head') =>
      wrapGroup(
        group,
        placed
          .filter((p) => p.group === group)
          .map(
            (p) =>
              partMarkup(p, (s) => emitOutlineShape(s, style), 'silhouette') +
              partMarkup(p, (s) => emitColorShape(s, resolve)),
          )
          .join(''),
      );
    return render('body') + render('head');
  }

  // Silhouette mode: one unified outline underlay beneath all color.
  const layer = (emit: (s: ShapeSpec) => string, only?: 'silhouette') =>
    wrapGroup('body', placed.filter((p) => p.group === 'body').map((p) => partMarkup(p, emit, only)).join('')) +
    wrapGroup('head', placed.filter((p) => p.group === 'head').map((p) => partMarkup(p, emit, only)).join(''));

  const outline = outlineOn ? layer((s) => emitOutlineShape(s, style), 'silhouette') : '';
  const color = layer((s) => emitColorShape(s, resolve));
  return outline + color;
}

/** Style-neutral ink ringing the badge bubble — matches the face overlays. */
const BADGE_INK = '#2C2C2A';
/**
 * A light contrast halo drawn BEHIND the dark ink ring, so the badge separates
 * from whatever it floats over on a busy floor (a sticker outline). Universal:
 * the white ring reads against both dark and light backgrounds. The sim never has
 * to know the floor color — the legibility is baked into the cell.
 */
const BADGE_HALO = '#FFFFFF';
/** Ink ring stroke + halo ring stroke (badge-local units). Halo > ink so it peeks out. */
const BADGE_INK_STROKE = 1.5;
const BADGE_HALO_STROKE = 4.5;

/** Bubble radius and outer stroke half-width in badge-local units (pre-scale). */
const BADGE_RADIUS = 8;
/** Outermost reach from the bubble edge = half the widest (halo) ring. */
const BADGE_STROKE_HALF = BADGE_HALO_STROKE / 2;
/**
 * Uniform scale on the whole emote badge. The badge is the readability-at-scale
 * element (it carries the mood in tiny scene/poster sprites), so it's drawn well
 * larger than the source artwork. Bump this to make moods more legible.
 */
const BADGE_SCALE = 1.9;
/** Keep the scaled bubble's top edge this far below the canvas top (no clipping). */
const BADGE_TOP_MARGIN = 2;

/**
 * Draw a path twice: a fat light HALO stroke first (peeks out as a contrast ring),
 * then the real fill + crisp dark ink ring on top. Used for every overhead bubble
 * and puff silhouette so they pop against a busy floor. `fill` may be 'none'.
 */
function haloedPath(d: string, fill: string, inkStroke = BADGE_INK_STROKE, haloStroke = BADGE_HALO_STROKE): string {
  return (
    `<path d="${d}" fill="none" stroke="${BADGE_HALO}" stroke-width="${haloStroke}" stroke-linejoin="round"/>` +
    `<path d="${d}" fill="${fill}" stroke="${BADGE_INK}" stroke-width="${inkStroke}" stroke-linejoin="round"/>`
  );
}

/**
 * A color + glyph pair drawn on the overhead bubble. Both mood emotes and
 * activity badges share this shape, so the same renderer draws either.
 */
interface BadgeSpec {
  color: string;
  glyph: ShapeSpec[];
}

/**
 * The overhead emote badge: a thought-bubble holding the glyph. Drawn in canvas
 * coords, undistorted by the body/head group transforms, so it reads crisply at
 * any zoom, and scaled up (BADGE_SCALE) for legibility everywhere. Glyph
 * fills/strokes are literal colors, so the resolver is the identity.
 */
function emoteMarkup(emote: BadgeSpec, ax: number, ay: number): string {
  const identity: ResolveToken = (ref) => ref;
  // Center the bubble at the anchor, but push it down just enough that the
  // scaled top edge clears the canvas top. The badge grows mostly downward
  // (toward the head), which is the empty band above the face.
  const minCenter = BADGE_TOP_MARGIN + (BADGE_RADIUS + BADGE_STROKE_HALF) * BADGE_SCALE;
  const cy = Math.max(ay, minCenter);
  // Tail (two thought dots) and bubble all carry the halo so the whole badge reads
  // as one haloed sticker, not a haloed disc with bare tail dots.
  const tail =
    haloedPath(circle(0.5, 8.6, 1.7), emote.color, 1.2, 3.2) +
    haloedPath(circle(-0.8, 11.8, 1), emote.color, 1, 2.6);
  const bubble = haloedPath(circle(0, 0, BADGE_RADIUS), emote.color);
  const glyph = emote.glyph.map((s) => emitColorShape(s, identity)).join('');
  return `<g transform="translate(${ax} ${cy}) scale(${BADGE_SCALE})">${tail}${bubble}${glyph}</g>`;
}

/**
 * A soft contact shadow ellipse in literal black at the style's contactShadow
 * opacity. silhouette-free by construction (it's emitted raw, outside the
 * outline pass), so it never fattens the figure. Returns '' when disabled.
 */
function contactShadow(cx: number, cy: number, rx: number, ry: number, style: StyleSheet): string {
  const o = style.render.contactShadow ?? 0;
  if (o <= 0) return '';
  return `<path d="${ellipse(cx, cy, rx, ry)}" fill="#000000" opacity="${o}"/>`;
}

function svgWrap(inner: string, pixelSize: number): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CANVAS} ${CANVAS}" ` +
    `width="${pixelSize}" height="${pixelSize}">${inner}</svg>`
  );
}

/** Render one character facing to an SVG string. West = east mirrored. */
export function composeCharacter(
  recipe: CharacterRecipe,
  style: StyleSheet,
  facing: Facing | 'west',
  pixelSize?: number,
  mood: Mood = 'normal',
  opts: { badge?: boolean; activity?: Activity } = {},
): string {
  const actual: Facing = facing === 'west' ? 'east' : facing;
  const placed = placeParts(recipe, actual, mood);
  let inner = renderPlaced(placed, actual, style, makeCharacterResolver(recipe));
  if (facing === 'west') {
    inner = `<g transform="translate(${CANVAS} 0) scale(-1 1)">${inner}</g>`;
  }
  // Overhead badges sit outside the mirror so their glyphs stay upright; only
  // the anchor x is mirrored so they track the head. Facing-independent, drawn
  // above all. An agent can be working *and* suspicious at once, so a mood emote
  // and an activity badge can both show — when they do, split them left/right of
  // the head so they don't overlap (the sim owns final placement at runtime;
  // this is the tool's preview convention).
  if (opts.badge ?? true) {
    const a = ANCHORS[actual].aboveHead;
    const ax = facing === 'west' ? CANVAS - a.x : a.x;
    const emote = MOOD_EMOTES[mood];
    const activity = opts.activity && opts.activity !== 'none' ? ACTIVITY_BADGES[opts.activity] : null;
    if (emote && activity) {
      inner += emoteMarkup(activity, ax - 18, a.y);
      inner += emoteMarkup(emote, ax + 18, a.y);
    } else if (emote) {
      inner += emoteMarkup(emote, ax, a.y);
    } else if (activity) {
      inner += emoteMarkup(activity, ax, a.y);
    }
  }
  // Contact shadow at the feet, painted first so it sits under the figure. It's
  // centered on the canvas, so the west mirror leaves it untouched.
  const shadow = contactShadow(CANVAS / 2, 113, 16, 4.5, style);
  return svgWrap(shadow + inner, pixelSize ?? style.render.baseSize);
}

/**
 * The overhead badge anchor (aboveHead) for a facing, in canvas coords, with x
 * mirrored for west. Exposed so the conversation renderer can attach its linking
 * arc to the same point the badges sit at.
 */
export function overheadAnchor(facing: Facing | 'west'): { x: number; y: number } {
  const actual: Facing = facing === 'west' ? 'east' : facing;
  const a = ANCHORS[actual].aboveHead;
  return { x: facing === 'west' ? CANVAS - a.x : a.x, y: a.y };
}

/**
 * Render one overhead emote on its own, centered in the canvas (pivot 0.5,0.5).
 * This is the shared-atlas cell: a single character-independent badge the sim
 * blits above any agent at the aboveHead anchor. Both activity badges and mood
 * emotes are character-independent `{color, glyph}` bubbles, so they share this.
 * Returns an empty canvas for a null (no-badge) state.
 */
export function composeOverheadEmote(badge: BadgeSpec | null, pixelSize: number = CANVAS): string {
  const inner = badge ? emoteMarkup(badge, CANVAS / 2, CANVAS / 2) : '';
  return svgWrap(inner, pixelSize);
}

/** Shared-atlas cell for one activity badge. */
export function composeActivityBadge(activity: Activity, pixelSize: number = CANVAS): string {
  return composeOverheadEmote(ACTIVITY_BADGES[activity], pixelSize);
}

/** Shared-atlas cell for one mood's overhead emote (the bubble, not the face overlay). */
export function composeMoodEmote(mood: Mood, pixelSize: number = CANVAS): string {
  return composeOverheadEmote(MOOD_EMOTES[mood], pixelSize);
}

/** Shared-atlas cell for one prop tamper-status badge (floats above a tampered prop). */
export function composePropStatusBadge(status: PropStatus, pixelSize: number = CANVAS): string {
  return composeOverheadEmote(PROP_STATUS_BADGES[status], pixelSize);
}

/**
 * An attention puff: a per-category silhouette (spark / shuriken / round / gem)
 * holding a white glyph, drawn at the same overhead anchor and scale as the emote
 * badges so it stacks with them — but with NO thought-tail (a puff is an event
 * flash centered on the agent, not a thought emanating from them). The top-tier
 * `harvestable` puff also gets a soft colored beacon halo behind it. The flash /
 * fade / scale-by-magnitude is sim-side; this is the static cell.
 */
function attentionPuffMarkup(art: AttentionPuffArt, ax: number, ay: number): string {
  const identity: ResolveToken = (ref) => ref;
  const minCenter = BADGE_TOP_MARGIN + (BADGE_RADIUS + BADGE_STROKE_HALF) * BADGE_SCALE;
  const cy = Math.max(ay, minCenter);
  const beacon = art.beacon
    ? `<path d="${circle(0, 1.4, 11.5)}" fill="${art.color}" opacity="0.18"/>`
    : '';
  const shape = haloedPath(art.shape, art.color);
  const glyph = art.glyph.map((s) => emitColorShape(s, identity)).join('');
  return `<g transform="translate(${ax} ${cy}) scale(${BADGE_SCALE})">${beacon}${shape}${glyph}</g>`;
}

/** Shared-atlas cell for one attention puff (the transient event flash above an agent). */
export function composeAttentionPuff(puff: AttentionPuff, pixelSize: number = CANVAS): string {
  const art = ATTENTION_PUFF_ART[puff];
  const inner = art ? attentionPuffMarkup(art, CANVAS / 2, CANVAS / 2) : '';
  return svgWrap(inner, pixelSize);
}

// ---------------------------------------------------------------------------
// Layer atlas (Phase 2.2 spike) — export the character as separate, re-tintable
// part layers instead of a flattened sheet, so a runtime engine can recombine
// + tint + mood-swap NPCs. Each layer is one (part × colour-source): token
// colours render as a WHITE MASK (the engine multiplies by the recipe colour,
// which preserves anti-aliasing), literal detail renders in its real colour
// (untinted). Layers are positioned exactly as composeCharacter (anchors +
// proportions) but OUTLINE-FREE — the engine strokes the merged silhouette.
// ---------------------------------------------------------------------------

export const PALETTE_TOKENS: PaletteToken[] = [
  'skin',
  'hair',
  'outfitPrimary',
  'outfitSecondary',
  'accent',
];

export interface CharacterLayer {
  /** Stable key across facings, e.g. "head-oval__skin" or "mood-suspicious". */
  key: string;
  slot: string;
  partId: string;
  /** Paint order — lower paints first (matches composeCharacter z). */
  z: number;
  order: number;
  /** Palette token to multiply this layer by, or null for untinted literal. */
  tint: PaletteToken | null;
  /** Base layer (null) or only shown for this mood. */
  mood: Mood | null;
  /** Positioned, outline-free inner SVG per facing ('' when the part is absent). */
  markup: Record<Facing | 'west', string>;
}

function tokenOf(ref: string | undefined): PaletteToken | null {
  return ref && ref.startsWith('$') ? (ref.slice(1) as PaletteToken) : null;
}

/** Emit a token shape as a white mask (engine multiplies by the token colour). */
function emitMaskShape(s: ShapeSpec): string {
  const attrs: string[] = [`d="${s.d}"`];
  attrs.push(`fill="${s.fill ? (tokenOf(s.fill) ? '#FFFFFF' : s.fill) : 'none'}"`);
  if (s.stroke) {
    attrs.push(`stroke="${tokenOf(s.stroke) ? '#FFFFFF' : s.stroke}"`);
    attrs.push(`stroke-width="${s.strokeWidth ?? 1.5}" stroke-linecap="round" stroke-linejoin="round"`);
  }
  if (s.opacity !== undefined) attrs.push(`opacity="${s.opacity}"`);
  return `<path ${attrs.join(' ')}/>`;
}

const identityResolve: ResolveToken = (ref) => ref;

/**
 * Emit a UI-icon shape as a flat white mask — geometry only, ALL fills/strokes
 * forced white (unlike emitMaskShape, which keeps literal colors). The framework
 * recolors the mask, so a tintable icon needs no token bookkeeping.
 */
function emitIconMask(s: ShapeSpec): string {
  const attrs: string[] = [`d="${s.d}"`, `fill="${s.fill ? '#FFFFFF' : 'none'}"`];
  if (s.stroke) {
    attrs.push('stroke="#FFFFFF"');
    attrs.push(`stroke-width="${s.strokeWidth ?? 1.5}" stroke-linecap="round" stroke-linejoin="round"`);
  }
  if (s.opacity !== undefined) attrs.push(`opacity="${s.opacity}"`);
  return `<path ${attrs.join(' ')}/>`;
}

/**
 * Render one UI icon, centered in the canvas (docs/ui-art-plan.md). 'tintable'
 * icons emit as a white mask the framework recolors; 'literal' icons ship final
 * colors. Unknown ids return an empty canvas. The SVG feeds UI Toolkit
 * (VectorImage); the same markup rasterizes to the uGUI PNG ladder.
 */
export function composeIcon(iconId: string, pixelSize: number = CANVAS): string {
  const icon = getIcon(iconId);
  if (!icon) return svgWrap('', pixelSize);
  const emit = icon.mode === 'tintable' ? emitIconMask : (s: ShapeSpec) => emitColorShape(s, identityResolve);
  const inner = icon.shapes.map(emit).join('');
  return svgWrap(`<g transform="translate(${CANVAS / 2} ${CANVAS / 2})">${inner}</g>`, pixelSize);
}

interface IdPlaced {
  partId: string;
  slot: string;
  anchor: { x: number; y: number };
  group: 'body' | 'head';
  variant: PartVariant;
}

/** Like placeParts but retains part identity and excludes mood/neck-shadow. */
function placeForLayers(recipe: CharacterRecipe, facing: Facing): IdPlaced[] {
  const order: Array<{ id: string; slot: string }> = [
    { id: recipe.parts.body, slot: 'body' },
    { id: recipe.parts.outfit, slot: 'outfit' },
    ...recipe.parts.accessories.map((id) => ({ id, slot: 'accessory' })),
    { id: recipe.parts.head, slot: 'head' },
    { id: recipe.parts.hair, slot: 'hair' },
  ];
  const out: IdPlaced[] = [];
  for (const { id, slot } of order) {
    const part = getPart(id);
    const variant = part?.facings[facing];
    if (!part || !variant) continue;
    out.push({
      partId: id,
      slot,
      anchor: ANCHORS[facing][part.anchor],
      group: HEAD_ANCHORS.includes(part.anchor) ? 'head' : 'body',
      variant,
    });
  }
  return out;
}

function positioned(group: 'body' | 'head', facing: Facing, style: StyleSheet, anchor: { x: number; y: number }, body: string): string {
  return `<g transform="${groupTransform(group, facing, style)}"><g transform="translate(${anchor.x} ${anchor.y})">${body}</g></g>`;
}

/** Decompose a recipe into re-tintable, outline-free part layers. */
export function characterLayers(recipe: CharacterRecipe, style: StyleSheet): CharacterLayer[] {
  const facings: Facing[] = ['south', 'east', 'north'];
  const byKey = new Map<string, CharacterLayer>();
  let order = 0;
  const ensure = (key: string, slot: string, partId: string, z: number, tint: PaletteToken | null, mood: Mood | null) => {
    let layer = byKey.get(key);
    if (!layer) {
      layer = { key, slot, partId, z, order: order++, tint, mood, markup: { south: '', east: '', north: '', west: '' } };
      byKey.set(key, layer);
    }
    return layer;
  };

  for (const facing of facings) {
    const placed = placeForLayers(recipe, facing);
    // neck shadow (literal), painted between body (z10) and outfit (z20)
    placed.splice(1, 0, {
      partId: 'neck-shadow',
      slot: 'body',
      anchor: ANCHORS[facing].body,
      group: 'body',
      variant: { shapes: [{ d: ellipse(0, -22, facing === 'east' ? 9 : 12, 4), fill: '#00000018', silhouette: false }], z: 35 },
    });

    for (const p of placed) {
      // split the part's shapes into buckets by colour source, preserving order
      const buckets = new Map<string, ShapeSpec[]>();
      const bucketOrder: string[] = [];
      for (const s of p.variant.shapes) {
        const bk = tokenOf(s.fill) ?? tokenOf(s.stroke) ?? 'literal';
        if (!buckets.has(bk)) {
          buckets.set(bk, []);
          bucketOrder.push(bk);
        }
        buckets.get(bk)!.push(s);
      }
      for (const bk of bucketOrder) {
        const shapes = buckets.get(bk)!;
        const tint = bk === 'literal' ? null : (bk as PaletteToken);
        const layer = ensure(`${p.partId}__${bk}`, p.slot, p.partId, p.variant.z, tint, null);
        const emit = tint ? emitMaskShape : (s: ShapeSpec) => emitColorShape(s, identityResolve);
        layer.markup[facing] = positioned(p.group, facing, style, p.anchor, shapes.map(emit).join(''));
      }
    }
  }

  // mood overlays — literal ink, head group, only south/east have shapes
  for (const mood of MOODS) {
    for (const facing of facings) {
      const shapes = MOOD_OVERLAYS[mood][facing];
      if (!shapes || shapes.length === 0) continue;
      const layer = ensure(`mood-${mood}`, 'mood', mood, MOOD_Z, null, mood);
      layer.markup[facing] = positioned('head', facing, style, ANCHORS[facing].headCenter, shapes.map((s) => emitColorShape(s, identityResolve)).join(''));
    }
  }

  // Baked silhouette outline (z below everything, untinted) — the engine draws
  // this first so runtime NPCs get the tool's unified outline with no shader.
  // Uses the exact silhouette-underlay path as composeCharacter; mood-shared
  // (mood shapes are silhouette:false), so one outline layer covers every mood.
  if (style.outline.width > 0) {
    for (const facing of facings) {
      const placed = placeParts(recipe, facing, 'normal');
      const partOutline = (p: PlacedPart) => {
        const shapes = p.variant.shapes.filter(shapeIsSilhouette);
        if (shapes.length === 0) return '';
        return `<g transform="translate(${p.anchor.x} ${p.anchor.y})">${shapes.map((s) => emitOutlineShape(s, style)).join('')}</g>`;
      };
      const wrap = (group: 'body' | 'head') => {
        const inner = placed.filter((p) => p.group === group).map(partOutline).join('');
        return inner ? `<g transform="${groupTransform(group, facing, style)}">${inner}</g>` : '';
      };
      const layer = ensure('outline', 'outline', 'outline', -1, null, null);
      layer.markup[facing] = wrap('body') + wrap('head');
    }
  }

  const layers = [...byKey.values()].sort((a, b) => a.z - b.z || a.order - b.order);
  // west = mirrored east, same as composeCharacter
  for (const layer of layers) {
    if (layer.markup.east) layer.markup.west = `<g transform="translate(${CANVAS} 0) scale(-1 1)">${layer.markup.east}</g>`;
  }
  return layers;
}

/** Wrap a single layer's per-facing markup as a standalone SVG (for export). */
export function layerCellSvg(markup: string, pixelSize: number): string {
  return svgWrap(markup, pixelSize);
}

/** Render one wall autotile segment (neighbor mask N=1,E=2,S=4,W=8). */
export function composeWallTile(
  wall: TileInstance,
  style: StyleSheet,
  mask: number,
  pixelSize?: number,
): string {
  const template = WALL_TEMPLATES.find((t) => t.id === wall.templateId);
  if (!template) return svgWrap('', pixelSize ?? style.render.baseSize);
  const shapes = template.build(mask, wall.params, wall.palette);
  const resolve = makePropResolver(wall.palette);
  const outline =
    style.outline.width > 0
      ? shapes
          .filter(shapeIsSilhouette)
          .map((s) => emitOutlineShape(s, style))
          .join('')
      : '';
  const color = shapes.map((s) => emitColorShape(s, resolve)).join('');
  return svgWrap(outline + color, pixelSize ?? style.render.baseSize);
}

/**
 * Raw floor shape markup (no svg wrapper). Callers must clip to the tile —
 * floor patterns draw wrapped copies past the tile edges for seamlessness.
 */
export function floorTileMarkup(floor: TileInstance): string {
  const template = FLOOR_TEMPLATES.find((t) => t.id === floor.templateId);
  if (!template) return '';
  const resolve = makePropResolver(floor.palette);
  return template.build(floor.params, floor.palette).map((s) => emitColorShape(s, resolve)).join('');
}

/** Render a floor tile: flat pattern, no outline pass, seamlessly tileable. */
export function composeFloorTile(floor: TileInstance, style: StyleSheet, pixelSize?: number): string {
  return svgWrap(floorTileMarkup(floor), pixelSize ?? style.render.baseSize);
}

/**
 * Render a whole demo room as ONE svg from a wall layout grid (1 = wall).
 * Masks are computed from neighbors; a single unified outline pass runs under
 * all cells, so runs read as continuous walls with no per-tile seams.
 */
export function composeWallRoom(
  wall: TileInstance,
  style: StyleSheet,
  layout: number[][],
  cellPixelSize: number,
): string {
  const template = WALL_TEMPLATES.find((t) => t.id === wall.templateId);
  const rows = layout.length;
  const cols = layout[0]?.length ?? 0;
  const width = cellPixelSize * cols;
  const height = cellPixelSize * rows;
  const head =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${cols * CANVAS} ${rows * CANVAS}" ` +
    `width="${width}" height="${height}">`;
  if (!template) return `${head}</svg>`;

  const at = (r: number, c: number) => layout[r]?.[c] === 1;
  const cells: Array<{ r: number; c: number; shapes: ShapeSpec[] }> = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!at(r, c)) continue;
      const mask = (at(r - 1, c) ? 1 : 0) | (at(r, c + 1) ? 2 : 0) | (at(r + 1, c) ? 4 : 0) | (at(r, c - 1) ? 8 : 0);
      cells.push({ r, c, shapes: template.build(mask, wall.params, wall.palette) });
    }
  }
  const resolve = makePropResolver(wall.palette);
  const place = (cell: { r: number; c: number }, inner: string) =>
    inner ? `<g transform="translate(${cell.c * CANVAS} ${cell.r * CANVAS})">${inner}</g>` : '';
  const outline =
    style.outline.width > 0
      ? cells.map((cell) => place(cell, cell.shapes.filter(shapeIsSilhouette).map((s) => emitOutlineShape(s, style)).join(''))).join('')
      : '';
  const color = cells.map((cell) => place(cell, cell.shapes.map((s) => emitColorShape(s, resolve)).join(''))).join('');
  return `${head}${outline}${color}</svg>`;
}

/** Render a floor tile repeated cols x rows in ONE svg to prove seamlessness. */
export function composeFloorRepeat(
  floor: TileInstance,
  _style: StyleSheet, // floors ignore outline style, kept for signature parity
  cols: number,
  rows: number,
  cellPixelSize: number,
): string {
  const template = FLOOR_TEMPLATES.find((t) => t.id === floor.templateId);
  const head =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${cols * CANVAS} ${rows * CANVAS}" ` +
    `width="${cellPixelSize * cols}" height="${cellPixelSize * rows}">`;
  if (!template) return `${head}</svg>`;
  const resolve = makePropResolver(floor.palette);
  const inner = template.build(floor.params, floor.palette).map((s) => emitColorShape(s, resolve)).join('');
  // solid backing in the base color kills antialiasing hairlines between copies
  let body = `<rect width="${cols * CANVAS}" height="${rows * CANVAS}" fill="${resolve('$primary')}"/>`;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      body += `<g transform="translate(${c * CANVAS} ${r * CANVAS})">${inner}</g>`;
    }
  }
  return `${head}${body}</svg>`;
}

/** Render a prop instance to an SVG string. */
export function composeProp(prop: PropInstance, style: StyleSheet, pixelSize?: number): string {
  const template = PROP_TEMPLATES.find((t) => t.id === prop.templateId);
  if (!template) return svgWrap('', pixelSize ?? style.render.baseSize);
  const shapes = template.build(prop.params, prop.palette);
  const resolve = makePropResolver(prop.palette);
  const outline =
    style.outline.width > 0
      ? shapes
          .filter(shapeIsSilhouette)
          .map((s) => emitOutlineShape(s, style))
          .join('')
      : '';
  const color = shapes.map((s) => emitColorShape(s, resolve)).join('');
  const fp = template.footprint;
  const shadow = fp ? contactShadow(fp.cx, fp.cy, fp.rx, fp.ry, style) : '';
  return svgWrap(shadow + outline + color, pixelSize ?? style.render.baseSize);
}
