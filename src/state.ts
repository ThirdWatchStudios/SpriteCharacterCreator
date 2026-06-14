import type { Mood, ProjectState } from './core/types';
import type { SceneBrush, SceneFacing } from './core/scene';
import type { EmployeeDefinition, Population } from './core/employee';
import { createDefaultScene } from './core/scene';
import { migrateProject } from './core/migrations';
import { defaultProject } from './data/defaults';

export { normalizePixelScale } from './core/migrations';

const STORAGE_KEY = 'sprite-character-creator-v1';

/** What changed — 'structure' rebuilds controls, 'data' only refreshes previews. */
export type ChangeKind = 'structure' | 'data';
type Listener = (kind: ChangeKind) => void;

class Store {
  state: ProjectState;
  /** UI selection, not persisted as part of the project. */
  ui = {
    tab: 'characters' as 'characters' | 'props' | 'tiles' | 'scene' | 'employees' | 'style',
    selectedCharacterId: '',
    selectedPropId: '',
    selectedTileId: '',
    exportScale: 2,
    /** Preview-only mood; never stored in recipes. */
    previewMood: 'normal' as Mood,
    /** Show the overhead mood badge in live previews (exports always include it). */
    showMoodBadge: true,
    sceneBrush: 'character' as SceneBrush,
    sceneFacing: 'south' as SceneFacing,
    sceneMood: 'suspicious' as Mood,
    sceneCoworkers: 4,
    /** Blank = random seed on Generate; shows the seed actually used. */
    sceneSeed: '',
    selectedStylePresetId: '',
    styleCompare: false,
    stylePresetName: '',
    /** Office Population Generator tab (transient — not persisted in the project). */
    employeeSeed: '',
    employeeProfile: 'random',
    employeeRenderMode: 'full' as 'full' | 'portrait',
    employee: undefined as EmployeeDefinition | undefined,
    population: undefined as Population | undefined,
    populationCount: 25,
  };
  private listeners: Listener[] = [];

  constructor() {
    this.state = this.load();
    this.ui.selectedCharacterId = this.state.characters[0]?.id ?? '';
    this.ui.selectedPropId = this.state.props[0]?.id ?? '';
    this.ui.selectedTileId = this.state.walls[0]?.id ?? this.state.floors[0]?.id ?? '';
    this.ui.selectedStylePresetId = this.state.stylePresets[0]?.id ?? '';
    this.state.scene ??= createDefaultScene(this.state);
    // Persist the migrated/normalized form so older saves are rewritten to the
    // current schema (and legacy ids reconciled) without waiting for an edit.
    this.save();
  }

  private load(): ProjectState {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const migrated = migrateProject(JSON.parse(raw));
        if (migrated) return migrated;
      }
    } catch {
      // fall through to defaults
    }
    return defaultProject();
  }

  save(): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
  }

  subscribe(fn: Listener): void {
    this.listeners.push(fn);
  }

  mutate(fn: (state: ProjectState) => void, kind: ChangeKind = 'data'): void {
    fn(this.state);
    this.save();
    this.emit(kind);
  }

  /** UI-only change (tab/selection) — no persistence of project data needed. */
  mutateUi(fn: (ui: Store['ui']) => void): void {
    fn(this.ui);
    this.emit('structure');
  }

  replaceProject(next: ProjectState): void {
    this.state = migrateProject(next) ?? next;
    this.ui.selectedCharacterId = this.state.characters[0]?.id ?? '';
    this.ui.selectedPropId = this.state.props[0]?.id ?? '';
    this.ui.selectedTileId = this.state.walls[0]?.id ?? this.state.floors[0]?.id ?? '';
    this.ui.selectedStylePresetId = this.state.stylePresets[0]?.id ?? '';
    this.state.scene ??= createDefaultScene(this.state);
    this.save();
    this.emit('structure');
  }

  private emit(kind: ChangeKind): void {
    for (const fn of this.listeners) fn(kind);
  }

  get selectedCharacter() {
    return this.state.characters.find((c) => c.id === this.ui.selectedCharacterId);
  }

  get selectedProp() {
    return this.state.props.find((p) => p.id === this.ui.selectedPropId);
  }

  /** Selected wall or floor, plus which list it came from. */
  get selectedTile(): { tile: import('./core/types').TileInstance; kind: 'wall' | 'floor' } | undefined {
    const wall = this.state.walls.find((w) => w.id === this.ui.selectedTileId);
    if (wall) return { tile: wall, kind: 'wall' };
    const floor = this.state.floors.find((f) => f.id === this.ui.selectedTileId);
    if (floor) return { tile: floor, kind: 'floor' };
    return undefined;
  }
}

export const store = new Store();
