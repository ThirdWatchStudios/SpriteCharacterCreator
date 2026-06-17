/**
 * Persona tab — authors a CharacterProfile alongside the selected sprite. Keyed
 * by the selected character's id (== agentId), so sprite and persona stay linked.
 * Renders from the modern-office character schema declared in core/profile.ts;
 * see game-design-docs/the-water-cooler/docs/design/character_model.md.
 */
import type { ChangeKind } from '../state';
import { store } from '../state';
import { MOODS } from '../core/types';
import { composeCharacter } from '../core/compositor';
import { downloadJson } from '../core/exporter';
import {
  ACTIVITY_SUGGESTIONS,
  AGE_BANDS,
  AXIS_LABELS,
  DEPARTMENTS,
  DERIVED_GAME_AXES,
  EXPECTED_BEHAVIOR_TENDENCIES,
  FORMATIVE_OPS,
  FORMATIVE_TARGET_KINDS,
  FORMATIVE_VISIBILITY,
  LOCATION_SUGGESTIONS,
  NEEDS,
  NEED_LABELS,
  OBJECTIVE_STATUSES,
  OCEAN_AXES,
  ON_BLOCKED_LOCATION,
  PRIMARY_GAME_AXES,
  PRONOUNS,
  REACTION_CATEGORIES,
  RELATIONSHIP_TAG_SUGGESTIONS,
  SENIORITY,
  SKILL_TRACKS,
  SUBJECT_CATALOG,
  applyDerived,
  applyFormativeEffects,
  createDefaultProfile,
  serializeProfile,
  suggestedTraitTags,
  validateProfile,
  type CharacterProfile,
  type DerivedGameAxis,
  type FormativeApplyReport,
  type FormativeEvent,
  type FormativeOp,
  type FormativeTargetKind,
  type OceanAxis,
  type OnBlockedLocation,
  type PrimaryGameAxis,
  type ReactionCategory,
  type Relationship,
} from '../core/profile';
import { generateRoutine, resolveRoutineContext } from '../core/routineGenerator';
import { button, clear, el, labeled, select, slider } from './dom';
import { collapsibleSection as section, enumField, num, tagEditor, textField, uid } from './controls';

/** Mutate the selected profile in place (it's a live reference into the store). */
function edit(fn: () => void, kind: ChangeKind = 'data'): void {
  store.mutate(fn, kind);
}

function agentOptions(profile: CharacterProfile): Array<{ value: string; label: string }> {
  return store.state.characters
    .filter((c) => c.id !== profile.agentId)
    .map((c) => ({ value: c.id, label: c.name }));
}

// --- sections ---------------------------------------------------------------

function identitySection(p: CharacterProfile): HTMLElement {
  const id = p.identity;
  return section(
    'Identity',
    textField('Display name', id.displayName, (v) => edit(() => (id.displayName = v))),
    textField('Role / title', id.roleTitle, (v) => edit(() => (id.roleTitle = v))),
    enumField('Department', id.department, DEPARTMENTS, (v) => edit(() => (id.department = v))),
    labeled(
      'Seniority',
      select(SENIORITY.map((s) => ({ value: s, label: s })), id.seniority, (v) =>
        edit(() => (id.seniority = v as typeof id.seniority)),
      ),
    ),
    enumField('Pronouns', id.pronouns, PRONOUNS, (v) => edit(() => (id.pronouns = v))),
    enumField('Age band', id.ageBand, AGE_BANDS, (v) => edit(() => (id.ageBand = v))),
    textField('Prototype role', id.prototypeRole, (v) => edit(() => (id.prototypeRole = v))),
    labeled(
      'Bio',
      el('textarea', {
        rows: 2,
        value: id.bio,
        onInput: (e: Event) => edit(() => (id.bio = (e.target as HTMLTextAreaElement).value)),
      }),
    ),
  );
}

function personalitySection(p: CharacterProfile): HTMLElement {
  const per = p.personality;
  // Editing the spine re-derives any non-authored derived field immediately.
  const onSpine = () => edit(() => applyDerived(p));

  const oceanRows = OCEAN_AXES.map((k: OceanAxis) =>
    num(AXIS_LABELS[k], per.ocean[k], (v) => {
      per.ocean[k] = v;
      onSpine();
    }),
  );
  const axisRows = PRIMARY_GAME_AXES.map((k: PrimaryGameAxis) =>
    num(AXIS_LABELS[k], per.axes[k], (v) => {
      per.axes[k] = v;
      onSpine();
    }),
  );
  const derivedRows = DERIVED_GAME_AXES.map((k: DerivedGameAxis) => {
    const d = per.derivedAxes[k];
    return labeled(
      `${AXIS_LABELS[k]}${d.authored ? ' (overridden)' : ' (derived)'}`,
      el(
        'span',
        { className: 'derived-row' },
        slider(d.value, 0, 100, 1, (v) =>
          edit(() => {
            d.value = v;
            d.authored = true;
          }),
        ),
        button(d.authored ? 'use derived' : '—', () => edit(() => { d.authored = false; applyDerived(p); }, 'structure'), 'tag-remove'),
      ),
    );
  });

  const suggestions = suggestedTraitTags(p);
  return section(
    'Personality',
    el('h4', {}, 'Big Five (OCEAN)'),
    ...oceanRows,
    el('h4', {}, 'Game axes'),
    ...axisRows,
    el('h4', {}, 'Derived axes'),
    ...derivedRows,
    el('h4', {}, 'Trait tags'),
    tagEditor(
      per.traitTags,
      (next) => edit(() => (per.traitTags = next), 'structure'),
      // Spine suggestions first (most relevant), then the full catalog; deduped.
      [...new Set([...suggestions, ...store.state.traits.map((t) => t.id)])].filter((t) => !per.traitTags.includes(t)),
    ),
    el('p', { className: 'hint' }, 'Traits come from the shared catalog — add or tune them in the Traits tab.'),
    suggestions.length
      ? el('p', { className: 'hint' }, `Suggested from the spine: ${suggestions.join(', ')}`)
      : null,
  );
}

function needsSection(p: CharacterProfile): HTMLElement {
  const rows = NEEDS.flatMap((n) => [
    el('h4', {}, NEED_LABELS[n]),
    num('Baseline', p.needs[n].baseline, (v) => edit(() => (p.needs[n].baseline = v))),
    num('Sensitivity', p.needs[n].sensitivity, (v) => edit(() => (p.needs[n].sensitivity = v))),
  ]);
  return section('Needs', ...rows);
}

function drivesSection(p: CharacterProfile): HTMLElement {
  // Options drawn from the shared drive catalog; a value not in the catalog is
  // preserved and tagged "(custom)" so links to removed/renamed drives survive.
  const driveOptions = (current: string): Array<{ value: string; label: string }> => {
    const opts = [
      { value: '', label: '—' },
      ...store.state.drives.map((d) => ({ value: d.id, label: d.label || d.id })),
    ];
    if (current && !store.state.drives.some((d) => d.id === current)) {
      opts.push({ value: current, label: `${current} (custom)` });
    }
    return opts;
  };
  const driveSelect = (label: string, value: string, set: (v: string) => void) =>
    labeled(label, select(driveOptions(value), value, (v) => edit(() => set(v))));

  const objRows = p.drives.objectives.map((o) =>
    el(
      'div',
      { className: 'row-card' },
      driveSelect('Source drive', o.sourceDrive, (v) => (o.sourceDrive = v)),
      textField('Concern', o.targetOrConcern, (v) => edit(() => (o.targetOrConcern = v))),
      labeled(
        'Tendency',
        select(
          EXPECTED_BEHAVIOR_TENDENCIES.map((t) => ({ value: t, label: t })),
          o.expectedBehaviorTendency,
          (v) => edit(() => (o.expectedBehaviorTendency = v as typeof o.expectedBehaviorTendency)),
        ),
      ),
      labeled(
        'Status',
        select(OBJECTIVE_STATUSES.map((s) => ({ value: s, label: s })), o.status, (v) =>
          edit(() => (o.status = v as typeof o.status)),
        ),
      ),
      button('Remove objective', () =>
        edit(() => (p.drives.objectives = p.drives.objectives.filter((x) => x !== o)), 'structure'),
        'danger',
      ),
    ),
  );

  return section(
    'Drives',
    driveSelect('Primary drive', p.drives.primary, (v) => (p.drives.primary = v)),
    driveSelect('Secondary drive', p.drives.secondary, (v) => (p.drives.secondary = v)),
    el('p', { className: 'hint' }, 'Drives come from the shared catalog — add or edit them in the Drives tab.'),
    el('h4', {}, 'Personal objectives'),
    ...objRows,
    button('+ Objective', () =>
      edit(() => {
        p.drives.objectives.push({
          id: uid('obj'),
          sourceDrive: p.drives.primary,
          targetOrConcern: '',
          expectedBehaviorTendency: 'share',
          status: 'active',
        });
      }, 'structure'),
    ),
  );
}

function preferencesSection(p: CharacterProfile): HTMLElement {
  const opts = SUBJECT_CATALOG.map((s) => ({ value: s.subjectId, label: `${s.displayName} (${s.kind})` }));
  const rows = p.preferences.map((pref) =>
    el(
      'div',
      { className: 'row-card' },
      labeled(
        'Subject',
        select(opts, pref.subjectId, (v) => edit(() => (pref.subjectId = v), 'structure')),
      ),
      num('Valence (hate ↔ love)', pref.valence, (v) => edit(() => (pref.valence = v)), -100, 100),
      button('Remove', () => edit(() => (p.preferences = p.preferences.filter((x) => x !== pref)), 'structure'), 'danger'),
    ),
  );
  return section(
    'Preferences (loves / hates)',
    ...rows,
    button('+ Preference', () =>
      edit(() => p.preferences.push({ subjectId: opts[0].value, valence: 0 }), 'structure'),
    ),
  );
}

function skillsSection(p: CharacterProfile): HTMLElement {
  const opts = SKILL_TRACKS.map((s) => ({ value: s.skillId, label: s.label }));
  const rows = p.skills.map((sk) =>
    el(
      'div',
      { className: 'row-card' },
      labeled('Skill', select(opts, sk.skillId, (v) => edit(() => (sk.skillId = v), 'structure'))),
      num('Level', sk.level, (v) => edit(() => (sk.level = v))),
      button('Remove', () => edit(() => (p.skills = p.skills.filter((x) => x !== sk)), 'structure'), 'danger'),
    ),
  );
  return section(
    'Skills',
    ...rows,
    button('+ Skill', () => edit(() => p.skills.push({ skillId: opts[0].value, level: 50 }), 'structure')),
  );
}

/** A simple inline checkbox + label, returned as one control for `labeled`. */
function checkbox(checked: boolean, onChange: (next: boolean) => void): HTMLElement {
  return el('input', {
    type: 'checkbox',
    checked,
    onChange: (e: Event) => onChange((e.target as HTMLInputElement).checked),
  });
}

/** Coupling badge text for a relationship type, so the editor hints at its effect. */
function relTypeHint(typeId: string | undefined): string {
  if (!typeId) return '';
  const def = store.state.relationshipTypes.find((t) => t.id === typeId);
  if (!def) return `Unknown type "${typeId}" (not in catalog).`;
  const biases = Object.entries(def.biasesReactions).filter(([, v]) => v);
  const parts: string[] = [];
  if (biases.length) parts.push('reacts ' + biases.map(([k, v]) => `${k} ${v > 0 ? '+' : ''}${v}`).join(', '));
  if (def.thirdParty) parts.push(`jealousy ${def.thirdParty.sensitivity}${def.thirdParty.intensifiesTowardDisliked ? ' (worse toward rivals)' : ''}`);
  return parts.join(' · ') || 'no reaction coupling';
}

/** Create or update the reverse edge in the target's profile (reciprocity helper). */
function mirrorRelationship(source: CharacterProfile, r: Relationship): void {
  const target = store.state.profiles?.find((pr) => pr.agentId === r.targetAgentId);
  if (!target) {
    alert(`No persona for "${r.targetAgentId}" to mirror into.`);
    return;
  }
  edit(() => {
    let back = target.relationships.find((x) => x.targetAgentId === source.agentId);
    if (!back) {
      back = { targetAgentId: source.agentId, trust: 50, suspicion: 0, affinity: 0, influence: 0, respect: 50, familiarity: 50, tags: [] };
      target.relationships.push(back);
    }
    // Mirror the durable, symmetric-ish fields; leave the rest for hand-tuning.
    back.relationshipType = r.relationshipType;
    back.secret = r.secret;
    back.affinity = r.affinity;
    back.familiarity = r.familiarity;
  }, 'structure');
}

function relationshipsSection(p: CharacterProfile): HTMLElement {
  const opts = agentOptions(p);
  const typeOpts = [{ value: '', label: '—' }, ...store.state.relationshipTypes.map((t) => ({ value: t.id, label: t.label }))];
  const rows = p.relationships.map((r) =>
    el(
      'div',
      { className: 'row-card' },
      labeled('Toward', select(opts, r.targetAgentId, (v) => edit(() => (r.targetAgentId = v), 'structure'))),
      labeled('Type', select(typeOpts, r.relationshipType ?? '', (v) => edit(() => (r.relationshipType = v === '' ? undefined : v), 'structure'))),
      r.relationshipType ? el('p', { className: 'hint' }, relTypeHint(r.relationshipType)) : null,
      labeled('Secret', checkbox(r.secret ?? false, (next) => edit(() => (r.secret = next ? true : undefined), 'structure'))),
      num('Trust', r.trust, (v) => edit(() => (r.trust = v))),
      num('Suspicion', r.suspicion, (v) => edit(() => (r.suspicion = v))),
      num('Affinity (dislike ↔ like)', r.affinity, (v) => edit(() => (r.affinity = v)), -100, 100),
      num('Influence', r.influence, (v) => edit(() => (r.influence = v))),
      num('Respect', r.respect, (v) => edit(() => (r.respect = v))),
      num('Familiarity', r.familiarity, (v) => edit(() => (r.familiarity = v))),
      labeled('Tags', tagEditor(r.tags, (next) => edit(() => (r.tags = next), 'structure'), RELATIONSHIP_TAG_SUGGESTIONS)),
      el(
        'div',
        { className: 'btn-row' },
        button('Mirror to ' + r.targetAgentId, () => mirrorRelationship(p, r)),
        button('Remove', () => edit(() => (p.relationships = p.relationships.filter((x) => x !== r)), 'structure'), 'danger'),
      ),
    ),
  );
  return section(
    'Relationships',
    opts.length === 0 ? el('p', { className: 'hint' }, 'Add more characters to author relationships.') : null,
    ...rows,
    opts.length
      ? button('+ Relationship', () =>
          edit(() => {
            const r: Relationship = {
              targetAgentId: opts[0].value,
              trust: 50,
              suspicion: 0,
              affinity: 0,
              influence: 0,
              respect: 50,
              familiarity: 50,
              tags: [],
            };
            p.relationships.push(r);
          }, 'structure'),
        )
      : null,
  );
}

function reactionsSection(p: CharacterProfile): HTMLElement {
  const rows = REACTION_CATEGORIES.map((c: ReactionCategory) => {
    const d = p.reactionTendencies[c];
    return labeled(
      `${c}${d.authored ? ' (overridden)' : ' (derived)'}`,
      el(
        'span',
        { className: 'derived-row' },
        slider(d.value, 0, 100, 1, (v) => edit(() => { d.value = v; d.authored = true; })),
        button(d.authored ? 'use derived' : '—', () => edit(() => { d.authored = false; applyDerived(p); }, 'structure'), 'tag-remove'),
      ),
    );
  });
  return section('Reaction tendencies', ...rows);
}

function temperamentSection(p: CharacterProfile): HTMLElement {
  const t = p.temperament;
  return section(
    'Temperament',
    labeled(
      'Baseline mood',
      select(MOODS.map((m) => ({ value: m, label: m })), t.baselineSocialState, (v) =>
        edit(() => (t.baselineSocialState = v as typeof t.baselineSocialState)),
      ),
    ),
    labeled(
      `Volatility${t.volatility.authored ? ' (overridden)' : ' (derived)'}`,
      el(
        'span',
        { className: 'derived-row' },
        slider(t.volatility.value, 0, 100, 1, (v) => edit(() => { t.volatility.value = v; t.volatility.authored = true; })),
        button(t.volatility.authored ? 'use derived' : '—', () => edit(() => { t.volatility.authored = false; applyDerived(p); }, 'structure'), 'tag-remove'),
      ),
    ),
  );
}

/** Summarize an apply report into an alert string. */
function reportText(report: FormativeApplyReport): string {
  const head = `Applied ${report.applied.length} effect(s).`;
  const body = report.applied.length ? `\n\n${report.applied.join('\n')}` : '';
  const skip = report.skipped.length ? `\n\nSkipped:\n${report.skipped.join('\n')}` : '';
  return head + body + skip;
}

/** Apply formative events to the live profile, then report what changed. */
function applyAndReport(p: CharacterProfile, events: FormativeEvent[]): void {
  let report: FormativeApplyReport = { applied: [], skipped: [] };
  store.mutate(() => {
    report = applyFormativeEffects(p, events);
  }, 'structure');
  alert(reportText(report));
}

function effectRow(fe: FormativeEvent, eff: FormativeEvent['effects'][number]): HTMLElement {
  return el(
    'div',
    { className: 'effect-row' },
    select(FORMATIVE_TARGET_KINDS.map((k) => ({ value: k, label: k })), eff.targetKind, (v) =>
      edit(() => (eff.targetKind = v as FormativeTargetKind)),
    ),
    el('input', {
      type: 'text',
      value: eff.targetRef,
      placeholder: 'targetRef (axis, need, agent:axis, subject, topic…)',
      onInput: (e: Event) => edit(() => (eff.targetRef = (e.target as HTMLInputElement).value)),
    }),
    select(FORMATIVE_OPS.map((o) => ({ value: o, label: o })), eff.op, (v) =>
      edit(() => (eff.op = v as FormativeOp)),
    ),
    el('input', {
      type: 'text',
      value: String(eff.value),
      placeholder: 'value',
      onInput: (e: Event) =>
        edit(() => {
          const raw = (e.target as HTMLInputElement).value;
          const n = Number(raw);
          eff.value = raw !== '' && !Number.isNaN(n) ? n : raw;
        }),
    }),
    button('×', () => edit(() => (fe.effects = fe.effects.filter((x) => x !== eff)), 'structure'), 'tag-remove'),
  );
}

function formativeSection(p: CharacterProfile): HTMLElement {
  const agentSug = store.state.characters.map((c) => c.id);
  const rows = p.formativeEvents.map((fe) =>
    el(
      'div',
      { className: 'row-card' },
      textField('Title', fe.title, (v) => edit(() => (fe.title = v))),
      labeled(
        'Description',
        el('textarea', {
          rows: 2,
          value: fe.description,
          onInput: (e: Event) => edit(() => (fe.description = (e.target as HTMLTextAreaElement).value)),
        }),
      ),
      textField('When', fe.when, (v) => edit(() => (fe.when = v))),
      labeled(
        'Visibility',
        select(FORMATIVE_VISIBILITY.map((s) => ({ value: s, label: s })), fe.visibility, (v) =>
          edit(() => (fe.visibility = v as typeof fe.visibility)),
        ),
      ),
      labeled('Involves', tagEditor(fe.involvedAgentIds, (next) => edit(() => (fe.involvedAgentIds = next), 'structure'), agentSug)),
      labeled('Known to', tagEditor(fe.knownToAgentIds, (next) => edit(() => (fe.knownToAgentIds = next), 'structure'), agentSug)),
      el('h4', {}, 'Effects'),
      ...fe.effects.map((eff) => effectRow(fe, eff)),
      button('+ Effect', () =>
        edit(() => fe.effects.push({ targetKind: 'personality_axis', targetRef: '', op: 'add', value: 0 }), 'structure'),
      ),
      el(
        'div',
        { className: 'btn-row' },
        button('Apply effects → starting state', () => {
          if (!fe.effects.length) return alert('This event has no effects to apply.');
          if (!confirm(`Fold ${fe.effects.length} effect(s) from "${fe.title}" into ${p.identity.displayName}'s starting state? This edits the fields directly.`)) return;
          applyAndReport(p, [fe]);
        }),
        button('Remove event', () => edit(() => (p.formativeEvents = p.formativeEvents.filter((x) => x !== fe)), 'structure'), 'danger'),
      ),
    ),
  );

  const hasEffects = p.formativeEvents.some((fe) => fe.effects.length);
  return section(
    'Formative events',
    el('p', { className: 'hint' }, 'Authored backstory that biases the starting state and can surface as evidence. "Apply effects" folds an event into the numeric starting fields — a one-shot authoring step (applying twice compounds).'),
    ...rows,
    button('+ Formative event', () =>
      edit(() => {
        p.formativeEvents.push({
          id: uid('fe'),
          title: 'New event',
          description: '',
          when: 'recent',
          involvedAgentIds: [],
          visibility: 'private',
          knownToAgentIds: [p.agentId],
          effects: [],
        });
      }, 'structure'),
    ),
    hasEffects
      ? button('Apply ALL formative effects', () => {
          if (!confirm(`Fold every formative event into ${p.identity.displayName}'s starting state?`)) return;
          applyAndReport(p, p.formativeEvents);
        })
      : null,
  );
}

function routineSection(p: CharacterProfile): HTMLElement {
  const locList = uid('loc');
  const actList = uid('act');
  const rows = p.routine.map((blk) =>
    el(
      'div',
      { className: 'row-card' },
      el(
        'div',
        { className: 'effect-row' },
        el('input', { type: 'text', value: blk.startTime, placeholder: 'start (09:00)', onInput: (e: Event) => edit(() => (blk.startTime = (e.target as HTMLInputElement).value)) }),
        el('input', { type: 'text', value: blk.endTime, placeholder: 'end (10:00)', onInput: (e: Event) => edit(() => (blk.endTime = (e.target as HTMLInputElement).value)) }),
      ),
      labeled('Location', el('input', { type: 'text', value: blk.locationId, list: locList, onInput: (e: Event) => edit(() => (blk.locationId = (e.target as HTMLInputElement).value)) })),
      labeled('Activity', el('input', { type: 'text', value: blk.activity, list: actList, onInput: (e: Event) => edit(() => (blk.activity = (e.target as HTMLInputElement).value)) })),
      labeled(
        'If blocked',
        select(ON_BLOCKED_LOCATION.map((o) => ({ value: o, label: o })), blk.onBlockedLocation, (v) =>
          edit(() => (blk.onBlockedLocation = v as OnBlockedLocation)),
        ),
      ),
      button('Remove', () => edit(() => (p.routine = p.routine.filter((x) => x !== blk)), 'structure'), 'danger'),
    ),
  );
  const generate = () => {
    if (p.routine.length && !confirm('Replace the current routine with a generated default?')) return;
    edit(() => {
      const ctx = resolveRoutineContext(p, store.selectedScenario);
      p.routine = generateRoutine(p, ctx);
    }, 'structure');
  };
  const scenarioNote = store.selectedScenario
    ? `Locations resolve against scenario "${store.selectedScenario.title || store.selectedScenario.scenarioId}".`
    : 'No scenario selected — falls back to the canonical office (break_room, hallway, <agent>_desk).';
  return section(
    'Routine',
    el('p', { className: 'hint' }, 'Default daily schedule — blocks create encounters and put preferences/needs in space.'),
    el('datalist', { id: locList }, ...LOCATION_SUGGESTIONS.map((l) => el('option', { value: l }))),
    el('datalist', { id: actList }, ...ACTIVITY_SUGGESTIONS.map((a) => el('option', { value: a }))),
    el(
      'div',
      { className: 'btn-row' },
      button('✨ Generate routine', generate, 'primary'),
      el('span', { className: 'hint' }, scenarioNote),
    ),
    ...rows,
    button('+ Routine block', () =>
      edit(() => {
        p.routine.push({
          startTime: '09:00',
          endTime: '10:00',
          locationId: LOCATION_SUGGESTIONS[0],
          activity: 'work',
          onBlockedLocation: 'wait_in_hallway',
        });
      }, 'structure'),
    ),
  );
}

function bindingSection(p: CharacterProfile): HTMLElement {
  return section(
    'Sprite binding',
    el('p', { className: 'hint' }, `Linked to sprite recipe "${p.spriteBinding.characterConfigId}" (auto-synced to this character).`),
    textField('Layer atlas id (Family/Recipe)', p.spriteBinding.layerAtlasId, (v) =>
      edit(() => (p.spriteBinding.layerAtlasId = v)),
    ),
  );
}

// --- public render entrypoints ---------------------------------------------

export function renderPersonaPreview(container: HTMLElement): void {
  clear(container);
  const recipe = store.selectedCharacter;
  if (!recipe) {
    container.append(el('p', { className: 'hint' }, 'Select or create a character.'));
    return;
  }
  const style = store.state.style;
  const hero = el('div', { className: 'preview-hero checker' });
  hero.innerHTML = composeCharacter(recipe, style, 'south', 224, 'normal', { badge: false });
  container.append(hero);

  const profile = store.selectedProfile;
  if (!profile) {
    container.append(el('p', { className: 'hint' }, `${recipe.name} has no persona yet.`));
    return;
  }
  const summary = el('div', { className: 'persona-summary' });
  const topNeed = [...NEEDS].sort((a, b) => profile.needs[b].sensitivity - profile.needs[a].sensitivity)[0];
  summary.append(
    el('div', {}, el('strong', {}, profile.identity.roleTitle || '—'), ` · ${profile.identity.department || '—'}`),
    el('div', {}, `Drive: ${profile.drives.primary || '—'}`),
    el('div', {}, `Strongest need: ${NEED_LABELS[topNeed]}`),
    el('div', { className: 'tag-chips' }, ...profile.personality.traitTags.map((t) => el('span', { className: 'tag-chip' }, t))),
  );
  container.append(summary);
}

export function renderPersonaControls(container: HTMLElement): void {
  clear(container);
  const recipe = store.selectedCharacter;
  if (!recipe) return;

  const profile = store.selectedProfile;
  if (!profile) {
    container.append(
      el('p', { className: 'hint' }, `No persona for ${recipe.name}.`),
      button('Create persona', () =>
        store.mutate((s) => {
          (s.profiles ??= []).push(createDefaultProfile(recipe));
        }, 'structure'),
        'primary',
      ),
    );
    return;
  }

  container.append(
    identitySection(profile),
    personalitySection(profile),
    needsSection(profile),
    drivesSection(profile),
    preferencesSection(profile),
    skillsSection(profile),
    relationshipsSection(profile),
    reactionsSection(profile),
    routineSection(profile),
    temperamentSection(profile),
    formativeSection(profile),
    bindingSection(profile),
    el(
      'div',
      { className: 'btn-row' },
      button('Validate', () => {
        const issues = validateProfile(profile, { agentIds: store.state.characters.map((c) => c.id) });
        alert(issues.length ? `Issues:\n\n${issues.join('\n')}` : 'No issues — profile is valid.');
      }),
      button('Profile JSON', () =>
        downloadJson(`${profile.agentId}-profile.json`, serializeProfile(profile)),
      ),
      button('Delete persona', () => {
        if (!confirm(`Delete ${recipe.name}'s persona?`)) return;
        store.mutate((s) => {
          s.profiles = (s.profiles ?? []).filter((p) => p.agentId !== profile.agentId);
        }, 'structure');
      }, 'danger'),
    ),
  );
}
