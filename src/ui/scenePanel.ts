import type { Mood, TileInstance } from '../core/types';
import type { SceneBrush, SceneState } from '../core/scene';
import { FACINGS, MOODS } from '../core/types';
import { composeCharacter, composeFloorTile, composeProp, composeWallTile } from '../core/compositor';
import { GENERATED_COWORKER_PREFIX, generateOfficeLayout, sceneToLayoutJson } from '../core/layout';
import {
  clearSceneBrush,
  composeSceneSvg,
  createDefaultScene,
  stampCharacter,
  stampFloor,
  stampProp,
  stampWall,
} from '../core/scene';
import { downloadBlob, downloadJson, scenePosterPng } from '../core/exporter';
import { PROP_TEMPLATES } from '../props/templates';
import { store } from '../state';
import { button, clear, el, labeled, select } from './dom';
import { setPreviewSvg, setScenePreviewSvg } from './renderPreview';

const BRUSHES: Array<{ id: SceneBrush; label: string }> = [
  { id: 'floor', label: 'Floor' },
  { id: 'wall', label: 'Wall' },
  { id: 'prop', label: 'Prop' },
  { id: 'character', label: 'Character' },
];

function scene(): SceneState {
  store.state.scene ??= createDefaultScene(store.state);
  return store.state.scene;
}

function selectedFloor(): TileInstance | undefined {
  return store.state.floors.find((floor) => floor.id === store.ui.selectedTileId) ?? store.state.floors[0];
}

function selectedWall(): TileInstance | undefined {
  return store.state.walls.find((wall) => wall.id === store.ui.selectedTileId) ?? store.state.walls[0];
}

function brushButton(brush: SceneBrush, label: string): HTMLButtonElement {
  return el(
    'button',
    {
      className: `scene-brush ${store.ui.sceneBrush === brush ? 'active' : ''}`,
      onClick: () =>
        store.mutateUi((ui) => {
          ui.sceneBrush = brush;
          if (brush === 'floor') ui.selectedTileId = selectedFloor()?.id ?? ui.selectedTileId;
          if (brush === 'wall') ui.selectedTileId = selectedWall()?.id ?? ui.selectedTileId;
        }),
    },
    label,
  );
}

function thumbForBrush(brush: SceneBrush, id: string): HTMLElement {
  const thumb = el('span', { className: 'thumb checker' });
  if (brush === 'character') {
    const recipe = store.state.characters.find((item) => item.id === id);
    if (recipe) setPreviewSvg(thumb, composeCharacter(recipe, store.state.style, 'south', 40, store.ui.sceneMood), store.state.style, 40);
  } else if (brush === 'prop') {
    const prop = store.state.props.find((item) => item.id === id);
    if (prop) setPreviewSvg(thumb, composeProp(prop, store.state.style, 40), store.state.style, 40);
  } else if (brush === 'wall') {
    const wall = store.state.walls.find((item) => item.id === id);
    if (wall) setPreviewSvg(thumb, composeWallTile(wall, store.state.style, 0b1010, 40), store.state.style, 40);
  } else {
    const floor = store.state.floors.find((item) => item.id === id);
    if (floor) setPreviewSvg(thumb, composeFloorTile(floor, store.state.style, 40), store.state.style, 40);
  }
  return thumb;
}

function renderAssetItems(list: HTMLElement, brush: SceneBrush): void {
  const items =
    brush === 'character'
      ? store.state.characters.map((item) => ({ id: item.id, name: item.name }))
      : brush === 'prop'
        ? store.state.props.map((item) => ({ id: item.id, name: item.name }))
        : brush === 'wall'
          ? store.state.walls.map((item) => ({ id: item.id, name: item.name }))
          : store.state.floors.map((item) => ({ id: item.id, name: item.name }));

  const selectedId =
    brush === 'character'
      ? store.ui.selectedCharacterId
      : brush === 'prop'
        ? store.ui.selectedPropId
        : store.ui.selectedTileId;

  for (const item of items) {
    list.append(
      el(
        'button',
        {
          className: `entity-item ${item.id === selectedId ? 'selected' : ''}`,
          onClick: () =>
            store.mutateUi((ui) => {
              ui.sceneBrush = brush;
              if (brush === 'character') ui.selectedCharacterId = item.id;
              else if (brush === 'prop') ui.selectedPropId = item.id;
              else ui.selectedTileId = item.id;
            }),
        },
        thumbForBrush(brush, item.id),
        el('span', { className: 'entity-name' }, item.name),
      ),
    );
  }
}

export function renderSceneList(container: HTMLElement): void {
  clear(container);
  const brushGrid = el('div', { className: 'scene-brush-grid' });
  for (const brush of BRUSHES) brushGrid.append(brushButton(brush.id, brush.label));

  const list = el('div', { className: 'entity-list' });
  list.append(el('div', { className: 'list-heading' }, `${store.ui.sceneBrush}s`));
  renderAssetItems(list, store.ui.sceneBrush);
  container.append(el('div', { className: 'list-actions' }, brushGrid), list);
}

function placeAt(x: number, y: number): void {
  store.mutate((state) => {
    const target = (state.scene ??= createDefaultScene(state));
    const ui = store.ui;
    if (ui.sceneBrush === 'floor') stampFloor(target, x, y, selectedFloor());
    else if (ui.sceneBrush === 'wall') stampWall(target, x, y, selectedWall());
    else if (ui.sceneBrush === 'prop') stampProp(target, x, y, store.selectedProp);
    else stampCharacter(target, x, y, store.selectedCharacter, ui.sceneFacing, ui.sceneMood);
  }, 'structure');
}

function clearAt(x: number, y: number): void {
  store.mutate((state) => {
    const target = (state.scene ??= createDefaultScene(state));
    clearSceneBrush(target, x, y, store.ui.sceneBrush);
  }, 'structure');
}

export function renderScenePreview(container: HTMLElement): void {
  clear(container);
  const current = scene();
  const frame = el('div', { className: 'scene-frame', style: `aspect-ratio: ${current.cols} / ${current.rows};` });
  const art = el('div', { className: `scene-art ${store.state.style.render.pixelScale > 1 ? 'pixelated-preview' : ''}` });
  setScenePreviewSvg(
    art,
    composeSceneSvg(current, store.state, 64),
    store.state.style,
    current.cols * 64,
    current.rows * 64,
    true,
  );

  const overlay = el('div', {
    className: 'scene-grid',
    style: `grid-template-columns: repeat(${current.cols}, 1fr); grid-template-rows: repeat(${current.rows}, 1fr);`,
  });
  for (let y = 0; y < current.rows; y++) {
    for (let x = 0; x < current.cols; x++) {
      overlay.append(
        el('button', {
          className: 'scene-cell',
          title: `${x}, ${y}`,
          onClick: () => placeAt(x, y),
          onContextmenu: (event: Event) => {
            event.preventDefault();
            clearAt(x, y);
          },
        }),
      );
    }
  }

  frame.append(art, overlay);
  container.append(frame);
}

function placedCharacterRows(current: SceneState): HTMLElement {
  const rows = el('div', { className: 'scene-character-list' });
  const characters = current.entities.filter((entity) => entity.kind === 'character');
  if (characters.length === 0) {
    rows.append(el('p', { className: 'hint' }, 'No placed characters.'));
    return rows;
  }

  for (const entity of characters) {
    const recipe = store.state.characters.find((item) => item.id === entity.refId);
    const moodSelect = select(
      MOODS.map((mood) => ({ value: mood, label: mood })),
      entity.mood,
      (value) =>
        store.mutate((state) => {
          const target = state.scene?.entities.find((item) => item.id === entity.id);
          if (target) target.mood = value as Mood;
        }),
    );
    rows.append(
      el(
        'div',
        { className: 'scene-character-row' },
        el('span', { className: 'scene-character-name' }, recipe?.name ?? 'Missing character'),
        moodSelect,
      ),
    );
  }
  return rows;
}

export function renderSceneControls(container: HTMLElement): void {
  clear(container);
  const current = scene();

  container.append(
    labeled(
      'Character facing',
      select(
        [...FACINGS, 'west'].map((facing) => ({ value: facing, label: facing })),
        store.ui.sceneFacing,
        (value) => store.mutateUi((ui) => (ui.sceneFacing = value as typeof store.ui.sceneFacing)),
      ),
    ),
    labeled(
      'Character mood',
      select(
        MOODS.map((mood) => ({ value: mood, label: mood })),
        store.ui.sceneMood,
        (value) => store.mutateUi((ui) => (ui.sceneMood = value as Mood)),
      ),
    ),
  );

  const projection = store.selectedProp
    ? PROP_TEMPLATES.find((template) => template.id === store.selectedProp?.templateId)?.projection
    : undefined;
  if (projection) {
    container.append(
      labeled(
        'Selected prop',
        el('span', { className: `projection-badge ${projection}` }, projection === 'plan' ? 'Plan layer' : 'Y-sorted'),
      ),
    );
  }

  container.append(el('h3', {}, 'Placed moods'), placedCharacterRows(current));

  const scaleSelect = select(
    [1, 2, 4].map((scale) => ({
      value: String(scale),
      label: `${scale}x (${store.state.style.render.baseSize * scale}px cells)`,
    })),
    String(store.ui.exportScale),
    (value) => (store.ui.exportScale = Number(value)),
  );

  const exportBtn = button('Poster PNG', async () => {
    exportBtn.disabled = true;
    exportBtn.textContent = 'Rendering...';
    try {
      const blob = await scenePosterPng(current, store.state, store.ui.exportScale);
      downloadBlob(`office-scene@${store.ui.exportScale}x.png`, blob);
    } finally {
      exportBtn.disabled = false;
      exportBtn.textContent = 'Poster PNG';
    }
  }, 'primary');

  const coworkerInput = el('input', {
    type: 'number',
    min: 0,
    max: 12,
    step: 1,
    value: store.ui.sceneCoworkers,
    onInput: (event: Event) => {
      const value = Number((event.target as HTMLInputElement).value);
      store.ui.sceneCoworkers = Number.isFinite(value) ? Math.max(0, Math.min(12, Math.floor(value))) : 0;
    },
  });

  const seedInput = el('input', {
    type: 'text',
    placeholder: 'random',
    value: store.ui.sceneSeed,
    onInput: (event: Event) => {
      store.ui.sceneSeed = (event.target as HTMLInputElement).value.trim();
    },
  });

  const generate = (seed: number | undefined) => {
    const generated = generateOfficeLayout(store.state, store.ui.sceneCoworkers, seed);
    store.ui.sceneSeed = String(generated.seed);
    store.mutate((state) => {
      state.characters = state.characters
        .filter((recipe) => !recipe.id.startsWith(GENERATED_COWORKER_PREFIX))
        .concat(generated.coworkers);
      state.scene = generated.scene;
    }, 'structure');
  };

  // replays the seed in the field (or rolls one when blank)
  const generateBtn = button('Generate office', () => {
    const parsed = Number.parseInt(store.ui.sceneSeed, 10);
    generate(Number.isFinite(parsed) ? parsed : undefined);
  }, 'primary');

  // always rolls a fresh seed — one click, new office
  const randomBtn = button('🎲 New office', () => generate(undefined), 'primary');

  container.append(
    el('h3', {}, 'Random office'),
    labeled('Random coworkers', coworkerInput),
    labeled('Seed (same seed = same office)', seedInput),
    el('div', { className: 'btn-row' }, randomBtn, generateBtn),
    el('h3', {}, 'Scene'),
    labeled('Export scale', scaleSelect),
    el(
      'div',
      { className: 'btn-row' },
      exportBtn,
      button('Layout JSON', () => downloadJson('office-layout.json', sceneToLayoutJson(current, store.state))),
      button('Reset scene', () => store.mutate((state) => (state.scene = createDefaultScene(state)), 'structure')),
    ),
  );
}
