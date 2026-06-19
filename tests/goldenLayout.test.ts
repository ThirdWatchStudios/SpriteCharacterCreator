import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateOfficeLayout, sceneToLayoutJson } from '../src/core/layout';
import { defaultProject } from '../src/data/defaults';
import { GOLDEN_LAYOUT_CONFIGS } from './golden/configs';

/**
 * Golden-layout regression lock (F1.5 / S1.5.2). Each config regenerates and must
 * deep-equal its committed `tests/golden/office-layout/<name>.json` — the same
 * fixtures the C# runtime port asserts a structural match against. When a layout
 * change is intentional, regenerate with `npm run golden:update` and review the diff.
 */
const GOLDEN_DIR = resolve(dirname(fileURLToPath(import.meta.url)), 'golden/office-layout');

describe('golden office layouts (Epic 1 / F1.5)', () => {
  for (const config of GOLDEN_LAYOUT_CONFIGS) {
    it(`matches the committed golden for "${config.name}"`, () => {
      const project = defaultProject();
      const { scene } = generateOfficeLayout(project, 6, config.seed, {
        wingDepartmentIds: config.wingDepartmentIds,
      });
      const generated = sceneToLayoutJson(scene, project);
      const golden = JSON.parse(readFileSync(join(GOLDEN_DIR, `${config.name}.json`), 'utf8'));
      expect(generated).toEqual(golden);
    });
  }

  it('every golden config is at payload version 3', () => {
    const project = defaultProject();
    for (const config of GOLDEN_LAYOUT_CONFIGS) {
      const { scene } = generateOfficeLayout(project, 6, config.seed, { wingDepartmentIds: config.wingDepartmentIds });
      expect(sceneToLayoutJson(scene, project).version).toBe(3);
    }
  });

  it('multi-wing configs carry wings and a connected graph; single does not', () => {
    const project = defaultProject();
    for (const config of GOLDEN_LAYOUT_CONFIGS) {
      const { scene } = generateOfficeLayout(project, 6, config.seed, { wingDepartmentIds: config.wingDepartmentIds });
      const json = sceneToLayoutJson(scene, project);
      const wingCount = config.wingDepartmentIds?.length ?? 0;
      if (wingCount > 0) {
        // one wing per department + the common wing, and an edge per department wing
        expect(json.wings.length).toBe(wingCount + 1);
        expect(json.connectivity.length).toBe(wingCount);
      } else {
        expect(json.wings.length).toBe(1);
        expect(json.connectivity).toEqual([]);
      }
    }
  });
});
