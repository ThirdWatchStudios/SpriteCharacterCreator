import type { CharacterRecipe, ProjectState, PropInstance, StylePreset, StyleSheet, TileInstance } from '../core/types';
import { CURRENT_SCHEMA_VERSION } from '../core/types';
import type { CharacterProfile, Relationship } from '../core/profile';
import { applyDerived, createDefaultProfile } from '../core/profile';

export const DEFAULT_STYLE: StyleSheet = {
  outline: {
    width: 2.5,
    color: '#3A342E',
    mode: 'silhouette',
  },
  proportions: {
    headScale: 1,
    bodyWidth: 1,
  },
  render: {
    baseSize: 128,
    pixelScale: 1,
  },
  palettePools: {
    skin: ['#F4D3B0', '#E8B88A', '#D9A06B', '#C68B59', '#A9714B', '#8D5A3B', '#6B4226'],
    hair: ['#1F1A17', '#4A3325', '#6E4A2A', '#B8893B', '#C7782F', '#8A8A8A', '#D8D3C8'],
    clothing: [
      '#2E4057', '#3D5A80', '#1D9E75', '#0F6E56', '#D85A30',
      '#993C56', '#534AB7', '#5F5E5A', '#7A6C5D', '#B04A3A',
    ],
    secondary: ['#F5F2EA', '#E8E4D8', '#DCE6EC', '#F0E2C8'],
    accent: ['#A32D2D', '#D85A30', '#185FA5', '#3B6D11', '#854F0B', '#2C2C2A'],
  },
};

export const DEFAULT_STYLE_PRESETS: StylePreset[] = [
  {
    id: 'preset-warm-office',
    name: 'Warm office',
    style: structuredClone(DEFAULT_STYLE),
  },
  {
    id: 'preset-corporate-cold',
    name: 'Corporate cold',
    style: {
      outline: {
        width: 2,
        color: '#27323A',
        mode: 'silhouette',
      },
      proportions: {
        headScale: 0.96,
        bodyWidth: 0.94,
      },
      render: {
        baseSize: 128,
        pixelScale: 1,
      },
      palettePools: {
        skin: ['#F1D6BE', '#D6A77F', '#BC855F', '#8E6046', '#68422F'],
        hair: ['#17191D', '#353A42', '#5C6170', '#7F858F', '#C7CDD5'],
        clothing: ['#20344A', '#2F4A63', '#476579', '#58616F', '#30363F', '#68727D'],
        secondary: ['#EEF3F6', '#DCE7EF', '#CBD6E0', '#B7C4CF'],
        accent: ['#1E6BA8', '#2E8BC8', '#4E6B7A', '#7A8FA0', '#DA7C4B'],
      },
    },
  },
  {
    id: 'preset-high-contrast',
    name: 'High-contrast readability',
    style: {
      outline: {
        width: 4,
        color: '#111111',
        mode: 'per-part',
      },
      proportions: {
        headScale: 1.12,
        bodyWidth: 1.08,
      },
      render: {
        baseSize: 128,
        pixelScale: 1,
      },
      palettePools: {
        skin: ['#FFE1BD', '#D99A65', '#A86A42', '#6B3F27'],
        hair: ['#0B0B0B', '#3B2417', '#8B5A22', '#D8D8D8'],
        clothing: ['#0F4C81', '#C7362E', '#107A53', '#6D3FB5', '#D88918', '#242424'],
        secondary: ['#FFFFFF', '#F3F0E8', '#D6EAF8', '#FFE7B8'],
        accent: ['#FFB000', '#E52B2B', '#0066CC', '#118A28', '#6A1B9A'],
      },
    },
  },
];

/** The Experiment 001 cast from the design docs. */
export const DEFAULT_CAST: CharacterRecipe[] = [
  {
    id: 'janice',
    name: 'Janice',
    parts: {
      body: 'body-standard',
      head: 'head-oval',
      hair: 'hair-bob',
      outfit: 'outfit-blazer',
      accessories: ['acc-lanyard'],
    },
    palette: {
      skin: '#E8B88A',
      hair: '#4A3325',
      outfitPrimary: '#2E4057',
      outfitSecondary: '#F5F2EA',
      accent: '#D85A30',
    },
  },
  {
    id: 'carl',
    name: 'Carl',
    parts: {
      body: 'body-broad',
      head: 'head-round',
      hair: 'hair-short',
      outfit: 'outfit-polo',
      accessories: ['acc-mug'],
    },
    palette: {
      skin: '#C68B59',
      hair: '#1F1A17',
      outfitPrimary: '#1D9E75',
      outfitSecondary: '#F5F2EA',
      accent: '#854F0B',
    },
  },
  {
    id: 'linda',
    name: 'Linda',
    parts: {
      body: 'body-standard',
      head: 'head-round',
      hair: 'hair-bun',
      outfit: 'outfit-cardigan',
      accessories: ['acc-glasses'],
    },
    palette: {
      skin: '#8D5A3B',
      hair: '#1F1A17',
      outfitPrimary: '#D85A30',
      outfitSecondary: '#F0E2C8',
      accent: '#993C1D',
    },
  },
  {
    id: 'manager',
    name: 'The Manager',
    parts: {
      body: 'body-broad',
      head: 'head-boxy',
      hair: 'hair-balding',
      outfit: 'outfit-shirt-tie',
      accessories: ['acc-badge'],
    },
    palette: {
      skin: '#F4D3B0',
      hair: '#8A8A8A',
      outfitPrimary: '#5F5E5A',
      outfitSecondary: '#F5F2EA',
      accent: '#A32D2D',
    },
  },
];

export const DEFAULT_PROPS: PropInstance[] = [
  {
    id: 'prop-water-cooler',
    name: 'Water cooler',
    templateId: 'water-cooler',
    params: { height: 56 },
    palette: { primary: '#85B7EB', secondary: '#F1EFE8', accent: '#378ADD' },
  },
  {
    id: 'prop-printer',
    name: 'Printer',
    templateId: 'printer',
    params: { width: 56 },
    palette: { primary: '#5F5E5A', secondary: '#B4B2A9', accent: '#97C459' },
  },
  {
    id: 'prop-desk',
    name: 'Desk',
    templateId: 'desk',
    params: { width: 100, monitor: 1 },
    palette: { primary: '#A9714B', secondary: '#DCE6EC', accent: '#444441' },
  },
  {
    id: 'prop-coffee-machine',
    name: 'Coffee machine',
    templateId: 'coffee-machine',
    params: { height: 48 },
    palette: { primary: '#444441', secondary: '#B4B2A9', accent: '#E24B4A' },
  },
  {
    id: 'prop-office-plant',
    name: 'Office plant',
    templateId: 'office-plant',
    params: { bushiness: 2 },
    palette: { primary: '#639922', secondary: '#3B6D11', accent: '#B04A3A' },
  },
  {
    id: 'prop-fridge',
    name: 'Break room fridge',
    templateId: 'fridge',
    params: { height: 78 },
    palette: { primary: '#DCE6EC', secondary: '#D85A30', accent: '#5F5E5A' },
  },
  {
    id: 'prop-conference-table',
    name: 'Conference table',
    templateId: 'conference-table',
    params: { width: 110, chairs: 6 },
    palette: { primary: '#6E4A2A', secondary: '#5F5E5A', accent: '#444441' },
  },
  {
    id: 'prop-reception-desk',
    name: 'Reception desk',
    templateId: 'reception-desk',
    params: { width: 88 },
    palette: { primary: '#3D5A80', secondary: '#E8E4D8', accent: '#EF9F27' },
  },
  {
    id: 'prop-badge-reader',
    name: 'Badge reader',
    templateId: 'badge-reader',
    params: { granted: 1 },
    palette: { primary: '#444441', secondary: '#D3D1C7', accent: '#97C459' },
  },
  {
    id: 'prop-door',
    name: 'Door',
    templateId: 'door',
    params: { width: 56, open: 0 },
    palette: { primary: '#7A6C5D', secondary: '#B4B2A9', accent: '#EF9F27' },
  },
  {
    id: 'prop-open-door',
    name: 'Open door',
    templateId: 'door',
    params: { width: 56, open: 1 },
    palette: { primary: '#7A6C5D', secondary: '#B4B2A9', accent: '#EF9F27' },
  },
  {
    id: 'prop-window',
    name: 'Office window',
    templateId: 'window',
    params: { width: 72, blinds: 2 },
    palette: { primary: '#5F5E5A', secondary: '#B5D4F4', accent: '#EEF3F4' },
  },
  {
    id: 'prop-nameplate',
    name: 'Nameplate',
    templateId: 'nameplate',
    params: { width: 48, lines: 2 },
    palette: { primary: '#D3B56E', secondary: '#F7F4EC', accent: '#5F5E5A' },
  },
  {
    id: 'prop-hvac-vent',
    name: 'HVAC vent',
    templateId: 'hvac-vent',
    params: { width: 52, slats: 5 },
    palette: { primary: '#A9B3B8', secondary: '#CAD4D7', accent: '#5F5E5A' },
  },
  {
    id: 'prop-desk-clutter',
    name: 'Desk clutter',
    templateId: 'desk-clutter',
    params: { papers: 3, phone: 1 },
    palette: { primary: '#2C2C2A', secondary: '#B4B2A9', accent: '#D85A30' },
  },
  {
    id: 'prop-couch',
    name: 'Lobby couch',
    templateId: 'couch',
    params: { width: 82, cushions: 3 },
    palette: { primary: '#3D5A80', secondary: '#2E4057', accent: '#D85A30' },
  },
  {
    id: 'prop-rug',
    name: 'Office rug',
    templateId: 'rug',
    params: { width: 96, pattern: 1 },
    palette: { primary: '#993C56', secondary: '#E8E4D8', accent: '#D85A30' },
  },
  {
    id: 'prop-vending-machine',
    name: 'Vending machine',
    templateId: 'vending-machine',
    params: { height: 84, stocked: 3 },
    palette: { primary: '#A32D2D', secondary: '#22384D', accent: '#97C459' },
  },
  {
    id: 'prop-office-chair',
    name: 'Office chair',
    templateId: 'office-chair',
    params: { size: 13 },
    palette: { primary: '#444441', secondary: '#888780', accent: '#2C2C2A' },
  },
  {
    id: 'prop-cubicle-workstation',
    name: 'Cubicle workstation',
    templateId: 'cubicle-workstation',
    params: { openness: 0, clutter: 1 },
    palette: { primary: '#8A9199', secondary: '#5F5E5A', accent: '#D85A30' },
  },
  {
    id: 'prop-whiteboard',
    name: 'Whiteboard',
    templateId: 'whiteboard',
    params: { width: 64, scribbles: 2 },
    palette: { primary: '#B4B2A9', secondary: '#F7F4EC', accent: '#D85A30' },
  },
  {
    id: 'prop-filing-cabinet',
    name: 'Filing cabinet',
    templateId: 'filing-cabinet',
    params: { drawers: 3 },
    palette: { primary: '#7A6C5D', secondary: '#8A8578', accent: '#2C2C2A' },
  },
  {
    id: 'prop-supply-cabinet',
    name: 'Supply cabinet',
    templateId: 'supply-cabinet',
    params: { height: 72 },
    palette: { primary: '#8A8578', secondary: '#D3D1C7', accent: '#185FA5' },
  },
  {
    id: 'prop-mail-station',
    name: 'Mail station',
    templateId: 'mail-station',
    params: { height: 60, columns: 4 },
    palette: { primary: '#7A6C5D', secondary: '#E8E4D8', accent: '#A32D2D' },
  },
];

export const DEFAULT_WALLS: TileInstance[] = [
  {
    id: 'wall-office',
    name: 'Office wall',
    templateId: 'office-wall',
    params: { thickness: 28 },
    palette: { primary: '#B4B2A9', secondary: '#888780', accent: '#5F5E5A' },
  },
  {
    id: 'wall-glass',
    name: 'Glass partition',
    templateId: 'glass-partition',
    params: { thickness: 10 },
    palette: { primary: '#5F5E5A', secondary: '#B5D4F4', accent: '#185FA5' },
  },
  {
    id: 'wall-cubicle',
    name: 'Cubicle partition',
    templateId: 'cubicle-partition',
    params: { thickness: 14 },
    palette: { primary: '#8A9199', secondary: '#5F5E5A', accent: '#D85A30' },
  },
];

export const DEFAULT_FLOORS: TileInstance[] = [
  {
    id: 'floor-carpet',
    name: 'Office carpet',
    templateId: 'carpet',
    params: { speckle: 2, seed: 3 },
    palette: { primary: '#667687', secondary: '#8B9AA8', accent: '#4E5B69' },
  },
  {
    id: 'floor-carpet-tiles',
    name: 'Lobby carpet tiles',
    templateId: 'carpet-tiles',
    params: { contrast: 2 },
    palette: { primary: '#7A6C5D', secondary: '#8A8578', accent: '#5F5E5A' },
  },
  {
    id: 'floor-wood',
    name: 'Executive wood',
    templateId: 'wood-floor',
    params: { seed: 5 },
    palette: { primary: '#A9714B', secondary: '#6E4A2A', accent: '#C68B59' },
  },
  {
    id: 'floor-linoleum',
    name: 'Break room linoleum',
    templateId: 'linoleum',
    params: { grid: 32 },
    palette: { primary: '#E8E4D8', secondary: '#D3D1C7', accent: '#B4B2A9' },
  },
  {
    id: 'floor-utility-vinyl',
    name: 'Utility vinyl',
    templateId: 'utility-vinyl',
    params: { grid: 32, scuff: 2, seed: 4 },
    palette: { primary: '#CAD4D7', secondary: '#EEF3F4', accent: '#7F8B91' },
  },
  {
    id: 'floor-quiet-carpet',
    name: 'Quiet room carpet',
    templateId: 'quiet-carpet',
    params: { weave: 2, seed: 6 },
    palette: { primary: '#496C68', secondary: '#6F908B', accent: '#314D55' },
  },
];

// ---------------------------------------------------------------------------
// Default character profiles — the Experiment 001 cast authored up into the
// full-game character model (game-design-docs .../design/character_model.md).
// Prototype data maps up: traits → trait tags, goals → drives, the relationship
// matrix → directed multi-axis relationships, Carl's suspicion seed → a starting
// belief (confidence 1/3 → 33). A neutral base from createDefaultProfile is
// customized, then applyDerived fills the derived axes/tendencies/volatility.
// ---------------------------------------------------------------------------

/** Build a relationship, defaulting the unset axes to neutral. */
function rel(targetAgentId: string, over: Partial<Relationship>): Relationship {
  return {
    targetAgentId,
    trust: 50,
    suspicion: 0,
    affinity: 0,
    influence: 0,
    respect: 50,
    familiarity: 50,
    tags: [],
    ...over,
  };
}

function buildDefaultProfiles(): CharacterProfile[] {
  const byId = Object.fromEntries(DEFAULT_CAST.map((c) => [c.id, c]));

  const janice = createDefaultProfile(byId.janice);
  janice.identity = {
    ...janice.identity,
    roleTitle: 'Senior Analyst',
    department: 'Operations',
    seniority: 'senior',
    pronouns: 'she/her',
    prototypeRole: 'Promotion Recipient',
    bio: 'Just promoted. Determined to show it was earned.',
  };
  janice.personality.ocean = { openness: 55, conscientiousness: 82, extraversion: 55, agreeableness: 60, neuroticism: 52 };
  janice.personality.axes = { ambition: 85, integrity: 75, loyalty: 60, discretion: 62 };
  janice.personality.traitTags = ['ambitious', 'hard_working', 'recognition_seeking'];
  janice.needs.recognition = { baseline: 45, sensitivity: 85 };
  janice.needs.competence = { baseline: 72, sensitivity: 70 };
  janice.needs.security = { baseline: 60, sensitivity: 60 };
  janice.drives = {
    primary: 'prove_readiness',
    secondary: 'avoid_reputational_damage',
    objectives: [
      {
        id: 'janice-prove-earned',
        sourceDrive: 'prove_readiness',
        targetOrConcern: 'Demonstrate the promotion was earned',
        expectedBehaviorTendency: 'support',
        status: 'active',
      },
    ],
  };
  janice.startingBeliefs = [
    { topic: 'janice_promotion', claim: 'I earned the promotion legitimately.', stance: 'accepts', confidence: 90 },
  ];
  janice.relationships = [
    rel('manager', { trust: 80, affinity: 50, influence: 40, respect: 75, familiarity: 60 }),
    rel('carl', { trust: 40, suspicion: 40, affinity: 0, respect: 45, familiarity: 70 }),
  ];

  const carl = createDefaultProfile(byId.carl);
  carl.identity = {
    ...carl.identity,
    roleTitle: 'Analyst',
    department: 'Operations',
    seniority: 'senior',
    pronouns: 'he/him',
    prototypeRole: 'Promotion Skeptic',
    bio: 'Been here longer than most. Felt the last promotion should have been his.',
  };
  carl.personality.ocean = { openness: 45, conscientiousness: 50, extraversion: 70, agreeableness: 30, neuroticism: 60 };
  carl.personality.axes = { ambition: 75, integrity: 40, loyalty: 35, discretion: 25 };
  carl.personality.traitTags = ['cynical', 'competitive', 'socially_connected'];
  carl.needs.recognition = { baseline: 40, sensitivity: 80 };
  carl.needs.security = { baseline: 55, sensitivity: 65 };
  carl.needs.belonging = { baseline: 65, sensitivity: 60 };
  carl.drives = {
    primary: 'protect_status',
    secondary: 'challenge_unfair_advancement',
    objectives: [
      {
        id: 'carl-scrutinize-promotion',
        sourceDrive: 'challenge_unfair_advancement',
        targetOrConcern: "Janice's promotion",
        expectedBehaviorTendency: 'share',
        status: 'active',
      },
    ],
  };
  carl.startingBeliefs = [
    { topic: 'janice_promotion', claim: 'The promotion was probably rigged.', stance: 'suspects', confidence: 33 },
  ];
  carl.relationships = [
    rel('janice', { trust: 33, suspicion: 100, affinity: -50, influence: 33, respect: 30, familiarity: 70, tags: ['rival'] }),
    rel('manager', { trust: 33, suspicion: 66, affinity: 0, influence: 0, respect: 40, familiarity: 55 }),
  ];
  carl.formativeEvents = [
    {
      id: 'carl-passed-over',
      title: 'Passed over for the promotion Janice got',
      description: 'Carl believed the role was his. It went to Janice after a closed-door meeting.',
      when: 'recent',
      involvedAgentIds: ['janice', 'manager'],
      visibility: 'private',
      knownToAgentIds: ['carl'],
      effects: [
        { targetKind: 'relationship_axis', targetRef: 'janice:suspicion', op: 'add', value: 40 },
        { targetKind: 'need_baseline', targetRef: 'recognition', op: 'add', value: -20 },
      ],
    },
  ];

  const linda = createDefaultProfile(byId.linda);
  linda.identity = {
    ...linda.identity,
    roleTitle: 'Coordinator',
    department: 'Operations',
    seniority: 'junior',
    pronouns: 'she/her',
    prototypeRole: 'Information Amplifier',
    bio: 'Knows everyone and everything. The office switchboard.',
  };
  linda.personality.ocean = { openness: 70, conscientiousness: 50, extraversion: 80, agreeableness: 75, neuroticism: 45 };
  linda.personality.axes = { ambition: 40, integrity: 60, loyalty: 65, discretion: 28 };
  linda.personality.traitTags = ['social', 'trusting', 'curious'];
  linda.needs.belonging = { baseline: 60, sensitivity: 85 };
  linda.needs.recognition = { baseline: 60, sensitivity: 50 };
  linda.drives = {
    primary: 'maintain_social_access',
    secondary: 'reduce_uncertainty',
    objectives: [
      {
        id: 'linda-stay-informed',
        sourceDrive: 'maintain_social_access',
        targetOrConcern: 'Stay in the loop on the promotion',
        expectedBehaviorTendency: 'confirm',
        status: 'active',
      },
    ],
  };
  linda.startingBeliefs = [
    { topic: 'janice_promotion', claim: 'Janice was promoted.', stance: 'unknown', confidence: 0 },
  ];
  linda.relationships = [
    rel('carl', { trust: 100, suspicion: 0, affinity: 50, influence: 66, respect: 60, familiarity: 80, tags: ['friend'] }),
    rel('janice', { trust: 66, suspicion: 0, affinity: 0, influence: 0, respect: 55, familiarity: 50 }),
  ];

  const manager = createDefaultProfile(byId.manager);
  manager.identity = {
    ...manager.identity,
    roleTitle: 'Office Manager',
    department: 'Management',
    seniority: 'manager',
    prototypeRole: 'Source Of Truth',
    bio: 'Practical, busy, and protective of a stable team.',
  };
  manager.personality.ocean = { openness: 45, conscientiousness: 80, extraversion: 50, agreeableness: 55, neuroticism: 35 };
  manager.personality.axes = { ambition: 55, integrity: 75, loyalty: 60, discretion: 82 };
  manager.personality.traitTags = ['practical', 'busy'];
  manager.needs.security = { baseline: 70, sensitivity: 60 };
  manager.needs.autonomy = { baseline: 70, sensitivity: 55 };
  manager.drives = {
    primary: 'preserve_leadership_confidence',
    secondary: 'contain_variance',
    objectives: [
      {
        id: 'manager-keep-stable',
        sourceDrive: 'preserve_leadership_confidence',
        targetOrConcern: 'Team stability after the promotion',
        expectedBehaviorTendency: 'support',
        status: 'active',
      },
    ],
  };
  manager.startingBeliefs = [
    { topic: 'janice_promotion', claim: 'Janice earned the promotion legitimately.', stance: 'accepts', confidence: 100 },
  ];
  manager.relationships = [
    rel('janice', { trust: 100, affinity: 50, influence: 66, respect: 80, familiarity: 60 }),
    rel('carl', { trust: 50, suspicion: 33, affinity: 0, respect: 45, familiarity: 60 }),
  ];

  return [janice, carl, linda, manager].map(applyDerived);
}

export const DEFAULT_PROFILES: CharacterProfile[] = buildDefaultProfiles();

export function defaultProject(): ProjectState {
  return {
    version: CURRENT_SCHEMA_VERSION,
    style: structuredClone(DEFAULT_STYLE),
    stylePresets: structuredClone(DEFAULT_STYLE_PRESETS),
    characters: structuredClone(DEFAULT_CAST),
    props: structuredClone(DEFAULT_PROPS),
    walls: structuredClone(DEFAULT_WALLS),
    floors: structuredClone(DEFAULT_FLOORS),
    profiles: structuredClone(DEFAULT_PROFILES),
  };
}
