import type { PaletteToken } from '../core/types';
import { composeCharacter } from '../core/compositor';
import { characterAtlas, characterSheetPng, downloadBlob, downloadJson } from '../core/exporter';
import { randomCharacter, rerollPalette } from '../core/random';
import { partsForSlot } from '../parts/library';
import { store } from '../state';
import { button, clear, colorInput, el, labeled, select } from './dom';

const PALETTE_LABELS: Record<PaletteToken, string> = {
  skin: 'Skin',
  hair: 'Hair',
  outfitPrimary: 'Outfit',
  outfitSecondary: 'Shirt / collar',
  accent: 'Accent',
};

export function renderCharacterList(container: HTMLElement): void {
  clear(container);
  const list = el('div', { className: 'entity-list' });
  for (const recipe of store.state.characters) {
    const selected = recipe.id === store.ui.selectedCharacterId;
    const thumb = el('span', { className: 'thumb checker' });
    thumb.innerHTML = composeCharacter(recipe, store.state.style, 'south', 40);
    const item = el(
      'button',
      {
        className: `entity-item ${selected ? 'selected' : ''}`,
        onClick: () => store.mutateUi((ui) => (ui.selectedCharacterId = recipe.id)),
      },
      thumb,
      el('span', { className: 'entity-name' }, recipe.name),
    );
    list.append(item);
  }
  container.append(
    list,
    el(
      'div',
      { className: 'list-actions' },
      button('+ Random coworker', () => {
        const recipe = randomCharacter(store.state.style);
        store.mutate((s) => s.characters.push(recipe), 'data');
        store.mutateUi((ui) => (ui.selectedCharacterId = recipe.id));
      }, 'primary'),
    ),
  );
}

export function renderCharacterPreview(container: HTMLElement): void {
  clear(container);
  const recipe = store.selectedCharacter;
  if (!recipe) {
    container.append(el('p', { className: 'hint' }, 'Select or create a character.'));
    return;
  }
  const style = store.state.style;

  const hero = el('div', { className: 'preview-hero checker' });
  hero.innerHTML = composeCharacter(recipe, style, 'south', 224);

  const row = el('div', { className: 'facing-row' });
  for (const facing of ['south', 'east', 'north', 'west'] as const) {
    const cell = el('div', { className: 'facing-cell' });
    const img = el('div', { className: 'facing-img checker' });
    img.innerHTML = composeCharacter(recipe, style, facing, 96);
    cell.append(img, el('span', { className: 'facing-label' }, facing));
    row.append(cell);
  }
  container.append(hero, row);
}

export function renderCharacterControls(container: HTMLElement): void {
  clear(container);
  const recipe = store.selectedCharacter;
  if (!recipe) return;

  container.append(
    labeled(
      'Name',
      el('input', {
        type: 'text',
        value: recipe.name,
        onInput: (e: Event) =>
          store.mutate(() => (recipe.name = (e.target as HTMLInputElement).value), 'data'),
      }),
    ),
  );

  // Part pickers
  const slotConfigs = [
    { label: 'Body', slot: 'body', get: () => recipe.parts.body, set: (v: string) => (recipe.parts.body = v) },
    { label: 'Head', slot: 'head', get: () => recipe.parts.head, set: (v: string) => (recipe.parts.head = v) },
    { label: 'Hair', slot: 'hair', get: () => recipe.parts.hair, set: (v: string) => (recipe.parts.hair = v) },
    { label: 'Outfit', slot: 'outfit', get: () => recipe.parts.outfit, set: (v: string) => (recipe.parts.outfit = v) },
  ] as const;
  for (const cfg of slotConfigs) {
    const options = partsForSlot(cfg.slot).map((p) => ({ value: p.id, label: p.label }));
    container.append(
      labeled(cfg.label, select(options, cfg.get(), (v) => store.mutate(() => cfg.set(v), 'data'))),
    );
  }

  // Accessories
  const accBox = el('div', { className: 'check-grid' });
  for (const part of partsForSlot('accessory')) {
    const checked = recipe.parts.accessories.includes(part.id);
    accBox.append(
      el(
        'label',
        { className: 'check-item' },
        el('input', {
          type: 'checkbox',
          ...(checked ? { checked: true } : {}),
          onChange: (e: Event) =>
            store.mutate(() => {
              const on = (e.target as HTMLInputElement).checked;
              recipe.parts.accessories = on
                ? [...recipe.parts.accessories, part.id]
                : recipe.parts.accessories.filter((id) => id !== part.id);
            }, 'data'),
        }),
        part.label,
      ),
    );
  }
  container.append(labeled('Accessories', accBox));

  // Palette
  const paletteBox = el('div', { className: 'palette-grid' });
  for (const token of Object.keys(PALETTE_LABELS) as PaletteToken[]) {
    paletteBox.append(
      el(
        'span',
        { className: 'palette-cell' },
        colorInput(recipe.palette[token], (v) => store.mutate(() => (recipe.palette[token] = v), 'data')),
        el('span', { className: 'palette-label' }, PALETTE_LABELS[token]),
      ),
    );
  }
  container.append(labeled('Palette', paletteBox));

  // Actions
  container.append(
    el(
      'div',
      { className: 'btn-row' },
      button('Reroll colors', () =>
        store.mutate((s) => {
          const i = s.characters.findIndex((c) => c.id === recipe.id);
          s.characters[i] = rerollPalette(recipe, s.style);
        }, 'structure'),
      ),
      button('Duplicate', () =>
        store.mutate((s) => {
          const copy = structuredClone(recipe);
          copy.id = `${recipe.id}-copy-${Date.now().toString(36)}`;
          copy.name = `${recipe.name} copy`;
          s.characters.push(copy);
          store.ui.selectedCharacterId = copy.id;
        }, 'structure'),
      ),
      button('Delete', () => {
        if (!confirm(`Delete ${recipe.name}?`)) return;
        store.mutate((s) => {
          s.characters = s.characters.filter((c) => c.id !== recipe.id);
          store.ui.selectedCharacterId = s.characters[0]?.id ?? '';
        }, 'structure');
      }, 'danger'),
    ),
  );

  // Export
  const scaleSelect = select(
    [1, 2, 4].map((s) => ({ value: String(s), label: `${s}x (${store.state.style.render.baseSize * s}px)` })),
    String(store.ui.exportScale),
    (v) => (store.ui.exportScale = Number(v)),
  );
  container.append(
    el('h3', {}, 'Export'),
    labeled('Scale', scaleSelect),
    el(
      'div',
      { className: 'btn-row' },
      button('Sheet PNG', async () => {
        const blob = await characterSheetPng(recipe, store.state.style, store.ui.exportScale);
        downloadBlob(`${recipe.name.toLowerCase().replace(/\s+/g, '-')}-sheet@${store.ui.exportScale}x.png`, blob);
      }, 'primary'),
      button('Atlas JSON', () =>
        downloadJson(
          `${recipe.name.toLowerCase().replace(/\s+/g, '-')}-atlas@${store.ui.exportScale}x.json`,
          characterAtlas(recipe, store.state.style, store.ui.exportScale),
        ),
      ),
      button('Recipe JSON', () =>
        downloadJson(`${recipe.name.toLowerCase().replace(/\s+/g, '-')}-recipe.json`, recipe),
      ),
    ),
  );
}
