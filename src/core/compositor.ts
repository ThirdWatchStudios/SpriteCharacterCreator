import type {
  AnchorName,
  CharacterRecipe,
  Facing,
  PartVariant,
  PropInstance,
  PropPalette,
  ShapeSpec,
  StyleSheet,
} from './types';
import { CANVAS } from './types';
import { getPart } from '../parts/library';
import { PROP_TEMPLATES } from '../props/templates';

/**
 * Named attachment points in canvas coordinates, per facing. Moving an anchor
 * moves everything attached to it — parts are never positioned absolutely.
 */
const ANCHORS: Record<Facing, Record<AnchorName, { x: number; y: number }>> = {
  south: {
    body: { x: 64, y: 87 },
    neck: { x: 64, y: 58 },
    headCenter: { x: 64, y: 44 },
    chest: { x: 64, y: 80 },
    handRight: { x: 89, y: 99 },
  },
  east: {
    body: { x: 64, y: 87 },
    neck: { x: 64, y: 58 },
    headCenter: { x: 67, y: 44 },
    chest: { x: 64, y: 80 },
    handRight: { x: 80, y: 99 },
  },
  north: {
    body: { x: 64, y: 87 },
    neck: { x: 64, y: 58 },
    headCenter: { x: 64, y: 44 },
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

function placeParts(recipe: CharacterRecipe, facing: Facing): PlacedPart[] {
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
): string {
  const actual: Facing = facing === 'west' ? 'east' : facing;
  const placed = placeParts(recipe, actual);
  let inner = renderPlaced(placed, actual, style, makeCharacterResolver(recipe));
  if (facing === 'west') {
    inner = `<g transform="translate(${CANVAS} 0) scale(-1 1)">${inner}</g>`;
  }
  return svgWrap(inner, pixelSize ?? style.render.baseSize);
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
  return svgWrap(outline + color, pixelSize ?? style.render.baseSize);
}
