import type { Mood, ProjectState } from './core/types';
import type { SceneBrush, SceneFacing } from './core/scene';
import { createDefaultScene } from './core/scene';
import { DEFAULT_FLOORS, DEFAULT_PROPS, DEFAULT_STYLE_PRESETS, DEFAULT_WALLS, defaultProject } from './data/defaults';

const STORAGE_KEY = 'sprite-character-creator-v1';

/** What changed — 'structure' rebuilds controls, 'data' only refreshes previews. */
export type ChangeKind = 'structure' | 'data';
type Listener = (kind: ChangeKind) => void;

class Store {
  state: ProjectState;
  /** UI selection, not persisted as part of the project. */
  ui = {
    tab: 'characters' as 'characters' | 'props' | 'tiles' | 'scene' | 'style',
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
  };
  private listeners: Listener[] = [];

  constructor() {
    this.state = this.load();
    this.ui.selectedCharacterId = this.state.characters[0]?.id ?? '';
    this.ui.selectedPropId = this.state.props[0]?.id ?? '';
    this.ui.selectedTileId = this.state.walls[0]?.id ?? this.state.floors[0]?.id ?? '';
    this.ui.selectedStylePresetId = this.state.stylePresets[0]?.id ?? '';
    this.state.scene ??= createDefaultScene(this.state);
  }

  private load(): ProjectState {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as ProjectState;
        if (parsed.version === 1) {
          // Projects saved before walls/floors existed get the default sets.
          this.backfillDefaults(parsed);
          return parsed;
        }
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
    this.backfillDefaults(next);
    this.state = next;
    this.ui.selectedCharacterId = next.characters[0]?.id ?? '';
    this.ui.selectedPropId = next.props[0]?.id ?? '';
    this.ui.selectedTileId = next.walls[0]?.id ?? next.floors[0]?.id ?? '';
    this.ui.selectedStylePresetId = next.stylePresets[0]?.id ?? '';
    next.scene ??= createDefaultScene(next);
    this.save();
    this.emit('structure');
  }

  private backfillDefaults(project: ProjectState): void {
    project.props ??= structuredClone(DEFAULT_PROPS);
    project.walls ??= structuredClone(DEFAULT_WALLS);
    project.floors ??= structuredClone(DEFAULT_FLOORS);
    project.stylePresets ??= structuredClone(DEFAULT_STYLE_PRESETS);
    project.style.render.pixelScale ??= 1;
    project.style.render.pixelScale = normalizePixelScale(project.style.render.pixelScale);
    for (const preset of DEFAULT_STYLE_PRESETS) {
      if (!project.stylePresets.some((item) => item.id === preset.id || item.name === preset.name)) {
        project.stylePresets.push(structuredClone(preset));
      }
    }
    for (const preset of project.stylePresets) {
      preset.style.render.pixelScale ??= 1;
      preset.style.render.pixelScale = normalizePixelScale(preset.style.render.pixelScale);
    }
    for (const prop of DEFAULT_PROPS) {
      if (!project.props.some((item) => item.id === prop.id)) {
        project.props.push(structuredClone(prop));
      }
    }
    for (const floor of DEFAULT_FLOORS) {
      if (!project.floors.some((item) => item.id === floor.id || item.templateId === floor.templateId)) {
        project.floors.push(structuredClone(floor));
      }
    }
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

export function normalizePixelScale(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.max(1, Math.min(8, Math.round(value)));
}

export const store = new Store();
