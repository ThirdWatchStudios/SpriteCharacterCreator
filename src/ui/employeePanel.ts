import { composeCharacter } from '../core/compositor';
import {
  type EmployeeDefinition,
  appearanceSignature,
  employeeRecipe,
  generateEmployee,
  generatePopulation,
  generationProfiles,
  randomSeed,
} from '../core/employee';
import { downloadBlob, downloadJson, employeePackageZip } from '../core/exporter';
import { createDefaultProfile } from '../core/profile';
import { store } from '../state';
import { button, clear, el, labeled, select } from './dom';
import { exportScaleSelect } from './controls';

/** Crop a composed-character SVG to the head+upper-torso region for portraits. */
function portraitSvg(svg: string): string {
  return svg.replace('viewBox="0 0 128 128"', 'viewBox="24 14 80 80"');
}

function currentEmployee(): EmployeeDefinition {
  if (!store.ui.employee) {
    const seed = store.ui.employeeSeed || randomSeed();
    store.ui.employeeSeed = seed;
    store.ui.employee = generateEmployee(seed, store.ui.employeeProfile, store.state.style);
  }
  return store.ui.employee;
}

function regenerate(seed: string): void {
  store.mutateUi((ui) => {
    ui.employeeSeed = seed;
    ui.employee = generateEmployee(seed, ui.employeeProfile, store.state.style);
  });
}

/** A character id not already taken in the project (suffixes on collision). */
function uniqueCharacterId(base: string): string {
  const taken = new Set(store.state.characters.map((c) => c.id));
  if (!taken.has(base)) return base;
  let i = 2;
  while (taken.has(`${base}-${i}`)) i++;
  return `${base}-${i}`;
}

/** A standalone CharacterRecipe (deep-cloned, unique id) from a generated employee. */
function recipeFromEmployee(emp: EmployeeDefinition) {
  const recipe = structuredClone(employeeRecipe(emp));
  recipe.id = uniqueCharacterId(recipe.id);
  return recipe;
}

/** Promote a generated employee into the project's cast (optionally with a starter persona). */
function addEmployeeToCast(emp: EmployeeDefinition, withPersona: boolean): void {
  store.mutate((s) => {
    const recipe = recipeFromEmployee(emp);
    s.characters.push(recipe);
    if (withPersona) (s.profiles ??= []).push(createDefaultProfile(recipe));
    store.ui.selectedCharacterId = recipe.id;
  }, 'structure');
}

/** Promote a whole generated population into the cast. */
function addPopulationToCast(emps: EmployeeDefinition[]): void {
  store.mutate((s) => {
    let lastId = store.ui.selectedCharacterId;
    for (const emp of emps) {
      const recipe = recipeFromEmployee(emp);
      s.characters.push(recipe);
      lastId = recipe.id;
    }
    store.ui.selectedCharacterId = lastId;
  }, 'structure');
}

function renderEmployeeSvg(emp: EmployeeDefinition, size: number): string {
  const svg = composeCharacter(employeeRecipe(emp), store.state.style, 'south', size, 'normal', { badge: false });
  return store.ui.employeeRenderMode === 'portrait' ? portraitSvg(svg) : svg;
}

export function renderEmployeeList(container: HTMLElement): void {
  clear(container);
  const pop = store.ui.population;
  if (!pop || pop.employees.length === 0) {
    container.append(el('p', { className: 'hint' }, 'Generate a population to see the roster here.'));
    return;
  }
  const list = el('div', { className: 'entity-list' });
  list.append(el('div', { className: 'list-heading' }, `Roster — ${pop.employees.length}`));
  for (const emp of pop.employees) {
    const thumb = el('span', { className: 'thumb checker' });
    thumb.innerHTML = composeCharacter(employeeRecipe(emp), store.state.style, 'south', 40, 'normal', { badge: false });
    list.append(
      el(
        'button',
        {
          className: `entity-item ${store.ui.employee && appearanceSignature(store.ui.employee) === appearanceSignature(emp) ? 'selected' : ''}`,
          onClick: () => store.mutateUi((ui) => { ui.employee = emp; ui.employeeSeed = emp.visualSeed; ui.employeeProfile = emp.profile; }),
        },
        thumb,
        el('span', { className: 'entity-name' }, `${emp.name} · ${emp.visualSeed}`),
      ),
    );
  }
  container.append(list);
}

export function renderEmployeePreview(container: HTMLElement): void {
  clear(container);
  const emp = currentEmployee();
  const hero = el('div', { className: 'preview-hero checker' });
  hero.innerHTML = renderEmployeeSvg(emp, 224);
  container.append(
    hero,
    el('p', { className: 'preview-caption' }, `${emp.name}  ·  seed ${emp.visualSeed}  ·  ${emp.metadata.department}`),
  );
}

export function renderEmployeeControls(container: HTMLElement): void {
  clear(container);
  const emp = currentEmployee();

  // hidden importer
  const importInput = el('input', {
    type: 'file',
    accept: 'application/json',
    className: 'hidden-input',
    onChange: async (e: Event) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const parsed = JSON.parse(await file.text()) as EmployeeDefinition;
        if (!parsed.visualSeed || !parsed.recipe) throw new Error('not an employee');
        store.mutateUi((ui) => { ui.employee = parsed; ui.employeeSeed = parsed.visualSeed; ui.employeeProfile = parsed.profile ?? 'random'; });
      } catch {
        alert('Could not import: not a valid employee JSON.');
      }
      (e.target as HTMLInputElement).value = '';
    },
  });

  // Generation profile
  container.append(
    labeled(
      'Generation profile',
      select(
        generationProfiles().map((p) => ({ value: p.id, label: p.label })),
        store.ui.employeeProfile,
        (value) => store.mutateUi((ui) => { ui.employeeProfile = value; ui.employee = generateEmployee(ui.employeeSeed || randomSeed(), value, store.state.style); ui.employeeSeed = ui.employee.visualSeed; }),
      ),
    ),
  );

  // Visual DNA / seed
  const seedInput = el('input', {
    type: 'text',
    value: store.ui.employeeSeed,
    placeholder: 'A9F7C2',
    onInput: (e: Event) => { store.ui.employeeSeed = (e.target as HTMLInputElement).value.trim().toUpperCase(); },
  });
  container.append(
    el('h3', {}, 'Visual DNA'),
    labeled('Seed', seedInput),
    el(
      'div',
      { className: 'btn-row' },
      button('Generate from seed', () => regenerate(store.ui.employeeSeed || randomSeed()), 'primary'),
      button('Randomize seed', () => regenerate(randomSeed())),
      button('Copy seed', () => navigator.clipboard?.writeText(store.ui.employeeSeed)),
    ),
  );

  // Render mode
  container.append(
    labeled(
      'Preview',
      el(
        'div',
        { className: 'mood-bar' },
        ...(['full', 'portrait'] as const).map((mode) =>
          el(
            'button',
            {
              className: `mood-chip ${store.ui.employeeRenderMode === mode ? 'active' : ''}`,
              onClick: () => store.mutateUi((ui) => (ui.employeeRenderMode = mode)),
            },
            mode === 'full' ? 'Full body' : 'Portrait',
          ),
        ),
      ),
    ),
  );

  // Per-employee export
  container.append(
    el('h3', {}, 'Employee'),
    el(
      'div',
      { className: 'btn-row' },
      button('Add to cast', () => addEmployeeToCast(emp, false), 'primary'),
      button('Add to cast + persona', () => addEmployeeToCast(emp, true)),
    ),
    labeled('Export scale', exportScaleSelect()),
    el(
      'div',
      { className: 'btn-row' },
      button('Export character JSON', () => downloadJson(`employee-${emp.visualSeed}.json`, emp)),
      button('Import character JSON', () => importInput.click()),
      importInput,
    ),
    el(
      'div',
      { className: 'btn-row' },
      button('Unity package (1)', async () => {
        const blob = await employeePackageZip([emp], store.state.style, store.ui.exportScale);
        downloadBlob(`employee-${emp.visualSeed}.zip`, blob);
      }, 'primary'),
    ),
  );

  // Population
  const countInput = el('input', {
    type: 'number',
    min: 1,
    max: 200,
    value: store.ui.populationCount,
    onInput: (e: Event) => {
      const v = Number((e.target as HTMLInputElement).value);
      store.ui.populationCount = Number.isFinite(v) ? Math.max(1, Math.min(200, Math.floor(v))) : 1;
    },
  });
  container.append(
    el('h3', {}, 'Population'),
    labeled('Employee count', countInput),
    el(
      'div',
      { className: 'btn-row' },
      button('Generate population', () =>
        store.mutateUi((ui) => { ui.population = generatePopulation(ui.populationCount, ui.employeeProfile, store.state.style); }),
      'primary'),
    ),
  );

  const pop = store.ui.population;
  if (pop) {
    container.append(
      el('p', { className: 'preview-caption' },
        `Unique employees: ${pop.unique} / ${pop.employees.length}   ·   Near duplicates: ${pop.nearDuplicates}${pop.exhausted ? '   ·   ⚠ pool exhausted' : ''}`),
      el(
        'div',
        { className: 'btn-row' },
        button(`Add all ${pop.employees.length} to cast`, () => {
          if (!confirm(`Add all ${pop.employees.length} generated employees to the project cast?`)) return;
          addPopulationToCast(pop.employees);
        }, 'primary'),
      ),
      el(
        'div',
        { className: 'btn-row' },
        button('Export population JSON', () => downloadJson(`population-${pop.baseSeed}.json`, pop.employees)),
        button('Export Unity package', async () => {
          const blob = await employeePackageZip(pop.employees, store.state.style, store.ui.exportScale);
          downloadBlob(`population-${pop.baseSeed}.zip`, blob);
        }, 'primary'),
      ),
    );
  }
}
