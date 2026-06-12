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
export type AnchorName = 'body' | 'neck' | 'headCenter' | 'chest' | 'handRight';

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

export interface PropTemplate {
  id: string;
  label: string;
  params: PropParamDef[];
  /** Build shapes in canvas coords (128 design units, ground at y=116). */
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
  };
  palettePools: {
    skin: string[];
    hair: string[];
    clothing: string[];
    secondary: string[];
    accent: string[];
  };
}

export interface ProjectState {
  version: 1;
  style: StyleSheet;
  characters: CharacterRecipe[];
  props: PropInstance[];
}

/** Design-space canvas size. Parts are authored against this; never changes. */
export const CANVAS = 128;
