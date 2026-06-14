import type { ProjectState } from './types';
import { CURRENT_SCHEMA_VERSION } from './types';
import { DEFAULT_FLOORS, DEFAULT_PROFILES, DEFAULT_PROPS, DEFAULT_STYLE_PRESETS, DEFAULT_WALLS } from '../data/defaults';

// Re-export so callers can keep importing the version from the migration module.
export { CURRENT_SCHEMA_VERSION } from './types';

/**
 * Legacy recipe ids → their reconciled, game-aligned id. The exported atlas
 * family is the recipe id, which must equal the sim's AgentId; the manager was
 * authored as 'the-manager' but the game spawns 'manager'. Applied in the v2
 * step so existing saves stop exporting the wrong family.
 */
const LEGACY_CAST_ID_RENAMES: Record<string, string> = {
  'the-manager': 'manager',
};

export function normalizePixelScale(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.max(1, Math.min(8, Math.round(value)));
}

/**
 * Bring a parsed project of any prior shape up to {@link CURRENT_SCHEMA_VERSION},
 * or return `null` if it isn't a usable project (the caller then falls back to
 * defaults). This replaces the old ad-hoc `??=` backfill: every shape change
 * becomes a numbered, ordered step here so old saves — and the game's
 * expectations of an exported pack — can't drift apart unnoticed.
 */
export function migrateProject(raw: unknown): ProjectState | null {
  if (!raw || typeof raw !== 'object') return null;
  const project = raw as Partial<ProjectState> & { version?: unknown };

  // A project written by a newer tool than this one: refuse rather than corrupt
  // it by silently dropping fields we don't understand.
  const version = typeof project.version === 'number' ? project.version : 0;
  if (version > CURRENT_SCHEMA_VERSION) return null;

  // Minimum viability — without a cast and a render style nothing can compose.
  if (!Array.isArray(project.characters) || project.characters.length === 0) return null;
  if (!project.style || !project.style.render) return null;

  // --- ordered migrations: apply every step newer than the file's version ---
  // legacy/v0 → v1: collections (props/walls/floors/presets) and pixelScale were
  // added after the first saves; backfill them from defaults. Idempotent, so it
  // runs unconditionally as a safety net for partial data.
  backfillV1(project as ProjectState);

  // v1 → v2: reconcile legacy cast ids to the game's AgentIds (the-manager →
  // manager) so the exported atlas family matches the agent the game spawns.
  if (version < 2) reconcileLegacyCastIds(project as ProjectState);

  // v2 → v3: ensure the profiles collection exists and seed the default cast's
  // personas for saves that predate it (matched by agentId, so user-authored
  // profiles are never clobbered).
  backfillV3(project as ProjectState);

  project.version = CURRENT_SCHEMA_VERSION;
  return project as ProjectState;
}

/** v3 step: ensure `profiles` exists and the default cast personas are present. */
function backfillV3(project: ProjectState): void {
  project.profiles ??= [];
  const present = new Set(project.profiles.map((p) => p.agentId));
  const castIds = new Set(project.characters.map((c) => c.id));
  for (const profile of DEFAULT_PROFILES) {
    if (!present.has(profile.agentId) && castIds.has(profile.agentId)) {
      project.profiles.push(structuredClone(profile));
    }
  }
}

/** v2 step: rename legacy cast recipe ids and remap any scene refs to them. */
function reconcileLegacyCastIds(project: ProjectState): void {
  for (const [from, to] of Object.entries(LEGACY_CAST_ID_RENAMES)) {
    const legacy = project.characters.find((recipe) => recipe.id === from);
    const taken = project.characters.some((recipe) => recipe.id === to);
    if (!legacy || taken) continue; // nothing to rename, or the id is already in use
    legacy.id = to;
    for (const entity of project.scene?.entities ?? []) {
      if (entity.kind === 'character' && entity.refId === from) entity.refId = to;
    }
  }
}

/** v1 step: ensure later-added collections exist and pixel scales are sane. */
function backfillV1(project: ProjectState): void {
  project.props ??= structuredClone(DEFAULT_PROPS);
  project.walls ??= structuredClone(DEFAULT_WALLS);
  project.floors ??= structuredClone(DEFAULT_FLOORS);
  project.stylePresets ??= structuredClone(DEFAULT_STYLE_PRESETS);
  project.style.render.pixelScale = normalizePixelScale(project.style.render.pixelScale ?? 1);

  // Pull in any default presets/props/floors the saved project predates, so a
  // refreshed default set (e.g. the supply cabinet + mail station) reaches old
  // projects without clobbering the user's own entries.
  for (const preset of DEFAULT_STYLE_PRESETS) {
    if (!project.stylePresets.some((item) => item.id === preset.id || item.name === preset.name)) {
      project.stylePresets.push(structuredClone(preset));
    }
  }
  for (const preset of project.stylePresets) {
    preset.style.render.pixelScale = normalizePixelScale(preset.style.render.pixelScale ?? 1);
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
