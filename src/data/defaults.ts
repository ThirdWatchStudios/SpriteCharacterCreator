import type { CharacterRecipe, ProjectState, PropInstance, StyleSheet } from '../core/types';

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
    params: { width: 110, chairs: 2 },
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
    params: { backHeight: 30 },
    palette: { primary: '#444441', secondary: '#888780', accent: '#2C2C2A' },
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

export function defaultProject(): ProjectState {
  return {
    version: 1,
    style: structuredClone(DEFAULT_STYLE),
    characters: structuredClone(DEFAULT_CAST),
    props: structuredClone(DEFAULT_PROPS),
  };
}
