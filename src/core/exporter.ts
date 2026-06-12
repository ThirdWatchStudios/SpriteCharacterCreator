import JSZip from 'jszip';
import type { CharacterRecipe, ProjectState, PropInstance, StyleSheet } from './types';
import { MOODS } from './types';
import { composeCharacter, composeProp } from './compositor';

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
    ctx.drawImage(img, i * size, 0, size, size);
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
      ctx.drawImage(img, col * size, row * size, size, size);
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

export async function propPng(prop: PropInstance, style: StyleSheet, scale: number): Promise<Blob> {
  const size = style.render.baseSize * scale;
  const svg = composeProp(prop, style, size);
  const img = await svgToImage(svg);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  canvas.getContext('2d')!.drawImage(img, 0, 0, size, size);
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
    }
    dir.file('prop.json', JSON.stringify(prop, null, 2));
  }

  zip.file('project.json', JSON.stringify(project, null, 2));
  return zip.generateAsync({ type: 'blob' });
}
