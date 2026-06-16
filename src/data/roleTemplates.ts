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

export const ROLE_TEMPLATES: ScenarioTemplate[] = [THE_OFFICE_ROMANCE];
