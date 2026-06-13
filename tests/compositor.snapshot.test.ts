import { describe, expect, it } from 'vitest';

import {
  composeCharacter,
  composeFloorTile,
  composeProp,
  composeWallTile,
} from '../src/core/compositor';
import type { CharacterRecipe } from '../src/core/types';
import { CANVAS, FACINGS, MOODS } from '../src/core/types';
import { PART_LIBRARY } from '../src/parts/library';
import {
  DEFAULT_CAST,
  DEFAULT_FLOORS,
  DEFAULT_PROPS,
  DEFAULT_STYLE,
  DEFAULT_WALLS,
} from '../src/data/defaults';

/**
 * Golden-file compositor snapshots (ROADMAP §3.3). Every render path is frozen
 * to a committed SVG so a geometry/engine change can't silently regress the art
 * — the north-facing hair bug was exactly this class. Regenerate intentional
 * changes with `npm run test:update`, then eyeball the diff.
 *
 * Renders use DEFAULT_STYLE and an explicit pixel size so output depends only on
 * the compositor + content, never on ambient style. Snapshots are deterministic
 * (pure functions, no RNG/clock); seeded content params live in the defaults.
 */

const STYLE = DEFAULT_STYLE;
const SIZE = CANVAS; // fixed so width/height attrs stay stable
const FACINGS_ALL = [...FACINGS, 'west'] as const;

/** Strip a compose function's outer <svg> wrapper, keeping inner design-space markup. */
function inner(svg: string): string {
  return svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');
}

/** Lay out N 128-unit cells (each a full compose SVG) into one reviewable grid SVG. */
function grid(cells: string[], cols: number): string {
  const rows = Math.ceil(cells.length / cols);
  const body = cells
    .map((svg, i) => {
      const x = (i % cols) * CANVAS;
      const y = Math.floor(i / cols) * CANVAS;
      return `<g transform="translate(${x} ${y})">${inner(svg)}</g>`;
    })
    .join('');
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" ` +
    `viewBox="0 0 ${cols * CANVAS} ${rows * CANVAS}" ` +
    `width="${cols * CANVAS}" height="${rows * CANVAS}">${body}</svg>`
  );
}

const snap = (name: string) => `./__snapshots__/${name}.svg`;

describe('cast', () => {
  for (const c of DEFAULT_CAST) {
    it(`${c.id} — all facings`, async () => {
      const strip = FACINGS_ALL.map((f) =>
        composeCharacter(c, STYLE, f, SIZE, 'normal', { badge: false }),
      );
      await expect(grid(strip, FACINGS_ALL.length)).toMatchFileSnapshot(snap(`cast/${c.id}`));
    });

    it(`${c.id} — all moods (south, with badge)`, async () => {
      const strip = MOODS.map((m) => composeCharacter(c, STYLE, 'south', SIZE, m, { badge: true }));
      await expect(grid(strip, MOODS.length)).toMatchFileSnapshot(snap(`cast/${c.id}__moods`));
    });
  }
});

describe('parts', () => {
  // A neutral recipe; each part is swapped into its slot so the snapshot isolates
  // that part's geometry (against a constant body for context).
  const BASE: CharacterRecipe = {
    id: 'base',
    name: 'Base',
    parts: {
      body: 'body-standard',
      head: 'head-oval',
      hair: 'hair-short',
      outfit: 'outfit-tee',
      accessories: [],
    },
    palette: {
      skin: '#E8B88A',
      hair: '#4A3325',
      outfitPrimary: '#2E4057',
      outfitSecondary: '#F5F2EA',
      accent: '#D85A30',
    },
  };

  for (const part of PART_LIBRARY) {
    it(`${part.slot}/${part.id} — all facings`, async () => {
      const recipe: CharacterRecipe = {
        ...BASE,
        parts: { ...BASE.parts, accessories: [...BASE.parts.accessories] },
      };
      if (part.slot === 'accessory') {
        recipe.parts.accessories = [part.id];
      } else {
        recipe.parts[part.slot] = part.id;
      }
      const strip = FACINGS_ALL.map((f) =>
        composeCharacter(recipe, STYLE, f, SIZE, 'normal', { badge: false }),
      );
      await expect(grid(strip, FACINGS_ALL.length)).toMatchFileSnapshot(
        snap(`parts/${part.slot}__${part.id}`),
      );
    });
  }
});

describe('walls — all 16 autotile masks', () => {
  for (const wall of DEFAULT_WALLS) {
    it(`${wall.id}`, async () => {
      const masks = Array.from({ length: 16 }, (_, mask) =>
        composeWallTile(wall, STYLE, mask, SIZE),
      );
      await expect(grid(masks, 4)).toMatchFileSnapshot(snap(`walls/${wall.id}`));
    });
  }
});

describe('floors', () => {
  for (const floor of DEFAULT_FLOORS) {
    it(`${floor.id}`, async () => {
      await expect(composeFloorTile(floor, STYLE, SIZE)).toMatchFileSnapshot(
        snap(`floors/${floor.id}`),
      );
    });
  }
});

describe('props', () => {
  for (const prop of DEFAULT_PROPS) {
    it(`${prop.id}`, async () => {
      await expect(composeProp(prop, STYLE, SIZE)).toMatchFileSnapshot(snap(`props/${prop.id}`));
    });
  }
});
