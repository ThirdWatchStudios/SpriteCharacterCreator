import { composeCharacter, composeProp } from '../core/compositor';
import { DEFAULT_STYLE } from '../data/defaults';
import { store } from '../state';
import { button, clear, colorInput, el, labeled, select, slider } from './dom';

/**
 * The style tab is the whole point of the tool: every control here re-renders
 * every character and prop live, proving the style is never baked in.
 */

export function renderStylePreview(container: HTMLElement): void {
  clear(container);
  const { characters, props, style } = store.state;

  const charGrid = el('div', { className: 'style-grid' });
  for (const recipe of characters) {
    const cell = el('div', { className: 'style-cell checker' });
    cell.innerHTML = composeCharacter(recipe, style, 'south', 88);
    charGrid.append(cell);
  }
  const propGrid = el('div', { className: 'style-grid' });
  for (const prop of props) {
    const cell = el('div', { className: 'style-cell checker' });
    cell.innerHTML = composeProp(prop, style, 88);
    propGrid.append(cell);
  }
  container.append(
    el('h3', {}, 'Every character…'),
    charGrid,
    el('h3', {}, '…and every prop, restyled live'),
    propGrid,
  );
}

export function renderStyleControls(container: HTMLElement): void {
  clear(container);
  const style = store.state.style;

  container.append(el('h3', {}, 'Outline'));
  container.append(
    labeled(
      'Width',
      slider(style.outline.width, 0, 6, 0.5, (v) => store.mutate((s) => (s.style.outline.width = v), 'data')),
    ),
    labeled(
      'Color',
      colorInput(style.outline.color, (v) => store.mutate((s) => (s.style.outline.color = v), 'data')),
    ),
    labeled(
      'Mode',
      select(
        [
          { value: 'silhouette', label: 'Silhouette (RimWorld-ish)' },
          { value: 'per-part', label: 'Per-part (cartoon)' },
        ],
        style.outline.mode,
        (v) => store.mutate((s) => (s.style.outline.mode = v as 'silhouette' | 'per-part'), 'data'),
      ),
    ),
  );

  container.append(el('h3', {}, 'Proportions'));
  container.append(
    labeled(
      'Head scale',
      slider(style.proportions.headScale, 0.7, 1.4, 0.05, (v) =>
        store.mutate((s) => (s.style.proportions.headScale = v), 'data'),
      ),
    ),
    labeled(
      'Body width',
      slider(style.proportions.bodyWidth, 0.7, 1.4, 0.05, (v) =>
        store.mutate((s) => (s.style.proportions.bodyWidth = v), 'data'),
      ),
    ),
  );

  container.append(el('h3', {}, 'Render'));
  container.append(
    labeled(
      'Base sprite size',
      select(
        [64, 96, 128, 192, 256].map((n) => ({ value: String(n), label: `${n}px` })),
        String(style.render.baseSize),
        (v) => store.mutate((s) => (s.style.render.baseSize = Number(v)), 'data'),
      ),
    ),
  );

  container.append(el('h3', {}, 'Palette pools'));
  container.append(
    el('p', { className: 'hint' }, 'Pools feed the randomizer and keep generated coworkers on-style.'),
  );
  const poolLabels: Record<keyof typeof style.palettePools, string> = {
    skin: 'Skin tones',
    hair: 'Hair',
    clothing: 'Clothing',
    secondary: 'Shirts / collars',
    accent: 'Accents',
  };
  for (const key of Object.keys(poolLabels) as Array<keyof typeof style.palettePools>) {
    const row = el('div', { className: 'pool-row' });
    style.palettePools[key].forEach((color, i) => {
      const swatch = el('span', { className: 'pool-swatch' });
      swatch.append(
        colorInput(color, (v) => store.mutate((s) => (s.style.palettePools[key][i] = v), 'data')),
        el(
          'button',
          {
            className: 'pool-remove',
            title: 'Remove',
            onClick: () =>
              store.mutate((s) => s.style.palettePools[key].splice(i, 1), 'structure'),
          },
          '×',
        ),
      );
      row.append(swatch);
    });
    row.append(
      el(
        'button',
        {
          className: 'pool-add',
          title: 'Add color',
          onClick: () => store.mutate((s) => s.style.palettePools[key].push('#888888'), 'structure'),
        },
        '+',
      ),
    );
    container.append(labeled(poolLabels[key], row));
  }

  container.append(
    el('h3', {}, 'Danger zone'),
    el(
      'div',
      { className: 'btn-row' },
      button('Reset style to defaults', () => {
        if (!confirm('Reset the global style sheet? Characters and props are kept.')) return;
        store.mutate((s) => (s.style = structuredClone(DEFAULT_STYLE)), 'structure');
      }, 'danger'),
    ),
  );
}
