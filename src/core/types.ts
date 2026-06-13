/** Facings follow the RimWorld convention: west is east mirrored at render time. */
export type Facing = 'south' | 'east' | 'north';
export const FACINGS: Facing[] = ['south', 'east', 'north'];

/** Slots a character recipe fills. Render order is determined per-part via z. */
export type Slot = 'body' | 'head' | 'hair' | 'outfit' | 'accessory';

/**
 * The six emotional states from the behavioral pressure model. Moods are
 * runtime state, not identity — they are face overlays selected at render
 * time, never stored in a recipe.
 */
export type Mood = 'normal' | 'suspicious' | 'curious' | 'defensive' | 'hostile' | 'confused';
export const MOODS: Mood[] = ['normal', 'suspicious', 'curious', 'defensive', 'hostile', 'confused'];

/**
 * Palette tokens. Parts never hardcode style colors — they reference tokens
 * ('$skin', '$hair', ...) that resolve against a recipe's palette at composite
 * time. Literal hex values are allowed only for style-neutral detail
 * (eye dots, soft shadows) that should not change with the palette.
 */
export type PaletteToken = 'skin' | 'hair' | 'outfitPrimary' | 'outfitSecondary' | 'accent';
export type Palette = Record<PaletteToken, string>;

/** A single drawable. Coordinates are part-local; (0,0) is the part's anchor. */
export interface ShapeSpec {
  /** SVG path data. */
  d: string;
  /** '$token' or '#hex'. Omit for stroke-only shapes. */
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;
  /**
   * Whether this shape contributes to the outline pass. Defaults to true for
   * filled shapes. Set false for interior detail (seams, buttons, eyes) so it
   * doesn't fatten the silhouette.
   */
  silhouette?: boolean;
}

/** Named attachment points, defined per facing in the compositor. */
export type AnchorName = 'body' | 'neck' | 'headCenter' | 'aboveHead' | 'chest' | 'handRight';

export interface PartVariant {
  shapes: ShapeSpec[];
  /** Paint order within the character. Lower paints first. */
  z: number;
}

export interface PartDef {
  id: string;
  label: string;
  slot: Slot;
  anchor: AnchorName;
  /** Missing facing = part not drawn from that angle (e.g. lanyard from behind). */
  facings: Partial<Record<Facing, PartVariant>>;
}

/** A character is pure data — parts by id plus a palette. */
export interface CharacterRecipe {
  id: string;
  name: string;
  parts: {
    body: string;
    head: string;
    hair: string;
    outfit: string;
    accessories: string[];
  };
  palette: Palette;
}

export interface PropParamDef {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  default: number;
}

/**
 * How a prop is projected, RimWorld-style. 'plan' = seen from above: pivot at
 * center, renders on the furniture layer below characters, rotates freely in
 * the engine. 'elevation' = seen from the front: pivot at the base, y-sorts
 * with characters, never rotates.
 */
export type Projection = 'plan' | 'elevation';
export type PropPlacement = 'floor' | 'wall-slot';

export interface PropTemplate {
  id: string;
  label: string;
  projection: Projection;
  /** Floor props occupy walkable cells; wall-slot props mount into or over wall runs. */
  placement?: PropPlacement;
  params: PropParamDef[];
  /**
   * Build shapes in canvas coords (128 design units). Elevation props rest on
   * the ground line y=116; plan props center their footprint on the canvas.
   */
  build(params: Record<string, number>, palette: PropPalette): ShapeSpec[];
}

export type PropPaletteToken = 'primary' | 'secondary' | 'accent';
export type PropPalette = Record<PropPaletteToken, string>;

export interface PropInstance {
  id: string;
  name: string;
  templateId: string;
  params: Record<string, number>;
  palette: PropPalette;
}

/**
 * The global style sheet. Everything here is applied at composite time, so
 * changing it retroactively restyles every character and prop.
 */
export interface StyleSheet {
  outline: {
    width: number;
    color: string;
    /** 'silhouette' outlines the whole figure; 'per-part' also outlines internal part edges. */
    mode: 'silhouette' | 'per-part';
  };
  proportions: {
    /** Scales the head group (head, hair, glasses) about the neck. */
    headScale: number;
    /** Scales body-anchored parts horizontally about the character center. */
    bodyWidth: number;
  };
  render: {
    /** Design canvas is always 128 units; this is the export pixel size at 1x. */
    baseSize: number;
    /** 1 = smooth SVG rasterization; higher values render smaller then nearest-neighbor scale up. */
    pixelScale: number;
  };
  palettePools: {
    skin: string[];
    hair: string[];
    clothing: string[];
    secondary: string[];
    accent: string[];
  };
}

export interface StylePreset {
  id: string;
  name: string;
  style: StyleSheet;
}

/**
 * Wall neighbor bitmask: N=1, E=2, S=4, W=8. A wall tileset has 16 segments,
 * one per mask, so walls auto-connect into straights, corners, tees, and
 * crosses when placed on the grid.
 */
export const WALL_BITS = { N: 1, E: 2, S: 4, W: 8 } as const;

export interface WallTemplate {
  kind: 'wall';
  id: string;
  label: string;
  params: PropParamDef[];
  /** Build one autotile segment for a neighbor mask. Connected arms overdraw
   *  the tile edge so outlines stay continuous across tiles. */
  build(mask: number, params: Record<string, number>, palette: PropPalette): ShapeSpec[];
}

export interface FloorTemplate {
  kind: 'floor';
  id: string;
  label: string;
  params: PropParamDef[];
  /** Build one floor tile. Must tile seamlessly: patterns wrap at the edges
   *  and floors render flat (no outline pass). */
  build(params: Record<string, number>, palette: PropPalette): ShapeSpec[];
}

/** A placed wall/floor style: template + params + palette, same shape as props. */
export interface TileInstance {
  id: string;
  name: string;
  templateId: string;
  params: Record<string, number>;
  palette: PropPalette;
}

export interface ProjectState {
  version: 1;
  style: StyleSheet;
  stylePresets: StylePreset[];
  characters: CharacterRecipe[];
  props: PropInstance[];
  walls: TileInstance[];
  floors: TileInstance[];
  /** The scene canvas — persisted so hand-edits survive reloads. */
  scene?: import('./scene').SceneState;
}

/** Design-space canvas size. Parts are authored against this; never changes. */
export const CANVAS = 128;
