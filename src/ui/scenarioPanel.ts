/**
 * Scenario tab — authors a full Water Cooler run (cast + office binding + truth /
 * information + experiment variants + objective) and exports scenario.json. The
 * sim loads it (see game-design-docs .../design/scenario_model.md). Scenarios are
 * project-level, so the sidebar lists them and the controls edit the selected one.
 */
import type { ChangeKind } from '../state';
import { store } from '../state';
import { downloadJson } from '../core/exporter';
import { computeOfficeAnchors } from '../core/layout';
import { STANCES } from '../core/profile';
import {
  ACCESS_STATES,
  OBJECTIVE_CATEGORIES,
  ORIGIN_TYPES,
  OVERRIDE_AXES,
  TRUTH_ALIGNMENTS,
  castMemberFor,
  createDefaultScenario,
  serializeScenario,
  validateScenario,
  type InformationItem,
  type RelationshipOverride,
  type Scenario,
  type ScenarioCastMember,
  type ScenarioLocation,
  type TruthFact,
} from '../core/scenario';
import { button, clear, el, labeled, select, slider } from './dom';

const uid = (prefix: string): string => `${prefix}-${Math.random().toString(36).slice(2, 6)}`;

function edit(fn: () => void, kind: ChangeKind = 'data'): void {
  store.mutate(fn, kind);
}

// --- option helpers ---------------------------------------------------------

function agentOptions(): Array<{ value: string; label: string }> {
  return store.state.characters.map((c) => ({ value: c.id, label: `${c.name} (${c.id})` }));
}

/** Anchor ids from the current office layout, optionally filtered to rooms. */
function anchorIds(roomsOnly = false): string[] {
  const scene = store.state.scene;
  if (!scene) return [];
  return computeOfficeAnchors(scene, store.state)
    .filter((a) => (roomsOnly ? a.kind === 'room' : true))
    .map((a) => a.anchorId);
}

/**
 * Validation context. Anchor resolution only runs when the current scene
 * actually exposes office anchors — a starter/hand scene has none, so we skip the
 * binding check there rather than flagging bindings that can't yet resolve. Once
 * an office is generated (Scene tab), bindings are checked against its anchors.
 */
function validationCtx(): { agentIds: string[]; anchorIds?: string[] } {
  const ids = anchorIds();
  return { agentIds: store.state.characters.map((c) => c.id), anchorIds: ids.length ? ids : undefined };
}

/** Options including the current value even when it is absent from the source. */
function withCurrent(values: string[], current: string): Array<{ value: string; label: string }> {
  const set = [...new Set([current, ...values].filter((v) => v !== ''))];
  return set.map((v) => ({ value: v, label: v }));
}

// --- shared bits ------------------------------------------------------------

function section(title: string, ...children: Array<Node | null | undefined>): HTMLElement {
  return el('section', { className: 'persona-section' }, el('h3', {}, title), ...(children.filter(Boolean) as Node[]));
}

function textField(label: string, value: string, onInput: (v: string) => void): HTMLElement {
  return labeled(
    label,
    el('input', { type: 'text', value, onInput: (e: Event) => onInput((e.target as HTMLInputElement).value) }),
  );
}

function textArea(label: string, value: string, onInput: (v: string) => void): HTMLElement {
  return labeled(
    label,
    el('textarea', { rows: 2, value, onInput: (e: Event) => onInput((e.target as HTMLTextAreaElement).value) }),
  );
}

function num(label: string, value: number, onInput: (v: number) => void, min = 0, max = 100): HTMLElement {
  return labeled(label, slider(value, min, max, 1, onInput));
}

/** Optional integer field — empty clears it (for partial relationship overrides). */
function optNum(label: string, value: number | undefined, set: (v: number | undefined) => void): HTMLElement {
  return labeled(
    label,
    el('input', {
      type: 'number',
      value: value === undefined ? '' : String(value),
      onInput: (e: Event) => {
        const raw = (e.target as HTMLInputElement).value;
        set(raw === '' ? undefined : Number(raw));
      },
    }),
  );
}

function tagEditor(tags: string[], onChange: (next: string[]) => void, suggestions: string[]): HTMLElement {
  const wrap = el('div', { className: 'tag-editor' });
  const chips = el('div', { className: 'tag-chips' });
  for (const tag of tags) {
    chips.append(
      el('span', { className: 'tag-chip' }, tag, button('×', () => onChange(tags.filter((t) => t !== tag)), 'tag-remove')),
    );
  }
  const listId = uid('dl');
  const input = el('input', {
    type: 'text',
    placeholder: '+ add…',
    list: listId,
    onKeydown: (e: Event) => {
      if ((e as KeyboardEvent).key !== 'Enter') return;
      const v = (e.target as HTMLInputElement).value.trim();
      if (v && !tags.includes(v)) onChange([...tags, v]);
    },
  });
  wrap.append(chips, el('div', { className: 'tag-add' }, input, el('datalist', { id: listId }, ...suggestions.map((s) => el('option', { value: s })))));
  return wrap;
}

// --- sections ---------------------------------------------------------------

function metaSection(s: Scenario): HTMLElement {
  return section(
    'Scenario',
    textField('Scenario id', s.scenarioId, (v) => edit(() => (s.scenarioId = v), 'structure')),
    textField('Title', s.title, (v) => edit(() => (s.title = v))),
    textArea('Summary', s.summary, (v) => edit(() => (s.summary = v))),
  );
}

function relationshipOverrideRow(member: ScenarioCastMember, r: RelationshipOverride): HTMLElement {
  const axisInputs = OVERRIDE_AXES.map((a) =>
    optNum(a, r[a], (v) => edit(() => (v === undefined ? delete r[a] : (r[a] = v)))),
  );
  return el(
    'div',
    { className: 'row-card' },
    labeled('Toward', select(withCurrent(store.state.characters.map((c) => c.id), r.targetAgentId), r.targetAgentId, (v) => edit(() => (r.targetAgentId = v), 'structure'))),
    optNum('affinity', r.affinity, (v) => edit(() => (v === undefined ? delete r.affinity : (r.affinity = v)))),
    ...axisInputs,
    button('Remove override', () => edit(() => (member.relationshipOverrides = member.relationshipOverrides.filter((x) => x !== r)), 'structure'), 'danger'),
  );
}

function castMemberCard(s: Scenario, member: ScenarioCastMember): HTMLElement {
  const locationOpts = s.locations.map((l) => ({ value: l.locationId, label: l.locationId }));
  const infoIds = s.informationItems.map((i) => i.informationId);
  return el(
    'div',
    { className: 'row-card' },
    labeled('Agent', select(agentOptions(), member.agentId, (v) => edit(() => (member.agentId = v), 'structure'))),
    labeled('Spawn location', select(withCurrent(s.locations.map((l) => l.locationId), member.spawnLocationId), member.spawnLocationId, (v) => edit(() => (member.spawnLocationId = v), 'structure'))),
    locationOpts.length === 0 ? el('p', { className: 'hint' }, 'Add locations below to set a spawn.') : null,
    textField('Prototype role', member.prototypeRole, (v) => edit(() => (member.prototypeRole = v))),

    el('h4', {}, 'Belief seeds'),
    ...member.beliefSeeds.map((b) =>
      el(
        'div',
        { className: 'row-card' },
        textField('Topic', b.topic, (v) => edit(() => (b.topic = v))),
        textField('Claim', b.claim, (v) => edit(() => (b.claim = v))),
        labeled('Stance', select(STANCES.map((x) => ({ value: x, label: x })), b.stance, (v) => edit(() => (b.stance = v as typeof b.stance)))),
        num('Confidence', b.confidence, (v) => edit(() => (b.confidence = v))),
        button('Remove belief', () => edit(() => (member.beliefSeeds = member.beliefSeeds.filter((x) => x !== b)), 'structure'), 'danger'),
      ),
    ),
    button('+ Belief seed', () => edit(() => member.beliefSeeds.push({ topic: '', claim: '', stance: 'unknown', confidence: 0 }), 'structure')),

    el('h4', {}, 'Knowledge seeds (information ids)'),
    tagEditor(member.knowledgeSeeds, (next) => edit(() => (member.knowledgeSeeds = next), 'structure'), infoIds),

    el('h4', {}, 'Relationship overrides'),
    ...member.relationshipOverrides.map((r) => relationshipOverrideRow(member, r)),
    button('+ Relationship override', () => edit(() => member.relationshipOverrides.push({ targetAgentId: store.state.characters[0]?.id ?? '' }), 'structure')),

    button('Remove cast member', () => edit(() => (s.cast = s.cast.filter((x) => x !== member)), 'structure'), 'danger'),
  );
}

function castSection(s: Scenario): HTMLElement {
  const inCast = new Set(s.cast.map((c) => c.agentId));
  const available = store.state.characters.filter((c) => !inCast.has(c.id));
  return section(
    'Cast',
    ...s.cast.map((m) => castMemberCard(s, m)),
    available.length
      ? button('+ Cast member', () => edit(() => s.cast.push(castMemberFor(available[0], s.locations[0]?.locationId ?? '')), 'structure'))
      : el('p', { className: 'hint' }, 'All project characters are already in the cast.'),
  );
}

function locationCard(s: Scenario, l: ScenarioLocation): HTMLElement {
  return el(
    'div',
    { className: 'row-card' },
    textField('Location id', l.locationId, (v) => edit(() => (l.locationId = v), 'structure')),
    textField('Display name', l.displayName, (v) => edit(() => (l.displayName = v))),
    labeled('Access', select(ACCESS_STATES.map((a) => ({ value: a, label: a })), l.accessState, (v) => edit(() => (l.accessState = v as typeof l.accessState)))),
    labeled('Fallback', select([{ value: '', label: '(none)' }, ...withCurrent(s.locations.map((x) => x.locationId).filter((id) => id !== l.locationId), l.fallbackLocationId)], l.fallbackLocationId, (v) => edit(() => (l.fallbackLocationId = v), 'structure'))),
    labeled('Bind → room', select(withCurrent(anchorIds(true), l.bindTo.roomId), l.bindTo.roomId, (v) => edit(() => (l.bindTo.roomId = v), 'structure'))),
    labeled('Bind → anchor', select([{ value: '', label: '(room only)' }, ...withCurrent(anchorIds(false), l.bindTo.anchorId)], l.bindTo.anchorId, (v) => edit(() => (l.bindTo.anchorId = v), 'structure'))),
    labeled('Tags', tagEditor(l.tags, (next) => edit(() => (l.tags = next), 'structure'), ['work_area', 'management', 'break_area', 'transit'])),
    button('Remove location', () => edit(() => (s.locations = s.locations.filter((x) => x !== l)), 'structure'), 'danger'),
  );
}

function locationsSection(s: Scenario): HTMLElement {
  return section(
    'Locations',
    anchorIds().length === 0 ? el('p', { className: 'hint' }, 'No office anchors found — generate a Scene to bind locations to rooms/desks.') : null,
    ...s.locations.map((l) => locationCard(s, l)),
    button('+ Location', () =>
      edit(() => s.locations.push({ locationId: uid('loc'), displayName: '', tags: [], accessState: 'open', fallbackLocationId: '', bindTo: { anchorId: '', roomId: anchorIds(true)[0] ?? '' } }), 'structure'),
    ),
  );
}

function truthSection(s: Scenario): HTMLElement {
  const rows = s.truthFacts.map((t: TruthFact) =>
    el(
      'div',
      { className: 'row-card' },
      textField('Truth id', t.truthId, (v) => edit(() => (t.truthId = v), 'structure')),
      textField('Topic', t.topic, (v) => edit(() => (t.topic = v))),
      textField('Statement', t.statement, (v) => edit(() => (t.statement = v))),
      labeled('Source agent', select(withCurrent(store.state.characters.map((c) => c.id), t.sourceAgentId), t.sourceAgentId, (v) => edit(() => (t.sourceAgentId = v), 'structure'))),
      labeled('Subjects', tagEditor(t.subjectAgentIds, (next) => edit(() => (t.subjectAgentIds = next), 'structure'), store.state.characters.map((c) => c.id))),
      labeled('Objective value', el('input', { type: 'checkbox', ...(t.objectiveValue ? { checked: true } : {}), onChange: (e: Event) => edit(() => (t.objectiveValue = (e.target as HTMLInputElement).checked)) })),
      button('Remove truth', () => edit(() => (s.truthFacts = s.truthFacts.filter((x) => x !== t)), 'structure'), 'danger'),
    ),
  );
  return section(
    'Truth facts',
    ...rows,
    button('+ Truth fact', () => edit(() => s.truthFacts.push({ truthId: uid('truth'), topic: '', statement: '', subjectAgentIds: [], objectiveValue: true, sourceAgentId: store.state.characters[0]?.id ?? '' }), 'structure')),
  );
}

function informationSection(s: Scenario): HTMLElement {
  const truthOpts = [{ value: '', label: '(none)' }, ...s.truthFacts.map((t) => ({ value: t.truthId, label: t.truthId }))];
  const rows = s.informationItems.map((i: InformationItem) =>
    el(
      'div',
      { className: 'row-card' },
      textField('Information id', i.informationId, (v) => edit(() => (i.informationId = v), 'structure')),
      textField('Topic', i.topic, (v) => edit(() => (i.topic = v))),
      textField('Claim', i.claim, (v) => edit(() => (i.claim = v))),
      labeled('Origin', select(ORIGIN_TYPES.map((o) => ({ value: o, label: o })), i.originType, (v) => edit(() => (i.originType = v as typeof i.originType)))),
      labeled('Truth alignment', select(TRUTH_ALIGNMENTS.map((a) => ({ value: a, label: a })), i.truthAlignment, (v) => edit(() => (i.truthAlignment = v as typeof i.truthAlignment)))),
      labeled('Truth fact', select(withCurrent([...truthOpts.map((o) => o.value)], i.truthId), i.truthId, (v) => edit(() => (i.truthId = v), 'structure'))),
      labeled('Source agent', select(withCurrent(store.state.characters.map((c) => c.id), i.sourceAgentId), i.sourceAgentId, (v) => edit(() => (i.sourceAgentId = v), 'structure'))),
      labeled('Initial holders', tagEditor(i.initialHolderAgentIds, (next) => edit(() => (i.initialHolderAgentIds = next), 'structure'), store.state.characters.map((c) => c.id))),
      button('Remove information', () => edit(() => (s.informationItems = s.informationItems.filter((x) => x !== i)), 'structure'), 'danger'),
    ),
  );
  return section(
    'Information items',
    ...rows,
    button('+ Information item', () => edit(() => s.informationItems.push({ informationId: uid('info'), topic: '', claim: '', originType: 'rumor', truthId: '', truthAlignment: 'unknown', sourceAgentId: store.state.characters[0]?.id ?? '', initialHolderAgentIds: [] }), 'structure')),
  );
}

function experimentSection(s: Scenario): HTMLElement {
  const typeRows = s.interventionTypes.map((t) =>
    el(
      'div',
      { className: 'row-card' },
      textField('Type', t.type, (v) => edit(() => (t.type = v), 'structure')),
      labeled('Values', tagEditor(t.values, (next) => edit(() => (t.values = next), 'structure'), [])),
      button('Remove type', () => edit(() => (s.interventionTypes = s.interventionTypes.filter((x) => x !== t)), 'structure'), 'danger'),
    ),
  );
  const variantRows = s.variants.map((v) =>
    el(
      'div',
      { className: 'row-card' },
      textField('Variant id', v.variantId, (vv) => edit(() => (v.variantId = vv), 'structure')),
      ...s.interventionTypes.map((t) =>
        labeled(
          t.type,
          select([{ value: '', label: '(unset)' }, ...t.values.map((val) => ({ value: val, label: val }))], v.selections[t.type] ?? '', (val) =>
            edit(() => (val === '' ? delete v.selections[t.type] : (v.selections[t.type] = val)), 'structure'),
          ),
        ),
      ),
      button('Remove variant', () => edit(() => (s.variants = s.variants.filter((x) => x !== v)), 'structure'), 'danger'),
    ),
  );
  return section(
    'Experiment (intervention variants)',
    el('h4', {}, 'Intervention types'),
    ...typeRows,
    button('+ Intervention type', () => edit(() => s.interventionTypes.push({ type: uid('type'), values: [] }), 'structure')),
    el('h4', {}, 'Variants'),
    ...variantRows,
    button('+ Variant', () => edit(() => s.variants.push({ variantId: uid('variant'), selections: {} }), 'structure')),
    labeled('Default variant', select([{ value: '', label: '(none)' }, ...s.variants.map((v) => ({ value: v.variantId, label: v.variantId }))], s.defaultVariantId, (v) => edit(() => (s.defaultVariantId = v), 'structure'))),
  );
}

function objectiveSection(s: Scenario): HTMLElement {
  const o = s.objective;
  return section(
    'Objective',
    textField('Objective id', o.objectiveId, (v) => edit(() => (o.objectiveId = v))),
    textArea('Label', o.label, (v) => edit(() => (o.label = v))),
    labeled('Category', select(OBJECTIVE_CATEGORIES.map((c) => ({ value: c, label: c })), o.category, (v) => edit(() => (o.category = v as typeof o.category)))),
    textField('Desired pressure', o.desiredPressure, (v) => edit(() => (o.desiredPressure = v))),
    textField('Intended observable behavior', o.intendedObservableBehavior, (v) => edit(() => (o.intendedObservableBehavior = v))),
    textField('KPI', o.kpi, (v) => edit(() => (o.kpi = v))),
    labeled('Expected evidence', tagEditor(o.expectedEvidence, (next) => edit(() => (o.expectedEvidence = next), 'structure'), [])),
  );
}

// --- public render entrypoints ---------------------------------------------

export function renderScenarioList(container: HTMLElement): void {
  clear(container);
  const list = el('div', { className: 'entity-list' });
  for (const scenario of store.state.scenarios ?? []) {
    const selected = scenario.scenarioId === store.ui.selectedScenarioId;
    list.append(
      el(
        'button',
        { className: `entity-item ${selected ? 'selected' : ''}`, onClick: () => store.mutateUi((ui) => (ui.selectedScenarioId = scenario.scenarioId)) },
        el('span', { className: 'entity-name' }, scenario.title || scenario.scenarioId),
      ),
    );
  }
  container.append(
    list,
    el(
      'div',
      { className: 'list-actions' },
      button('+ New scenario', () => {
        const s = createDefaultScenario(uid('scenario'), 'New scenario');
        store.mutate((st) => (st.scenarios ??= []).push(s), 'data');
        store.mutateUi((ui) => (ui.selectedScenarioId = s.scenarioId));
      }, 'primary'),
    ),
  );
}

export function renderScenarioPreview(container: HTMLElement): void {
  clear(container);
  const s = store.selectedScenario;
  if (!s) {
    container.append(el('p', { className: 'hint' }, 'Select or create a scenario.'));
    return;
  }
  const issues = validateScenario(s, validationCtx());
  const summary = el('div', { className: 'persona-summary' });
  summary.append(
    el('div', {}, el('strong', {}, s.title || s.scenarioId)),
    el('div', {}, s.summary || '—'),
    el('div', {}, `${s.cast.length} cast · ${s.locations.length} locations · ${s.truthFacts.length} truths · ${s.informationItems.length} info · ${s.variants.length} variants`),
    el('div', {}, `Objective: ${s.objective.label || s.objective.objectiveId || '—'}`),
    el('div', { className: issues.length ? 'scenario-invalid' : 'scenario-valid' }, issues.length ? `⚠ ${issues.length} validation issue(s)` : '✓ valid'),
  );
  container.append(summary);
}

export function renderScenarioControls(container: HTMLElement): void {
  clear(container);
  const s = store.selectedScenario;
  if (!s) return;

  container.append(
    metaSection(s),
    castSection(s),
    locationsSection(s),
    truthSection(s),
    informationSection(s),
    experimentSection(s),
    objectiveSection(s),
    el(
      'div',
      { className: 'btn-row' },
      button('Validate', () => {
        const issues = validateScenario(s, validationCtx());
        const note = anchorIds().length ? '' : '\n\n(No office anchors in the current Scene — location bindings were not checked. Generate an office in the Scene tab to verify them.)';
        alert((issues.length ? `Issues:\n\n${issues.join('\n')}` : 'No issues — scenario is valid.') + note);
      }),
      button('Scenario JSON', () => downloadJson(`${s.scenarioId}.json`, serializeScenario(s))),
      button('Delete scenario', () => {
        if (!confirm(`Delete scenario "${s.title || s.scenarioId}"?`)) return;
        store.mutate((st) => {
          st.scenarios = (st.scenarios ?? []).filter((x) => x.scenarioId !== s.scenarioId);
          store.ui.selectedScenarioId = st.scenarios[0]?.scenarioId ?? '';
        }, 'structure');
      }, 'danger'),
    ),
  );
}
