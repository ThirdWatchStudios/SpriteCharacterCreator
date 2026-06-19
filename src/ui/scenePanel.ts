import type { Mood, TileInstance } from '../core/types';
import type { SceneBrush, SceneState } from '../core/scene';
import { FACINGS, MOODS } from '../core/types';
import { composeCharacter, composeFloorTile, composeProp, composeWallTile } from '../core/compositor';
import {
  GENERATED_COWORKER_PREFIX,
  INTERACTION_PROP_TYPES,
  computeInteractionAnchors,
  computeOfficeAnchors,
  generateOfficeLayout,
  sceneToLayoutJson,
  type OfficeAnchor,
} from '../core/layout';
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
import { exportScaleSelect, listItem, uid, viewTabs } from './controls';
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
      listItem({
        selected: item.id === selectedId,
        name: item.name,
        thumb: thumbForBrush(brush, item.id),
        onClick: () =>
          store.mutateUi((ui) => {
            ui.sceneBrush = brush;
            if (brush === 'character') ui.selectedCharacterId = item.id;
            else if (brush === 'prop') ui.selectedPropId = item.id;
            else ui.selectedTileId = item.id;
          }),
      }),
    );
  }
}

type MapMode = 'layout' | 'assign' | 'interactions';
const MAP_MODES: ReadonlyArray<{ id: MapMode; label: string }> = [
  { id: 'layout', label: 'Layout' },
  { id: 'assign', label: 'Assign' },
  { id: 'interactions', label: 'Interactions' },
];

export function renderSceneList(container: HTMLElement): void {
  clear(container);
  const mode = store.ui.mapMode;
  if (mode === 'assign') renderAssignSidebar(container);
  else if (mode === 'interactions') renderInteractionsSidebar(container);
  else renderLayoutSidebar(container);
}

function renderLayoutSidebar(container: HTMLElement): void {
  const brushGrid = el('div', { className: 'scene-brush-grid' });
  for (const brush of BRUSHES) brushGrid.append(brushButton(brush.id, brush.label));

  const list = el('div', { className: 'entity-list' });
  list.append(el('div', { className: 'list-heading' }, `${store.ui.sceneBrush}s`));
  renderAssetItems(list, store.ui.sceneBrush);
  container.append(el('div', { className: 'list-actions' }, brushGrid), list);
}

function renderAssignSidebar(container: HTMLElement): void {
  const s = store.selectedScenario;
  if (!s) {
    container.append(el('p', { className: 'hint' }, 'Select or create a scenario in the Scenario tab to seat cast and bind locations.'));
    return;
  }
  const target = store.ui.assignTarget;

  container.append(el('div', { className: 'list-heading' }, 'Seat cast'));
  const castList = el('div', { className: 'entity-list' });
  if (!s.cast.length) castList.append(el('p', { className: 'hint' }, 'No cast members yet.'));
  for (const member of s.cast) {
    const recipe = store.state.characters.find((c) => c.id === member.agentId);
    castList.append(
      listItem({
        selected: target?.kind === 'cast' && target.id === member.agentId,
        name: recipe?.name ?? member.agentId,
        onClick: () => store.mutateUi((ui) => (ui.assignTarget = { kind: 'cast', id: member.agentId })),
      }),
    );
  }
  container.append(castList);

  container.append(el('div', { className: 'list-heading' }, 'Bind location'));
  const locList = el('div', { className: 'entity-list' });
  if (!s.locations.length) locList.append(el('p', { className: 'hint' }, 'No locations yet — add them in the Scenario tab.'));
  for (const loc of s.locations) {
    locList.append(
      listItem({
        selected: target?.kind === 'location' && target.id === loc.locationId,
        name: loc.displayName || loc.locationId,
        onClick: () => store.mutateUi((ui) => (ui.assignTarget = { kind: 'location', id: loc.locationId })),
      }),
    );
  }
  container.append(locList);
}

function renderInteractionsSidebar(container: HTMLElement): void {
  container.append(el('div', { className: 'list-heading' }, 'Interaction props'));
  const list = el('div', { className: 'entity-list' });
  const interactionProps = store.state.props.filter((p) => INTERACTION_PROP_TYPES[p.templateId]);
  if (!interactionProps.length) {
    container.append(el('p', { className: 'hint' }, 'No interaction props in the project. Create one in the Props tab.'));
    return;
  }
  for (const prop of interactionProps) {
    list.append(
      listItem({
        selected: prop.id === store.ui.selectedPropId && store.ui.sceneBrush === 'prop',
        name: prop.name,
        thumb: thumbForBrush('prop', prop.id),
        onClick: () =>
          store.mutateUi((ui) => {
            ui.sceneBrush = 'prop';
            ui.selectedPropId = prop.id;
          }),
      }),
    );
  }
  container.append(list);
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
  const mode = store.ui.mapMode;
  container.append(
    viewTabs(mode, MAP_MODES, (id) => store.mutateUi((ui) => (ui.mapMode = id as MapMode))),
  );
  if (mode === 'assign') container.append(el('p', { className: 'hint scene-mode-hint' }, assignHint()));
  else if (mode === 'interactions')
    container.append(el('p', { className: 'hint scene-mode-hint' }, 'Pick an interaction prop on the left, then click the map to place it. Right-click removes a prop.'));

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

  frame.append(art, buildMapOverlay(current, mode));
  container.append(frame);
}

function assignHint(): string {
  const t = store.ui.assignTarget;
  if (!store.selectedScenario) return 'No scenario selected.';
  if (!t) return 'Pick a cast member or location on the left, then click a desk or room anchor.';
  const s = store.selectedScenario;
  const name =
    t.kind === 'cast'
      ? store.state.characters.find((c) => c.id === t.id)?.name ?? t.id
      : s?.locations.find((l) => l.locationId === t.id)?.displayName || t.id;
  return `Click a desk or room anchor to ${t.kind === 'cast' ? 'seat' : 'bind'} "${name}".`;
}

/** The clickable grid overlaid on the scene SVG; its behaviour depends on the map mode. */
function buildMapOverlay(current: SceneState, mode: MapMode): HTMLElement {
  const overlay = el('div', {
    className: 'scene-grid',
    style: `grid-template-columns: repeat(${current.cols}, 1fr); grid-template-rows: repeat(${current.rows}, 1fr);`,
  });

  const s = store.selectedScenario;
  const anchors = mode === 'assign' ? computeOfficeAnchors(current, store.state) : [];
  const anchorByCell = new Map(anchors.map((a) => [`${a.x},${a.y}`, a]));
  const spawnByCell = new Map<string, string[]>();
  if (mode === 'assign' && s) {
    for (const member of s.cast) {
      const loc = s.locations.find((l) => l.locationId === member.spawnLocationId);
      if (!loc) continue;
      const anchor = anchors.find((a) => a.anchorId === (loc.bindTo.anchorId || loc.bindTo.roomId));
      if (!anchor) continue;
      const key = `${anchor.x},${anchor.y}`;
      const list = spawnByCell.get(key) ?? [];
      list.push(member.agentId);
      spawnByCell.set(key, list);
    }
  }
  // Interaction markers are shown in every mode except assign, so they stay visible while painting.
  const interByCell =
    mode === 'assign'
      ? new Map<string, string>()
      : new Map(computeInteractionAnchors(current, store.state).map((i) => [`${i.x},${i.y}`, i.interactionType]));

  for (let y = 0; y < current.rows; y++) {
    for (let x = 0; x < current.cols; x++) {
      const key = `${x},${y}`;
      const classes = ['scene-cell'];
      const children: Node[] = [];
      let onClick: () => void;

      if (mode === 'assign') {
        classes.push('scenario-cell');
        const anchor = anchorByCell.get(key);
        if (anchor) classes.push('is-anchor');
        onClick = () => {
          if (anchor) assignAtAnchor(anchor);
        };
        const spawns = spawnByCell.get(key);
        if (spawns) children.push(el('span', { className: 'scenario-marker' }, spawns.join(',')));
      } else {
        onClick = () => placeAt(x, y);
        const interaction = interByCell.get(key);
        if (interaction) children.push(el('span', { className: 'interaction-marker' }, interaction.replace(/_/g, ' ')));
      }

      overlay.append(
        el(
          'button',
          {
            className: classes.join(' '),
            title: key,
            onClick,
            onContextmenu: (event: Event) => {
              event.preventDefault();
              if (mode !== 'assign') clearAt(x, y);
            },
          },
          ...children,
        ),
      );
    }
  }
  return overlay;
}

/** Seat the active cast member, or bind the active location, to the clicked anchor. */
function assignAtAnchor(anchor: OfficeAnchor): void {
  const s = store.selectedScenario;
  const target = store.ui.assignTarget;
  if (!s || !target) return;
  const bindAnchorId = anchor.kind === 'desk' ? anchor.anchorId : '';

  if (target.kind === 'location') {
    store.mutate(() => {
      const loc = s.locations.find((l) => l.locationId === target.id);
      if (loc) loc.bindTo = { roomId: anchor.roomId, anchorId: bindAnchorId };
    }, 'structure');
    return;
  }

  // Seat a cast member: reuse a location already bound to this anchor, or create one.
  store.mutate(() => {
    const member = s.cast.find((c) => c.agentId === target.id);
    if (!member) return;
    let loc = s.locations.find((l) => l.bindTo.roomId === anchor.roomId && l.bindTo.anchorId === bindAnchorId);
    if (!loc) {
      const base = anchor.kind === 'desk' ? `${target.id}-desk` : anchor.roomId || 'spawn';
      loc = {
        locationId: uid(base),
        displayName: '',
        tags: [],
        accessState: 'open',
        fallbackLocationId: '',
        bindTo: { roomId: anchor.roomId, anchorId: bindAnchorId },
      };
      s.locations.push(loc);
    }
    member.spawnLocationId = loc.locationId;
  }, 'structure');
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

// Office controls split into focused tabs so paint settings, office generation,
// and export aren't all competing for attention beside the canvas at once.
const SCENE_TABS: ReadonlyArray<{ id: string; label: string }> = [
  { id: 'paint', label: 'Paint' },
  { id: 'generate', label: 'Generate' },
  { id: 'export', label: 'Export' },
];

let sceneControlsContainer: HTMLElement | null = null;
let sceneControlsTab = 'paint';

export function renderSceneControls(container: HTMLElement): void {
  clear(container);
  sceneControlsContainer = container;
  const mode = store.ui.mapMode;
  if (mode === 'assign') renderAssignControls(container);
  else if (mode === 'interactions') renderInteractionsControls(container);
  else renderLayoutControls(container);
}

function renderLayoutControls(container: HTMLElement): void {
  const current = scene();
  if (!SCENE_TABS.some((t) => t.id === sceneControlsTab)) sceneControlsTab = 'paint';
  container.append(
    viewTabs(sceneControlsTab, SCENE_TABS, (id) => {
      sceneControlsTab = id;
      if (sceneControlsContainer) renderSceneControls(sceneControlsContainer);
    }),
  );

  if (sceneControlsTab === 'paint') renderScenePaint(container, current);
  else if (sceneControlsTab === 'generate') renderSceneGenerate(container);
  else renderSceneExport(container, current);
}

function renderAssignControls(container: HTMLElement): void {
  const s = store.selectedScenario;
  if (!s) {
    container.append(el('p', { className: 'hint' }, 'No scenario selected.'));
    return;
  }

  container.append(el('h3', {}, 'Cast seating'));
  if (!s.cast.length) container.append(el('p', { className: 'hint' }, 'No cast members.'));
  for (const member of s.cast) {
    const recipe = store.state.characters.find((c) => c.id === member.agentId);
    const loc = s.locations.find((l) => l.locationId === member.spawnLocationId);
    const where = loc ? loc.bindTo.anchorId || loc.bindTo.roomId || '—' : 'unassigned';
    container.append(
      el(
        'div',
        { className: 'assign-row' },
        el('span', { className: 'assign-name' }, recipe?.name ?? member.agentId),
        el('span', { className: 'assign-where' }, where),
      ),
    );
  }

  container.append(el('h3', {}, 'Location bindings'));
  if (!s.locations.length) container.append(el('p', { className: 'hint' }, 'No locations.'));
  for (const loc of s.locations) {
    container.append(
      el(
        'div',
        { className: 'assign-row' },
        el('span', { className: 'assign-name' }, loc.displayName || loc.locationId),
        el('span', { className: 'assign-where' }, loc.bindTo.anchorId || loc.bindTo.roomId || '(unbound)'),
        button('×', () => store.mutate(() => (loc.bindTo = { roomId: '', anchorId: '' }), 'structure'), 'tag-remove'),
      ),
    );
  }
}

function renderInteractionsControls(container: HTMLElement): void {
  const interactions = computeInteractionAnchors(scene(), store.state);
  container.append(el('h3', {}, `Interaction points (${interactions.length})`));
  if (!interactions.length) {
    container.append(el('p', { className: 'hint' }, 'Place an interaction prop (water cooler, printer, …) on the map to create one.'));
    return;
  }
  for (const i of interactions) {
    container.append(
      el(
        'div',
        { className: 'assign-row' },
        el('span', { className: 'assign-name' }, i.interactionType.replace(/_/g, ' ')),
        el('span', { className: 'assign-where' }, `${i.roomId || '—'} · ${i.x},${i.y}`),
      ),
    );
  }
}

function renderScenePaint(container: HTMLElement, current: SceneState): void {
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
}

function renderSceneExport(container: HTMLElement, current: SceneState): void {
  const scaleSelect = exportScaleSelect();

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

  container.append(
    el('h3', {}, 'Export'),
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

function renderSceneGenerate(container: HTMLElement): void {
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
    const generated = generateOfficeLayout(store.state, store.ui.sceneCoworkers, seed, {
      wingDepartmentIds: store.ui.sceneWingDepartmentIds,
    });
    store.ui.sceneSeed = String(generated.seed);
    store.ui.sceneOccupancy = generated.occupancy;
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

  // Department wings (F1.4): each checked department becomes its own wing, and the
  // footprint grows to fit them. None checked = the classic single office.
  const wingBox = el('div', { className: 'check-grid' });
  for (const dept of store.state.departments) {
    wingBox.append(
      el(
        'label',
        { className: 'check-item' },
        el('input', {
          type: 'checkbox',
          ...(store.ui.sceneWingDepartmentIds.includes(dept.id) ? { checked: true } : {}),
          onChange: () => {
            store.ui.sceneWingDepartmentIds = store.ui.sceneWingDepartmentIds.includes(dept.id)
              ? store.ui.sceneWingDepartmentIds.filter((id) => id !== dept.id)
              : [...store.ui.sceneWingDepartmentIds, dept.id];
          },
        }),
        dept.label,
      ),
    );
  }

  container.append(
    el('h3', {}, 'Random office'),
    el('p', { className: 'hint' }, 'Roll a fresh office and coworker cast, or replay a pinned seed.'),
    labeled('Random coworkers', coworkerInput),
    labeled('Seed (same seed = same office)', seedInput),
    labeled('Department wings (optional)', wingBox),
    el('p', { className: 'hint' }, 'Leave unchecked to auto-derive a wing per department in the generated cast; check departments to override the wing set. Unchecked + no population = a single office.'),
    el('div', { className: 'btn-row' }, randomBtn, generateBtn),
  );

  // F3.4: warn when a wing can't seat all of its generated population.
  if (store.ui.sceneOccupancy.length > 0) {
    container.append(
      el(
        'div',
        { className: 'warning' },
        el('strong', {}, 'Wing over capacity:'),
        ...store.ui.sceneOccupancy.map((msg) => el('p', { className: 'hint' }, msg)),
      ),
    );
  }
}
