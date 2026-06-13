/**
 * Headless export CLI (ROADMAP §2.5).
 *
 *   npm run export -- <project.json|default> <outDir>
 *
 * Regenerates the full asset set — the same tree the in-app "Export all" zip
 * produces (characters / character-layers / props / walls / floors + atlas
 * JSON + project.json + office-layout.json) — without a browser, rendering
 * SVG→PNG with resvg-js. Reuses src/core/exporter.ts's exportAll(); only the
 * rasterizer backend and the output sink differ from the browser path.
 *
 *   default  — the built-in project plus a deterministic generated office
 *              (seed 1), so office-layout.json + generated coworkers are
 *              included. Real project.json files are exported verbatim.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

import { exportAll, type ExportSink } from '../src/core/exporter';
import { createResvgRasterizer } from '../src/core/rasterizer-node';
import { generateOfficeLayout } from '../src/core/layout';
import { defaultProject } from '../src/data/defaults';
import type { ProjectState } from '../src/core/types';

function usage(msg?: string): never {
  if (msg) console.error(`error: ${msg}\n`);
  console.error('usage: npm run export -- <project.json|default> <outDir>');
  process.exit(msg ? 1 : 0);
}

function loadProject(arg: string): ProjectState {
  if (arg === 'default') {
    // Built-in project + a deterministic office so the scene-dependent outputs
    // (office-layout.json, generated coworkers) are exercised end to end.
    const project = defaultProject();
    const office = generateOfficeLayout(project, 6, 1);
    project.characters = [...project.characters, ...office.coworkers];
    project.scene = office.scene;
    return project;
  }
  let raw: string;
  try {
    raw = readFileSync(arg, 'utf8');
  } catch {
    usage(`cannot read project file: ${arg}`);
  }
  try {
    return JSON.parse(raw) as ProjectState;
  } catch (e) {
    usage(`invalid JSON in ${arg}: ${(e as Error).message}`);
  }
}

async function main() {
  const [projectArg, outArg] = process.argv.slice(2);
  if (!projectArg || projectArg === '--help' || projectArg === '-h') usage();
  if (!outArg) usage('missing output directory');

  const project = loadProject(projectArg);
  const outDir = resolve(outArg);

  let fileCount = 0;
  const sink: ExportSink = {
    file(path, data) {
      const full = join(outDir, path);
      mkdirSync(dirname(full), { recursive: true });
      if (typeof data === 'string') {
        writeFileSync(full, data);
      } else if (data instanceof Uint8Array) {
        writeFileSync(full, data);
      } else {
        // A Blob would only appear if the canvas backend leaked in — guard it.
        throw new Error(`headless sink received a non-Uint8Array for ${path}`);
      }
      fileCount++;
    },
  };

  const start = Date.now();
  let lastPct = -1;
  await exportAll(project, {
    sink,
    rasterizer: createResvgRasterizer(),
    onProgress: (done, total, label) => {
      const pct = Math.floor((done / total) * 100);
      if (pct !== lastPct) {
        lastPct = pct;
        process.stdout.write(`\r  rendering ${pct}% (${done}/${total}) ${label.padEnd(28)}`);
      }
    },
  });

  process.stdout.write('\r\x1b[K');
  console.log(
    `exported ${fileCount} files to ${outDir} in ${((Date.now() - start) / 1000).toFixed(1)}s`,
  );
}

main().catch((e) => {
  console.error('\nexport failed:', e);
  process.exit(1);
});
