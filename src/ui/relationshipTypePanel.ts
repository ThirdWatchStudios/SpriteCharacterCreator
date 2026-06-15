/**
 * The reusable relationship-type catalog editor (Cast → Bonds). Relationship
 * types are project-level, structured bond definitions a relationship edge
 * references by id (relationship.relationshipType). Each carries −2..+2 reaction
 * nudges the sim applies toward the target, plus an optional third-party
 * (jealousy/protectiveness) coupling. Renaming a type repoints every edge that
 * references it so links never break. See CONTRACT.md §3.7.
 */
import { store } from '../state';
import { button, clear, el, labeled, select, slider } from './dom';
import { listItem, textArea, textField } from './controls';
import {
  REACTION_CATEGORIES,
  RELATIONSHIP_TYPE_CATEGORIES,
  type RelationshipTypeCategory,
  type RelationshipTypeDefinition,
} from '../core/profile';

const BIAS_OPTIONS = [
  { value: '-2', label: '−− strong down' },
  { value: '-1', label: '− down' },
  { value: '0', label: '· none' },
  { value: '1', label: '+ up' },
  { value: '2', label: '++ strong up' },
];

const reactionLabel = (r: string): string => r.charAt(0).toUpperCase() + r.slice(1);

function catalog(): RelationshipTypeDefinition[] {
  return store.state.relationshipTypes;
}

function selected(): RelationshipTypeDefinition | undefined {
  return catalog().find((t) => t.id === store.ui.selectedRelationshipTypeId) ?? catalog()[0];
}

/** Which edges (source → target) carry a given type, for the usage panel. */
function usageOf(id: string): string[] {
  const who: string[] = [];
  for (const p of store.state.profiles ?? []) {
    for (const r of p.relationships) {
      if (r.relationshipType === id) who.push(`${p.identity.displayName || p.agentId} → ${r.targetAgentId}`);
    }
  }
  return who;
}

/** Rename a type and repoint every edge that references it. */
function renameType(t: RelationshipTypeDefinition, raw: string): void {
  const next = raw.trim();
  if (!next || next === t.id) return;
  store.mutate((s) => {
    if (s.relationshipTypes.some((x) => x !== t && x.id === next)) return; // id taken
    const old = t.id;
    t.id = next;
    for (const p of s.profiles ?? []) {
      for (const r of p.relationships) if (r.relationshipType === old) r.relationshipType = next;
    }
    store.ui.selectedRelationshipTypeId = next;
  }, 'structure');
}

/** A reaction-bias dropdown row that writes into the given bias map. */
function biasRow(map: Partial<Record<string, number>>, r: string): HTMLElement {
  const cur = map[r] ?? 0;
  return labeled(
    reactionLabel(r),
    select(BIAS_OPTIONS, String(cur), (v) =>
      store.mutate(() => {
        const n = Number(v);
        if (n === 0) delete map[r];
        else map[r] = n;
      }, 'data'),
    ),
  );
}

export function renderRelationshipTypeList(container: HTMLElement): void {
  clear(container);
  const current = selected();
  const list = el('div', { className: 'entity-list' });
  for (const t of catalog()) {
    list.append(
      listItem({
        selected: t.id === current?.id,
        name: `${t.label || t.id}${t.thirdParty ? ' ♦' : ''}`,
        onClick: () => store.mutateUi((ui) => (ui.selectedRelationshipTypeId = t.id)),
      }),
    );
  }
  container.append(
    list,
    el(
      'div',
      { className: 'list-actions' },
      button(
        '+ New type',
        () => {
          const def: RelationshipTypeDefinition = {
            id: `bond-${Math.random().toString(36).slice(2, 8)}`,
            label: 'New bond',
            description: '',
            category: 'social',
            biasesReactions: {},
          };
          store.mutate((s) => {
            s.relationshipTypes.push(def);
            store.ui.selectedRelationshipTypeId = def.id;
          }, 'structure');
        },
        'primary',
      ),
    ),
  );
}

export function renderRelationshipTypeControls(container: HTMLElement): void {
  clear(container);
  const t = selected();
  if (!t) {
    container.append(el('p', { className: 'hint' }, 'No relationship types in the catalog. Create one to start.'));
    return;
  }

  container.append(
    labeled(
      'Id',
      el('input', {
        type: 'text',
        value: t.id,
        onChange: (e: Event) => renameType(t, (e.target as HTMLInputElement).value),
      }),
    ),
    textField('Label', t.label, (v) => store.mutate(() => (t.label = v), 'data')),
    labeled(
      'Category',
      select(RELATIONSHIP_TYPE_CATEGORIES.map((c) => ({ value: c, label: c })), t.category, (v) =>
        store.mutate(() => (t.category = v as RelationshipTypeCategory), 'data'),
      ),
    ),
    textArea('Description', t.description, (v) => store.mutate(() => (t.description = v), 'data')),
    labeled(
      'Secret by default',
      el('input', {
        type: 'checkbox',
        checked: t.secretByDefault ?? false,
        onChange: (e: Event) =>
          store.mutate(() => (t.secretByDefault = (e.target as HTMLInputElement).checked ? true : undefined), 'data'),
      }),
    ),
    el('h4', {}, 'Reaction bias toward the target'),
  );

  for (const r of REACTION_CATEGORIES) container.append(biasRow(t.biasesReactions, r));

  // --- third-party (jealousy / protectiveness) coupling ---
  container.append(el('h4', {}, 'Third-party coupling (jealousy)'));
  if (!t.thirdParty) {
    container.append(
      el('p', { className: 'hint' }, 'When the target engages someone else, the holder reacts. Off for this bond.'),
      button('Enable third-party coupling', () =>
        store.mutate(() => (t.thirdParty = { sensitivity: 50, biasesReactions: {}, intensifiesTowardDisliked: true }), 'structure'),
      ),
    );
  } else {
    const tp = t.thirdParty;
    container.append(
      labeled('Sensitivity', slider(tp.sensitivity, 0, 100, 1, (v) => store.mutate(() => (tp.sensitivity = v), 'data'))),
      labeled(
        'Intensifies toward disliked third parties',
        el('input', {
          type: 'checkbox',
          checked: tp.intensifiesTowardDisliked,
          onChange: (e: Event) => store.mutate(() => (tp.intensifiesTowardDisliked = (e.target as HTMLInputElement).checked), 'data'),
        }),
      ),
      el('p', { className: 'hint' }, 'Reaction the holder is biased toward in that moment:'),
    );
    for (const r of REACTION_CATEGORIES) container.append(biasRow(tp.biasesReactions, r));
    container.append(
      button('Remove third-party coupling', () => store.mutate(() => (t.thirdParty = undefined), 'structure'), 'danger'),
    );
  }

  container.append(
    el('h4', {}, ''),
    el(
      'div',
      { className: 'btn-row' },
      button(
        'Delete type',
        () => {
          const used = usageOf(t.id);
          const msg = used.length
            ? `"${t.label || t.id}" is on ${used.length} edge(s): ${used.join(', ')}. Delete anyway?`
            : `Delete "${t.label || t.id}"?`;
          if (!confirm(msg)) return;
          store.mutate((s) => {
            s.relationshipTypes = s.relationshipTypes.filter((x) => x.id !== t.id);
            store.ui.selectedRelationshipTypeId = s.relationshipTypes[0]?.id ?? '';
          }, 'structure');
        },
        'danger',
      ),
    ),
  );
}

export function renderRelationshipTypePreview(container: HTMLElement): void {
  clear(container);
  const t = selected();
  if (!t) {
    container.append(el('p', { className: 'hint' }, 'No relationship types in the catalog.'));
    return;
  }
  const biases = Object.entries(t.biasesReactions).filter(([, v]) => v);
  const used = usageOf(t.id);
  const tpBiases = t.thirdParty ? Object.entries(t.thirdParty.biasesReactions).filter(([, v]) => v) : [];
  container.append(
    el(
      'div',
      { className: 'persona-summary' },
      el('div', {}, el('strong', {}, t.label || t.id), ` · ${t.category}${t.secretByDefault ? ' · secret' : ''}`),
      t.description ? el('div', {}, t.description) : null,
      el('div', { className: 'dry-key' }, 'reactions toward target'),
      el(
        'div',
        { className: 'tag-chips' },
        ...(biases.length
          ? biases.map(([r, v]) => el('span', { className: 'tag-chip' }, `${reactionLabel(r)} ${v > 0 ? '+' : ''}${v}`))
          : [el('span', { className: 'hint' }, 'No reaction bias')]),
      ),
      el('div', { className: 'dry-key' }, 'third-party (jealousy)'),
      t.thirdParty
        ? el(
            'div',
            { className: 'tag-chips' },
            el('span', { className: 'tag-chip' }, `sensitivity ${t.thirdParty.sensitivity}`),
            ...(t.thirdParty.intensifiesTowardDisliked ? [el('span', { className: 'tag-chip' }, 'worse toward rivals')] : []),
            ...tpBiases.map(([r, v]) => el('span', { className: 'tag-chip' }, `${reactionLabel(r)} ${v > 0 ? '+' : ''}${v}`)),
          )
        : el('span', { className: 'hint' }, 'none'),
    ),
    el('h3', {}, 'Used by'),
    el('p', { className: 'hint' }, used.length ? used.join(', ') : '—'),
  );
}
