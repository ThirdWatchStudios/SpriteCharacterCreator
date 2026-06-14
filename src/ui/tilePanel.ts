import type { TileInstance } from '../core/types';
import { composeFloorRepeat, composeFloorTile, composeWallRoom, composeWallTile } from '../core/compositor';
import {
  downloadBlob,
  downloadJson,
  floorAtlas,
  floorTilePng,
  wallAtlas,
  wallTilesetPng,
} from '../core/exporter';
import { FLOOR_TEMPLATES, WALL_TEMPLATES, maskName } from '../tiles/templates';
import { store } from '../state';
import { button, clear, el, labeled, select, slider } from './dom';
import { exportScaleSelect, listItem, paletteGrid, PROP_PALETTE_LABELS, uid } from './controls';
import { setPreviewSvg, setScenePreviewSvg } from './renderPreview';

const slugName = (name: string) => name.toLowerCase().replace(/\s+/g, '-');

/**
 * Demo room layout used for the wall preview: 1 = wall cell. Shows straights,
 * corners, a tee, and an end cap in one glance.
 */
const DEMO_ROOM = [
  [1, 1, 1, 1, 1],
  [1, 0, 1, 0, 1],
  [1, 0, 1, 0, 1],
  [1, 1, 1, 0, 1],
  [1, 0, 0, 0, 1],
  [1, 1, 1, 1, 1],
];

export function renderTileList(container: HTMLElement): void {
  clear(container);
  const list = el('div', { className: 'entity-list' });

  const item = (tile: TileInstance, kind: 'wall' | 'floor') => {
    const thumb = el('span', { className: 'thumb checker' });
    setPreviewSvg(
      thumb,
      kind === 'wall'
        ? composeWallTile(tile, store.state.style, 0b1010, 40) // EW straight reads best tiny
        : composeFloorTile(tile, store.state.style, 40),
      store.state.style,
      40,
    );
    list.append(
      listItem({
        selected: tile.id === store.ui.selectedTileId,
        name: tile.name,
        thumb,
        onClick: () => store.mutateUi((ui) => (ui.selectedTileId = tile.id)),
      }),
    );
  };

  list.append(el('div', { className: 'list-heading' }, 'Walls'));
  for (const wall of store.state.walls) item(wall, 'wall');
  list.append(el('div', { className: 'list-heading' }, 'Floors'));
  for (const floor of store.state.floors) item(floor, 'floor');

  const options = [
    ...WALL_TEMPLATES.map((t) => ({ value: `wall:${t.id}`, label: `Wall — ${t.label}` })),
    ...FLOOR_TEMPLATES.map((t) => ({ value: `floor:${t.id}`, label: `Floor — ${t.label}` })),
  ];
  const templateSelect = select(options, options[0].value, () => {});

  container.append(
    list,
    el(
      'div',
      { className: 'list-actions' },
      templateSelect,
      button('+ Add wall / floor', () => {
        const [kind, templateId] = templateSelect.value.split(':') as ['wall' | 'floor', string];
        const template = (kind === 'wall' ? WALL_TEMPLATES : FLOOR_TEMPLATES).find((t) => t.id === templateId)!;
        const tile: TileInstance = {
          id: uid(kind),
          name: template.label,
          templateId,
          params: Object.fromEntries(template.params.map((p) => [p.key, p.default])),
          palette: { primary: '#B4B2A9', secondary: '#888780', accent: '#5F5E5A' },
        };
        store.mutate((s) => (kind === 'wall' ? s.walls : s.floors).push(tile), 'data');
        store.mutateUi((ui) => (ui.selectedTileId = tile.id));
      }, 'primary'),
    ),
  );
}

export function renderTilePreview(container: HTMLElement): void {
  clear(container);
  const sel = store.selectedTile;
  if (!sel) {
    container.append(el('p', { className: 'hint' }, 'Select or add a wall or floor.'));
    return;
  }
  const { tile, kind } = sel;
  const style = store.state.style;
  const pixelated = style.render.pixelScale > 1 ? ' pixelated-preview' : '';

  if (kind === 'wall') {
    // demo room assembled from the autotile set, rendered as one svg so the
    // outline pass is unified and runs read as continuous walls
    const room = el('div', { className: `tile-room checker${pixelated}` });
    setScenePreviewSvg(
      room,
      composeWallRoom(tile, style, DEMO_ROOM, 44),
      style,
      DEMO_ROOM[0].length * 44,
      DEMO_ROOM.length * 44,
    );
    container.append(el('p', { className: 'preview-caption' }, 'Sample room from the 16-piece autotile set'), room);

    // the full tileset
    const sheet = el('div', { className: 'tile-sheet' });
    for (let mask = 0; mask < 16; mask++) {
      const cell = el('div', { className: `tile-sheet-cell checker${pixelated}` });
      setPreviewSvg(cell, composeWallTile(tile, style, mask, 56), style, 56);
      sheet.append(cell, );
      cell.title = `${mask}: ${maskName(mask)}`;
    }
    container.append(el('p', { className: 'preview-caption' }, 'Tileset (masks 0–15, hover for names)'), sheet);
  } else {
    // 3x2 repeat in one svg proves the tile is seamless
    const repeat = el('div', { className: `tile-repeat${pixelated}` });
    setScenePreviewSvg(repeat, composeFloorRepeat(tile, style, 3, 2, 88), style, 3 * 88, 2 * 88);
    container.append(el('p', { className: 'preview-caption' }, 'Tiled 3×2 — seams should be invisible'), repeat);
  }
}

export function renderTileControls(container: HTMLElement): void {
  clear(container);
  const sel = store.selectedTile;
  if (!sel) return;
  const { tile, kind } = sel;
  const template = (kind === 'wall' ? WALL_TEMPLATES : FLOOR_TEMPLATES).find((t) => t.id === tile.templateId);
  if (!template) return;

  container.append(
    labeled(
      'Name',
      el('input', {
        type: 'text',
        value: tile.name,
        onInput: (e: Event) => store.mutate(() => (tile.name = (e.target as HTMLInputElement).value), 'data'),
      }),
    ),
    labeled(
      'Kind',
      el(
        'span',
        { className: 'projection-badge plan' },
        kind === 'wall' ? 'Wall (16-piece autotile)' : 'Floor (seamless tile)',
      ),
    ),
  );

  for (const param of template.params) {
    container.append(
      labeled(
        param.label,
        slider(tile.params[param.key] ?? param.default, param.min, param.max, param.step, (v) =>
          store.mutate(() => (tile.params[param.key] = v), 'data'),
        ),
      ),
    );
  }

  container.append(
    labeled(
      'Palette',
      paletteGrid(tile.palette, PROP_PALETTE_LABELS, (token, v) =>
        store.mutate(() => (tile.palette[token] = v), 'data'),
      ),
    ),
  );

  container.append(
    el(
      'div',
      { className: 'btn-row' },
      button('Duplicate', () =>
        store.mutate((s) => {
          const copy = structuredClone(tile);
          copy.id = uid(kind);
          copy.name = `${tile.name} copy`;
          (kind === 'wall' ? s.walls : s.floors).push(copy);
          store.ui.selectedTileId = copy.id;
        }, 'structure'),
      ),
      button('Delete', () => {
        if (!confirm(`Delete ${tile.name}?`)) return;
        store.mutate((s) => {
          if (kind === 'wall') s.walls = s.walls.filter((w) => w.id !== tile.id);
          else s.floors = s.floors.filter((f) => f.id !== tile.id);
          store.ui.selectedTileId = s.walls[0]?.id ?? s.floors[0]?.id ?? '';
        }, 'structure');
      }, 'danger'),
    ),
  );

  container.append(
    el('h3', {}, 'Export'),
    labeled('Scale', exportScaleSelect()),
    el(
      'div',
      { className: 'btn-row' },
      kind === 'wall'
        ? button('Tileset PNG', async () => {
            const blob = await wallTilesetPng(tile, store.state.style, store.ui.exportScale);
            downloadBlob(`${slugName(tile.name)}-tileset@${store.ui.exportScale}x.png`, blob);
          }, 'primary')
        : button('Tile PNG', async () => {
            const blob = await floorTilePng(tile, store.state.style, store.ui.exportScale);
            downloadBlob(`${slugName(tile.name)}-tile@${store.ui.exportScale}x.png`, blob);
          }, 'primary'),
      button('Atlas JSON', () =>
        downloadJson(
          `${slugName(tile.name)}-atlas@${store.ui.exportScale}x.json`,
          kind === 'wall'
            ? wallAtlas(tile, store.state.style, store.ui.exportScale)
            : floorAtlas(tile, store.state.style, store.ui.exportScale),
        ),
      ),
      button('Tile JSON', () => downloadJson(`${slugName(tile.name)}.json`, tile)),
    ),
  );
}
