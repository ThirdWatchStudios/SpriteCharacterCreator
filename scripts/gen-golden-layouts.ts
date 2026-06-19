/**
 * Golden office-layout fixture generator (F1.5 / S1.5.2).
 *
 *   npm run golden:update
 *
 * Regenerates the committed `tests/golden/office-layout/<name>.json` fixtures from
 * the shared config table (`tests/golden/configs.ts`). These goldens are the
 * shared parity artifact: `tests/goldenLayout.test.ts` locks the tool's output
 * against them, and the C# runtime port's Unity-side tests assert a structural
 * match against the same files. Run this whenever a layout change is intentional.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { generateOfficeLayout, sceneToLayoutJson } from '../src/core/layout';
import { defaultProject } from '../src/data/defaults';
import { GOLDEN_LAYOUT_CONFIGS } from '../tests/golden/configs';

const OUT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../tests/golden/office-layout');

function main(): void {
  mkdirSync(OUT_DIR, { recursive: true });
  for (const config of GOLDEN_LAYOUT_CONFIGS) {
    const project = defaultProject();
    const { scene } = generateOfficeLayout(project, 6, config.seed, {
      wingDepartmentIds: config.wingDepartmentIds,
    });
    const json = sceneToLayoutJson(scene, project);
    const path = join(OUT_DIR, `${config.name}.json`);
    writeFileSync(path, `${JSON.stringify(json, null, 2)}\n`);
    console.log(`wrote ${path} (cols=${json.cols} rows=${json.rows} wings=${json.wings.length} edges=${json.connectivity.length})`);
  }
}

main();
