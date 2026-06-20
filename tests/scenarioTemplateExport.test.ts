import { describe, it, expect } from 'vitest';
import { exportAll, type ExportSink, type Rasterizer } from '../src/core/exporter';
import { serializeScenarioTemplateLibrary } from '../src/core/scenarioTemplate';
import { ROLE_TEMPLATES, THE_OFFICE_ROMANCE } from '../src/data/roleTemplates';
import { defaultProject } from '../src/data/defaults';
import { CURRENT_SCHEMA_VERSION } from '../src/core/types';
import type { ProjectState } from '../src/core/types';

/** Run exportAll with a stub rasterizer, capturing only the JSON (string) files. */
async function exportJsonFiles(
  project: ProjectState,
  scenarioTemplates?: typeof ROLE_TEMPLATES,
): Promise<Map<string, string>> {
  const files = new Map<string, string>();
  const sink: ExportSink = { file: (path, data) => { if (typeof data === 'string') files.set(path, data); } };
  const rasterizer: Rasterizer = { rasterizeSheet: async () => new Uint8Array() };
  await exportAll(project, { sink, rasterizer, scenarioTemplates });
  return files;
}

describe('F4.1 — scenario-template library serialization (S4.1.1)', () => {
  it('wraps the library under one versioned meta block', () => {
    const out = serializeScenarioTemplateLibrary(ROLE_TEMPLATES) as any;
    expect(out.meta.artifact).toBe('scenario-template-library');
    expect(out.meta.generator).toBe('sprite-character-creator');
    expect(out.meta.schema).toBe('scenario_model.md');
    expect(out.meta.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(out.templates.map((t: any) => t.templateId)).toEqual(ROLE_TEMPLATES.map((t) => t.templateId));
  });

  it('deep-clones each template (mutating the artifact never touches the source)', () => {
    const out = serializeScenarioTemplateLibrary(ROLE_TEMPLATES) as any;
    out.templates[0].title = 'mutated';
    expect(THE_OFFICE_ROMANCE.title).toBe('The Office Romance');
  });
});

describe('F4.1 — scenario-template.json in the export bundle (S4.1.1)', () => {
  it('emits scenario-template.json at the bundle root when a library is supplied', async () => {
    const files = await exportJsonFiles(defaultProject(), ROLE_TEMPLATES);
    expect(files.has('scenario-template.json')).toBe(true);
    const artifact = JSON.parse(files.get('scenario-template.json')!);
    expect(artifact).toEqual(serializeScenarioTemplateLibrary(ROLE_TEMPLATES));
    expect(artifact.templates).toHaveLength(ROLE_TEMPLATES.length);
  });

  it('omits scenario-template.json when no library is supplied (sprite-only export unaffected)', async () => {
    const files = await exportJsonFiles(defaultProject());
    expect(files.has('scenario-template.json')).toBe(false);
    // the rest of the bundle is unchanged.
    expect(files.has('project.json')).toBe(true);
    expect(files.has('departments.json')).toBe(true);
  });

  it('is versioned with the package schema (parity with the project schema version)', async () => {
    const files = await exportJsonFiles(defaultProject(), ROLE_TEMPLATES);
    const artifact = JSON.parse(files.get('scenario-template.json')!);
    expect(artifact.meta.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
  });
});
