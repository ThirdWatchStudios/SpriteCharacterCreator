import type { CharacterRecipe, ProjectState, PropInstance, StylePreset, StyleSheet, TileInstance } from '../core/types';
import { CURRENT_SCHEMA_VERSION } from '../core/types';
import type { CharacterProfile, DriveDefinition, Relationship, RelationshipTypeDefinition, TraitDefinition } from '../core/profile';
import { applyDerived, createDefaultProfile } from '../core/profile';
import type { Scenario } from '../core/scenario';

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
    contactShadow: 0.12,
    ambientTint: 0.07,
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
        contactShadow: 0.1,
        ambientTint: 0.05,
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
        contactShadow: 0.16,
        ambientTint: 0.09,
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
  {
    id: 'prop-trash-bin',
    name: 'Trash bin',
    templateId: 'trash-bin',
    params: { height: 36 },
    palette: { primary: '#5F6B5A', secondary: '#3F4A3C', accent: '#D8D3C8' },
  },
  {
    id: 'prop-water-station',
    name: 'Water station',
    templateId: 'water-station',
    params: { height: 54 },
    palette: { primary: '#9FD0F2', secondary: '#5F5E5A', accent: '#378ADD' },
  },
  {
    id: 'prop-coat-rack',
    name: 'Coat rack',
    templateId: 'coat-rack',
    params: { hooks: 4 },
    palette: { primary: '#5F5E5A', secondary: '#2C2C2A', accent: '#854F0B' },
  },
  {
    id: 'prop-bulletin-board',
    name: 'Bulletin board',
    templateId: 'bulletin-board',
    params: { width: 64, notes: 4 },
    palette: { primary: '#7A6C5D', secondary: '#C9A36B', accent: '#D85A30' },
  },
  {
    id: 'prop-wall-calendar',
    name: 'Wall calendar',
    templateId: 'wall-calendar',
    params: { rows: 5 },
    palette: { primary: '#3D5A80', secondary: '#F7F4EC', accent: '#D85A30' },
  },
  {
    id: 'prop-water-fountain',
    name: 'Water fountain',
    templateId: 'water-fountain',
    params: { basins: 1 },
    palette: { primary: '#A9B3B8', secondary: '#CAD4D7', accent: '#185FA5' },
  },
  {
    id: 'prop-kitchenette-counter',
    name: 'Kitchenette counter',
    templateId: 'kitchenette-counter',
    params: { length: 108, sink: 1 },
    palette: { primary: '#D3D1C7', secondary: '#B4B2A9', accent: '#5F5E5A' },
  },
  {
    id: 'prop-lounge-seating',
    name: 'Lounge seating',
    templateId: 'lounge-seating',
    params: { seats: 3 },
    palette: { primary: '#534AB7', secondary: '#3A3490', accent: '#EF9F27' },
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
  {
    id: 'wall-brick',
    name: 'Brick wall',
    templateId: 'brick-wall',
    params: { thickness: 24 },
    palette: { primary: '#9C5A45', secondary: '#D8C9B8', accent: '#7A4334' },
  },
  {
    id: 'wall-panel',
    name: 'Panel wall',
    templateId: 'panel-wall',
    params: { thickness: 20 },
    palette: { primary: '#6E6A63', secondary: '#9AA0A6', accent: '#185FA5' },
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
  {
    id: 'floor-terrazzo',
    name: 'Terrazzo',
    templateId: 'terrazzo',
    params: { density: 2, seed: 4 },
    palette: { primary: '#E2DED3', secondary: '#9AA7A0', accent: '#C2885E' },
  },
  {
    id: 'floor-rubber-mat',
    name: 'Rubber mat',
    templateId: 'rubber-mat',
    params: { studs: 8 },
    palette: { primary: '#3C4651', secondary: '#56626E', accent: '#2A323A' },
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
  // Durable baseline rivalry toward Janice; the promotion-driven suspicion spike
  // (suspicion 100 / affinity -50) is a scenario relationshipOverride in
  // promotion_rumor_001, applied on top of this at load.
  carl.relationships = [
    rel('janice', { trust: 40, suspicion: 30, affinity: -20, influence: 33, respect: 35, familiarity: 70, relationshipType: 'rival', tags: ['rival'] }),
    rel('manager', { trust: 33, suspicion: 66, affinity: 0, influence: 0, respect: 40, familiarity: 55 }),
    // Mirror of Linda's secret romance.
    rel('linda', { trust: 100, suspicion: 0, affinity: 80, influence: 50, respect: 60, familiarity: 90, relationshipType: 'romance', secret: true }),
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
  linda.relationships = [
    // A secret office romance with Carl — the live demo of the third-party
    // (jealousy) coupling: when Carl engages Janice (whom Linda is cool on), the
    // 'romance' type's thirdParty hook fires for Linda.
    rel('carl', { trust: 100, suspicion: 0, affinity: 80, influence: 66, respect: 60, familiarity: 90, relationshipType: 'romance', secret: true, tags: ['friend'] }),
    rel('janice', { trust: 66, suspicion: 0, affinity: -10, influence: 0, respect: 55, familiarity: 50, relationshipType: 'coworker' }),
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
  manager.relationships = [
    rel('janice', { trust: 100, affinity: 50, influence: 66, respect: 80, familiarity: 60 }),
    rel('carl', { trust: 50, suspicion: 33, affinity: 0, respect: 45, familiarity: 60 }),
  ];

  return [janice, carl, linda, manager].map(applyDerived);
}

export const DEFAULT_PROFILES: CharacterProfile[] = buildDefaultProfiles();

// ---------------------------------------------------------------------------
// Default scenarios — Experiment 001 ("The Promotion Rumor") authored as the
// first full scenario (game-design-docs .../design/scenario_model.md). It
// composes the cast by reference and adds the situation: locations bound to the
// office, truth facts, information items, the experiment variants, and the
// objective. Per the persona↔scenario boundary, the starting BELIEFS live here
// (Carl's "rigged" suspicion seed moves out of his persona into the scenario),
// and the promotion-driven suspicion spike is a relationship OVERRIDE on top of
// his persona baseline.
// ---------------------------------------------------------------------------

const PROMOTION_RUMOR_001: Scenario = {
  scenarioId: 'promotion_rumor_001',
  title: 'The Promotion Rumor',
  summary: 'An ambiguous promotion seeds a rumor; does it spread or stay contained?',
  cast: [
    {
      agentId: 'janice',
      spawnLocationId: 'janice_desk',
      prototypeRole: 'Promotion Recipient',
      relationshipOverrides: [],
      beliefSeeds: [
        { topic: 'janice_promotion', claim: 'I earned the promotion legitimately.', stance: 'accepts', confidence: 90 },
      ],
      knowledgeSeeds: ['official_promotion_notice'],
    },
    {
      agentId: 'carl',
      spawnLocationId: 'carl_desk',
      prototypeRole: 'Promotion Skeptic',
      // Scenario-driven shift on top of Carl's persona baseline toward Janice.
      relationshipOverrides: [{ targetAgentId: 'janice', suspicion: 100, affinity: -50 }],
      beliefSeeds: [
        { topic: 'janice_promotion', claim: 'The promotion was probably rigged.', stance: 'suspects', confidence: 33 },
      ],
      knowledgeSeeds: ['official_promotion_notice', 'manager_private_meeting_observation'],
    },
    {
      agentId: 'linda',
      spawnLocationId: 'linda_desk',
      prototypeRole: 'Information Amplifier',
      relationshipOverrides: [],
      beliefSeeds: [
        { topic: 'janice_promotion', claim: 'Janice was promoted.', stance: 'unknown', confidence: 0 },
      ],
      knowledgeSeeds: [],
    },
    {
      agentId: 'manager',
      spawnLocationId: 'manager_office',
      prototypeRole: 'Source Of Truth',
      relationshipOverrides: [],
      beliefSeeds: [
        { topic: 'janice_promotion', claim: 'Janice earned the promotion legitimately.', stance: 'accepts', confidence: 100 },
      ],
      knowledgeSeeds: ['official_promotion_notice'],
    },
  ],
  locations: [
    { locationId: 'janice_desk', displayName: "Janice's Desk", tags: ['work_area'], accessState: 'open', fallbackLocationId: 'hallway', bindTo: { anchorId: 'desk:janice', roomId: 'cubicle-farm' } },
    { locationId: 'carl_desk', displayName: "Carl's Desk", tags: ['work_area'], accessState: 'open', fallbackLocationId: 'hallway', bindTo: { anchorId: 'desk:carl', roomId: 'cubicle-farm' } },
    { locationId: 'linda_desk', displayName: "Linda's Desk", tags: ['work_area'], accessState: 'open', fallbackLocationId: 'hallway', bindTo: { anchorId: 'desk:linda', roomId: 'cubicle-farm' } },
    { locationId: 'manager_office', displayName: 'Manager Office', tags: ['management'], accessState: 'open', fallbackLocationId: '', bindTo: { anchorId: '', roomId: 'manager-office' } },
    { locationId: 'break_room', displayName: 'Break Room', tags: ['break_area'], accessState: 'open', fallbackLocationId: 'hallway', bindTo: { anchorId: '', roomId: 'break-room' } },
    { locationId: 'hallway', displayName: 'Hallway', tags: ['transit'], accessState: 'open', fallbackLocationId: '', bindTo: { anchorId: '', roomId: 'hallway' } },
  ],
  truthFacts: [
    {
      truthId: 'janice_promotion_legitimate',
      topic: 'janice_promotion',
      statement: 'Janice earned the promotion legitimately.',
      subjectAgentIds: ['janice', 'manager'],
      objectiveValue: true,
      sourceAgentId: 'manager',
    },
  ],
  informationItems: [
    { informationId: 'official_promotion_notice', topic: 'janice_promotion', claim: 'Janice was promoted.', originType: 'official', truthId: 'janice_promotion_legitimate', truthAlignment: 'true', sourceAgentId: 'manager', initialHolderAgentIds: ['manager', 'janice'] },
    { informationId: 'manager_private_meeting_observation', topic: 'janice_promotion', claim: 'Janice had a private meeting with the manager.', originType: 'observation', truthId: 'janice_promotion_legitimate', truthAlignment: 'misleading', sourceAgentId: 'carl', initialHolderAgentIds: ['carl'] },
    { informationId: 'rigged_promotion_claim', topic: 'janice_promotion', claim: 'The promotion was rigged.', originType: 'rumor', truthId: 'janice_promotion_legitimate', truthAlignment: 'false', sourceAgentId: 'carl', initialHolderAgentIds: ['carl'] },
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
    intendedObservableBehavior: "Carl's suspicion stays low OR Linda does not spread the rumor.",
    kpi: 'rumor_containment_or_amplification_assessment',
    expectedEvidence: ['belief changes', 'rumor reach count', 'trust metrics'],
  },
};

export const DEFAULT_SCENARIOS: Scenario[] = [PROMOTION_RUMOR_001];

/**
 * The shared, reusable drive catalog. Drives are common across an office cast, so
 * they live at the project level; personas reference them by id. `amplifiesNeeds`
 * is the sim-facing coupling (which needs the drive pushes). Free to extend.
 */
const drive = (
  id: string,
  category: DriveDefinition['category'],
  amplifiesNeeds: DriveDefinition['amplifiesNeeds'],
  label: string,
  description: string,
): DriveDefinition => ({ id, label, description, category, amplifiesNeeds });

export const DEFAULT_DRIVES: DriveDefinition[] = [
  // Status & advancement
  drive('advance_career', 'status', ['recognition', 'competence'], 'Advance career', 'Climb the ladder; take on higher-profile work.'),
  drive('seek_promotion', 'status', ['recognition', 'competence'], 'Seek promotion', 'Angle for the next title and pay bump.'),
  drive('prove_readiness', 'status', ['competence', 'recognition'], 'Prove readiness', 'Demonstrate they can handle more responsibility.'),
  drive('prove_competence', 'status', ['competence'], 'Prove competence', 'Show they are good at the job.'),
  drive('gain_recognition', 'status', ['recognition'], 'Gain recognition', 'Be seen and credited for contributions.'),
  drive('protect_status', 'status', ['recognition', 'security'], 'Protect status', 'Defend standing and seniority from threats.'),
  drive('earn_respect', 'status', ['recognition', 'belonging'], 'Earn respect', 'Be taken seriously by peers and leadership.'),
  drive('outperform_rivals', 'status', ['competence', 'recognition'], 'Outperform rivals', 'Beat specific colleagues at the work.'),
  drive('impress_leadership', 'status', ['recognition'], 'Impress leadership', 'Win favor with managers and executives.'),
  drive('preserve_leadership_confidence', 'status', ['recognition', 'security'], 'Preserve leadership confidence', 'Keep leadership trusting their judgment.'),
  // Security & risk
  drive('job_security', 'security', ['security'], 'Job security', 'Stay safely employed; avoid the chopping block.'),
  drive('avoid_blame', 'security', ['security'], 'Avoid blame', 'Stay clear of fault when things go wrong.'),
  drive('avoid_reputational_damage', 'security', ['security', 'recognition'], 'Avoid reputational damage', 'Protect their name from a black mark.'),
  drive('avoid_conflict', 'security', ['belonging', 'rest'], 'Avoid conflict', 'Steer clear of confrontation and friction.'),
  drive('reduce_uncertainty', 'security', ['security'], 'Reduce uncertainty', 'Pin down ambiguity; know where they stand.'),
  drive('contain_variance', 'security', ['security', 'autonomy'], 'Contain variance', 'Keep outcomes predictable and under control.'),
  drive('minimize_effort', 'security', ['rest', 'autonomy'], 'Minimize effort', 'Get by with the least work required.'),
  // Power & autonomy
  drive('gain_influence', 'power', ['autonomy', 'recognition'], 'Gain influence', 'Build sway over decisions and people.'),
  drive('maintain_control', 'power', ['autonomy', 'security'], 'Maintain control', 'Keep a grip on their domain and outcomes.'),
  drive('maximize_autonomy', 'power', ['autonomy'], 'Maximize autonomy', 'Work on their own terms, free of oversight.'),
  // Social & belonging
  drive('maintain_social_access', 'social', ['belonging'], 'Maintain social access', 'Stay in the loop and connected.'),
  drive('build_alliances', 'social', ['belonging', 'autonomy'], 'Build alliances', 'Cultivate allies and mutual favors.'),
  drive('be_liked', 'social', ['belonging', 'recognition'], 'Be liked', 'Be popular and well-regarded socially.'),
  drive('belong', 'social', ['belonging'], 'Belong', 'Feel part of the group; fit in.'),
  drive('preserve_harmony', 'social', ['belonging', 'rest'], 'Preserve harmony', 'Keep the peace across the team.'),
  drive('settle_score', 'social', ['recognition'], 'Settle a score', 'Get even with someone who wronged them.'),
  // Values & growth
  drive('uphold_fairness', 'growth', ['belonging', 'autonomy'], 'Uphold fairness', 'Insist things be done right and even-handedly.'),
  drive('challenge_unfair_advancement', 'growth', ['recognition', 'autonomy'], 'Challenge unfair advancement', 'Contest a promotion or call they see as unjust.'),
  drive('expose_wrongdoing', 'growth', ['autonomy', 'recognition'], 'Expose wrongdoing', 'Bring misconduct to light.'),
  drive('mentor_others', 'growth', ['belonging', 'competence'], 'Mentor others', 'Develop and look after junior colleagues.'),
  drive('master_craft', 'growth', ['competence'], 'Master the craft', 'Get genuinely excellent at the work itself.'),
  drive('protect_team', 'growth', ['belonging', 'security'], 'Protect the team', 'Shield the group from blame and overload.'),
];

/**
 * The shared, reusable trait catalog. Traits are personality shorthand personas
 * reference by id (`personality.traitTags`). `biasesReactions` is the sim-facing
 * coupling — signed −2..+2 nudges to reaction propensities the sim applies on top
 * of the spine-derived tendencies. Only behavioural traits carry biases; the rest
 * are categorized descriptors (extend or tune freely).
 */
const trait = (
  id: string,
  category: TraitDefinition['category'],
  biasesReactions: TraitDefinition['biasesReactions'],
  label: string,
  description: string,
): TraitDefinition => ({ id, label, description, category, biasesReactions });

export const DEFAULT_TRAITS: TraitDefinition[] = [
  // Work ethic & drive
  trait('workaholic', 'work_ethic', {}, 'Workaholic', 'Lives at the office; always working.'),
  trait('hard_working', 'work_ethic', {}, 'Hard-working', 'Reliably puts in the effort.'),
  trait('ambitious', 'work_ethic', { escalate: 1 }, 'Ambitious', 'Hungry to get ahead.'),
  trait('climber', 'work_ethic', { escalate: 1 }, 'Climber', 'Openly angling up the ladder.'),
  trait('overachiever', 'work_ethic', { verify: 1 }, 'Overachiever', 'Goes well beyond what is asked.'),
  trait('perfectionist', 'work_ethic', { verify: 2 }, 'Perfectionist', 'Sweats every detail; hard to satisfy.'),
  trait('deadline_driven', 'work_ethic', {}, 'Deadline-driven', 'Sprints as the clock runs down.'),
  trait('slacker', 'work_ethic', { ignore: 2, withdraw: 1 }, 'Slacker', 'Coasts on minimum effort.'),
  trait('procrastinator', 'work_ethic', { ignore: 1 }, 'Procrastinator', 'Puts things off to the last minute.'),
  trait('coaster', 'work_ethic', { ignore: 1 }, 'Coaster', 'Does just enough to get by.'),
  // Social style
  trait('social', 'social', { gossip: 1, reassure: 1 }, 'Social', 'Energized by people; chats freely.'),
  trait('socially_connected', 'social', { gossip: 1 }, 'Socially connected', 'Knows everyone; well-networked.'),
  trait('networker', 'social', { gossip: 1 }, 'Networker', 'Works the room for contacts.'),
  trait('team_player', 'social', { reassure: 1 }, 'Team player', 'Pulls for the group over self.'),
  trait('office_mom', 'social', { reassure: 2 }, 'Office mom', 'Looks after everyone; the caretaker.'),
  trait('people_pleaser', 'social', { reassure: 2, confront: -1 }, 'People-pleaser', 'Avoids saying no; seeks approval.'),
  trait('charmer', 'social', { reassure: 1 }, 'Charmer', 'Smooth and likeable.'),
  trait('class_clown', 'social', { reassure: 1, confront: -1 }, 'Class clown', 'Defuses with jokes.'),
  trait('peacemaker', 'social', { reassure: 2, escalate: -1 }, 'Peacemaker', 'Smooths over conflict.'),
  trait('lone_wolf', 'social', { withdraw: 2, gossip: -1 }, 'Lone wolf', 'Keeps to themselves; works solo.'),
  trait('wallflower', 'social', { withdraw: 2, confront: -1 }, 'Wallflower', 'Quiet; fades into the background.'),
  trait('private', 'social', { withdraw: 1, gossip: -1 }, 'Private', 'Guards their personal life.'),
  // Information & politics
  trait('gossip', 'politics', { gossip: 2 }, 'Gossip', 'Trades in who-said-what.'),
  trait('oversharer', 'politics', { gossip: 1 }, 'Oversharer', 'Says more than they should.'),
  trait('spin_doctor', 'politics', { gossip: 1, verify: -1 }, 'Spin doctor', 'Bends the story to suit them.'),
  trait('brown_noser', 'politics', { reassure: 1, confront: -1 }, 'Brown-noser', 'Flatters those above them.'),
  trait('opportunist', 'politics', {}, 'Opportunist', 'Plays whatever angle helps them.'),
  trait('whistleblower', 'politics', { confront: 1, escalate: 1 }, 'Whistleblower', 'Calls out wrongdoing.'),
  trait('straight_shooter', 'politics', { confront: 1, verify: 1 }, 'Straight shooter', 'Says it plainly; no games.'),
  trait('blunt', 'politics', { confront: 2 }, 'Blunt', 'Tactless and direct.'),
  trait('diplomat', 'politics', { reassure: 2, confront: -1 }, 'Diplomat', 'Tactful; reads the room.'),
  trait('contrarian', 'politics', { confront: 1 }, 'Contrarian', 'Argues the other side on reflex.'),
  trait('instigator', 'politics', { escalate: 2, gossip: 1 }, 'Instigator', 'Stirs the pot.'),
  trait('drama_magnet', 'politics', { escalate: 1, gossip: 1 }, 'Drama magnet', 'Trouble seems to find them.'),
  // Temperament
  trait('worrier', 'temperament', { withdraw: 1, verify: 1 }, 'Worrier', 'Anxious; sees the downside.'),
  trait('high_strung', 'temperament', { escalate: 1, withdraw: 1 }, 'High-strung', 'Tense and easily rattled.'),
  trait('hot_headed', 'temperament', { confront: 2, escalate: 2 }, 'Hot-headed', 'Quick to anger.'),
  trait('even_keeled', 'temperament', { escalate: -1, reassure: 1 }, 'Even-keeled', 'Steady under pressure.'),
  trait('thick_skinned', 'temperament', { ignore: 1, escalate: -1 }, 'Thick-skinned', 'Brushes off criticism.'),
  trait('sensitive', 'temperament', { withdraw: 1 }, 'Sensitive', 'Takes things to heart.'),
  trait('grudge_holder', 'temperament', { escalate: 1, reassure: -1 }, 'Grudge-holder', 'Slow to let things go.'),
  trait('forgiving', 'temperament', { reassure: 2, escalate: -1 }, 'Forgiving', 'Quick to move past slights.'),
  trait('optimist', 'temperament', { reassure: 1 }, 'Optimist', 'Expects things to work out.'),
  trait('pessimist', 'temperament', { withdraw: 1 }, 'Pessimist', 'Braces for the worst.'),
  trait('cynical', 'temperament', { verify: 1, reassure: -1 }, 'Cynical', 'Assumes the worst of motives.'),
  trait('easygoing', 'temperament', { ignore: 1, confront: -1 }, 'Easygoing', 'Relaxed; goes with the flow.'),
  trait('trusting', 'temperament', { reassure: 1, verify: -1 }, 'Trusting', 'Takes people at their word.'),
  trait('suspicious', 'temperament', { verify: 2, reassure: -1 }, 'Suspicious', 'Wary of others’ intentions.'),
  // Integrity & rules
  trait('rule_follower', 'integrity', { verify: 1 }, 'Rule-follower', 'Plays it by the book.'),
  trait('rule_bender', 'integrity', {}, 'Rule-bender', 'Treats rules as suggestions.'),
  trait('loyalist', 'integrity', {}, 'Loyalist', 'Stands by their people.'),
  trait('idealist', 'integrity', {}, 'Idealist', 'Holds to principle over expedience.'),
  // Openness & thinking
  trait('curious', 'openness', { verify: 1 }, 'Curious', 'Wants to know how things work.'),
  trait('creative', 'openness', {}, 'Creative', 'Generates novel ideas.'),
  trait('experimental', 'openness', {}, 'Experimental', 'Likes to try new approaches.'),
  trait('set_in_their_ways', 'openness', {}, 'Set in their ways', 'Resists change.'),
  trait('traditional', 'openness', {}, 'Traditional', 'Prefers the established way.'),
  trait('detail_oriented', 'openness', { verify: 2 }, 'Detail-oriented', 'Catches the small stuff.'),
  trait('big_picture', 'openness', {}, 'Big-picture', 'Thinks in strategy, not specifics.'),
  trait('pragmatic', 'openness', {}, 'Pragmatic', 'Whatever works in practice.'),
  trait('practical', 'openness', {}, 'Practical', 'Grounded and no-nonsense.'),
  // Competence & role
  trait('mentor', 'competence', { reassure: 1, verify: 1 }, 'Mentor', 'Develops and guides others.'),
  trait('micromanager', 'competence', { verify: 2, confront: 1 }, 'Micromanager', 'Hovers over every detail.'),
  trait('delegator', 'competence', {}, 'Delegator', 'Hands off and trusts the team.'),
  trait('fixer', 'competence', {}, 'Fixer', 'The one who makes problems go away.'),
  trait('know_it_all', 'competence', { confront: 1, verify: 1 }, 'Know-it-all', 'Always has the answer.'),
  trait('quick_learner', 'competence', {}, 'Quick learner', 'Picks things up fast.'),
  trait('tech_savvy', 'competence', {}, 'Tech-savvy', 'Comfortable with the tools.'),
  trait('organized', 'competence', { verify: 1 }, 'Organized', 'Everything in its place.'),
  trait('scatterbrained', 'competence', { ignore: 1, verify: -1 }, 'Scatterbrained', 'Forgetful and disorganized.'),
  trait('reliable', 'competence', { verify: 1 }, 'Reliable', 'Does what they say they will.'),
  trait('flaky', 'competence', { ignore: 1 }, 'Flaky', 'Hard to count on.'),
  // Status & misc
  trait('competitive', 'status', { escalate: 1, confront: 1 }, 'Competitive', 'Has to win.'),
  trait('recognition_seeking', 'status', {}, 'Recognition-seeking', 'Wants the credit and spotlight.'),
  trait('status_conscious', 'status', {}, 'Status-conscious', 'Keenly aware of pecking order.'),
  trait('frugal', 'status', {}, 'Frugal', 'Careful with money and resources.'),
  trait('generous', 'status', { reassure: 1 }, 'Generous', 'Free with help and credit.'),
  trait('punctual', 'status', {}, 'Punctual', 'Always on time.'),
  trait('always_late', 'status', {}, 'Always late', 'Never quite on schedule.'),
  trait('busy', 'status', {}, 'Busy', 'Perpetually slammed.'),
  trait('prickly', 'status', { confront: 1, reassure: -1 }, 'Prickly', 'Easily irritated; sharp edges.'),
];

/**
 * The shared relationship-type catalog. Bond types relationship edges reference by
 * id (`relationship.relationshipType`). `biasesReactions` colors the holder's
 * reactions toward the target (sim applies, like trait biases); `thirdParty` is
 * the optional jealousy/protectiveness coupling — when the target engages a third
 * party, the holder reacts per `sensitivity` + `biasesReactions`, scaled up toward
 * disliked third parties when `intensifiesTowardDisliked`. Behavior stays sim-side;
 * the tool ships the coupling. Free to extend.
 */
const relType = (
  id: string,
  category: RelationshipTypeDefinition['category'],
  biasesReactions: RelationshipTypeDefinition['biasesReactions'],
  label: string,
  description: string,
  extra?: Partial<Pick<RelationshipTypeDefinition, 'secretByDefault' | 'thirdParty'>>,
): RelationshipTypeDefinition => ({ id, label, description, category, biasesReactions, ...extra });

export const DEFAULT_RELATIONSHIP_TYPES: RelationshipTypeDefinition[] = [
  // Professional
  relType('coworker', 'professional', {}, 'Coworker', 'Neutral colleague; no strong pull either way.'),
  relType('manager', 'professional', { reassure: 1, confront: -1 }, 'Manager', 'Target is the holder’s boss; defers, avoids open conflict.'),
  relType('direct-report', 'professional', { reassure: 1, verify: 1 }, 'Direct report', 'Target reports to the holder; checks in, keeps tabs.'),
  relType('mentor', 'professional', { reassure: 1, verify: 1 }, 'Mentor', 'Target guides the holder; trusts and defers to their read.'),
  relType('protege', 'professional', { reassure: 1 }, 'Protégé', 'Target is the holder’s mentee; protective of them.', {
    thirdParty: { sensitivity: 45, biasesReactions: { verify: 1, confront: 1 }, intensifiesTowardDisliked: true },
  }),
  // Social
  relType('friend', 'social', { reassure: 1 }, 'Friend', 'Genuinely likes the target; gives benefit of the doubt.'),
  relType('close-friend', 'social', { reassure: 2, confront: -1 }, 'Close friend', 'Tight bond; backs them, slow to suspect them.', {
    thirdParty: { sensitivity: 30, biasesReactions: { withdraw: 1 }, intensifiesTowardDisliked: true },
  }),
  relType('confidant', 'social', { reassure: 1, gossip: 1 }, 'Confidant', 'Trades secrets with the target; shares freely with them.'),
  relType('ally', 'social', { reassure: 1, escalate: 1 }, 'Ally', 'Mutual-favor partner; takes their side, amplifies them.'),
  // Romantic (secret by default — office romances usually are)
  relType('romance', 'romantic', { reassure: 2, confront: -1 }, 'Romance', 'Romantic partner; devoted, soft on them — and possessive.', {
    secretByDefault: true,
    thirdParty: { sensitivity: 80, biasesReactions: { confront: 1, withdraw: 1, escalate: 1 }, intensifiesTowardDisliked: true },
  }),
  relType('crush', 'romantic', { reassure: 1, withdraw: 1 }, 'Crush', 'One-sided pining; nervous around them, watchful of rivals.', {
    secretByDefault: true,
    thirdParty: { sensitivity: 60, biasesReactions: { withdraw: 1, gossip: 1 }, intensifiesTowardDisliked: true },
  }),
  relType('work-spouse', 'romantic', { reassure: 2 }, 'Work spouse', 'Platonic-but-exclusive office pairing; playfully territorial.', {
    thirdParty: { sensitivity: 40, biasesReactions: { gossip: 1 }, intensifiesTowardDisliked: false },
  }),
  relType('ex-partner', 'romantic', { confront: 1, withdraw: 1 }, 'Ex-partner', 'Former romance; lingering charge, easily set off.', {
    thirdParty: { sensitivity: 50, biasesReactions: { gossip: 1, escalate: 1 }, intensifiesTowardDisliked: true },
  }),
  // Adversarial
  relType('rival', 'adversarial', { confront: 1, escalate: 1, verify: 1 }, 'Rival', 'Competes with the target; scrutinizes, pushes back.', {
    thirdParty: { sensitivity: 40, biasesReactions: { gossip: 1, escalate: 1 }, intensifiesTowardDisliked: false },
  }),
  relType('nemesis', 'adversarial', { confront: 2, escalate: 1, reassure: -1 }, 'Nemesis', 'Active antagonist; opposes them on reflex.'),
];

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
    scenarios: structuredClone(DEFAULT_SCENARIOS),
    drives: structuredClone(DEFAULT_DRIVES),
    traits: structuredClone(DEFAULT_TRAITS),
    relationshipTypes: structuredClone(DEFAULT_RELATIONSHIP_TYPES),
  };
}
