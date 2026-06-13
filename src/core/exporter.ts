import JSZip from 'jszip';
import type { CharacterRecipe, ProjectState, PropInstance, StyleSheet, TileInstance } from './types';
import type { SceneState } from './scene';
import { MOODS } from './types';
import { composeCharacter, composeFloorTile, composeProp, composeWallTile } from './compositor';
import { composeSceneSvg } from './scene';
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

function drawRasterized(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
  style: StyleSheet,
): void {
  const pixelScale = renderScale(style);
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

/** Render a character sprite sheet (south, east, north, west) at the given scale. */
export async function characterSheetPng(
  recipe: CharacterRecipe,
  style: StyleSheet,
  scale: number,
): Promise<Blob> {
  const size = style.render.baseSize * scale;
  const canvas = document.createElement('canvas');
  canvas.width = size * SHEET_FACINGS.length;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  for (let i = 0; i < SHEET_FACINGS.length; i++) {
    const svg = composeCharacter(recipe, style, SHEET_FACINGS[i], size);
    const img = await svgToImage(svg);
    drawRasterized(ctx, img, i * size, 0, size, size, style);
  }
  return canvasToBlob(canvas);
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
    meta: {
      generator: 'sprite-character-creator',
      westIsMirroredEast: true,
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
  const size = style.render.baseSize * scale;
  const canvas = document.createElement('canvas');
  canvas.width = size * SHEET_FACINGS.length;
  canvas.height = size * MOODS.length;
  const ctx = canvas.getContext('2d')!;
  for (let row = 0; row < MOODS.length; row++) {
    for (let col = 0; col < SHEET_FACINGS.length; col++) {
      const svg = composeCharacter(recipe, style, SHEET_FACINGS[col], size, MOODS[row]);
      const img = await svgToImage(svg);
      drawRasterized(ctx, img, col * size, row * size, size, size, style);
    }
  }
  return canvasToBlob(canvas);
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
    },
  };
}

/**
 * Wall tileset: 4x4 sheet, one segment per neighbor mask 0-15 in row-major
 * order (mask = row * 4 + column; bits N=1, E=2, S=4, W=8).
 */
export async function wallTilesetPng(wall: TileInstance, style: StyleSheet, scale: number): Promise<Blob> {
  const size = style.render.baseSize * scale;
  const canvas = document.createElement('canvas');
  canvas.width = size * 4;
  canvas.height = size * 4;
  const ctx = canvas.getContext('2d')!;
  for (let mask = 0; mask < 16; mask++) {
    const img = await svgToImage(composeWallTile(wall, style, mask, size));
    drawRasterized(ctx, img, (mask % 4) * size, Math.floor(mask / 4) * size, size, size, style);
  }
  return canvasToBlob(canvas);
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
  const size = style.render.baseSize * scale;
  const svg = composeFloorTile(floor, style, size);
  const img = await svgToImage(svg);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  drawRasterized(canvas.getContext('2d')!, img, 0, 0, size, size, style);
  return canvasToBlob(canvas);
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
  const size = style.render.baseSize * scale;
  return {
    name: prop.name,
    id: prop.id,
    templateId: prop.templateId,
    frameSize: size,
    scale,
    projection,
    pivot: projection === 'plan' ? { x: 0.5, y: 0.5 } : { x: 0.5, y: 0.09 },
    meta: {
      generator: 'sprite-character-creator',
      sorting: projection === 'plan' ? 'floor-layer' : 'y-sort',
      rotatable: projection === 'plan',
    },
  };
}

export async function propPng(prop: PropInstance, style: StyleSheet, scale: number): Promise<Blob> {
  const size = style.render.baseSize * scale;
  const svg = composeProp(prop, style, size);
  const img = await svgToImage(svg);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  drawRasterized(canvas.getContext('2d')!, img, 0, 0, size, size, style);
  return canvasToBlob(canvas);
}

export async function scenePosterPng(scene: SceneState, project: ProjectState, scale: number): Promise<Blob> {
  const cellSize = project.style.render.baseSize * scale;
  const svg = composeSceneSvg(scene, project, cellSize);
  const img = await svgToImage(svg);
  const canvas = document.createElement('canvas');
  canvas.width = scene.cols * cellSize;
  canvas.height = scene.rows * cellSize;
  drawRasterized(canvas.getContext('2d')!, img, 0, 0, canvas.width, canvas.height, project.style);
  return canvasToBlob(canvas);
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

/**
 * Export the whole project as a zip: every character sheet and prop at
 * 1x/2x/4x, atlas JSON, and the full project file (recipes + style) so the
 * exact asset set can be regenerated or imported later.
 */
export async function exportAllZip(project: ProjectState): Promise<Blob> {
  const zip = new JSZip();
  const { style } = project;

  for (const recipe of project.characters) {
    const dir = zip.folder(`characters/${slug(recipe.name)}`)!;
    for (const scale of EXPORT_SCALES) {
      dir.file(`sheet@${scale}x.png`, await characterSheetPng(recipe, style, scale));
      dir.file(`atlas@${scale}x.json`, JSON.stringify(characterAtlas(recipe, style, scale), null, 2));
      dir.file(`moods@${scale}x.png`, await moodSheetPng(recipe, style, scale));
      dir.file(`moods-atlas@${scale}x.json`, JSON.stringify(moodAtlas(recipe, style, scale), null, 2));
    }
    dir.file('recipe.json', JSON.stringify(recipe, null, 2));
  }

  for (const prop of project.props) {
    const dir = zip.folder(`props/${slug(prop.name)}`)!;
    for (const scale of EXPORT_SCALES) {
      dir.file(`sprite@${scale}x.png`, await propPng(prop, style, scale));
      dir.file(`atlas@${scale}x.json`, JSON.stringify(propAtlas(prop, style, scale), null, 2));
    }
    dir.file('prop.json', JSON.stringify(prop, null, 2));
  }

  for (const wall of project.walls ?? []) {
    const dir = zip.folder(`walls/${slug(wall.name)}`)!;
    for (const scale of EXPORT_SCALES) {
      dir.file(`tileset@${scale}x.png`, await wallTilesetPng(wall, style, scale));
      dir.file(`atlas@${scale}x.json`, JSON.stringify(wallAtlas(wall, style, scale), null, 2));
    }
    dir.file('wall.json', JSON.stringify(wall, null, 2));
  }

  for (const floor of project.floors ?? []) {
    const dir = zip.folder(`floors/${slug(floor.name)}`)!;
    for (const scale of EXPORT_SCALES) {
      dir.file(`tile@${scale}x.png`, await floorTilePng(floor, style, scale));
      dir.file(`atlas@${scale}x.json`, JSON.stringify(floorAtlas(floor, style, scale), null, 2));
    }
    dir.file('floor.json', JSON.stringify(floor, null, 2));
  }

  zip.file('project.json', JSON.stringify(project, null, 2));
  return zip.generateAsync({ type: 'blob' });
}
