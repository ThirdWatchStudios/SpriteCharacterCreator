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
    'behaviors.json', // reusable workplace-behavior catalog (CONTRACT §3.14)
    'departments.json', // department catalog (+ F2.4 capabilities)
    'org-structure.json', // derived org chart (Epic 2)
    'scenario-template.json', // cast-agnostic template library (Epic 4)
    'office-layout.json', // rooms / wings / anchors (Epic 1)
    'conversation-style.json',
    'activity-badges-atlas@1x.json',
    'mood-emotes-atlas@1x.json',
    'attention-puffs-atlas@1x.json', // transient event-flash atlas (active-loop §7)
    'theme.uss', // shared UI palette — UI Toolkit (docs/ui-art-plan.md)
    'theme.json', // shared UI palette — uGUI / non-USS consumers
    'overlay-style.json', // floor-overlay look spec for the Shapes layer (Epic 36)
  ];

  // Per-entity systems — at least one folder of each must exist.
  const REQUIRED_PREFIXES = [
    'characters/', // baked sprite sheets + atlas + recipe + profile
    'character-layers/', // re-tintable layer atlases
    'props/',
    'walls/',
    'floors/',
    'scenarios/', // authored scenario run package
    'icons/', // UI icon set — SVG + PNG ladder (docs/ui-art-plan.md)
    'cursors/', // cursor textures — PNG-only + hotspots (docs/ui-art-plan.md)
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
    // §3.14 — the shipped behavior catalog is non-trivial and spans multiple families,
    // so an agent has several recognizable ways to express pressure out of the box.
    const behaviors = JSON.parse(json.get('behaviors.json')!);
    expect(behaviors.length, 'behavior catalog is too small (§3.14)').toBeGreaterThanOrEqual(20);
    expect(new Set(behaviors.map((b: { category: string }) => b.category)).size, 'behaviors span too few categories').toBeGreaterThan(3);
    // F4.3 — the shipped template library includes an organizational-distance term.
    const lib = JSON.parse(json.get('scenario-template.json')!);
    const hasDistance = lib.templates.some((t: { roles: { preconditions: { kind: string }[] }[] }) =>
      t.roles.some((r) => r.preconditions.some((p) => p.kind === 'distance')),
    );
    expect(hasDistance, 'no shipped template uses a distance precondition (F4.3)').toBe(true);
    // F1.1/F1.4 — the golden office is a MULTI-department populated office: several
    // department wings (not just one) + the sim-bound common rooms, all connected.
    const layout = JSON.parse(json.get('office-layout.json')!);
    // Schema v4 + building surround: the golden baseline SHIPS the "floor in a tower"
    // border (every system contributes a default), so the export carries a tenantRect
    // and a grown grid. The tenant region stays smaller than the full (tenant+ring) grid.
    expect(layout.version, 'office-layout should be schema v4').toBe(4);
    expect(layout.tenantRect, 'golden baseline should ship a building surround').not.toBeNull();
    expect(layout.tenantRect.cols, 'tenant should be narrower than the grown grid').toBeLessThan(layout.cols);
    expect(layout.tenantRect.rows, 'tenant should be shorter than the grown grid').toBeLessThan(layout.rows);
    // Ring props are decor only — they must never produce interaction anchors.
    const tr = layout.tenantRect;
    const inTenant = (a: { x: number; y: number }) =>
      a.x >= tr.x && a.y >= tr.y && a.x < tr.x + tr.cols && a.y < tr.y + tr.rows;
    expect(
      layout.interactionAnchors.every(inTenant),
      'no interaction anchor should sit in the building-surround ring',
    ).toBe(true);
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
    // Epic 36 channel tokens are present so floor (Shapes) + chrome share one palette.
    for (const tok of ['--wc-trust', '--wc-suspicion', '--wc-pressure', '--wc-surveillance']) {
      expect(json.get('theme.uss'), `theme.uss missing channel token ${tok}`).toContain(tok);
    }
  });

  it('emits a floor-overlay style spec the Shapes layer can read', async () => {
    const { json } = await exportPaths();
    const overlay = JSON.parse(json.get('overlay-style.json')!);
    expect(overlay.kind).toBe('floor-overlay-style');
    expect(overlay.renderer).toBe('shapes');
    // The two protective rules from ui_visual_design.md.
    expect(overlay.rules.motionEncodesEvents).toBe(true);
    expect(overlay.rules.oneDominantPressurePerAgent).toBe(true);
    // Every channel cites a theme token (color or belief axis), not a raw hex.
    for (const [name, ch] of Object.entries<Record<string, unknown>>(overlay.channels)) {
      const refs = JSON.stringify(ch);
      expect(refs.includes('--wc-'), `overlay channel ${name} should reference a --wc-* token`).toBe(true);
    }
    // Cross-channel focus model — the "bloom the selection, dim the rest" lever.
    expect(overlay.focus.focusWeightMul).toBeGreaterThan(1);
    expect(overlay.focus.dimAlpha).toBeLessThan(1);
    // Relationship state lines carry static richness (glow + endpoints) so they
    // read without animation — motion stays reserved for events (the rule above).
    expect(overlay.channels.trust.motion).toBe('still');
    expect(overlay.channels.trust.glow.alpha).toBeGreaterThan(0);
    expect(overlay.channels.trust.endpoints.cap).not.toBe('none');
  });

  it('ships overhead-badge motion intent so the sim animates them consistently', async () => {
    const { json } = await exportPaths();
    const activity = JSON.parse(json.get('activity-badges-atlas@1x.json')!);
    const attention = JSON.parse(json.get('attention-puffs-atlas@1x.json')!);
    // Ongoing state badges carry intent but are NOT transient (no flash); every
    // badged id has an intro/loop/outro + salience tier.
    expect(activity.motion.transient).toBe(false);
    for (const intent of Object.values<Record<string, unknown>>(activity.motion.byId)) {
      expect(intent.intro).toBeTruthy();
      expect(intent.salienceTier).toBeGreaterThan(0);
    }
    // Attention puffs are transient events, and harvestable sits at the top of the
    // salience hierarchy (§7) — the player's call-to-action.
    expect(attention.motion.transient).toBe(true);
    const tiers = attention.motion.byId;
    const top = Math.max(...Object.values<{ salienceTier: number }>(tiers).map((i) => i.salienceTier));
    expect(tiers['attn-harvestable'].salienceTier).toBe(top);
    expect(tiers['attn-harvestable'].loop).toBe('shimmer');
  });

  it('emits the UI icon set as both SVG (UI Toolkit) and PNG (uGUI) with a manifest', async () => {
    const { paths, json } = await exportPaths();
    const manifest = JSON.parse(json.get('icons/icons-manifest.json')!);
    expect(manifest.icons.length, 'no UI icons shipped').toBeGreaterThan(0);
    for (const icon of manifest.icons) {
      expect(paths.has(`icons/${icon.id}.svg`), `icon ${icon.id} missing SVG`).toBe(true);
      expect(paths.has(`icons/${icon.id}@1x.png`), `icon ${icon.id} missing 1x PNG`).toBe(true);
    }
    // SVG is resolution-independent (carries the design viewBox).
    const svg = json.get(`icons/${manifest.icons[0].id}.svg`)!;
    expect(svg, 'icon SVG missing design viewBox').toContain('viewBox="0 0 128 128"');
    // The diegetic + literal batches are present: a literal icon ships real color
    // (not a white mask), and the catalog-grounded groups exist.
    const ids = manifest.icons.map((i: { id: string }) => i.id);
    for (const id of [
      'dept-leadership',
      'need-recognition',
      'rel-romantic',
      // Epic 36 workstation chrome (docs/epic-36-ui-assets.md).
      'ui-capture',
      'layer-relationships',
      'pressure-suspicion',
      'intervention-lock',
      'iris-mark',
    ]) {
      expect(ids, `icon set missing ${id}`).toContain(id);
    }
    const romance = json.get('icons/rel-romantic.svg')!;
    expect(romance, 'literal icon should ship its real color, not a white mask').toContain('#D8638F');
  });

  it('emits PNG-only cursors with normalized hotspots', async () => {
    const { paths, json } = await exportPaths();
    const manifest = JSON.parse(json.get('cursors/cursors-manifest.json')!);
    expect(manifest.cursors.length, 'no cursors shipped').toBeGreaterThan(0);
    for (const cursor of manifest.cursors) {
      expect(paths.has(`cursors/${cursor.id}@1x.png`), `cursor ${cursor.id} missing 1x PNG`).toBe(true);
      // Cursors are textures — no SVG.
      expect(paths.has(`cursors/${cursor.id}.svg`), `cursor ${cursor.id} should not ship an SVG`).toBe(false);
      expect(cursor.hotspot.x, `cursor ${cursor.id} hotspot out of range`).toBeGreaterThanOrEqual(0);
      expect(cursor.hotspot.x).toBeLessThanOrEqual(1);
    }
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
