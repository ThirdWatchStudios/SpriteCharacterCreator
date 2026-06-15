import type { ProjectState } from './types';
import { CURRENT_SCHEMA_VERSION } from './types';
import { DEFAULT_DRIVES, DEFAULT_FLOORS, DEFAULT_PROFILES, DEFAULT_PROPS, DEFAULT_RELATIONSHIP_TYPES, DEFAULT_SCENARIOS, DEFAULT_STYLE, DEFAULT_STYLE_PRESETS, DEFAULT_TRAITS, DEFAULT_WALLS } from '../data/defaults';

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

  // v3 → v4: ensure the scenarios collection exists and seed the default scenario
  // for saves that predate it (matched by scenarioId; user scenarios untouched).
  backfillV4(project as ProjectState);

  // v4 → v5: beliefs/knowledge moved from personas to scenarios; strip the
  // legacy persona fields so saved profiles match the current shape.
  migrateV5(project as ProjectState);

  // v5 → v6: drives became a reusable, structured project catalog. Seed it and
  // absorb any free-text drive ids existing personas already reference, so no
  // authored drive is lost when the field becomes an id reference.
  backfillV6(project as ProjectState);

  // v6 → v7: trait tags became a reusable, structured catalog. Same treatment —
  // seed defaults and absorb any trait ids personas already carry.
  backfillV7(project as ProjectState);

  // v7 → v8: the render style gained contactShadow + ambientTint. Backfill them
  // on the live style and every preset so old saves get the new (off-by-default
  // would surprise; we seed the DEFAULT_STYLE values) controls.
  backfillV8(project as ProjectState);

  // v8 → v9: the reusable relationshipTypes catalog. Same treatment as drives/
  // traits — seed defaults and absorb any type ids relationship edges already
  // reference, so no authored bond type is lost when it becomes an id reference.
  backfillV9(project as ProjectState);

  project.version = CURRENT_SCHEMA_VERSION;
  return project as ProjectState;
}

/** v9 step: ensure the `relationshipTypes` catalog exists, seed defaults, absorb referenced ids. */
function backfillV9(project: ProjectState): void {
  project.relationshipTypes ??= [];
  const present = new Set(project.relationshipTypes.map((t) => t.id));
  for (const def of DEFAULT_RELATIONSHIP_TYPES) {
    if (!present.has(def.id)) {
      project.relationshipTypes.push(structuredClone(def));
      present.add(def.id);
    }
  }
  // Any type id an edge carries but the catalog lacks (a custom one, or the old
  // hardcoded union's values from a pre-v9 save) is added as a minimal entry.
  for (const profile of project.profiles ?? []) {
    for (const r of profile.relationships) {
      const id = r.relationshipType;
      if (id && !present.has(id)) {
        project.relationshipTypes.push({ id, label: id, description: '', category: 'professional', biasesReactions: {} });
        present.add(id);
      }
    }
  }
}

/** v8 step: seed the new render fields (contactShadow, ambientTint) everywhere a style lives. */
function backfillV8(project: ProjectState): void {
  seedRenderFields(project.style);
  for (const preset of project.stylePresets ?? []) seedRenderFields(preset.style);
}

function seedRenderFields(style: ProjectState['style']): void {
  style.render.contactShadow ??= DEFAULT_STYLE.render.contactShadow;
  style.render.ambientTint ??= DEFAULT_STYLE.render.ambientTint;
}

/** v7 step: ensure the `traits` catalog exists, seed defaults, absorb referenced ids. */
function backfillV7(project: ProjectState): void {
  project.traits ??= [];
  const present = new Set(project.traits.map((t) => t.id));
  for (const def of DEFAULT_TRAITS) {
    if (!present.has(def.id)) {
      project.traits.push(structuredClone(def));
      present.add(def.id);
    }
  }
  // Any trait id a persona carries but the catalog lacks (a custom tag typed
  // before traits were structured) is added as a minimal entry, never dropped.
  for (const profile of project.profiles ?? []) {
    for (const id of profile.personality.traitTags) {
      if (id && !present.has(id)) {
        project.traits.push({ id, label: id, description: '', category: 'status', biasesReactions: {} });
        present.add(id);
      }
    }
  }
}

/** v6 step: ensure the `drives` catalog exists, seed defaults, absorb referenced ids. */
function backfillV6(project: ProjectState): void {
  project.drives ??= [];
  const present = new Set(project.drives.map((d) => d.id));
  for (const def of DEFAULT_DRIVES) {
    if (!present.has(def.id)) {
      project.drives.push(structuredClone(def));
      present.add(def.id);
    }
  }
  // Any drive id a persona still references but the catalog lacks (a custom one
  // typed before drives were structured) is added as a minimal entry, never dropped.
  for (const profile of project.profiles ?? []) {
    const ids = [profile.drives.primary, profile.drives.secondary, ...profile.drives.objectives.map((o) => o.sourceDrive)];
    for (const id of ids) {
      if (id && !present.has(id)) {
        project.drives.push({ id, label: id, description: '', category: 'status', amplifiesNeeds: [] });
        present.add(id);
      }
    }
  }
}

/** v5 step: drop persona-resident startingBeliefs/startingKnowledge (now scenario-owned). */
function migrateV5(project: ProjectState): void {
  for (const profile of project.profiles ?? []) {
    delete (profile as { startingBeliefs?: unknown }).startingBeliefs;
    delete (profile as { startingKnowledge?: unknown }).startingKnowledge;
  }
}

/** v4 step: ensure `scenarios` exists and seed the default scenario(s). */
function backfillV4(project: ProjectState): void {
  project.scenarios ??= [];
  const present = new Set(project.scenarios.map((s) => s.scenarioId));
  const castIds = new Set(project.characters.map((c) => c.id));
  for (const scenario of DEFAULT_SCENARIOS) {
    // Only seed when the project actually has the scenario's cast (don't inject
    // promotion_rumor_001 into an unrelated project).
    const castPresent = scenario.cast.every((c) => castIds.has(c.agentId));
    if (!present.has(scenario.scenarioId) && castPresent) {
      project.scenarios.push(structuredClone(scenario));
    }
  }
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
  for (const wall of DEFAULT_WALLS) {
    if (!project.walls.some((item) => item.id === wall.id || item.templateId === wall.templateId)) {
      project.walls.push(structuredClone(wall));
    }
  }
  for (const floor of DEFAULT_FLOORS) {
    if (!project.floors.some((item) => item.id === floor.id || item.templateId === floor.templateId)) {
      project.floors.push(structuredClone(floor));
    }
  }
}
