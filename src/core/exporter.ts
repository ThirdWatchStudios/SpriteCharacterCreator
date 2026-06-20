import JSZip from 'jszip';
import type { CharacterRecipe, ProjectState, PropInstance, StyleSheet, TileInstance } from './types';
import type { SceneState } from './scene';
import { CANVAS, MOODS } from './types';
import {
  PALETTE_TOKENS,
  characterLayers,
  composeActivityBadge,
  composeCharacter,
  composeFloorTile,
  composeMoodEmote,
  composeProp,
  composeWallTile,
  layerCellSvg,
  overheadAnchor,
} from './compositor';
import { ACTIVITIES, ACTIVITY_BADGES } from '../parts/activities';
import { MOOD_EMOTES } from '../parts/moods';
import { conversationStyleJson } from './conversation';
import { sceneToLayoutJson } from './layout';
import { composeSceneSvg } from './scene';
import type { EmployeeDefinition } from './employee';
import { employeeRecipe } from './employee';
import { serializeProfile } from './profile';
import { buildScenarioPackage } from './scenarioRun';
import { buildOrgStructure } from './orgStructure';
import { serializeCompany } from './company';
import { serializeScenarioTemplateLibrary, type ScenarioTemplate } from './scenarioTemplate';
import { PROP_TEMPLATES } from '../props/templates';
import { maskName } from '../tiles/templates';

/** Sheet frame order. West is baked as mirrored east for engine convenience. */
const SHEET_FACINGS = ['south', 'east', 'north', 'west'] as const;

export const EXPORT_SCALES = [1, 2, 4];

function svgToImage(svg: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    img.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png');
  });
}

function renderScale(style: StyleSheet): number {
  const value = style.render.pixelScale ?? 1;
  if (!Number.isFinite(value)) return 1;
  return Math.max(1, Math.min(8, Math.round(value)));
}

// ---------------------------------------------------------------------------
// SVG → PNG behind an interface. Every PNG the exporter produces is a "sheet":
// one or more 128-unit SVG cells composited into a grid at fixed pixel
// positions, optionally pixelated (render small, nearest-neighbor upscale).
// The browser uses a <canvas> backend (CanvasRasterizer); the headless CLI
// supplies a resvg-js backend (src/core/rasterizer-node.ts). Cell layout lives
// in pure SheetDesc builders below, so both backends render identical geometry.
// ---------------------------------------------------------------------------

/** PNG output: a Blob in the browser, raw bytes (Uint8Array/Buffer) headless. */
export type PngBytes = Blob | Uint8Array;

/** One 128-unit SVG drawn into the sheet at (dx,dy), scaled to dw×dh pixels. */
export interface RasterCell {
  /** A full <svg> whose viewBox is 0 0 128 128 (the design canvas). */
  svg: string;
  dx: number;
  dy: number;
  dw: number;
  dh: number;
}

/** A complete sheet to rasterize: canvas size, pixelate factor, and its cells. */
export interface SheetDesc {
  width: number;
  height: number;
  /** >1 renders each cell small then nearest-neighbor upscales (pixelate). */
  pixelScale: number;
  cells: RasterCell[];
}

export interface Rasterizer {
  rasterizeSheet(desc: SheetDesc): Promise<PngBytes>;
}

/** Draw one cell into a 2D context, honoring the pixelate (nearest-neighbor) trick. */
function drawCell(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
  pixelScale: number,
): void {
  if (pixelScale <= 1) {
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(img, dx, dy, dw, dh);
    return;
  }

  const small = document.createElement('canvas');
  small.width = Math.max(1, Math.round(dw / pixelScale));
  small.height = Math.max(1, Math.round(dh / pixelScale));
  const smallCtx = small.getContext('2d')!;
  smallCtx.imageSmoothingEnabled = true;
  smallCtx.drawImage(img, 0, 0, small.width, small.height);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(small, dx, dy, dw, dh);
  ctx.imageSmoothingEnabled = true;
}

/** Browser SVG→PNG backend: composite cells on a <canvas>, export as a Blob. */
class CanvasRasterizer implements Rasterizer {
  async rasterizeSheet(desc: SheetDesc): Promise<PngBytes> {
    const canvas = document.createElement('canvas');
    canvas.width = desc.width;
    canvas.height = desc.height;
    const ctx = canvas.getContext('2d')!;
    for (const cell of desc.cells) {
      const img = await svgToImage(cell.svg);
      drawCell(ctx, img, cell.dx, cell.dy, cell.dw, cell.dh, desc.pixelScale);
    }
    return canvasToBlob(canvas);
  }
}

let canvasRasterizer: Rasterizer | null = null;
/** The default (browser) rasterizer. Instantiated lazily so importing this
 *  module in Node (the CLI) never touches the DOM. */
export function defaultRasterizer(): Rasterizer {
  return (canvasRasterizer ??= new CanvasRasterizer());
}

const asBlob = (p: Promise<PngBytes>): Promise<Blob> => p as Promise<Blob>;

// --- Sheet descriptors (pure: cell positions only, no rasterization) ---------

function characterSheetDesc(recipe: CharacterRecipe, style: StyleSheet, scale: number): SheetDesc {
  const size = style.render.baseSize * scale;
  return {
    width: size * SHEET_FACINGS.length,
    height: size,
    pixelScale: renderScale(style),
    cells: SHEET_FACINGS.map((facing, i) => ({
      svg: composeCharacter(recipe, style, facing, size),
      dx: i * size,
      dy: 0,
      dw: size,
      dh: size,
    })),
  };
}

function moodSheetDesc(recipe: CharacterRecipe, style: StyleSheet, scale: number): SheetDesc {
  const size = style.render.baseSize * scale;
  const cells: RasterCell[] = [];
  MOODS.forEach((mood, row) => {
    SHEET_FACINGS.forEach((facing, col) => {
      cells.push({
        // The overhead mood emote is NOT baked here — it ships in the shared
        // mood-emotes atlas, placed by the sim at aboveHead (same as activity
        // badges). The sheet carries the per-character face overlay only.
        svg: composeCharacter(recipe, style, facing, size, mood, { badge: false }),
        dx: col * size,
        dy: row * size,
        dw: size,
        dh: size,
      });
    });
  });
  return { width: size * SHEET_FACINGS.length, height: size * MOODS.length, pixelScale: renderScale(style), cells };
}

function layerSheetDesc(recipe: CharacterRecipe, style: StyleSheet, scale: number): SheetDesc {
  const layers = characterLayers(recipe, style);
  const size = style.render.baseSize * scale;
  const cells: RasterCell[] = [];
  layers.forEach((layer, row) => {
    SHEET_FACINGS.forEach((facing, col) => {
      const markup = layer.markup[facing];
      if (!markup) return; // empty cell: draw nothing (same as the canvas path)
      cells.push({ svg: layerCellSvg(markup, size), dx: col * size, dy: row * size, dw: size, dh: size });
    });
  });
  // Layer sheets never pixelate (re-tintable masks must stay crisp/exact).
  return { width: size * SHEET_FACINGS.length, height: size * Math.max(1, layers.length), pixelScale: 1, cells };
}

/**
 * Activity badges: a single shared strip, one cell per activity that has a
 * badge (the blank 'none' state is omitted). Character-independent — the sim
 * blits the matching cell above any agent keyed off its routine `activity`.
 */
const BADGED_ACTIVITIES = ACTIVITIES.filter((a) => ACTIVITY_BADGES[a]);

function activityBadgesDesc(style: StyleSheet, scale: number): SheetDesc {
  const size = style.render.baseSize * scale;
  return {
    width: size * BADGED_ACTIVITIES.length,
    height: size,
    pixelScale: renderScale(style),
    cells: BADGED_ACTIVITIES.map((activity, i) => ({
      svg: composeActivityBadge(activity, size),
      dx: i * size,
      dy: 0,
      dw: size,
      dh: size,
    })),
  };
}

export async function activityBadgesPng(style: StyleSheet, scale: number): Promise<Blob> {
  return asBlob(defaultRasterizer().rasterizeSheet(activityBadgesDesc(style, scale)));
}

export function activityBadgesAtlas(style: StyleSheet, scale: number) {
  const size = style.render.baseSize * scale;
  const frames: Record<string, { x: number; y: number; w: number; h: number }> = {};
  BADGED_ACTIVITIES.forEach((activity, i) => {
    frames[activity] = { x: i * size, y: 0, w: size, h: size };
  });
  return {
    kind: 'activity-badges' as const,
    frameSize: size,
    scale,
    activities: [...BADGED_ACTIVITIES],
    frames,
    // The badge bubble is centered in its cell — anchor it above an agent's head.
    pivot: { x: 0.5, y: 0.5 },
    // Where to hang the badge on the agent: the per-facing aboveHead anchor in
    // each character atlas (.anchors.aboveHead). South value inlined for convenience.
    attach: { anchor: 'aboveHead', normalizedSouth: normalizedAboveHead().south },
    meta: {
      generator: 'sprite-character-creator',
      shared: true,
      facingIndependent: true,
      note: 'Selected at runtime by the agent\'s routine activity; unknown ids draw nothing.',
    },
  };
}

/**
 * Mood emotes: the overhead-bubble half of a mood, as a shared strip — one cell
 * per mood that has an emote (`normal` has none). Character-independent, exactly
 * like activity badges; the sim blits the cell above an agent's head at the same
 * aboveHead anchor. The per-character *face overlay* half stays in the mood sheet.
 */
const EMOTED_MOODS = MOODS.filter((m) => MOOD_EMOTES[m]);

function moodEmotesDesc(style: StyleSheet, scale: number): SheetDesc {
  const size = style.render.baseSize * scale;
  return {
    width: size * EMOTED_MOODS.length,
    height: size,
    pixelScale: renderScale(style),
    cells: EMOTED_MOODS.map((mood, i) => ({
      svg: composeMoodEmote(mood, size),
      dx: i * size,
      dy: 0,
      dw: size,
      dh: size,
    })),
  };
}

export async function moodEmotesPng(style: StyleSheet, scale: number): Promise<Blob> {
  return asBlob(defaultRasterizer().rasterizeSheet(moodEmotesDesc(style, scale)));
}

export function moodEmotesAtlas(style: StyleSheet, scale: number) {
  const size = style.render.baseSize * scale;
  const frames: Record<string, { x: number; y: number; w: number; h: number }> = {};
  EMOTED_MOODS.forEach((mood, i) => {
    frames[mood] = { x: i * size, y: 0, w: size, h: size };
  });
  return {
    kind: 'mood-emotes' as const,
    frameSize: size,
    scale,
    moods: [...EMOTED_MOODS],
    frames,
    pivot: { x: 0.5, y: 0.5 },
    attach: { anchor: 'aboveHead', normalizedSouth: normalizedAboveHead().south },
    meta: {
      generator: 'sprite-character-creator',
      shared: true,
      facingIndependent: true,
      note: 'Overhead mood bubble; no longer baked in the mood sheet. Place above the head, stacks with the activity badge.',
    },
  };
}

function wallTilesetDesc(wall: TileInstance, style: StyleSheet, scale: number): SheetDesc {
  const size = style.render.baseSize * scale;
  const cells: RasterCell[] = [];
  for (let mask = 0; mask < 16; mask++) {
    cells.push({
      svg: composeWallTile(wall, style, mask, size),
      dx: (mask % 4) * size,
      dy: Math.floor(mask / 4) * size,
      dw: size,
      dh: size,
    });
  }
  return { width: size * 4, height: size * 4, pixelScale: renderScale(style), cells };
}

function floorTileDesc(floor: TileInstance, style: StyleSheet, scale: number): SheetDesc {
  const size = style.render.baseSize * scale;
  return {
    width: size,
    height: size,
    pixelScale: renderScale(style),
    cells: [{ svg: composeFloorTile(floor, style, size), dx: 0, dy: 0, dw: size, dh: size }],
  };
}

function propDesc(prop: PropInstance, style: StyleSheet, scale: number): SheetDesc {
  const size = style.render.baseSize * scale;
  return {
    width: size,
    height: size,
    pixelScale: renderScale(style),
    cells: [{ svg: composeProp(prop, style, size), dx: 0, dy: 0, dw: size, dh: size }],
  };
}

/** Render a character sprite sheet (south, east, north, west) at the given scale. */
export async function characterSheetPng(
  recipe: CharacterRecipe,
  style: StyleSheet,
  scale: number,
): Promise<Blob> {
  return asBlob(defaultRasterizer().rasterizeSheet(characterSheetDesc(recipe, style, scale)));
}

/** Atlas metadata matching the sheet layout, for slicing in Unity. */
export function characterAtlas(recipe: CharacterRecipe, style: StyleSheet, scale: number) {
  const size = style.render.baseSize * scale;
  const frames: Record<string, { x: number; y: number; w: number; h: number }> = {};
  SHEET_FACINGS.forEach((facing, i) => {
    frames[facing] = { x: i * size, y: 0, w: size, h: size };
  });
  return {
    name: recipe.name,
    id: recipe.id,
    frameSize: size,
    scale,
    frames,
    /** Normalized pivot — feet sit near the bottom of the design canvas. */
    pivot: { x: 0.5, y: 0.09 },
    /**
     * Normalized attach points (same bottom-left origin as pivot). `aboveHead`
     * is where the sim hangs a *separate* overhead sprite — the shared activity
     * badge (§3.9) or a conversation-link endpoint. Moods bake their emote into
     * the sheet and don't need this; the badge/link are external and do. Uniform
     * across characters today, but shipped per-character so it stays correct if
     * proportions ever diverge.
     */
    anchors: { aboveHead: normalizedAboveHead() },
    meta: {
      generator: 'sprite-character-creator',
      westIsMirroredEast: true,
    },
  };
}

/** aboveHead anchor per facing, normalized bottom-left origin (Unity pivot convention). */
function normalizedAboveHead(): Record<string, { x: number; y: number }> {
  const out: Record<string, { x: number; y: number }> = {};
  for (const facing of SHEET_FACINGS) {
    const a = overheadAnchor(facing);
    out[facing] = { x: a.x / CANVAS, y: (CANVAS - a.y) / CANVAS };
  }
  return out;
}

/**
 * Layer atlas (Phase 2.2 spike). One row per re-tintable part layer, one column
 * per facing (south, east, north, west). Token layers are white masks the engine
 * multiplies by the recipe colour; literal layers are untinted; mood layers swap
 * by the active mood. Outline-free — the engine strokes the merged silhouette.
 * Pairs with characterLayerManifest, which carries z-order + tint token + mood.
 */
export async function characterLayerSheetPng(
  recipe: CharacterRecipe,
  style: StyleSheet,
  scale: number,
): Promise<Blob> {
  return asBlob(defaultRasterizer().rasterizeSheet(layerSheetDesc(recipe, style, scale)));
}

export function characterLayerManifest(recipe: CharacterRecipe, style: StyleSheet, scale: number) {
  const layers = characterLayers(recipe, style);
  const size = style.render.baseSize * scale;
  const frames: Record<string, { x: number; y: number; w: number; h: number }> = {};
  layers.forEach((layer, row) => {
    SHEET_FACINGS.forEach((facing, col) => {
      if (layer.markup[facing]) frames[`${layer.key}__${facing}`] = { x: col * size, y: row * size, w: size, h: size };
    });
  });
  return {
    kind: 'character-layers' as const,
    family: recipe.id,
    name: recipe.name,
    frameSize: size,
    scale,
    canvas: 128,
    facings: [...SHEET_FACINGS],
    tokens: [...PALETTE_TOKENS],
    moods: [...MOODS],
    palette: recipe.palette,
    pivot: { x: 0.5, y: 0.09 },
    // Composite order: stack ascending z (ties broken by order). Multiply each
    // layer by palette[tint] (skip when tint is null). Show base layers (mood
    // null) plus the one layer whose mood === the active mood.
    layers: layers.map((layer) => ({
      key: layer.key,
      slot: layer.slot,
      partId: layer.partId,
      z: layer.z,
      order: layer.order,
      tint: layer.tint,
      mood: layer.mood,
    })),
    frames,
    meta: {
      generator: 'sprite-character-creator',
      westIsMirroredEast: true,
      tintMode: 'multiply-white-mask',
      outline:
        style.outline.width > 0
          ? 'baked-silhouette-layer (layer key "outline", z -1: draw first, untinted)'
          : 'none',
    },
  };
}

/**
 * Mood sheet: one row per mood (in MOODS order), one column per facing.
 * North frames are identical across moods (no face from behind) but are still
 * emitted so frame indexing stays uniform engine-side.
 */
export async function moodSheetPng(
  recipe: CharacterRecipe,
  style: StyleSheet,
  scale: number,
): Promise<Blob> {
  return asBlob(defaultRasterizer().rasterizeSheet(moodSheetDesc(recipe, style, scale)));
}

export function moodAtlas(recipe: CharacterRecipe, style: StyleSheet, scale: number) {
  const size = style.render.baseSize * scale;
  const frames: Record<string, { x: number; y: number; w: number; h: number }> = {};
  MOODS.forEach((mood, row) => {
    SHEET_FACINGS.forEach((facing, col) => {
      frames[`${mood}_${facing}`] = { x: col * size, y: row * size, w: size, h: size };
    });
  });
  return {
    name: recipe.name,
    id: recipe.id,
    frameSize: size,
    scale,
    moods: [...MOODS],
    facings: [...SHEET_FACINGS],
    frames,
    pivot: { x: 0.5, y: 0.09 },
    meta: {
      generator: 'sprite-character-creator',
      westIsMirroredEast: true,
      northHasNoFace: true,
      // The overhead mood bubble is no longer baked into these frames; it ships
      // in the shared mood-emotes atlas, placed by the consumer at aboveHead.
      emoteBaked: false,
      overheadEmote: 'mood-emotes-atlas',
    },
  };
}

/**
 * Wall tileset: 4x4 sheet, one segment per neighbor mask 0-15 in row-major
 * order (mask = row * 4 + column; bits N=1, E=2, S=4, W=8).
 */
export async function wallTilesetPng(wall: TileInstance, style: StyleSheet, scale: number): Promise<Blob> {
  return asBlob(defaultRasterizer().rasterizeSheet(wallTilesetDesc(wall, style, scale)));
}

export function wallAtlas(wall: TileInstance, style: StyleSheet, scale: number) {
  const size = style.render.baseSize * scale;
  const frames: Record<string, { x: number; y: number; w: number; h: number; name: string }> = {};
  for (let mask = 0; mask < 16; mask++) {
    frames[`mask_${mask}`] = {
      x: (mask % 4) * size,
      y: Math.floor(mask / 4) * size,
      w: size,
      h: size,
      name: maskName(mask),
    };
  }
  return {
    name: wall.name,
    id: wall.id,
    templateId: wall.templateId,
    frameSize: size,
    scale,
    kind: 'wall' as const,
    bits: { N: 1, E: 2, S: 4, W: 8 },
    frames,
    pivot: { x: 0.5, y: 0.5 },
    meta: { generator: 'sprite-character-creator', autotile: '4-bit neighbor mask', sorting: 'wall-layer' },
  };
}

export async function floorTilePng(floor: TileInstance, style: StyleSheet, scale: number): Promise<Blob> {
  return asBlob(defaultRasterizer().rasterizeSheet(floorTileDesc(floor, style, scale)));
}

export function floorAtlas(floor: TileInstance, style: StyleSheet, scale: number) {
  return {
    name: floor.name,
    id: floor.id,
    templateId: floor.templateId,
    frameSize: style.render.baseSize * scale,
    scale,
    kind: 'floor' as const,
    tileable: true,
    pivot: { x: 0.5, y: 0.5 },
    meta: { generator: 'sprite-character-creator', sorting: 'floor-layer (below everything)' },
  };
}

/**
 * Prop atlas: projection drives how the engine should treat the sprite.
 * Plan props pivot at center, sit on the furniture layer below characters,
 * and rotate freely. Elevation props pivot at the base (same 9% ground
 * offset as characters), y-sort with characters, and must not rotate.
 */
export function propAtlas(prop: PropInstance, style: StyleSheet, scale: number) {
  const template = PROP_TEMPLATES.find((t) => t.id === prop.templateId);
  const projection = template?.projection ?? 'elevation';
  const placement = template?.placement ?? 'floor';
  const size = style.render.baseSize * scale;
  return {
    name: prop.name,
    id: prop.id,
    templateId: prop.templateId,
    frameSize: size,
    scale,
    projection,
    placement,
    pivot: projection === 'plan' ? { x: 0.5, y: 0.5 } : { x: 0.5, y: 0.09 },
    meta: {
      generator: 'sprite-character-creator',
      sorting: projection === 'plan' ? 'floor-layer' : 'y-sort',
      rotatable: projection === 'plan',
      wallSlot: placement === 'wall-slot',
    },
  };
}

export async function propPng(prop: PropInstance, style: StyleSheet, scale: number): Promise<Blob> {
  return asBlob(defaultRasterizer().rasterizeSheet(propDesc(prop, style, scale)));
}

export async function scenePosterPng(scene: SceneState, project: ProjectState, scale: number): Promise<Blob> {
  // Scene cells span the whole grid, so this sheet has one cell whose source
  // SVG viewBox is cols*128 × rows*128 (not the 128 the other cells use). The
  // canvas backend scales it to fill, matching the in-app poster.
  const cellSize = project.style.render.baseSize * scale;
  const width = scene.cols * cellSize;
  const height = scene.rows * cellSize;
  return asBlob(
    defaultRasterizer().rasterizeSheet({
      width,
      height,
      pixelScale: renderScale(project.style),
      cells: [{ svg: composeSceneSvg(scene, project, cellSize), dx: 0, dy: 0, dw: width, dh: height }],
    }),
  );
}

// ---------------------------------------------------------------------------
// Employee / population exports (Office Population Generator)
// ---------------------------------------------------------------------------

/** South-facing full-body sprite for an employee (no overhead badge). */
export async function employeeSpritePng(recipe: CharacterRecipe, style: StyleSheet, scale: number): Promise<Blob> {
  const size = style.render.baseSize * scale;
  const img = await svgToImage(composeCharacter(recipe, style, 'south', size, 'normal', { badge: false }));
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  canvas.getContext('2d')!.drawImage(img, 0, 0, size, size);
  return canvasToBlob(canvas);
}

/** Portrait crop (head + upper torso) for an employee profile card. */
export async function employeePortraitPng(recipe: CharacterRecipe, style: StyleSheet, scale: number): Promise<Blob> {
  const out = style.render.baseSize * scale;
  const render = 512; // render the full figure crisply, then crop
  const img = await svgToImage(composeCharacter(recipe, style, 'south', render, 'normal', { badge: false }));
  const canvas = document.createElement('canvas');
  canvas.width = out;
  canvas.height = out;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = true;
  // crop the 128-unit design region around head+shoulders, scale to output
  const k = render / 128;
  ctx.drawImage(img, 24 * k, 14 * k, 80 * k, 80 * k, 0, 0, out, out);
  return canvasToBlob(canvas);
}

/**
 * Unity employee package: one folder per employee with sprite.png, portrait.png,
 * and employee.json, plus a roster.json. Drag a folder into Unity to use it.
 */
export async function employeePackageZip(
  employees: EmployeeDefinition[],
  style: StyleSheet,
  scale: number,
): Promise<Blob> {
  const zip = new JSZip();
  for (const emp of employees) {
    const recipe = employeeRecipe(emp);
    const dir = zip.folder(`Employee_${emp.visualSeed}`)!;
    dir.file('sprite.png', await employeeSpritePng(recipe, style, scale));
    dir.file('portrait.png', await employeePortraitPng(recipe, style, scale));
    dir.file('employee.json', JSON.stringify(emp, null, 2));
  }
  zip.file(
    'roster.json',
    JSON.stringify(
      employees.map((e) => ({ name: e.name, visualSeed: e.visualSeed, profile: e.profile })),
      null,
      2,
    ),
  );
  return zip.generateAsync({ type: 'blob' });
}

export function downloadBlob(name: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  // Give the browser a beat before revoking, or the download can race it.
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function downloadJson(name: string, data: unknown): void {
  downloadBlob(name, new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
}

function slug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'unnamed';
}

/** Progress callback for exportAll — fired after each rendered PNG. */
export type ExportProgress = (done: number, total: number, label: string) => void;

/** Where exported files land. Keys are full POSIX paths ("characters/x/y.png"). */
export interface ExportSink {
  file(path: string, data: string | PngBytes): void | Promise<void>;
}

/**
 * Regenerate the entire asset set — every character sheet/moods/layers, prop,
 * wall, and floor at 1x/2x/4x with atlas JSON, the project file, and (when a
 * scene exists) office-layout.json — into a sink, rasterizing PNGs through the
 * given backend. This is the single source of truth for the export tree; both
 * the in-browser zip (canvas backend) and the headless CLI (resvg backend) call
 * it, so their outputs are structurally identical.
 */
export async function exportAll(
  project: ProjectState,
  opts: { sink: ExportSink; rasterizer: Rasterizer; onProgress?: ExportProgress; scenarioTemplates?: ScenarioTemplate[] },
): Promise<void> {
  const { sink, rasterizer, onProgress } = opts;
  const { style } = project;
  const scales = EXPORT_SCALES.length;

  // Total PNG renders (the slow part): per character sheet + moods + layers,
  // plus one per prop/wall/floor — each across every scale.
  const total =
    project.characters.length * scales * 3 +
    project.props.length * scales +
    (project.walls?.length ?? 0) * scales +
    (project.floors?.length ?? 0) * scales +
    scales * 2; // one shared activity-badge + one shared mood-emote atlas per scale
  let done = 0;
  const tick = (label: string) => {
    done += 1;
    onProgress?.(done, total, label);
  };
  const png = (desc: SheetDesc) => rasterizer.rasterizeSheet(desc);
  const write = (path: string, data: string | PngBytes) => sink.file(path, data);

  for (const recipe of project.characters) {
    // Slug off the recipe id, not the display name: the id is the engine
    // binding key (layer atlas Family = recipe id = the sim's AgentId), so the
    // exported folder name must be stable and match the consuming agent id.
    const dir = `characters/${slug(recipe.id)}`;
    for (const scale of EXPORT_SCALES) {
      await write(`${dir}/sheet@${scale}x.png`, await png(characterSheetDesc(recipe, style, scale)));
      await write(`${dir}/atlas@${scale}x.json`, JSON.stringify(characterAtlas(recipe, style, scale), null, 2));
      tick(recipe.name);
      await write(`${dir}/moods@${scale}x.png`, await png(moodSheetDesc(recipe, style, scale)));
      await write(`${dir}/moods-atlas@${scale}x.json`, JSON.stringify(moodAtlas(recipe, style, scale), null, 2));
      tick(`${recipe.name} moods`);
    }
    await write(`${dir}/recipe.json`, JSON.stringify(recipe, null, 2));
    // The full-game persona (sim-consumer form: derived fields resolved to plain
    // numbers). Keyed by agentId == recipe id; emitted only when authored.
    const profile = project.profiles?.find((p) => p.agentId === recipe.id);
    if (profile) await write(`${dir}/profile.json`, JSON.stringify(serializeProfile(profile), null, 2));
  }

  // Re-tintable layer atlases (Phase 2.2 / runtime NPC compositor input). Kept
  // in a separate top-level folder so the layer importer iterates it distinctly
  // from the baked character sheets above.
  for (const recipe of project.characters) {
    // Layer-atlas folder is keyed by recipe id too — this is the Family the
    // runtime NPC composer resolves by AgentId (see SPRITE_INTEGRATION.md W4).
    const dir = `character-layers/${slug(recipe.id)}`;
    for (const scale of EXPORT_SCALES) {
      await write(`${dir}/layers@${scale}x.png`, await png(layerSheetDesc(recipe, style, scale)));
      await write(`${dir}/manifest@${scale}x.json`, JSON.stringify(characterLayerManifest(recipe, style, scale), null, 2));
      tick(`${recipe.name} layers`);
    }
    await write(`${dir}/recipe.json`, JSON.stringify(recipe, null, 2));
  }

  for (const prop of project.props) {
    const dir = `props/${slug(prop.name)}`;
    for (const scale of EXPORT_SCALES) {
      await write(`${dir}/sprite@${scale}x.png`, await png(propDesc(prop, style, scale)));
      await write(`${dir}/atlas@${scale}x.json`, JSON.stringify(propAtlas(prop, style, scale), null, 2));
      tick(prop.name);
    }
    await write(`${dir}/prop.json`, JSON.stringify(prop, null, 2));
  }

  for (const wall of project.walls ?? []) {
    const dir = `walls/${slug(wall.name)}`;
    for (const scale of EXPORT_SCALES) {
      await write(`${dir}/tileset@${scale}x.png`, await png(wallTilesetDesc(wall, style, scale)));
      await write(`${dir}/atlas@${scale}x.json`, JSON.stringify(wallAtlas(wall, style, scale), null, 2));
      tick(wall.name);
    }
    await write(`${dir}/wall.json`, JSON.stringify(wall, null, 2));
  }

  for (const floor of project.floors ?? []) {
    const dir = `floors/${slug(floor.name)}`;
    for (const scale of EXPORT_SCALES) {
      await write(`${dir}/tile@${scale}x.png`, await png(floorTileDesc(floor, style, scale)));
      await write(`${dir}/atlas@${scale}x.json`, JSON.stringify(floorAtlas(floor, style, scale), null, 2));
      tick(floor.name);
    }
    await write(`${dir}/floor.json`, JSON.stringify(floor, null, 2));
  }

  // Shared activity-badge atlas (one per scale, character-independent). The sim
  // blits a cell above any agent keyed off its routine `activity` string.
  for (const scale of EXPORT_SCALES) {
    await write(`activity-badges@${scale}x.png`, await png(activityBadgesDesc(style, scale)));
    await write(`activity-badges-atlas@${scale}x.json`, JSON.stringify(activityBadgesAtlas(style, scale), null, 2));
    tick('activity badges');
    await write(`mood-emotes@${scale}x.png`, await png(moodEmotesDesc(style, scale)));
    await write(`mood-emotes-atlas@${scale}x.json`, JSON.stringify(moodEmotesAtlas(style, scale), null, 2));
    tick('mood emotes');
  }
  // Conversation style — the sim draws the connector between paired talking
  // agents from this (tool owns the look, sim owns pairing + placement).
  await write('conversation-style.json', JSON.stringify(conversationStyleJson(), null, 2));

  onProgress?.(total, total, 'writing');
  await write('project.json', JSON.stringify(project, null, 2));
  // The company root (Epic 0 F0.8) — present only for a generated company package.
  // company.json sits at the bundle root with the org-structure / personas /
  // relationships / office-layout / scenarios below it as its children.
  if (project.company) {
    await write('company.json', JSON.stringify(serializeCompany(project.company), null, 2));
  }
  // The reusable drive + trait catalogs personas reference by id (see CONTRACT.md).
  await write('drives.json', JSON.stringify(project.drives, null, 2));
  await write('traits.json', JSON.stringify(project.traits, null, 2));
  // The department catalog — the single org model the office-scale work references
  // by stable id (Epic 2 F2.1).
  await write('departments.json', JSON.stringify(project.departments, null, 2));
  // The org-structure artifact — departments + members with a visible-structure /
  // fogged-contents split the sim renders as the org chart (Epic 2 F2.2).
  await write('org-structure.json', JSON.stringify(buildOrgStructure(project), null, 2));
  if (project.scene) {
    await write('office-layout.json', JSON.stringify(sceneToLayoutJson(project.scene, project), null, 2));
  }
  // The cast-agnostic scenario-template library (Epic 4 F4.1) — the sim's runtime
  // caster binds these onto the live cast/office by precondition match (§3.8/§5.7).
  // The library is passed in (the UI supplies ROLE_TEMPLATES) so core carries no
  // `data` dependency; omitted when no library is provided.
  const scenarioTemplates = opts.scenarioTemplates ?? [];
  if (scenarioTemplates.length) {
    await write('scenario-template.json', JSON.stringify(serializeScenarioTemplateLibrary(scenarioTemplates), null, 2));
  }
  // Authored run definitions as split packages under scenarios/<id>/ — Unity can
  // load a package directly (scenario.json + employees/relationships/beliefs/
  // knowledge/interaction-anchors + office-layout). See buildScenarioPackage.
  for (const scenario of project.scenarios ?? []) {
    const dir = `scenarios/${slug(scenario.scenarioId)}`;
    const pkg = buildScenarioPackage(scenario, project);
    for (const [file, data] of Object.entries(pkg)) {
      await write(`${dir}/${file}`, JSON.stringify(data, null, 2));
    }
  }
}

/**
 * Export the whole project as a zip (browser path). Thin wrapper over exportAll
 * with the canvas rasterizer and a JSZip sink — unchanged output vs before.
 */
export async function exportAllZip(
  project: ProjectState,
  onProgress?: ExportProgress,
  scenarioTemplates?: ScenarioTemplate[],
): Promise<Blob> {
  const zip = new JSZip();
  const sink: ExportSink = { file: (path, data) => void zip.file(path, data as Blob | Uint8Array | string) };
  await exportAll(project, { sink, rasterizer: defaultRasterizer(), onProgress, scenarioTemplates });
  return zip.generateAsync({ type: 'blob' });
}
