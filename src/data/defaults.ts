import type { CharacterRecipe, ProjectState, PropInstance, StylePreset, StyleSheet, TileInstance } from '../core/types';

export const DEFAULT_STYLE: StyleSheet = {
  outline: {
    width: 2.5,
    color: '#3A342E',
    mode: 'silhouette',
  },
  proportions: {
    headScale: 1,
    bodyWidth: 1,
  },
  render: {
    baseSize: 128,
    pixelScale: 1,
  },
  palettePools: {
    skin: ['#F4D3B0', '#E8B88A', '#D9A06B', '#C68B59', '#A9714B', '#8D5A3B', '#6B4226'],
    hair: ['#1F1A17', '#4A3325', '#6E4A2A', '#B8893B', '#C7782F', '#8A8A8A', '#D8D3C8'],
    clothing: [
      '#2E4057', '#3D5A80', '#1D9E75', '#0F6E56', '#D85A30',
      '#993C56', '#534AB7', '#5F5E5A', '#7A6C5D', '#B04A3A',
    ],
    secondary: ['#F5F2EA', '#E8E4D8', '#DCE6EC', '#F0E2C8'],
    accent: ['#A32D2D', '#D85A30', '#185FA5', '#3B6D11', '#854F0B', '#2C2C2A'],
  },
};

export const DEFAULT_STYLE_PRESETS: StylePreset[] = [
  {
    id: 'preset-warm-office',
    name: 'Warm office',
    style: structuredClone(DEFAULT_STYLE),
  },
  {
    id: 'preset-corporate-cold',
    name: 'Corporate cold',
    style: {
      outline: {
        width: 2,
        color: '#27323A',
        mode: 'silhouette',
      },
      proportions: {
        headScale: 0.96,
        bodyWidth: 0.94,
      },
      render: {
        baseSize: 128,
        pixelScale: 1,
      },
      palettePools: {
        skin: ['#F1D6BE', '#D6A77F', '#BC855F', '#8E6046', '#68422F'],
        hair: ['#17191D', '#353A42', '#5C6170', '#7F858F', '#C7CDD5'],
        clothing: ['#20344A', '#2F4A63', '#476579', '#58616F', '#30363F', '#68727D'],
        secondary: ['#EEF3F6', '#DCE7EF', '#CBD6E0', '#B7C4CF'],
        accent: ['#1E6BA8', '#2E8BC8', '#4E6B7A', '#7A8FA0', '#DA7C4B'],
      },
    },
  },
  {
    id: 'preset-high-contrast',
    name: 'High-contrast readability',
    style: {
      outline: {
        width: 4,
        color: '#111111',
        mode: 'per-part',
      },
      proportions: {
        headScale: 1.12,
        bodyWidth: 1.08,
      },
      render: {
        baseSize: 128,
        pixelScale: 1,
      },
      palettePools: {
        skin: ['#FFE1BD', '#D99A65', '#A86A42', '#6B3F27'],
        hair: ['#0B0B0B', '#3B2417', '#8B5A22', '#D8D8D8'],
        clothing: ['#0F4C81', '#C7362E', '#107A53', '#6D3FB5', '#D88918', '#242424'],
        secondary: ['#FFFFFF', '#F3F0E8', '#D6EAF8', '#FFE7B8'],
        accent: ['#FFB000', '#E52B2B', '#0066CC', '#118A28', '#6A1B9A'],
      },
    },
  },
];

/** The Experiment 001 cast from the design docs. */
export const DEFAULT_CAST: CharacterRecipe[] = [
  {
    id: 'janice',
    name: 'Janice',
    parts: {
      body: 'body-standard',
      head: 'head-oval',
      hair: 'hair-bob',
      outfit: 'outfit-blazer',
      accessories: ['acc-lanyard'],
    },
    palette: {
      skin: '#E8B88A',
      hair: '#4A3325',
      outfitPrimary: '#2E4057',
      outfitSecondary: '#F5F2EA',
      accent: '#D85A30',
    },
  },
  {
    id: 'carl',
    name: 'Carl',
    parts: {
      body: 'body-broad',
      head: 'head-round',
      hair: 'hair-short',
      outfit: 'outfit-polo',
      accessories: ['acc-mug'],
    },
    palette: {
      skin: '#C68B59',
      hair: '#1F1A17',
      outfitPrimary: '#1D9E75',
      outfitSecondary: '#F5F2EA',
      accent: '#854F0B',
    },
  },
  {
    id: 'linda',
    name: 'Linda',
    parts: {
      body: 'body-standard',
      head: 'head-round',
      hair: 'hair-bun',
      outfit: 'outfit-cardigan',
      accessories: ['acc-glasses'],
    },
    palette: {
      skin: '#8D5A3B',
      hair: '#1F1A17',
      outfitPrimary: '#D85A30',
      outfitSecondary: '#F0E2C8',
      accent: '#993C1D',
    },
  },
  {
    id: 'the-manager',
    name: 'The Manager',
    parts: {
      body: 'body-broad',
      head: 'head-boxy',
      hair: 'hair-balding',
      outfit: 'outfit-shirt-tie',
      accessories: ['acc-badge'],
    },
    palette: {
      skin: '#F4D3B0',
      hair: '#8A8A8A',
      outfitPrimary: '#5F5E5A',
      outfitSecondary: '#F5F2EA',
      accent: '#A32D2D',
    },
  },
];

export const DEFAULT_PROPS: PropInstance[] = [
  {
    id: 'prop-water-cooler',
    name: 'Water cooler',
    templateId: 'water-cooler',
    params: { height: 56 },
    palette: { primary: '#85B7EB', secondary: '#F1EFE8', accent: '#378ADD' },
  },
  {
    id: 'prop-printer',
    name: 'Printer',
    templateId: 'printer',
    params: { width: 56 },
    palette: { primary: '#5F5E5A', secondary: '#B4B2A9', accent: '#97C459' },
  },
  {
    id: 'prop-desk',
    name: 'Desk',
    templateId: 'desk',
    params: { width: 100, monitor: 1 },
    palette: { primary: '#A9714B', secondary: '#DCE6EC', accent: '#444441' },
  },
  {
    id: 'prop-coffee-machine',
    name: 'Coffee machine',
    templateId: 'coffee-machine',
    params: { height: 48 },
    palette: { primary: '#444441', secondary: '#B4B2A9', accent: '#E24B4A' },
  },
  {
    id: 'prop-office-plant',
    name: 'Office plant',
    templateId: 'office-plant',
    params: { bushiness: 2 },
    palette: { primary: '#639922', secondary: '#3B6D11', accent: '#B04A3A' },
  },
  {
    id: 'prop-fridge',
    name: 'Break room fridge',
    templateId: 'fridge',
    params: { height: 78 },
    palette: { primary: '#DCE6EC', secondary: '#D85A30', accent: '#5F5E5A' },
  },
  {
    id: 'prop-conference-table',
    name: 'Conference table',
    templateId: 'conference-table',
    params: { width: 110, chairs: 6 },
    palette: { primary: '#6E4A2A', secondary: '#5F5E5A', accent: '#444441' },
  },
  {
    id: 'prop-reception-desk',
    name: 'Reception desk',
    templateId: 'reception-desk',
    params: { width: 88 },
    palette: { primary: '#3D5A80', secondary: '#E8E4D8', accent: '#EF9F27' },
  },
  {
    id: 'prop-badge-reader',
    name: 'Badge reader',
    templateId: 'badge-reader',
    params: { granted: 1 },
    palette: { primary: '#444441', secondary: '#D3D1C7', accent: '#97C459' },
  },
  {
    id: 'prop-office-chair',
    name: 'Office chair',
    templateId: 'office-chair',
    params: { size: 13 },
    palette: { primary: '#444441', secondary: '#888780', accent: '#2C2C2A' },
  },
  {
    id: 'prop-cubicle-workstation',
    name: 'Cubicle workstation',
    templateId: 'cubicle-workstation',
    params: { openness: 0, clutter: 1 },
    palette: { primary: '#8A9199', secondary: '#5F5E5A', accent: '#D85A30' },
  },
  {
    id: 'prop-whiteboard',
    name: 'Whiteboard',
    templateId: 'whiteboard',
    params: { width: 64, scribbles: 2 },
    palette: { primary: '#B4B2A9', secondary: '#F7F4EC', accent: '#D85A30' },
  },
  {
    id: 'prop-filing-cabinet',
    name: 'Filing cabinet',
    templateId: 'filing-cabinet',
    params: { drawers: 3 },
    palette: { primary: '#7A6C5D', secondary: '#8A8578', accent: '#2C2C2A' },
  },
];

export const DEFAULT_WALLS: TileInstance[] = [
  {
    id: 'wall-office',
    name: 'Office wall',
    templateId: 'office-wall',
    params: { thickness: 28 },
    palette: { primary: '#B4B2A9', secondary: '#888780', accent: '#5F5E5A' },
  },
  {
    id: 'wall-glass',
    name: 'Glass partition',
    templateId: 'glass-partition',
    params: { thickness: 10 },
    palette: { primary: '#5F5E5A', secondary: '#B5D4F4', accent: '#185FA5' },
  },
  {
    id: 'wall-cubicle',
    name: 'Cubicle partition',
    templateId: 'cubicle-partition',
    params: { thickness: 14 },
    palette: { primary: '#8A9199', secondary: '#5F5E5A', accent: '#D85A30' },
  },
];

export const DEFAULT_FLOORS: TileInstance[] = [
  {
    id: 'floor-carpet',
    name: 'Office carpet',
    templateId: 'carpet',
    params: { speckle: 2, seed: 3 },
    palette: { primary: '#667687', secondary: '#8B9AA8', accent: '#4E5B69' },
  },
  {
    id: 'floor-carpet-tiles',
    name: 'Lobby carpet tiles',
    templateId: 'carpet-tiles',
    params: { contrast: 2 },
    palette: { primary: '#7A6C5D', secondary: '#8A8578', accent: '#5F5E5A' },
  },
  {
    id: 'floor-wood',
    name: 'Executive wood',
    templateId: 'wood-floor',
    params: { seed: 5 },
    palette: { primary: '#A9714B', secondary: '#6E4A2A', accent: '#C68B59' },
  },
  {
    id: 'floor-linoleum',
    name: 'Break room linoleum',
    templateId: 'linoleum',
    params: { grid: 32 },
    palette: { primary: '#E8E4D8', secondary: '#D3D1C7', accent: '#B4B2A9' },
  },
];

export function defaultProject(): ProjectState {
  return {
    version: 1,
    style: structuredClone(DEFAULT_STYLE),
    stylePresets: structuredClone(DEFAULT_STYLE_PRESETS),
    characters: structuredClone(DEFAULT_CAST),
    props: structuredClone(DEFAULT_PROPS),
    walls: structuredClone(DEFAULT_WALLS),
    floors: structuredClone(DEFAULT_FLOORS),
  };
}
