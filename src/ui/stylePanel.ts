import type { ProjectState, StylePreset, StyleSheet } from '../core/types';
import { composeCharacter, composeProp } from '../core/compositor';
import { composeSceneSvg } from '../core/scene';
import { DEFAULT_STYLE, DEFAULT_STYLE_PRESETS } from '../data/defaults';
import { normalizePixelScale, store } from '../state';
import { button, clear, colorInput, el, labeled, select, slider } from './dom';
import { setPreviewSvg, setScenePreviewSvg } from './renderPreview';

/**
 * The style tab is the whole point of the tool: every control here re-renders
 * every character and prop live, proving the style is never baked in.
 */

const BUILT_IN_PRESET_IDS = new Set(DEFAULT_STYLE_PRESETS.map((preset) => preset.id));

function cloneStyle(style: StyleSheet): StyleSheet {
  return structuredClone(style);
}

function projectWithStyle(style: StyleSheet): ProjectState {
  return { ...store.state, style };
}

function selectedPreset(): StylePreset | undefined {
  return store.state.stylePresets.find((preset) => preset.id === store.ui.selectedStylePresetId);
}

function stylePreviewStrip(style: StyleSheet): HTMLElement {
  const strip = el('div', { className: 'style-compare-strip' });
  for (const recipe of store.state.characters.slice(0, 4)) {
    const cell = el('div', { className: `style-compare-character checker ${pixelClass(style)}` });
    setPreviewSvg(cell, composeCharacter(recipe, style, 'south', 54, store.ui.previewMood), style, 54);
    strip.append(cell);
  }
  return strip;
}

function pixelClass(style: StyleSheet): string {
  return (style.render.pixelScale ?? 1) > 1 ? 'pixelated-preview' : '';
}

function presetSwatches(style: StyleSheet): HTMLElement {
  const colors = [
    style.outline.color,
    ...style.palettePools.clothing.slice(0, 3),
    ...style.palettePools.accent.slice(0, 2),
  ];
  return el(
    'span',
    { className: 'preset-swatches' },
    ...colors.map((color) => el('span', { className: 'preset-swatch', style: `background:${color};` })),
  );
}

function renderComparePreview(container: HTMLElement): void {
  const styles: Array<{ id: string; name: string; style: StyleSheet; active: boolean }> = [
    { id: 'current', name: 'Current style', style: store.state.style, active: true },
    ...store.state.stylePresets.map((preset) => ({
      id: preset.id,
      name: preset.name,
      style: preset.style,
      active: preset.id === store.ui.selectedStylePresetId,
    })),
  ];
  const currentScene = store.state.scene;
  const grid = el('div', { className: 'style-compare-grid' });

  for (const item of styles) {
    const sceneFrame = el('div', { className: `style-compare-scene ${pixelClass(item.style)}` });
    if (currentScene) {
      setScenePreviewSvg(
        sceneFrame,
        composeSceneSvg(currentScene, projectWithStyle(item.style), 26),
        item.style,
        currentScene.cols * 26,
        currentScene.rows * 26,
        true,
      );
    }
    grid.append(
      el(
        'article',
        { className: `style-compare-card ${item.active ? 'active' : ''}` },
        el('div', { className: 'style-compare-title' }, item.name),
        sceneFrame,
        stylePreviewStrip(item.style),
      ),
    );
  }

  container.append(el('h3', {}, 'Style compare'), grid);
}

export function renderStylePreview(container: HTMLElement): void {
  clear(container);
  const { characters, props, style } = store.state;

  if (store.ui.styleCompare) {
    renderComparePreview(container);
    return;
  }

  const charGrid = el('div', { className: 'style-grid' });
  for (const recipe of characters) {
    const cell = el('div', { className: `style-cell checker ${pixelClass(style)}` });
    setPreviewSvg(cell, composeCharacter(recipe, style, 'south', 88), style, 88);
    charGrid.append(cell);
  }
  const propGrid = el('div', { className: 'style-grid' });
  for (const prop of props) {
    const cell = el('div', { className: `style-cell checker ${pixelClass(style)}` });
    setPreviewSvg(cell, composeProp(prop, style, 88), style, 88);
    propGrid.append(cell);
  }
  container.append(
    el('h3', {}, 'Every character…'),
    charGrid,
    el('h3', {}, '…and every prop, restyled live'),
    propGrid,
  );
}

function applyPreset(preset: StylePreset): void {
  store.ui.selectedStylePresetId = preset.id;
  store.mutate((state) => {
    state.style = cloneStyle(preset.style);
  }, 'structure');
}

function saveCurrentAsPreset(name: string): void {
  const trimmed = name.trim();
  const preset: StylePreset = {
    id: `style-preset-${Date.now().toString(36)}`,
    name: trimmed || `Style ${store.state.stylePresets.length + 1}`,
    style: cloneStyle(store.state.style),
  };
  store.ui.selectedStylePresetId = preset.id;
  store.ui.stylePresetName = '';
  store.mutate((state) => {
    state.stylePresets.push(preset);
  }, 'structure');
}

function updateSelectedPreset(preset: StylePreset): void {
  store.mutate((state) => {
    const target = state.stylePresets.find((item) => item.id === preset.id);
    if (target) target.style = cloneStyle(state.style);
  }, 'structure');
}

function deleteSelectedPreset(preset: StylePreset): void {
  if (BUILT_IN_PRESET_IDS.has(preset.id)) return;
  store.mutate((state) => {
    state.stylePresets = state.stylePresets.filter((item) => item.id !== preset.id);
    store.ui.selectedStylePresetId = state.stylePresets[0]?.id ?? '';
  }, 'structure');
}

function renderPresetControls(container: HTMLElement): void {
  const activePreset = selectedPreset() ?? store.state.stylePresets[0];
  if (activePreset && store.ui.selectedStylePresetId !== activePreset.id) {
    store.ui.selectedStylePresetId = activePreset.id;
  }

  const presetCards = el('div', { className: 'preset-list' });
  for (const preset of store.state.stylePresets) {
    const isSelected = preset.id === store.ui.selectedStylePresetId;
    presetCards.append(
      el(
        'div',
        { className: `preset-card ${isSelected ? 'selected' : ''}` },
        el(
          'button',
          {
            className: 'preset-select',
            onClick: () => {
              store.ui.selectedStylePresetId = preset.id;
              store.mutateUi(() => {});
            },
          },
          el('span', { className: 'preset-name' }, preset.name),
          presetSwatches(preset.style),
        ),
        button('Apply', () => applyPreset(preset), 'primary'),
      ),
    );
  }

  const nameInput = el('input', {
    type: 'text',
    placeholder: 'Preset name',
    value: store.ui.stylePresetName,
    onInput: (event: Event) => {
      store.ui.stylePresetName = (event.target as HTMLInputElement).value;
    },
  });

  container.append(
    el('h3', {}, 'Style presets'),
    presetCards,
    labeled('Save current style', nameInput),
    el(
      'div',
      { className: 'btn-row' },
      button('Save current', () => saveCurrentAsPreset(store.ui.stylePresetName), 'primary'),
      button('Update selected', () => {
        const preset = selectedPreset();
        if (preset) updateSelectedPreset(preset);
      }),
      button(store.ui.styleCompare ? 'Hide compare' : 'Compare presets', () =>
        store.mutateUi((ui) => (ui.styleCompare = !ui.styleCompare)),
      ),
      button('Delete selected', () => {
        const preset = selectedPreset();
        if (!preset || BUILT_IN_PRESET_IDS.has(preset.id)) return;
        if (!confirm(`Delete "${preset.name}"?`)) return;
        deleteSelectedPreset(preset);
      }, 'danger'),
    ),
  );
}

export function renderStyleControls(container: HTMLElement): void {
  clear(container);
  const style = store.state.style;

  renderPresetControls(container);

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
    labeled(
      'Pixelate',
      slider(style.render.pixelScale ?? 1, 1, 8, 1, (v) =>
        store.mutate((s) => (s.style.render.pixelScale = normalizePixelScale(v)), 'data'),
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
