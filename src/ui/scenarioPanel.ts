/**
 * Scenario tab — authors a full Water Cooler run (cast + office binding + truth /
 * information + experiment variants + objective) and exports scenario.json. The
 * sim loads it (see game-design-docs .../design/scenario_model.md). Scenarios are
 * project-level, so the sidebar lists them and the controls edit the selected one.
 */
import type { ChangeKind } from '../state';
import { store } from '../state';
import { downloadJson } from '../core/exporter';
import { GENERATED_COWORKER_PREFIX, computeInteractionAnchors, computeOfficeAnchors, generateOfficeLayout } from '../core/layout';
import { STANCES } from '../core/profile';
import { resolveScenarioRun, type ResolvedAgent, type ResolvedRun } from '../core/scenarioRun';
import { SCENARIO_TEMPLATES } from '../data/scenarioTemplates';
import { ROLE_TEMPLATES } from '../data/roleTemplates';
import { analyzeTemplateCoverage, castTemplate, type ScenarioTemplate } from '../core/scenarioTemplate';
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
import { button, clear, el, labeled, select } from './dom';
import { collapsibleSection as section, listItem, num, optNum, tagEditor, textArea, textField, uid, viewTabs } from './controls';

// Which variant the dry-run preview resolves against (transient; resets on reload).
let previewVariantId: string | null = null;
let previewContainer: HTMLElement | null = null;
// Belief topic the social graph clusters by (transient).
let graphTopic: string | null = null;
// Which editor section group / inspector view is shown (transient; resets on reload).
let editorContainer: HTMLElement | null = null;
let editorGroup = 'setup';
let inspectorView = 'dryrun';

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
    list.append(
      listItem({
        selected: scenario.scenarioId === store.ui.selectedScenarioId,
        name: scenario.title || scenario.scenarioId,
        onClick: () => store.mutateUi((ui) => (ui.selectedScenarioId = scenario.scenarioId)),
      }),
    );
  }
  const addScenario = (s: ReturnType<typeof createDefaultScenario>) => {
    const taken = new Set((store.state.scenarios ?? []).map((x) => x.scenarioId));
    if (taken.has(s.scenarioId)) s.scenarioId = `${s.scenarioId}-${uid('').slice(1)}`;
    store.mutate((st) => (st.scenarios ??= []).push(s), 'data');
    store.mutateUi((ui) => (ui.selectedScenarioId = s.scenarioId));
  };
  // Test-cast a cast-agnostic role template onto the current cast (the project
  // profiles) for an authoring preview — author against roles, preview against
  // whoever's here. A clean cast can be added as a concrete scenario, which then
  // flows into the normal dry-run preview. See core/scenarioTemplate.ts.
  const castRoleTemplate = (template: ScenarioTemplate) => {
    const profiles = store.state.profiles ?? [];
    const anchors = anchorIds();
    const result = castTemplate(template, profiles, {
      anchorIds: anchors.length ? anchors : undefined,
      scenarioId: uid('scenario'),
    });
    const cov = analyzeTemplateCoverage(template, profiles);
    const lines = [
      `Template "${template.title}" cast onto ${profiles.length} persona(s).`,
      `Emotional payload: ${template.emotionalPayload.targetEmotions.join(', ')}`,
      '',
      'Roles:',
      ...result.report.assignments.map((a) => `  ${a.roleId}${a.required ? '' : ' (optional)'} → ${a.agentId ?? '— unfilled'}`),
      result.report.unfilledRequired.length ? `\n⚠ unfilled REQUIRED: ${result.report.unfilledRequired.join(', ')}` : '',
      result.report.unfilledOptional.length ? `Skipped optional: ${result.report.unfilledOptional.join(', ')}` : '',
      '',
      `Coverage: ${cov.fullyCastable ? '✓ castable' : '✗ not castable'}`,
      ...cov.notes.map((n) => `  • ${n}`),
      result.report.issues.length ? `\nIssues:\n${result.report.issues.map((i) => '  ' + i).join('\n')}` : '',
    ].filter(Boolean);
    if (result.ok && result.scenario) {
      if (confirm(`${lines.join('\n')}\n\nAdd this cast scenario to the project?`)) addScenario(result.scenario);
    } else {
      alert(lines.join('\n'));
    }
  };
  container.append(
    list,
    el(
      'div',
      { className: 'list-actions' },
      button('+ New scenario', () => addScenario(createDefaultScenario(uid('scenario'), 'New scenario')), 'primary'),
      labeled(
        'From template',
        select(
          [{ value: '', label: '+ template…' }, ...SCENARIO_TEMPLATES.map((t) => ({ value: t.id, label: t.name }))],
          '',
          (id) => {
            const t = SCENARIO_TEMPLATES.find((x) => x.id === id);
            if (t) addScenario(t.build());
          },
        ),
      ),
      labeled(
        'Cast role template',
        select(
          [{ value: '', label: 'test-cast…' }, ...ROLE_TEMPLATES.map((t) => ({ value: t.templateId, label: t.title }))],
          '',
          (id) => {
            const t = ROLE_TEMPLATES.find((x) => x.templateId === id);
            if (t) castRoleTemplate(t);
          },
        ),
      ),
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

function activeVariantId(s: Scenario): string {
  return previewVariantId && s.variants.some((v) => v.variantId === previewVariantId) ? previewVariantId : s.defaultVariantId;
}

/** Resolve the run for the currently-previewed variant (shared by dry-run/graph/overview). */
function activeRun(s: Scenario): ResolvedRun {
  return resolveScenarioRun(s, {
    profiles: store.state.profiles ?? [],
    characters: store.state.characters.map((c) => ({ id: c.id, name: c.name })),
    variantId: activeVariantId(s),
    agentIds: store.state.characters.map((c) => c.id),
    anchorIds: anchorIds().length ? anchorIds() : undefined,
  });
}

function renderDryRun(container: HTMLElement, s: Scenario): void {
  const variantOptions = s.variants.map((v) => ({ value: v.variantId, label: v.variantId }));
  const activeVariant = activeVariantId(s);
  const run = activeRun(s);

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

function stanceColor(stance: string): string {
  return { accepts: '#3b8a4e', unknown: '#6f6f6f', doubts: '#c98a3a', suspects: '#c98a3a', rejects: '#c0603a' }[stance] ?? '#6f6f6f';
}

/** Node-link relationship graph; nodes optionally clustered by belief stance on a topic. */
function renderSocialGraph(container: HTMLElement, run: ResolvedRun): void {
  const ids = run.agents.map((a) => a.agentId);
  if (ids.length < 2) return;
  const topics = [...new Set(run.agents.flatMap((a) => a.beliefs.map((b) => b.topic)))];
  const clusterTopic = graphTopic && topics.includes(graphTopic) ? graphTopic : '';

  const W = 280;
  const H = 280;
  const cx = W / 2;
  const cy = H / 2;
  const R = 100;
  const nr = 17;
  const pos = new Map(
    ids.map((id, i) => {
      const ang = -Math.PI / 2 + (i / ids.length) * 2 * Math.PI;
      return [id, { x: cx + R * Math.cos(ang), y: cy + R * Math.sin(ang) }];
    }),
  );
  let edges = '';
  for (const a of run.agents) {
    for (const r of a.relationships) {
      const from = pos.get(a.agentId);
      const to = pos.get(r.targetAgentId);
      if (!from || !to) continue;
      const mag = 0.3 + (Math.abs(r.affinity) / 100) * 0.6;
      const col = r.affinity >= 0 ? `rgba(60,160,90,${mag})` : `rgba(196,80,60,${mag})`;
      edges += `<line x1="${from.x.toFixed(1)}" y1="${from.y.toFixed(1)}" x2="${to.x.toFixed(1)}" y2="${to.y.toFixed(1)}" stroke="${col}" stroke-width="${r.fromOverride ? 2.5 : 1.5}" marker-end="url(#arr)" />`;
    }
  }
  let nodes = '';
  for (const a of run.agents) {
    const p = pos.get(a.agentId)!;
    const belief = clusterTopic ? a.beliefs.find((b) => b.topic === clusterTopic) : undefined;
    const fill = belief ? stanceColor(belief.stance) : '#39424a';
    nodes += `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${nr}" fill="${fill}" stroke="#15110d" stroke-width="1.5"/><text x="${p.x.toFixed(1)}" y="${(p.y + 3).toFixed(1)}" text-anchor="middle" font-size="8" fill="#fff">${a.agentId.slice(0, 7)}</text>`;
  }
  const svg = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg"><defs><marker id="arr" markerWidth="7" markerHeight="7" refX="15" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 z" fill="#8a8a8a"/></marker></defs>${edges}${nodes}</svg>`;
  const art = el('div', { className: 'social-graph' });
  art.innerHTML = svg;
  container.append(
    el(
      'div',
      { className: 'row-card' },
      el('div', { className: 'dry-key' }, 'Social graph — edges = affinity, nodes = belief stance'),
      topics.length
        ? labeled(
            'Cluster by belief',
            select([{ value: '', label: '(none)' }, ...topics.map((t) => ({ value: t, label: t }))], clusterTopic, (v) => {
              graphTopic = v;
              if (previewContainer) renderScenarioPreview(previewContainer);
            }),
          )
        : null,
      art,
    ),
  );
}

/** A quick sanity dashboard of scenario structure. */
function renderOverview(container: HTMLElement, s: Scenario, run: ResolvedRun): void {
  const identities = new Map((store.state.profiles ?? []).map((p) => [p.agentId, p.identity]));
  const deptCounts: Record<string, number> = {};
  for (const a of run.agents) {
    const d = identities.get(a.agentId)?.department || '—';
    deptCounts[d] = (deptCounts[d] ?? 0) + 1;
  }
  const n = run.agents.length;
  const edges = run.agents.reduce((sum, a) => sum + a.relationships.length, 0);
  const density = n > 1 ? `${Math.round((edges / (n * (n - 1))) * 100)}%` : '—';
  const beliefTopics = new Set(run.agents.flatMap((a) => a.beliefs.map((b) => b.topic)));
  const beliefCount = run.agents.reduce((sum, a) => sum + a.beliefs.length, 0);
  const roomCounts: Record<string, number> = {};
  for (const l of s.locations) {
    const r = l.bindTo.roomId || '—';
    roomCounts[r] = (roomCounts[r] ?? 0) + 1;
  }
  const interactions = store.state.scene ? computeInteractionAnchors(store.state.scene, store.state).length : 0;
  const line = (t: string) => el('div', { className: 'hint' }, t);
  const fmt = (rec: Record<string, number>) => Object.entries(rec).map(([k, v]) => `${k} (${v})`).join(', ') || '—';
  container.append(
    el(
      'div',
      { className: 'row-card' },
      el('div', { className: 'dry-key' }, 'Scenario overview'),
      line(`Employees: ${n}`),
      line(`Departments: ${fmt(deptCounts)}`),
      line(`Relationships: ${edges} (density ${density})`),
      line(`Beliefs: ${beliefCount} across ${beliefTopics.size} topic(s)`),
      line(`Truths: ${run.truthFacts.length} · Info items: ${run.informationItems.length}`),
      line(`Interaction anchors: ${interactions}`),
      line(`Locations by room: ${fmt(roomCounts)}`),
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

  // One analysis view at a time. The office map now lives in the unified Office tab.
  if (!INSPECTOR_VIEWS.some((v) => v.id === inspectorView)) inspectorView = 'dryrun';
  container.append(
    viewTabs(inspectorView, INSPECTOR_VIEWS, (id) => {
      inspectorView = id;
      if (previewContainer) renderScenarioPreview(previewContainer);
    }),
  );
  const run = activeRun(s);
  if (inspectorView === 'graph') {
    if (run.agents.length > 1) renderSocialGraph(container, run);
    else container.append(el('p', { className: 'hint' }, 'Add at least two cast members to see the social graph.'));
  } else if (inspectorView === 'stats') renderOverview(container, s, run);
  else renderDryRun(container, s);
}

const INSPECTOR_VIEWS: ReadonlyArray<{ id: string; label: string }> = [
  { id: 'dryrun', label: 'Dry run' },
  { id: 'graph', label: 'Graph' },
  { id: 'stats', label: 'Stats' },
];

// The editor's sections, grouped so the tab strip stays short. Each group
// renders only when its tab is active, so you focus on one slice at a time.
const EDITOR_GROUPS: ReadonlyArray<{ id: string; label: string; build: (s: Scenario) => HTMLElement[] }> = [
  { id: 'setup', label: 'Setup', build: (s) => [metaSection(s), officeSection(s), objectiveSection(s)] },
  { id: 'cast', label: 'Cast', build: (s) => [castSection(s)] },
  { id: 'locations', label: 'Locations', build: (s) => [locationsSection(s)] },
  { id: 'knowledge', label: 'Knowledge', build: (s) => [truthSection(s), informationSection(s)] },
  { id: 'experiment', label: 'Experiment', build: (s) => [experimentSection(s)] },
];

export function renderScenarioControls(container: HTMLElement): void {
  clear(container);
  editorContainer = container;
  const s = store.selectedScenario;
  if (!s) return;

  if (!EDITOR_GROUPS.some((g) => g.id === editorGroup)) editorGroup = 'setup';
  const group = EDITOR_GROUPS.find((g) => g.id === editorGroup)!;
  container.append(
    viewTabs(editorGroup, EDITOR_GROUPS, (id) => {
      editorGroup = id;
      if (editorContainer) renderScenarioControls(editorContainer);
    }),
    ...group.build(s),
    actionRow(s),
  );
}

function actionRow(s: Scenario): HTMLElement {
  return el(
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
  );
}
