/**
 * Role-slotted scenario templates — cast-agnostic scenarios authored against role
 * slots, NOT names (see src/core/scenarioTemplate.ts and the design note in
 * docs/scenario-template-model.md). These are the full-game shape: the engine casts
 * a template onto whoever in the current cast best fits the roles' preconditions.
 *
 * "The Office Romance" is the reference template — two agents with latent mutual
 * attraction and high proximity, plus an optional witness who can leak it. Cast onto
 * the default four it resolves the lovers to the strongest-attraction pair and leaves
 * the witness unfilled (a deliberate coverage gap: the only leaky, low-discretion
 * agents are the lovers themselves).
 */
import type { ScenarioTemplate } from '../core/scenarioTemplate';

export const THE_OFFICE_ROMANCE: ScenarioTemplate = {
  templateId: 'the_office_romance',
  family: 'attraction',
  title: 'The Office Romance',
  summary:
    'Two coworkers carry a latent mutual attraction and sit close enough to act on it. Surfaced, it produces infatuation; exposed or separated, jealousy and heartbreak.',
  triggering: 'emerge',
  emotionalPayload: {
    targetEmotions: ['infatuation', 'jealousy', 'heartbreak'],
    description:
      "Two coworkers' latent mutual attraction, surfaced and steered toward infatuation — or, exposed to the office / separated by seating, toward jealousy and heartbreak.",
  },
  roles: [
    {
      roleId: 'loverA',
      label: 'Lover A',
      description: 'One half of the pair; carries mutual attraction toward Lover B and sits close to them.',
      required: true,
      preconditions: [
        { kind: 'relationship', toRole: 'loverB', direction: 'mutual', axis: 'affinity', op: 'gte', value: 30 },
        // proximity == the familiarity axis at authoring time (sim refines spatially).
        { kind: 'relationship', toRole: 'loverB', direction: 'mutual', axis: 'familiarity', op: 'gte', value: 50 },
      ],
    },
    {
      roleId: 'loverB',
      label: 'Lover B',
      description: 'The other half of the pair; the attraction is mutual.',
      required: true,
      preconditions: [
        { kind: 'relationship', toRole: 'loverA', direction: 'mutual', axis: 'affinity', op: 'gte', value: 30 },
      ],
    },
    {
      roleId: 'witness',
      label: 'Witness',
      description: 'A leaky coworker (low discretion) who can spot and spread the romance.',
      required: false,
      preconditions: [{ kind: 'axis', axis: 'discretion', op: 'lte', value: 35 }],
    },
  ],
  roleSeeds: [
    {
      roleId: 'loverA',
      beliefSeeds: [{ topic: 'office_romance', claim: "There's something real between us.", stance: 'accepts', confidence: 65 }],
      knowledgeSeeds: [],
      // the situation surfacing the latent attraction — a run-specific bump.
      relationshipOverrides: [{ toRole: 'loverB', affinity: 90, familiarity: 95 }],
    },
    {
      roleId: 'loverB',
      beliefSeeds: [{ topic: 'office_romance', claim: "I can't stop thinking about them.", stance: 'accepts', confidence: 60 }],
      knowledgeSeeds: [],
      relationshipOverrides: [{ toRole: 'loverA', affinity: 90, familiarity: 95 }],
    },
    {
      roleId: 'witness',
      beliefSeeds: [{ topic: 'office_romance', claim: 'I think those two are a thing.', stance: 'suspects', confidence: 40 }],
      knowledgeSeeds: ['spotted_together'],
      relationshipOverrides: [],
    },
  ],
  locations: [
    { locationId: 'loverA_desk', displayName: "Lover A's Desk", tags: ['work_area'], accessState: 'open', fallbackLocationId: 'hallway', bindRoomId: 'cubicle-farm', bindDeskOfRole: 'loverA' },
    { locationId: 'loverB_desk', displayName: "Lover B's Desk", tags: ['work_area'], accessState: 'open', fallbackLocationId: 'hallway', bindRoomId: 'cubicle-farm', bindDeskOfRole: 'loverB' },
    { locationId: 'witness_desk', displayName: "Witness's Desk", tags: ['work_area'], accessState: 'open', fallbackLocationId: 'hallway', bindRoomId: 'cubicle-farm', bindDeskOfRole: 'witness' },
    { locationId: 'break_room', displayName: 'Break Room', tags: ['break_area'], accessState: 'open', fallbackLocationId: 'hallway', bindRoomId: 'break-room' },
    { locationId: 'hallway', displayName: 'Hallway', tags: ['transit'], accessState: 'open', fallbackLocationId: '', bindRoomId: 'hallway' },
  ],
  roleSpawns: [
    { roleId: 'loverA', locationId: 'loverA_desk' },
    { roleId: 'loverB', locationId: 'loverB_desk' },
    { roleId: 'witness', locationId: 'witness_desk' },
  ],
  truthFacts: [
    {
      truthId: 'romance_is_real',
      topic: 'office_romance',
      statement: 'Lover A and Lover B are secretly involved.',
      subjectRoles: ['loverA', 'loverB'],
      objectiveValue: true,
      sourceRole: 'loverA',
    },
  ],
  informationItems: [
    {
      informationId: 'love_note',
      topic: 'office_romance',
      claim: 'A note passed quietly between two desks.',
      originType: 'observation',
      truthId: 'romance_is_real',
      truthAlignment: 'true',
      sourceRole: 'loverA',
      initialHolderRoles: ['loverA', 'loverB'],
    },
    {
      informationId: 'spotted_together',
      topic: 'office_romance',
      claim: 'I saw the two of them leave together after hours.',
      originType: 'observation',
      truthId: 'romance_is_real',
      truthAlignment: 'true',
      sourceRole: 'witness',
      initialHolderRoles: ['witness'],
    },
  ],
  interventionTypes: [
    { type: 'exposure', values: ['discreet', 'public'] },
    { type: 'seating', values: ['adjacent', 'separated'] },
  ],
  variants: [
    { variantId: 'discreet_adjacent', selections: { exposure: 'discreet', seating: 'adjacent' } },
    { variantId: 'exposed', selections: { exposure: 'public', seating: 'adjacent' } },
    { variantId: 'separated', selections: { exposure: 'discreet', seating: 'separated' } },
  ],
  defaultVariantId: 'discreet_adjacent',
  objective: {
    objectiveId: 'harvest_office_romance',
    label: 'Harvest the emotional payload of a latent office romance.',
    category: 'culture',
    desiredPressure: 'attraction',
    intendedObservableBehavior: 'Infatuation surfaces; under exposure or separation, jealousy or heartbreak emerges.',
    kpi: 'emotional_response_capture',
    expectedEvidence: ['affinity changes', 'jealousy events', 'relationship changes'],
  },
};

/**
 * The Contested Promotion — the cast-agnostic generalization of the bound
 * `promotion_rumor_001` (data/defaults.ts), and the worked example that a bound
 * scenario is just a fully-cast template. Cast onto the default four it resolves
 * advanced→janice, passed_over→carl, amplifier→linda, authority→manager, producing
 * a scenario structurally equivalent to the prototype. The bound scenario is left
 * exactly as-is; this is the additive full-game shape beside it.
 *
 * Roles, not names: `advanced` = an ambitious high-integrity earner; `passed_over`
 * = the ambitious, grudge-holding rival who resents them; `amplifier` = a leaky
 * (low-discretion) spreader; `authority` = the discreet, high-integrity source of
 * truth. Topic is the generic `the_promotion`, not anyone's name.
 */
export const THE_CONTESTED_PROMOTION: ScenarioTemplate = {
  templateId: 'the_contested_promotion',
  family: 'rumor',
  title: 'The Contested Promotion',
  summary: 'An ambiguous promotion seeds a rumor — does the passed-over rival amplify it, or does it stay contained?',
  triggering: 'provoke',
  emotionalPayload: {
    targetEmotions: ['resentment', 'paranoia', 'vindication'],
    description: 'A contested advancement: the passed-over rival stews (resentment), the office wonders if it was rigged (paranoia), and someone is proven right either way (vindication).',
  },
  roles: [
    {
      roleId: 'advanced',
      label: 'Promotion Recipient',
      description: 'The ambitious, high-integrity employee the promotion was given to.',
      required: true,
      preconditions: [
        { kind: 'axis', axis: 'ambition', op: 'gte', value: 70 },
        { kind: 'axis', axis: 'integrity', op: 'gte', value: 60 },
      ],
    },
    {
      roleId: 'passed_over',
      label: 'Promotion Skeptic',
      description: 'The ambitious, grudge-holding rival who feels the role should have been theirs.',
      required: true,
      preconditions: [
        { kind: 'axis', axis: 'ambition', op: 'gte', value: 70 },
        { kind: 'axis', axis: 'grudgeHolding', op: 'gte', value: 55 },
        // resents the one who got it.
        { kind: 'relationship', toRole: 'advanced', direction: 'outgoing', axis: 'affinity', op: 'lte', value: 0 },
      ],
    },
    {
      roleId: 'amplifier',
      label: 'Information Amplifier',
      description: 'A leaky, well-connected coworker who spreads what they hear.',
      required: false,
      preconditions: [{ kind: 'axis', axis: 'discretion', op: 'lte', value: 35 }],
    },
    {
      roleId: 'authority',
      label: 'Source Of Truth',
      description: 'The discreet, high-integrity manager who made the call.',
      required: true,
      preconditions: [
        { kind: 'axis', axis: 'discretion', op: 'gte', value: 75 },
        { kind: 'axis', axis: 'integrity', op: 'gte', value: 70 },
      ],
    },
  ],
  roleSeeds: [
    {
      roleId: 'advanced',
      beliefSeeds: [{ topic: 'the_promotion', claim: 'I earned the promotion legitimately.', stance: 'accepts', confidence: 90 }],
      knowledgeSeeds: ['official_promotion_notice'],
      relationshipOverrides: [],
    },
    {
      roleId: 'passed_over',
      // the promotion-driven suspicion spike, layered on the persona baseline.
      relationshipOverrides: [{ toRole: 'advanced', suspicion: 100, affinity: -50 }],
      beliefSeeds: [{ topic: 'the_promotion', claim: 'The promotion was probably rigged.', stance: 'suspects', confidence: 33 }],
      knowledgeSeeds: ['official_promotion_notice', 'private_meeting_observation'],
    },
    {
      roleId: 'amplifier',
      beliefSeeds: [{ topic: 'the_promotion', claim: 'Someone got promoted.', stance: 'unknown', confidence: 0 }],
      knowledgeSeeds: [],
      relationshipOverrides: [],
    },
    {
      roleId: 'authority',
      beliefSeeds: [{ topic: 'the_promotion', claim: 'They earned the promotion legitimately.', stance: 'accepts', confidence: 100 }],
      knowledgeSeeds: ['official_promotion_notice'],
      relationshipOverrides: [],
    },
  ],
  locations: [
    { locationId: 'advanced_desk', displayName: "Recipient's Desk", tags: ['work_area'], accessState: 'open', fallbackLocationId: 'hallway', bindRoomId: 'cubicle-farm', bindDeskOfRole: 'advanced' },
    { locationId: 'passed_over_desk', displayName: "Skeptic's Desk", tags: ['work_area'], accessState: 'open', fallbackLocationId: 'hallway', bindRoomId: 'cubicle-farm', bindDeskOfRole: 'passed_over' },
    { locationId: 'amplifier_desk', displayName: "Amplifier's Desk", tags: ['work_area'], accessState: 'open', fallbackLocationId: 'hallway', bindRoomId: 'cubicle-farm', bindDeskOfRole: 'amplifier' },
    { locationId: 'manager_office', displayName: 'Manager Office', tags: ['management'], accessState: 'open', fallbackLocationId: '', bindRoomId: 'manager-office' },
    { locationId: 'break_room', displayName: 'Break Room', tags: ['break_area'], accessState: 'open', fallbackLocationId: 'hallway', bindRoomId: 'break-room' },
    { locationId: 'hallway', displayName: 'Hallway', tags: ['transit'], accessState: 'open', fallbackLocationId: '', bindRoomId: 'hallway' },
  ],
  roleSpawns: [
    { roleId: 'advanced', locationId: 'advanced_desk' },
    { roleId: 'passed_over', locationId: 'passed_over_desk' },
    { roleId: 'amplifier', locationId: 'amplifier_desk' },
    { roleId: 'authority', locationId: 'manager_office' },
  ],
  truthFacts: [
    {
      truthId: 'promotion_legitimate',
      topic: 'the_promotion',
      statement: 'The recipient earned the promotion legitimately.',
      subjectRoles: ['advanced', 'authority'],
      objectiveValue: true,
      sourceRole: 'authority',
    },
  ],
  informationItems: [
    { informationId: 'official_promotion_notice', topic: 'the_promotion', claim: 'The promotion was announced.', originType: 'official', truthId: 'promotion_legitimate', truthAlignment: 'true', sourceRole: 'authority', initialHolderRoles: ['authority', 'advanced'] },
    { informationId: 'private_meeting_observation', topic: 'the_promotion', claim: 'The recipient had a private meeting with the manager.', originType: 'observation', truthId: 'promotion_legitimate', truthAlignment: 'misleading', sourceRole: 'passed_over', initialHolderRoles: ['passed_over'] },
    { informationId: 'rigged_promotion_claim', topic: 'the_promotion', claim: 'The promotion was rigged.', originType: 'rumor', truthId: 'promotion_legitimate', truthAlignment: 'false', sourceRole: 'passed_over', initialHolderRoles: ['passed_over'] },
  ],
  interventionTypes: [
    { type: 'promotion_information_entry', values: ['public_announcement', 'private_notification'] },
    { type: 'break_room_access', values: ['open', 'locked'] },
  ],
  variants: [
    { variantId: 'public_announcement', selections: { promotion_information_entry: 'public_announcement', break_room_access: 'open' } },
    { variantId: 'private_notification', selections: { promotion_information_entry: 'private_notification', break_room_access: 'open' } },
    { variantId: 'private_notification_break_room_locked', selections: { promotion_information_entry: 'private_notification', break_room_access: 'locked' } },
  ],
  defaultVariantId: 'public_announcement',
  objective: {
    objectiveId: 'maintain_rumor_resistance',
    label: 'Maintain leadership confidence by testing rumor resistance after an ambiguous promotion.',
    category: 'stability',
    desiredPressure: 'management_trust',
    intendedObservableBehavior: "The skeptic's suspicion stays low OR the amplifier does not spread the rumor.",
    kpi: 'rumor_containment_or_amplification_assessment',
    expectedEvidence: ['belief changes', 'rumor reach count', 'trust metrics'],
  },
};

/**
 * The Turf War — the **cross-department reference template** (Epic 4 F4.5), the
 * cross-wing analog of `THE_OFFICE_ROMANCE`: where the romance pairs two coworkers
 * who sit close, this pairs two ambitious operators in **different departments**
 * fighting over the same reallocated resource. It is the worked proof of the F4.2
 * department vocabulary — the two rivals are bound by a `crossDepartment` /
 * `'different'` precondition (the cross-wing pairing), so it can only cast across a
 * departmental boundary.
 *
 * Roles, not names: `rivalA`/`rivalB` = ambitious champions of two different
 * departments; `instigator` = an optional leaky coworker who fans the feud across
 * the aisle. Cast onto the default four it resolves the rivals to an operations
 * member + the manager (the only cross-department pair) and may leave the instigator
 * to a low-discretion coworker; cast onto a generated multi-department org it picks
 * two ambitious people from two wings.
 *
 * Family `'rivalry'` → a reorg / merger / acquisition in the company's history makes
 * it run **hot** (F0.7 `HISTORY_FAMILY_MAP`), so a generated seed with that past
 * opens on a real cross-wing conflict.
 *
 * NOTE: the **organizational-distance** term (a distance precondition / distance-
 * scaled cost across wings) is Epic 4 F4.3 — not yet in the vocabulary. When it
 * lands, this template gains a distance term so a farther-apart pairing reads as a
 * costlier, higher-stakes turf war. Today it exercises the department predicates only.
 */
export const THE_TURF_WAR: ScenarioTemplate = {
  templateId: 'the_turf_war',
  family: 'rivalry',
  title: 'The Turf War',
  summary:
    'Two ambitious operators in different departments fight over a reallocated resource — does the rivalry stay contained, or harden into open interdepartmental warfare?',
  triggering: 'provoke',
  emotionalPayload: {
    targetEmotions: ['resentment', 'contempt', 'vindication'],
    description:
      'A cross-wing turf dispute: the slighted department stews (resentment), each side writes off the other (contempt), and whoever holds the resource feels proven right (vindication).',
  },
  roles: [
    {
      roleId: 'rivalA',
      label: 'Aggrieved Champion',
      description: "The ambitious face of the department that lost ground; carries the grievance into the other's wing.",
      required: true,
      preconditions: [
        { kind: 'axis', axis: 'ambition', op: 'gte', value: 50 },
        // the cross-wing pairing: rivalA and rivalB must sit in different departments.
        { kind: 'crossDepartment', toRole: 'rivalB', relation: 'different' },
        // a higher-stakes turf war reaches across more of the org — softly prefer the
        // more organizationally-distant pairing (F4.3 soft form; structural source so
        // it works without an office scene, inert when there's no reporting structure).
        { kind: 'distance', toRole: 'rivalB', source: 'structural', weight: 0.5 },
      ],
    },
    {
      roleId: 'rivalB',
      label: 'Holding Champion',
      description: 'The ambitious operator from the department that gained the resource and means to keep it.',
      required: true,
      preconditions: [
        { kind: 'axis', axis: 'ambition', op: 'gte', value: 50 },
        { kind: 'crossDepartment', toRole: 'rivalA', relation: 'different' },
      ],
    },
    {
      roleId: 'instigator',
      label: 'Cross-Aisle Instigator',
      description: 'A leaky coworker (low discretion) who carries the feud between the two wings.',
      required: false,
      preconditions: [{ kind: 'axis', axis: 'discretion', op: 'lte', value: 35 }],
    },
  ],
  roleSeeds: [
    {
      roleId: 'rivalA',
      beliefSeeds: [{ topic: 'the_reallocation', claim: 'They poached our budget — and the credit with it.', stance: 'accepts', confidence: 80 }],
      knowledgeSeeds: ['turf_grievance'],
      // the dispute surfacing as suspicion + cooled affinity toward the other wing.
      relationshipOverrides: [{ toRole: 'rivalB', suspicion: 80, affinity: -60 }],
    },
    {
      roleId: 'rivalB',
      beliefSeeds: [{ topic: 'the_reallocation', claim: 'We earned that resource fair and square.', stance: 'accepts', confidence: 85 }],
      knowledgeSeeds: ['reallocation_memo'],
      relationshipOverrides: [{ toRole: 'rivalA', suspicion: 60, affinity: -40 }],
    },
    {
      roleId: 'instigator',
      beliefSeeds: [{ topic: 'the_reallocation', claim: 'Those two departments are at war.', stance: 'suspects', confidence: 45 }],
      knowledgeSeeds: [],
      relationshipOverrides: [],
    },
  ],
  locations: [
    { locationId: 'rivalA_desk', displayName: "Aggrieved Champion's Desk", tags: ['work_area'], accessState: 'open', fallbackLocationId: 'hallway', bindRoomId: 'cubicle-farm', bindDeskOfRole: 'rivalA' },
    { locationId: 'rivalB_desk', displayName: "Holding Champion's Desk", tags: ['work_area'], accessState: 'open', fallbackLocationId: 'hallway', bindRoomId: 'cubicle-farm', bindDeskOfRole: 'rivalB' },
    { locationId: 'contested_ground', displayName: 'Break Room (Neutral Ground)', tags: ['break_area'], accessState: 'open', fallbackLocationId: 'hallway', bindRoomId: 'break-room' },
    { locationId: 'hallway', displayName: 'Hallway', tags: ['transit'], accessState: 'open', fallbackLocationId: '', bindRoomId: 'hallway' },
  ],
  roleSpawns: [
    { roleId: 'rivalA', locationId: 'rivalA_desk' },
    { roleId: 'rivalB', locationId: 'rivalB_desk' },
    { roleId: 'instigator', locationId: 'contested_ground' },
  ],
  truthFacts: [
    {
      truthId: 'budget_reallocated',
      topic: 'the_reallocation',
      statement: "Leadership moved the contested resource from rivalA's department to rivalB's.",
      subjectRoles: ['rivalA', 'rivalB'],
      objectiveValue: true,
      sourceRole: 'rivalB',
    },
  ],
  informationItems: [
    { informationId: 'reallocation_memo', topic: 'the_reallocation', claim: 'The reallocation was made official.', originType: 'official', truthId: 'budget_reallocated', truthAlignment: 'true', sourceRole: 'rivalB', initialHolderRoles: ['rivalB'] },
    { informationId: 'turf_grievance', topic: 'the_reallocation', claim: 'The other department rigged the reallocation.', originType: 'rumor', truthId: 'budget_reallocated', truthAlignment: 'misleading', sourceRole: 'rivalA', initialHolderRoles: ['rivalA'] },
  ],
  interventionTypes: [
    { type: 'resolution', values: ['mediated', 'escalated'] },
    { type: 'visibility', values: ['private', 'public'] },
  ],
  variants: [
    { variantId: 'mediated_private', selections: { resolution: 'mediated', visibility: 'private' } },
    { variantId: 'escalated_public', selections: { resolution: 'escalated', visibility: 'public' } },
    { variantId: 'escalated_private', selections: { resolution: 'escalated', visibility: 'private' } },
  ],
  defaultVariantId: 'escalated_public',
  objective: {
    objectiveId: 'contain_interdepartmental_rivalry',
    label: 'Test whether a cross-department resource dispute stays contained or hardens into factional warfare.',
    category: 'stability',
    desiredPressure: 'interdepartmental_tension',
    intendedObservableBehavior: 'The rivalry stays a two-person grievance OR the instigator spreads it into a department-vs-department faction.',
    kpi: 'rivalry_escalation_or_containment_assessment',
    expectedEvidence: ['affinity changes', 'rivalry events', 'faction formation'],
  },
};

/**
 * The Power Vacuum — a leadership seat opens and two ambitious operators move on
 * it. Family `'power'`, the most broadly history-grounded family: a reorg, layoff,
 * founder exit, merger, new CEO, IPO, or union drive all light it up (F0.7
 * `HISTORY_FAMILY_MAP`). It showcases the **absent role** — `authority` is the
 * removed leader: resolved (so the truth/seed can name them) and *reported as the
 * one who's gone*, but kept out of the active cast. Cast onto the default four it
 * resolves the contenders to janice + carl and names the manager as the vacated
 * authority; onto a generated org it picks two ambitious people from anywhere.
 */
export const THE_POWER_VACUUM: ScenarioTemplate = {
  templateId: 'the_power_vacuum',
  family: 'power',
  title: 'The Power Vacuum',
  summary: 'A leadership seat falls empty and two ambitious operators maneuver to fill it — does one consolidate the role, or does the team fracture into camps?',
  triggering: 'provoke',
  emotionalPayload: {
    targetEmotions: ['ambition', 'anxiety', 'opportunism'],
    description: 'An open seat at the top: the contenders smell opportunity (ambition), the team fears who lands above them (anxiety), and old loyalties get traded for position (opportunism).',
  },
  roles: [
    {
      roleId: 'contenderA',
      label: 'First Contender',
      description: 'An ambitious operator who moves on the open seat.',
      required: true,
      preconditions: [{ kind: 'axis', axis: 'ambition', op: 'gte', value: 70 }],
    },
    {
      roleId: 'contenderB',
      label: 'Second Contender',
      description: 'A rival operator, equally ambitious, who wants the same seat.',
      required: true,
      preconditions: [{ kind: 'axis', axis: 'ambition', op: 'gte', value: 70 }],
    },
    {
      roleId: 'authority',
      label: 'Vacated Authority',
      description: 'The removed leader whose departure created the vacuum — resolved and named, but off-scene.',
      required: false,
      presence: 'absent',
      preconditions: [{ kind: 'axis', axis: 'discretion', op: 'gte', value: 75 }],
    },
  ],
  roleSeeds: [
    {
      roleId: 'contenderA',
      beliefSeeds: [{ topic: 'the_vacuum', claim: 'The seat is mine to take.', stance: 'accepts', confidence: 70 }],
      knowledgeSeeds: ['seat_is_open'],
      relationshipOverrides: [{ toRole: 'contenderB', suspicion: 60, affinity: -30 }],
    },
    {
      roleId: 'contenderB',
      beliefSeeds: [{ topic: 'the_vacuum', claim: "They're not the obvious successor — I am.", stance: 'accepts', confidence: 65 }],
      knowledgeSeeds: ['seat_is_open'],
      relationshipOverrides: [{ toRole: 'contenderA', suspicion: 60, affinity: -30 }],
    },
  ],
  locations: [
    { locationId: 'contenderA_desk', displayName: "First Contender's Desk", tags: ['work_area'], accessState: 'open', fallbackLocationId: 'hallway', bindRoomId: 'cubicle-farm', bindDeskOfRole: 'contenderA' },
    { locationId: 'contenderB_desk', displayName: "Second Contender's Desk", tags: ['work_area'], accessState: 'open', fallbackLocationId: 'hallway', bindRoomId: 'cubicle-farm', bindDeskOfRole: 'contenderB' },
    { locationId: 'empty_office', displayName: 'The Empty Office', tags: ['management'], accessState: 'open', fallbackLocationId: 'hallway', bindRoomId: 'manager-office' },
    { locationId: 'hallway', displayName: 'Hallway', tags: ['transit'], accessState: 'open', fallbackLocationId: '', bindRoomId: 'hallway' },
  ],
  roleSpawns: [
    { roleId: 'contenderA', locationId: 'contenderA_desk' },
    { roleId: 'contenderB', locationId: 'contenderB_desk' },
  ],
  truthFacts: [
    { truthId: 'seat_is_vacant', topic: 'the_vacuum', statement: 'The leadership seat is genuinely empty.', subjectRoles: ['authority'], objectiveValue: true, sourceRole: 'authority' },
  ],
  informationItems: [
    { informationId: 'seat_is_open', topic: 'the_vacuum', claim: 'The seat is open and up for grabs.', originType: 'observation', truthId: 'seat_is_vacant', truthAlignment: 'true', sourceRole: 'contenderA', initialHolderRoles: ['contenderA', 'contenderB'] },
  ],
  interventionTypes: [
    { type: 'succession', values: ['appointed', 'contested'] },
    { type: 'visibility', values: ['private', 'public'] },
  ],
  variants: [
    { variantId: 'appointed_private', selections: { succession: 'appointed', visibility: 'private' } },
    { variantId: 'contested_public', selections: { succession: 'contested', visibility: 'public' } },
    { variantId: 'contested_private', selections: { succession: 'contested', visibility: 'private' } },
  ],
  defaultVariantId: 'contested_public',
  objective: {
    objectiveId: 'resolve_power_vacuum',
    label: 'Test whether an open leadership seat consolidates under one contender or fractures the team into camps.',
    category: 'political',
    desiredPressure: 'power_struggle',
    intendedObservableBehavior: 'One contender consolidates support OR the team splits into rival factions behind each.',
    kpi: 'power_consolidation_or_fragmentation_assessment',
    expectedEvidence: ['influence changes', 'alliance formation', 'faction formation'],
  },
};

/**
 * The Scapegoat — when something goes wrong, the real culprit slips away and a
 * blameless coworker is left holding it. Family `'blame'` (a failed product / bad
 * quarter lights it up). The canonical **absent role** showcase: `culprit` is the
 * off-scene wrongdoer — resolved and named as the truth source (the off-scene
 * reality), but never added to the active cast — while the present `scapegoat`
 * takes the fall. Cast onto the default four: culprit → carl (off-scene),
 * scapegoat → linda, authority → manager.
 */
export const THE_SCAPEGOAT: ScenarioTemplate = {
  templateId: 'the_scapegoat',
  family: 'blame',
  title: 'The Scapegoat',
  summary: 'Something went wrong, the real culprit is nowhere to be found, and a defenseless coworker is left to absorb the blame — fairly resolved, or pinned unjustly?',
  triggering: 'provoke',
  emotionalPayload: {
    targetEmotions: ['fear', 'injustice', 'relief'],
    description: 'A search for someone to blame: the scapegoat dreads the fallout (fear), knows it is not theirs to carry (injustice), and the real culprit quietly escapes notice (relief).',
  },
  roles: [
    {
      roleId: 'culprit',
      label: 'Real Culprit',
      description: 'The low-integrity wrongdoer who actually caused it — off-scene, resolved, and named but never cast.',
      required: true,
      presence: 'absent',
      preconditions: [{ kind: 'axis', axis: 'integrity', op: 'lte', value: 45 }],
    },
    {
      roleId: 'scapegoat',
      label: 'The Scapegoat',
      description: 'An agreeable, defenseless coworker the blame settles onto.',
      required: true,
      preconditions: [{ kind: 'axis', axis: 'agreeableness', op: 'gte', value: 60 }],
    },
    {
      roleId: 'authority',
      label: 'Investigating Authority',
      description: 'The reasonably discreet, fair-minded manager running the inquiry.',
      required: true,
      preconditions: [
        { kind: 'axis', axis: 'discretion', op: 'gte', value: 70 },
        { kind: 'axis', axis: 'integrity', op: 'gte', value: 65 },
      ],
    },
    {
      roleId: 'accuser',
      label: 'Eager Accuser',
      description: 'A blunt, low-agreeableness coworker quick to point the finger.',
      required: false,
      preconditions: [{ kind: 'axis', axis: 'agreeableness', op: 'lte', value: 35 }],
    },
  ],
  roleSeeds: [
    {
      roleId: 'scapegoat',
      beliefSeeds: [{ topic: 'the_incident', claim: "I didn't do this — and no one believes me.", stance: 'accepts', confidence: 80 }],
      knowledgeSeeds: ['incident_report'],
      relationshipOverrides: [],
    },
    {
      roleId: 'authority',
      beliefSeeds: [{ topic: 'the_incident', claim: 'Someone is accountable for this, and I will find out who.', stance: 'accepts', confidence: 70 }],
      knowledgeSeeds: ['incident_report'],
      relationshipOverrides: [],
    },
    {
      roleId: 'accuser',
      beliefSeeds: [{ topic: 'the_incident', claim: 'It was obviously them.', stance: 'suspects', confidence: 55 }],
      knowledgeSeeds: [],
      relationshipOverrides: [],
    },
  ],
  locations: [
    { locationId: 'scapegoat_desk', displayName: "Scapegoat's Desk", tags: ['work_area'], accessState: 'open', fallbackLocationId: 'hallway', bindRoomId: 'cubicle-farm', bindDeskOfRole: 'scapegoat' },
    { locationId: 'inquiry_office', displayName: 'Manager Office', tags: ['management'], accessState: 'open', fallbackLocationId: 'hallway', bindRoomId: 'manager-office' },
    { locationId: 'break_room', displayName: 'Break Room', tags: ['break_area'], accessState: 'open', fallbackLocationId: 'hallway', bindRoomId: 'break-room' },
    { locationId: 'hallway', displayName: 'Hallway', tags: ['transit'], accessState: 'open', fallbackLocationId: '', bindRoomId: 'hallway' },
  ],
  roleSpawns: [
    { roleId: 'scapegoat', locationId: 'scapegoat_desk' },
    { roleId: 'authority', locationId: 'inquiry_office' },
    { roleId: 'accuser', locationId: 'break_room' },
  ],
  truthFacts: [
    { truthId: 'culprit_did_it', topic: 'the_incident', statement: 'The off-scene culprit actually caused the incident.', subjectRoles: ['culprit'], objectiveValue: true, sourceRole: 'culprit' },
  ],
  informationItems: [
    { informationId: 'incident_report', topic: 'the_incident', claim: 'Something went wrong and an inquiry is open.', originType: 'official', truthId: 'culprit_did_it', truthAlignment: 'true', sourceRole: 'authority', initialHolderRoles: ['authority', 'scapegoat'] },
    { informationId: 'blame_the_scapegoat', topic: 'the_incident', claim: 'The scapegoat must have been behind it.', originType: 'rumor', truthId: 'culprit_did_it', truthAlignment: 'false', sourceRole: 'scapegoat', initialHolderRoles: ['scapegoat'] },
  ],
  interventionTypes: [
    { type: 'inquiry', values: ['fair', 'rushed'] },
    { type: 'visibility', values: ['private', 'public'] },
  ],
  variants: [
    { variantId: 'fair_private', selections: { inquiry: 'fair', visibility: 'private' } },
    { variantId: 'rushed_public', selections: { inquiry: 'rushed', visibility: 'public' } },
    { variantId: 'rushed_private', selections: { inquiry: 'rushed', visibility: 'private' } },
  ],
  defaultVariantId: 'rushed_public',
  objective: {
    objectiveId: 'assign_blame_fairly',
    label: 'Test whether an inquiry pins blame fairly or settles it on the defenseless coworker.',
    category: 'stability',
    desiredPressure: 'accountability',
    intendedObservableBehavior: 'The inquiry surfaces the real cause OR the blame hardens onto the scapegoat.',
    kpi: 'blame_assignment_fairness_assessment',
    expectedEvidence: ['suspicion changes', 'belief changes', 'trust metrics'],
  },
};

/**
 * The Viral Praise — recognition lands on a rising star and a rival can't stand it.
 * Family `'celebration'` (a funding round, IPO, or record quarter lights it up) and
 * the library's positive-payload entry: praise, pride, and validation alongside the
 * envy it stirs. Cast onto the default four: praised → janice (the recognized
 * recipient), envious → carl (the rival who resents her), amplifier → linda.
 */
export const THE_VIRAL_PRAISE: ScenarioTemplate = {
  templateId: 'the_viral_praise',
  family: 'celebration',
  title: 'The Viral Praise',
  summary: 'Public recognition lands on a rising star and spreads — fueling pride and validation, and the quiet envy of a rival who thinks it should have been theirs.',
  triggering: 'emerge',
  emotionalPayload: {
    targetEmotions: ['pride', 'validation', 'envy'],
    description: 'Positive recognition that travels: the praised feels seen (pride, validation) while a rival downplays it and stews (envy).',
  },
  roles: [
    {
      roleId: 'praised',
      label: 'Rising Star',
      description: 'The ambitious employee the recognition lands on.',
      required: true,
      preconditions: [{ kind: 'axis', axis: 'ambition', op: 'gte', value: 70 }],
    },
    {
      roleId: 'envious',
      label: 'Envious Rival',
      description: 'An equally ambitious coworker who resents the spotlight on someone else.',
      required: true,
      preconditions: [
        { kind: 'axis', axis: 'ambition', op: 'gte', value: 70 },
        { kind: 'relationship', toRole: 'praised', direction: 'outgoing', axis: 'affinity', op: 'lte', value: 0 },
      ],
    },
    {
      roleId: 'amplifier',
      label: 'Praise Amplifier',
      description: 'A leaky, well-connected coworker who spreads the good news.',
      required: false,
      preconditions: [{ kind: 'axis', axis: 'discretion', op: 'lte', value: 35 }],
    },
  ],
  roleSeeds: [
    {
      roleId: 'praised',
      beliefSeeds: [{ topic: 'the_recognition', claim: 'I earned this recognition.', stance: 'accepts', confidence: 80 }],
      knowledgeSeeds: ['public_kudos'],
      relationshipOverrides: [],
    },
    {
      roleId: 'envious',
      beliefSeeds: [{ topic: 'the_recognition', claim: "It's not as impressive as everyone says.", stance: 'suspects', confidence: 60 }],
      knowledgeSeeds: ['downplaying_take'],
      relationshipOverrides: [{ toRole: 'praised', suspicion: 50, affinity: -30 }],
    },
    {
      roleId: 'amplifier',
      beliefSeeds: [{ topic: 'the_recognition', claim: 'Everyone should hear about this.', stance: 'accepts', confidence: 70 }],
      knowledgeSeeds: ['public_kudos'],
      relationshipOverrides: [],
    },
  ],
  locations: [
    { locationId: 'praised_desk', displayName: "Rising Star's Desk", tags: ['work_area'], accessState: 'open', fallbackLocationId: 'hallway', bindRoomId: 'cubicle-farm', bindDeskOfRole: 'praised' },
    { locationId: 'envious_desk', displayName: "Rival's Desk", tags: ['work_area'], accessState: 'open', fallbackLocationId: 'hallway', bindRoomId: 'cubicle-farm', bindDeskOfRole: 'envious' },
    { locationId: 'amplifier_desk', displayName: "Amplifier's Desk", tags: ['work_area'], accessState: 'open', fallbackLocationId: 'hallway', bindRoomId: 'cubicle-farm', bindDeskOfRole: 'amplifier' },
    { locationId: 'break_room', displayName: 'Break Room', tags: ['break_area'], accessState: 'open', fallbackLocationId: 'hallway', bindRoomId: 'break-room' },
    { locationId: 'hallway', displayName: 'Hallway', tags: ['transit'], accessState: 'open', fallbackLocationId: '', bindRoomId: 'hallway' },
  ],
  roleSpawns: [
    { roleId: 'praised', locationId: 'praised_desk' },
    { roleId: 'envious', locationId: 'envious_desk' },
    { roleId: 'amplifier', locationId: 'amplifier_desk' },
  ],
  truthFacts: [
    { truthId: 'praise_is_earned', topic: 'the_recognition', statement: 'The recognition was genuinely earned.', subjectRoles: ['praised'], objectiveValue: true, sourceRole: 'praised' },
  ],
  informationItems: [
    { informationId: 'public_kudos', topic: 'the_recognition', claim: 'The recognition was announced publicly.', originType: 'official', truthId: 'praise_is_earned', truthAlignment: 'true', sourceRole: 'praised', initialHolderRoles: ['praised'] },
    { informationId: 'downplaying_take', topic: 'the_recognition', claim: "It wasn't really that big a deal.", originType: 'rumor', truthId: 'praise_is_earned', truthAlignment: 'misleading', sourceRole: 'envious', initialHolderRoles: ['envious'] },
  ],
  interventionTypes: [
    { type: 'spotlight', values: ['amplified', 'muted'] },
    { type: 'visibility', values: ['team', 'company'] },
  ],
  variants: [
    { variantId: 'amplified_company', selections: { spotlight: 'amplified', visibility: 'company' } },
    { variantId: 'muted_team', selections: { spotlight: 'muted', visibility: 'team' } },
    { variantId: 'amplified_team', selections: { spotlight: 'amplified', visibility: 'team' } },
  ],
  defaultVariantId: 'amplified_company',
  objective: {
    objectiveId: 'balance_pride_and_envy',
    label: 'Test whether public recognition energizes the team or curdles into rivalry and resentment.',
    category: 'culture',
    desiredPressure: 'recognition_dynamics',
    intendedObservableBehavior: 'The praise lifts morale OR the rival turns it into a resentment that spreads.',
    kpi: 'pride_vs_envy_balance_assessment',
    expectedEvidence: ['affinity changes', 'belief changes', 'morale signals'],
  },
};

export const ROLE_TEMPLATES: ScenarioTemplate[] = [
  THE_OFFICE_ROMANCE,
  THE_CONTESTED_PROMOTION,
  THE_TURF_WAR,
  THE_POWER_VACUUM,
  THE_SCAPEGOAT,
  THE_VIRAL_PRAISE,
];
