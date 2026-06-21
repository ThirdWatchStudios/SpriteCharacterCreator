import { describe, it, expect } from 'vitest';
import { exportAll, type ExportSink, type Rasterizer } from '../src/core/exporter';
import { defaultGoldenProject } from '../src/data/defaults';
import { ROLE_TEMPLATES } from '../src/data/roleTemplates';

/**
 * Default-bundle coverage guard.
 *
 * The principle: every system we build that affects the export must contribute a
 * DEFAULT, so the out-of-the-box bundle is a complete, sim-importable baseline —
 * no hand-generation required to test the whole pipeline. This test is that
 * contract. When you add a system that emits a new artifact (or a new catalog
 * field the sim consumes), add it here too. A failure here means a system shipped
 * without a default to test it in the sim.
 *
 * The baseline IS `defaultGoldenProject()` — exactly what `npm run export -- default`,
 * Reset-all, and first-load produce: the hero cast inside a generated multi-department
 * company with a populated, wing-tagged office. The UI / CLI always pass ROLE_TEMPLATES.
 */
function defaultBaseline() {
  return defaultGoldenProject();
}

/** Capture every emitted path (strings and PNG bytes alike) plus the JSON bodies. */
async function exportPaths() {
  const paths = new Set<string>();
  const json = new Map<string, string>();
  const sink: ExportSink = {
    file: (path, data) => {
      paths.add(path);
      if (typeof data === 'string') json.set(path, data);
    },
  };
  const rasterizer: Rasterizer = { rasterizeSheet: async () => new Uint8Array() };
  await exportAll(defaultBaseline(), { sink, rasterizer, scenarioTemplates: ROLE_TEMPLATES });
  return { paths, json };
}

describe('default bundle is a complete, sim-importable baseline', () => {
  // One root artifact per system — every one of these must ship in a plain export.
  const REQUIRED_ROOT_FILES = [
    'project.json',
    'company.json', // company root (Epic 0) — MERIDIAN_DYNAMICS ships by default
    'drives.json',
    'traits.json',
    'relationshipTypes.json', // reusable bond catalog (CONTRACT §3.7)
    'departments.json', // department catalog (+ F2.4 capabilities)
    'org-structure.json', // derived org chart (Epic 2)
    'scenario-template.json', // cast-agnostic template library (Epic 4)
    'office-layout.json', // rooms / wings / anchors (Epic 1)
    'conversation-style.json',
    'activity-badges-atlas@1x.json',
    'mood-emotes-atlas@1x.json',
    'theme.uss', // shared UI palette — UI Toolkit (docs/ui-art-plan.md)
    'theme.json', // shared UI palette — uGUI / non-USS consumers
  ];

  // Per-entity systems — at least one folder of each must exist.
  const REQUIRED_PREFIXES = [
    'characters/', // baked sprite sheets + atlas + recipe + profile
    'character-layers/', // re-tintable layer atlases
    'props/',
    'walls/',
    'floors/',
    'scenarios/', // authored scenario run package
  ];

  it('emits one root artifact for every system', async () => {
    const { paths } = await exportPaths();
    for (const file of REQUIRED_ROOT_FILES) {
      expect(paths.has(file), `default bundle is missing root artifact "${file}"`).toBe(true);
    }
  });

  it('emits at least one folder for every per-entity system', async () => {
    const { paths } = await exportPaths();
    for (const prefix of REQUIRED_PREFIXES) {
      const hit = [...paths].some((p) => p.startsWith(prefix));
      expect(hit, `default bundle has no "${prefix}*" entries`).toBe(true);
    }
  });

  it('ships an authored persona profile and a self-contained scenario package', async () => {
    const { paths } = await exportPaths();
    expect([...paths].some((p) => /^characters\/.+\/profile\.json$/.test(p)), 'no character profile.json').toBe(true);
    expect([...paths].some((p) => /^scenarios\/.+\/scenario\.json$/.test(p)), 'no scenario.json').toBe(true);
    // The scenario package must carry the catalogs so a bundle is self-contained.
    expect([...paths].some((p) => /^scenarios\/.+\/relationshipTypes\.json$/.test(p)), 'scenario package missing relationshipTypes.json').toBe(true);
  });

  it('the default data actually exercises the recent catalog/precondition systems', async () => {
    const { json } = await exportPaths();
    // F2.4 — a department ships a non-empty capability/medium grant.
    const departments = JSON.parse(json.get('departments.json')!);
    expect(departments.some((d: { capabilities?: string[] }) => (d.capabilities?.length ?? 0) > 0), 'no department ships capabilities (F2.4)').toBe(true);
    // F2.4 — capabilities also surface in the visible org chart.
    const org = JSON.parse(json.get('org-structure.json')!);
    expect(org.structure.departments.some((d: { capabilities?: string[] }) => (d.capabilities?.length ?? 0) > 0), 'org-structure carries no capabilities (F2.4)').toBe(true);
    // F4.3 — the shipped template library includes an organizational-distance term.
    const lib = JSON.parse(json.get('scenario-template.json')!);
    const hasDistance = lib.templates.some((t: { roles: { preconditions: { kind: string }[] }[] }) =>
      t.roles.some((r) => r.preconditions.some((p) => p.kind === 'distance')),
    );
    expect(hasDistance, 'no shipped template uses a distance precondition (F4.3)').toBe(true);
    // F1.1/F1.4 — the golden office is a MULTI-department populated office: several
    // department wings (not just one) + the sim-bound common rooms, all connected.
    const layout = JSON.parse(json.get('office-layout.json')!);
    const deptWings = layout.wings.filter((w: { departmentId: string | null }) => w.departmentId);
    expect(deptWings.length, 'golden office should have multiple department wings').toBeGreaterThan(1);
    expect(layout.connectivity.length, 'golden office wings are not connected (F1.3)').toBeGreaterThan(0);
    const roomKinds = new Set(layout.rooms.map((r: { id: string }) => r.id.replace(/@.*/, '')));
    for (const simRoom of ['manager-office', 'break-room', 'conference-room', 'hallway']) {
      expect(roomKinds.has(simRoom), `golden office missing sim-bound room "${simRoom}"`).toBe(true);
    }
    // Themes — departments ship a visual theme (distinct floors keep wings distinct).
    expect(departments.some((d: { theme?: { floor?: string } }) => d.theme?.floor), 'no department ships a theme floor').toBe(true);
    // Amenities — each bullpen has its own interaction points (water cooler in ≥2 wings).
    const coolerWings = new Set(
      layout.interactionAnchors
        .filter((a: { interactionType: string }) => a.interactionType === 'water_cooler')
        .map((a: { roomId: string }) => a.roomId)
        .filter((r: string) => r.startsWith('cubicle-farm')),
    );
    expect(coolerWings.size, 'department wings have no per-wing amenities').toBeGreaterThan(1);
  });

  it('emits a UI theme whose line color matches the exported outline', async () => {
    const { json } = await exportPaths();
    const theme = JSON.parse(json.get('theme.json')!);
    const project = JSON.parse(json.get('project.json')!);
    // The theme is generated from the same style, so --wc-line tracks the world.
    expect(theme.palette.line, 'theme line color should equal the project outline').toBe(
      project.style.outline.color,
    );
    expect(theme.palette.accent, 'theme is missing an accent color').toBeTruthy();
    // theme.uss is the USS form of the same palette.
    expect(json.get('theme.uss'), 'theme.uss missing accent var').toContain('--wc-accent:');
  });

  it('ships a generated supporting population (multiple departments, personas, relationships)', async () => {
    const { json } = await exportPaths();
    const project = JSON.parse(json.get('project.json')!);
    // Hero cast (4) + generated coworkers across several departments.
    expect(project.characters.length, 'no generated population beyond the hero cast').toBeGreaterThan(4);
    const depts = new Set(project.profiles.map((p: { identity: { department: string } }) => p.identity.department));
    expect(depts.size, 'population should span multiple departments').toBeGreaterThan(2);
    const edges = project.profiles.reduce((s: number, p: { relationships: unknown[] }) => s + p.relationships.length, 0);
    expect(edges, 'population has no relationships').toBeGreaterThan(0);
  });
});
