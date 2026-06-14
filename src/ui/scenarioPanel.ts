/**
 * Scenario tab — authors a full Water Cooler run (cast + office binding + truth /
 * information + experiment variants + objective) and exports scenario.json. The
 * sim loads it (see game-design-docs .../design/scenario_model.md). Scenarios are
 * project-level, so the sidebar lists them and the controls edit the selected one.
 */
import type { ChangeKind } from '../state';
import { store } from '../state';
import { downloadJson } from '../core/exporter';
import { GENERATED_COWORKER_PREFIX, computeOfficeAnchors, generateOfficeLayout, type OfficeAnchor } from '../core/layout';
import { composeSceneSvg } from '../core/scene';
import { STANCES } from '../core/profile';
import { resolveScenarioRun, type ResolvedAgent, type ResolvedRun } from '../core/scenarioRun';
import { setScenePreviewSvg } from './renderPreview';
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

// Which variant the dry-run preview resolves against (transient; resets on reload).
let previewVariantId: string | null = null;
let previewContainer: HTMLElement | null = null;
// The location being placed by clicking the office map (transient).
let placingLocationId: string | null = null;
// Collapsed editor sections, by title (transient; persists across re-renders).
const collapsedSections = new Set<string>();

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

/** Cast members with no authored persona — a coherence warning (not a hard error). */
function castWithoutPersona(s: Scenario): string[] {
  const personas = new Set((store.state.profiles ?? []).map((p) => p.agentId));
  return s.cast.map((c) => c.agentId).filter((id) => !personas.has(id));
}

/** Options including the current value even when it is absent from the source. */
function withCurrent(values: string[], current: string): Array<{ value: string; label: string }> {
  const set = [...new Set([current, ...values].filter((v) => v !== ''))];
  return set.map((v) => ({ value: v, label: v }));
}

// --- shared bits ------------------------------------------------------------

function section(title: string, ...children: Array<Node | null | undefined>): HTMLElement {
  const body = el('div', { className: 'section-body' }, ...(children.filter(Boolean) as Node[]));
  const sec = el(
    'section',
    { className: `persona-section ${collapsedSections.has(title) ? 'collapsed' : ''}` },
    el(
      'h3',
      {
        className: 'section-head',
        onClick: () => {
          const isCollapsed = sec.classList.toggle('collapsed');
          if (isCollapsed) collapsedSections.add(title);
          else collapsedSections.delete(title);
        },
      },
      title,
    ),
    body,
  );
  return sec;
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

function officeSection(s: Scenario): HTMLElement {
  const generate = (seed: number | undefined) => {
    const gen = generateOfficeLayout(store.state, store.ui.sceneCoworkers, seed);
    store.mutate((st) => {
      st.characters = st.characters.filter((r) => !r.id.startsWith(GENERATED_COWORKER_PREFIX)).concat(gen.coworkers);
      st.scene = gen.scene;
      s.officeSeed = gen.seed; // s is the live selected scenario reference
    }, 'structure');
  };
  const seedInput = el('input', {
    type: 'number',
    value: s.officeSeed === undefined ? '' : String(s.officeSeed),
    placeholder: 'seed',
    onInput: (e: Event) =>
      edit(() => {
        const raw = (e.target as HTMLInputElement).value;
        s.officeSeed = raw === '' ? undefined : Number(raw);
      }),
  });
  return section(
    'Office',
    el('p', { className: 'hint' }, 'The shared project office this scenario binds to. Pin a seed so the bound layout is reproducible.'),
    labeled(
      'Seed',
      el(
        'span',
        { className: 'effect-row' },
        seedInput,
        button('Generate', () => generate(s.officeSeed), 'primary'),
        button('🎲 New', () => generate(undefined)),
      ),
    ),
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
      el(
        'div',
        { className: 'btn-row' },
        button('Duplicate', () => edit(() => s.variants.push({ variantId: uid('variant'), selections: { ...v.selections } }), 'structure')),
        button('Remove variant', () => edit(() => (s.variants = s.variants.filter((x) => x !== v)), 'structure'), 'danger'),
      ),
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

/** A labelled stat line like `trust 33 · susp 100`. */
function metricLine(label: string, parts: string[]): HTMLElement {
  return el('div', { className: 'dry-metrics' }, el('span', { className: 'dry-key' }, label), parts.join(' · '));
}

function relationshipLine(r: ResolvedAgent['relationships'][number]): HTMLElement {
  const parts = [`trust ${r.trust}`, `susp ${r.suspicion}`, `aff ${r.affinity}`, `infl ${r.influence}`, `resp ${r.respect}`, `fam ${r.familiarity}`];
  const tag = r.tags.length ? ` [${r.tags.join(', ')}]` : '';
  return el(
    'div',
    { className: 'dry-rel' },
    el('span', { className: 'dry-key' }, `→ ${r.targetAgentId}${tag}`),
    parts.join(' · '),
    r.fromOverride ? el('span', { className: 'dry-override' }, ' ⟵ scenario') : null,
  );
}

function affinityBg(aff: number): string {
  if (aff === 0) return 'rgba(120,120,120,0.18)';
  return aff > 0 ? `rgba(60,160,90,${(aff / 100) * 0.7})` : `rgba(196,80,60,${(-aff / 100) * 0.7})`;
}

/** A source×target affinity matrix — the relationship graph for a small cast. */
function renderRelationshipMatrix(run: ResolvedRun): HTMLElement {
  const ids = run.agents.map((a) => a.agentId);
  const relOf = new Map(run.agents.map((a) => [a.agentId, new Map(a.relationships.map((r) => [r.targetAgentId, r]))]));
  const grid = el('div', { className: 'rel-matrix', style: `grid-template-columns: auto repeat(${ids.length}, 1fr);` });
  grid.append(el('div', { className: 'rel-corner' }, '→'));
  for (const t of ids) grid.append(el('div', { className: 'rel-h' }, t));
  for (const src of ids) {
    grid.append(el('div', { className: 'rel-h' }, src));
    for (const tgt of ids) {
      if (src === tgt) {
        grid.append(el('div', { className: 'rel-self' }));
        continue;
      }
      const r = relOf.get(src)?.get(tgt);
      if (!r) {
        grid.append(el('div', { className: 'rel-cell rel-empty' }, '·'));
        continue;
      }
      grid.append(
        el(
          'div',
          {
            className: `rel-cell ${r.fromOverride ? 'rel-ov' : ''}`,
            style: `background:${affinityBg(r.affinity)};`,
            title: `${src} → ${tgt}: trust ${r.trust} · susp ${r.suspicion} · aff ${r.affinity} · infl ${r.influence} · resp ${r.respect} · fam ${r.familiarity}${r.tags.length ? ' [' + r.tags.join(',') + ']' : ''}${r.fromOverride ? ' (scenario override)' : ''}`,
          },
          String(r.affinity),
        ),
      );
    }
  }
  return el('div', { className: 'row-card' }, el('div', { className: 'dry-key' }, 'Relationships — affinity (row → column)'), grid);
}

function dryAgentCard(a: ResolvedAgent): HTMLElement {
  const beliefs = a.beliefs.map((b) => `${b.topic}: ${b.stance}@${b.confidence}`);
  return el(
    'div',
    { className: 'row-card dry-agent' },
    el(
      'div',
      { className: 'dry-agent-head' },
      el('strong', {}, a.displayName),
      el('span', { className: 'hint' }, ` ${a.prototypeRole || '—'}`),
      a.hasPersona ? null : el('span', { className: 'scenario-invalid' }, ' (no persona)'),
    ),
    el('div', { className: 'hint' }, `spawn: ${a.spawnLocationId || '—'}${a.spawnBinding ? ` → ${a.spawnBinding.anchorId || a.spawnBinding.roomId}` : ' (unbound)'}`),
    a.drivePrimary || a.driveSecondary ? metricLine('drive', [a.drivePrimary || '—', a.driveSecondary].filter(Boolean)) : null,
    a.topNeeds.length ? metricLine('needs', a.topNeeds) : null,
    a.traitTags.length ? el('div', { className: 'tag-chips' }, ...a.traitTags.map((t) => el('span', { className: 'tag-chip' }, t))) : null,
    beliefs.length ? metricLine('beliefs', beliefs) : null,
    a.knowledge.length ? metricLine('knows', a.knowledge) : null,
    ...(a.relationships.length ? [el('div', { className: 'dry-key' }, 'relationships'), ...a.relationships.map(relationshipLine)] : []),
  );
}

function renderDryRun(container: HTMLElement, s: Scenario): void {
  const variantOptions = s.variants.map((v) => ({ value: v.variantId, label: v.variantId }));
  const activeVariant = previewVariantId && s.variants.some((v) => v.variantId === previewVariantId) ? previewVariantId : s.defaultVariantId;
  const run = resolveScenarioRun(s, {
    profiles: store.state.profiles ?? [],
    characters: store.state.characters.map((c) => ({ id: c.id, name: c.name })),
    variantId: activeVariant,
    agentIds: store.state.characters.map((c) => c.id),
    anchorIds: anchorIds().length ? anchorIds() : undefined,
  });

  const header = el('h3', {}, 'Dry run — starting state');
  const variantRow = variantOptions.length
    ? labeled(
        'Variant',
        select(variantOptions, activeVariant, (v) => {
          previewVariantId = v;
          if (previewContainer) renderScenarioPreview(previewContainer);
        }),
      )
    : el('p', { className: 'hint' }, 'No variants defined.');
  const conditions = Object.entries(run.variantConditions);
  const conditionsLine = el('div', { className: 'hint' }, conditions.length ? conditions.map(([k, v]) => `${k}=${v}`).join(' · ') : 'no conditions');

  const world = el(
    'div',
    { className: 'row-card' },
    el('div', { className: 'dry-key' }, 'World'),
    ...run.truthFacts.map((t) => el('div', { className: 'hint' }, `truth: ${t.statement} (${t.objectiveValue})`)),
    ...run.informationItems.map((i) => el('div', { className: 'hint' }, `info: ${i.claim} [${i.originType}/${i.truthAlignment}] ← ${i.initialHolderAgentIds.join(', ') || 'unheld'}`)),
  );

  container.append(
    ...([
      header,
      variantRow,
      conditionsLine,
      run.agents.length > 1 ? renderRelationshipMatrix(run) : null,
      ...run.agents.map(dryAgentCard),
      world,
      el('div', { className: 'row-card' }, el('div', { className: 'dry-key' }, 'Objective'), el('div', { className: 'hint' }, `${run.objective.label || '—'} · KPI: ${run.objective.kpi || '—'}`)),
    ].filter(Boolean) as Node[]),
  );
}

function anchorForLocation(s: Scenario, locationId: string, anchors: OfficeAnchor[]): OfficeAnchor | undefined {
  const loc = s.locations.find((l) => l.locationId === locationId);
  if (!loc) return undefined;
  const want = loc.bindTo.anchorId || loc.bindTo.roomId;
  return anchors.find((a) => a.anchorId === want);
}

/** The office with each cast member's spawn marked; click an anchor to (re)bind the chosen location. */
function renderOfficeMap(container: HTMLElement, s: Scenario): void {
  const scene = store.state.scene;
  if (!scene || !scene.rooms?.length) {
    container.append(el('h3', {}, 'Office map'), el('p', { className: 'hint' }, 'No office yet — pin a seed and Generate in the Office section to place the cast spatially.'));
    return;
  }
  const anchors = computeOfficeAnchors(scene, store.state);
  const anchorByCell = new Map(anchors.map((a) => [`${a.x},${a.y}`, a]));
  const spawnByCell = new Map<string, string[]>();
  for (const member of s.cast) {
    const anchor = anchorForLocation(s, member.spawnLocationId, anchors);
    if (!anchor) continue;
    const key = `${anchor.x},${anchor.y}`;
    const list = spawnByCell.get(key) ?? [];
    list.push(member.agentId);
    spawnByCell.set(key, list);
  }

  placingLocationId =
    placingLocationId && s.locations.some((l) => l.locationId === placingLocationId)
      ? placingLocationId
      : s.locations[0]?.locationId ?? null;
  const placingCell = placingLocationId ? anchorForLocation(s, placingLocationId, anchors) : undefined;
  const placingKey = placingCell ? `${placingCell.x},${placingCell.y}` : null;

  const frame = el('div', { className: 'scene-frame', style: `aspect-ratio: ${scene.cols} / ${scene.rows};` });
  const art = el('div', { className: 'scene-art' });
  setScenePreviewSvg(art, composeSceneSvg(scene, store.state, 48), store.state.style, scene.cols * 48, scene.rows * 48, true);
  const overlay = el('div', {
    className: 'scene-grid',
    style: `grid-template-columns: repeat(${scene.cols}, 1fr); grid-template-rows: repeat(${scene.rows}, 1fr);`,
  });
  for (let y = 0; y < scene.rows; y++) {
    for (let x = 0; x < scene.cols; x++) {
      const key = `${x},${y}`;
      const anchor = anchorByCell.get(key);
      const spawns = spawnByCell.get(key);
      const classes = ['scene-cell', 'scenario-cell'];
      if (anchor) classes.push('is-anchor');
      if (key === placingKey) classes.push('placing');
      const cell = el('button', {
        className: classes.join(' '),
        title: anchor ? anchor.anchorId : `${x}, ${y}`,
        onClick: () => {
          if (!placingLocationId || !anchor) return;
          store.mutate(() => {
            const loc = s.locations.find((l) => l.locationId === placingLocationId);
            if (loc) loc.bindTo = { roomId: anchor.roomId, anchorId: anchor.kind === 'desk' ? anchor.anchorId : '' };
          }, 'structure');
        },
      });
      if (spawns) cell.append(el('span', { className: 'scenario-marker' }, spawns.join(',')));
      overlay.append(cell);
    }
  }
  frame.append(art, overlay);

  container.append(
    el(
      'div',
      { className: 'office-map' },
      el('h3', {}, 'Office map'),
      s.locations.length
        ? labeled(
            'Place location',
            select(s.locations.map((l) => ({ value: l.locationId, label: l.locationId })), placingLocationId ?? '', (v) => {
              placingLocationId = v;
              if (previewContainer) renderScenarioPreview(previewContainer);
            }),
          )
        : null,
      el('p', { className: 'hint' }, placingLocationId ? `Click an office anchor to bind "${placingLocationId}" there.` : 'Add a location to place it.'),
      frame,
    ),
  );
}

export function renderScenarioPreview(container: HTMLElement): void {
  clear(container);
  previewContainer = container;
  const s = store.selectedScenario;
  if (!s) {
    container.append(el('p', { className: 'hint' }, 'Select or create a scenario.'));
    return;
  }
  const issues = validateScenario(s, validationCtx());
  const personaless = castWithoutPersona(s);
  const summary = el(
    'div',
    { className: 'persona-summary' },
    el('div', {}, el('strong', {}, s.title || s.scenarioId)),
    el('div', {}, s.summary || '—'),
    el('div', {}, `${s.cast.length} cast · ${s.locations.length} locations · ${s.truthFacts.length} truths · ${s.informationItems.length} info · ${s.variants.length} variants`),
    el('div', { className: issues.length ? 'scenario-invalid' : 'scenario-valid' }, issues.length ? `⚠ ${issues.length} validation issue(s)` : '✓ valid'),
    personaless.length ? el('div', { className: 'scenario-invalid' }, `⚠ no persona: ${personaless.join(', ')}`) : null,
  );
  container.append(summary);
  if (issues.length) {
    container.append(
      el(
        'div',
        { className: 'scenario-issues' },
        el('div', { className: 'dry-key' }, `Validation — ${issues.length} issue(s)`),
        ...issues.map((i) => el('div', { className: 'scenario-issue' }, i)),
      ),
    );
  }
  renderOfficeMap(container, s);
  renderDryRun(container, s);
}

export function renderScenarioControls(container: HTMLElement): void {
  clear(container);
  const s = store.selectedScenario;
  if (!s) return;

  container.append(
    metaSection(s),
    officeSection(s),
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
        const personaless = castWithoutPersona(s);
        const notes = [
          anchorIds().length ? '' : '(No office anchors in the current Scene — location bindings were not checked. Generate an office in the Scene tab to verify them.)',
          personaless.length ? `Cast without a persona (will run on defaults): ${personaless.join(', ')}` : '',
        ].filter(Boolean).join('\n\n');
        const head = issues.length ? `Issues:\n\n${issues.join('\n')}` : 'No issues — scenario is valid.';
        alert(head + (notes ? `\n\n${notes}` : ''));
      }),
      button('Scenario JSON', () => downloadJson(`${s.scenarioId}.json`, serializeScenario(s))),
      button('Duplicate', () => {
        store.mutate((st) => {
          const copy = structuredClone(s);
          copy.scenarioId = uid('scenario');
          copy.title = `${s.title || s.scenarioId} copy`;
          (st.scenarios ??= []).push(copy);
          store.ui.selectedScenarioId = copy.scenarioId;
        }, 'structure');
      }),
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
