import type { CharacterRecipe, StyleSheet } from './types';
import { partsForSlot } from '../parts/library';

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

const FIRST_NAMES = [
  'Alex', 'Sam', 'Jordan', 'Casey', 'Morgan', 'Riley', 'Quinn', 'Avery',
  'Dana', 'Jesse', 'Robin', 'Marge', 'Doug', 'Pam', 'Greg', 'Tina',
  'Howard', 'Cheryl', 'Vince', 'Donna', 'Phil', 'Rhonda', 'Stan', 'Bev',
];

let counter = 0;

/** Generate a random coworker from the part library and the style palette pools. */
export function randomCharacter(style: StyleSheet): CharacterRecipe {
  const pools = style.palettePools;
  const accessories: string[] = [];
  const accessoryPool = partsForSlot('accessory').map((p) => p.id);
  // 0–2 accessories, no duplicates
  const count = Math.floor(Math.random() * 3);
  while (accessories.length < count) {
    const id = pick(accessoryPool);
    if (!accessories.includes(id)) accessories.push(id);
  }
  counter += 1;
  return {
    id: `char-${Date.now().toString(36)}-${counter}`,
    name: pick(FIRST_NAMES),
    parts: {
      body: pick(partsForSlot('body')).id,
      head: pick(partsForSlot('head')).id,
      hair: pick(partsForSlot('hair')).id,
      outfit: pick(partsForSlot('outfit')).id,
      accessories,
    },
    palette: {
      skin: pick(pools.skin),
      hair: pick(pools.hair),
      outfitPrimary: pick(pools.clothing),
      outfitSecondary: pick(pools.secondary),
      accent: pick(pools.accent),
    },
  };
}

/** Re-roll only the palette of an existing recipe. */
export function rerollPalette(recipe: CharacterRecipe, style: StyleSheet): CharacterRecipe {
  const pools = style.palettePools;
  return {
    ...recipe,
    palette: {
      skin: pick(pools.skin),
      hair: pick(pools.hair),
      outfitPrimary: pick(pools.clothing),
      outfitSecondary: pick(pools.secondary),
      accent: pick(pools.accent),
    },
  };
}
