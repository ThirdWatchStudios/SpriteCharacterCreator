/**
 * The department catalog editor (Company → Departments). Departments are the
 * project-level org units the office-scale work references by stable id — the
 * single department/org model (Epic 2 F2.1). Same catalog-editor shape as the
 * Drives/Traits/Bonds tabs: a list + a New action, id/label/category controls,
 * and a usage/coherence preview.
 *
 * Personas still hold a free-text `identity.department` (the id-reference rewrite
 * is Epic 3 / F3.1), so "members" here are resolved by mapping that free text onto
 * a catalog id; departments whose free-text values don't resolve are surfaced for
 * cleanup (S2.1.2).
 */
import { store } from '../state';
import { button, clear, el, labeled, select } from './dom';
import { listItem, textField } from './controls';
import {
  DEPARTMENT_CAPABILITIES,
  DEPARTMENT_CATEGORIES,
  defaultCapabilitiesForCategory,
  mapDepartmentNameToId,
  reportUnmappedDepartments,
  slugifyDepartment,
  type DepartmentDefinition,
} from '../core/department';
import { buildOrgStructure, validateOrgStructure } from '../core/orgStructure';

function catalog(): DepartmentDefinition[] {
  return store.state.departments;
}

function selectedDepartment(): DepartmentDefinition | undefined {
  return catalog().find((d) => d.id === store.ui.selectedDepartmentId) ?? catalog()[0];
}

/** Every free-text department value across the cast (personas), for mapping. */
function personaDepartmentNames(): string[] {
  return (store.state.profiles ?? []).map((p) => p.identity.department).filter((n): n is string => !!n);
}

/** Persona display names whose free-text department resolves to this catalog id. */
function membersOf(id: string): string[] {
  const who: string[] = [];
  for (const p of store.state.profiles ?? []) {
    if (p.identity.department && mapDepartmentNameToId(p.identity.department, catalog()) === id) {
      who.push(p.identity.displayName || p.agentId);
    }
  }
  return who;
}

/** A catalog id not already taken (slug of `base`, suffixed on collision). */
function uniqueDepartmentId(base: string): string {
  const taken = new Set(catalog().map((d) => d.id));
  const slug = slugifyDepartment(base) || 'department';
  if (!taken.has(slug)) return slug;
  let i = 2;
  while (taken.has(`${slug}-${i}`)) i++;
  return `${slug}-${i}`;
}

/** Rename a department id, guarding against collisions. */
function renameDepartment(d: DepartmentDefinition, raw: string): void {
  const next = raw.trim();
  if (!next || next === d.id) return;
  store.mutate((s) => {
    if (s.departments.some((x) => x !== d && x.id === next)) return; // id taken — ignore
    d.id = next;
    store.ui.selectedDepartmentId = next;
  }, 'structure');
}

export function renderDepartmentList(container: HTMLElement): void {
  clear(container);
  const current = selectedDepartment();
  const list = el('div', { className: 'entity-list' });
  for (const d of catalog()) {
    list.append(
      listItem({
        selected: d.id === current?.id,
        name: d.label || d.id,
        onClick: () => store.mutateUi((ui) => (ui.selectedDepartmentId = d.id)),
      }),
    );
  }
  container.append(
    list,
    el(
      'div',
      { className: 'list-actions' },
      button(
        '+ New department',
        () => {
          const id = uniqueDepartmentId('new department');
          const def: DepartmentDefinition = { id, label: 'New department', category: 'operations' };
          store.mutate((s) => {
            s.departments.push(def);
            store.ui.selectedDepartmentId = def.id;
          }, 'structure');
        },
        'primary',
      ),
    ),
  );
}

export function renderDepartmentControls(container: HTMLElement): void {
  clear(container);
  const d = selectedDepartment();
  if (!d) {
    container.append(el('p', { className: 'hint' }, 'No departments in the catalog. Create one to start.'));
    return;
  }

  container.append(
    labeled(
      'Id',
      el('input', {
        type: 'text',
        value: d.id,
        onChange: (e: Event) => renameDepartment(d, (e.target as HTMLInputElement).value),
      }),
    ),
    textField('Label', d.label, (v) => store.mutate(() => (d.label = v), 'data')),
    labeled(
      'Category',
      select(DEPARTMENT_CATEGORIES.map((c) => ({ value: c, label: c })), d.category, (v) =>
        store.mutate(() => (d.category = v), 'data'),
      ),
    ),
    textField('Capabilities (medium)', (d.capabilities ?? []).join(', '), (v) =>
      store.mutate(() => {
        const tags = v.split(',').map((t) => t.trim()).filter(Boolean);
        d.capabilities = tags;
      }, 'data'),
    ),
    el(
      'div',
      { className: 'btn-row' },
      button('Use category default', () =>
        store.mutate(() => (d.capabilities = defaultCapabilitiesForCategory(d.category)), 'data'),
      ),
    ),
    el('p', { className: 'hint' }, `Surveillance medium(s) reaching this department grants the player (F2.4). Comma-separated; suggested: ${DEPARTMENT_CAPABILITIES.join(', ')}. The sim owns what each medium unlocks.`),
    el('p', { className: 'hint' }, 'Ids are stable references — the cascade fills this catalog and layout groups by it. Renaming an id won’t rewrite persona department fields yet (that’s the F3.1 migration).'),
    el(
      'div',
      { className: 'btn-row' },
      button(
        'Delete department',
        () => {
          const used = membersOf(d.id);
          const msg = used.length
            ? `"${d.label || d.id}" has ${used.length} member(s): ${used.join(', ')}. Delete anyway?`
            : `Delete "${d.label || d.id}"?`;
          if (!confirm(msg)) return;
          store.mutate((s) => {
            s.departments = s.departments.filter((x) => x.id !== d.id);
            store.ui.selectedDepartmentId = s.departments[0]?.id ?? '';
          }, 'structure');
        },
        'danger',
      ),
    ),
  );
}

export function renderDepartmentPreview(container: HTMLElement): void {
  clear(container);
  const d = selectedDepartment();
  if (!d) {
    container.append(el('p', { className: 'hint' }, 'No departments in the catalog.'));
    return;
  }
  const members = membersOf(d.id);
  const unmapped = reportUnmappedDepartments(personaDepartmentNames(), catalog());

  // Derived org structure — the head of this department.
  const org = buildOrgStructure(store.state);
  const profiles = store.state.profiles ?? [];
  const nameOf = (agentId: string): string =>
    profiles.find((p) => p.agentId === agentId)?.identity.displayName || agentId;
  const headId = org.contents.heads[d.id];

  // Org-wide validation (F2.5) — errors block export.
  const { errors, warnings } = validateOrgStructure(store.state);

  container.append(
    el(
      'div',
      { className: 'persona-summary' },
      el('div', {}, el('strong', {}, d.label || d.id), ` · ${d.category}`),
      el('div', { className: 'hint' }, `id: ${d.id}`),
      el('div', { className: 'hint' }, `grants: ${(d.capabilities ?? []).join(', ') || '(nothing)'}`),
    ),
    el('h3', {}, 'Head'),
    el('p', { className: 'hint' }, headId ? nameOf(headId) : '—'),
    el('h3', {}, 'Members'),
    el('p', { className: 'hint' }, members.length ? members.join(', ') : '—'),
  );

  container.append(
    el(
      'div',
      {},
      el('h3', {}, `Org structure · ${catalog().length} departments`),
      errors.length
        ? el('div', {}, ...errors.map((e) => el('p', { className: 'hint warn' }, `⚠ ${e}`)))
        : el('p', { className: 'hint' }, '✓ org structure valid (export-ready)'),
      warnings.length ? el('p', { className: 'hint' }, `${warnings.length} empty department(s).`) : null,
      unmapped.length
        ? el('p', { className: 'hint warn' }, `Unmapped persona departments (add a catalog entry to map them): ${unmapped.join(', ')}`)
        : null,
    ),
  );
}
