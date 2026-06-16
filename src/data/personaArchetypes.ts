/**
 * Persona archetypes — the starter set of seeded generators (see
 * src/core/personaTemplate.ts and docs/persona-template-model.md). Each is an
 * internally-coherent spine + need profile + drive/trait pools, expressed in
 * ranges over the existing catalogs (DEFAULT_DRIVES / DEFAULT_TRAITS in defaults.ts),
 * sampled per seed so two of the same archetype differ. The role column in the
 * design note maps each to the scenario roles it supplies.
 *
 * Spine ranges name only the *characteristic* axes; unnamed axes sample neutral
 * (40–60). Derived axes (temper/grudgeHolding) follow from the spine via applyDerived.
 */
import type { PersonaTemplate } from '../core/personaTemplate';

export const THE_CLIMBER: PersonaTemplate = {
  id: 'climber',
  label: 'The Climber',
  description: 'Ambitious and driven to advance; treats the org as a ladder.',
  archetypeTags: ['ambition', 'status'],
  spine: {
    ocean: { conscientiousness: [60, 85], agreeableness: [25, 45], extraversion: [55, 75] },
    axes: { ambition: [78, 95], integrity: [40, 60], loyalty: [30, 50], discretion: [45, 65] },
  },
  needs: { recognition: { baseline: [35, 55], sensitivity: [75, 90] }, competence: { sensitivity: [60, 80] } },
  drivePool: { primary: ['advance_career', 'seek_promotion', 'protect_status', 'outperform_rivals'], secondary: ['gain_recognition', 'impress_leadership', 'earn_respect'] },
  traits: { required: ['ambitious'], pool: ['climber', 'competitive', 'recognition_seeking', 'status_conscious', 'networker', 'hard_working'], count: [2, 3], exclude: ['slacker', 'coaster', 'easygoing'] },
  identity: { seniority: ['junior', 'senior', 'lead'] },
};

export const THE_OPERATOR: PersonaTemplate = {
  id: 'operator',
  label: 'The Operator',
  description: 'Plays the angles; influence and self-interest over principle.',
  archetypeTags: ['politics', 'power'],
  spine: {
    ocean: { agreeableness: [35, 55], extraversion: [55, 75], neuroticism: [30, 50] },
    axes: { ambition: [65, 85], integrity: [15, 35], loyalty: [20, 40], discretion: [65, 85] },
  },
  needs: { recognition: { sensitivity: [55, 75] }, autonomy: { sensitivity: [55, 75] } },
  drivePool: { primary: ['gain_influence', 'build_alliances', 'advance_career', 'maintain_control'], secondary: ['settle_score', 'protect_status'] },
  traits: { required: ['opportunist'], pool: ['spin_doctor', 'networker', 'charmer', 'status_conscious', 'contrarian'], count: [2, 3], exclude: ['idealist', 'straight_shooter', 'loyalist'] },
  identity: { seniority: ['senior', 'lead', 'manager'] },
};

export const THE_GOSSIP: PersonaTemplate = {
  id: 'gossip',
  label: 'The Gossip',
  description: 'The office switchboard — knows everyone, leaks everything.',
  archetypeTags: ['social', 'information'],
  spine: {
    ocean: { extraversion: [70, 90], agreeableness: [55, 75], openness: [55, 75] },
    axes: { discretion: [12, 30], integrity: [45, 65], ambition: [30, 50] },
  },
  needs: { belonging: { baseline: [55, 70], sensitivity: [70, 90] } },
  drivePool: { primary: ['maintain_social_access', 'be_liked', 'belong'], secondary: ['reduce_uncertainty', 'build_alliances'] },
  traits: { required: ['gossip'], pool: ['social', 'socially_connected', 'oversharer', 'curious', 'networker'], count: [2, 3], exclude: ['private', 'lone_wolf', 'wallflower'] },
  identity: { seniority: ['junior', 'senior'] },
};

export const THE_OFFICE_MOM: PersonaTemplate = {
  id: 'office_mom',
  label: 'The Office Mom',
  description: 'The caretaker who keeps the peace and looks after everyone.',
  archetypeTags: ['social', 'support'],
  spine: {
    ocean: { agreeableness: [72, 90], extraversion: [60, 80], neuroticism: [35, 55] },
    axes: { loyalty: [60, 80], integrity: [60, 80] },
  },
  needs: { belonging: { sensitivity: [60, 80] } },
  drivePool: { primary: ['preserve_harmony', 'mentor_others', 'protect_team', 'be_liked'], secondary: ['belong', 'maintain_social_access'] },
  traits: { required: ['office_mom'], pool: ['team_player', 'peacemaker', 'generous', 'diplomat', 'social', 'mentor'], count: [2, 3], exclude: ['prickly', 'blunt', 'lone_wolf'] },
  identity: { seniority: ['senior', 'lead'] },
};

export const THE_CYNIC: PersonaTemplate = {
  id: 'cynic',
  label: 'The Cynic',
  description: 'Assumes the worst of motives; slow to trust, quick to suspect.',
  archetypeTags: ['temperament', 'politics'],
  spine: {
    ocean: { agreeableness: [20, 40], openness: [35, 55], neuroticism: [55, 75], extraversion: [40, 60] },
    axes: { integrity: [45, 65], discretion: [40, 60], loyalty: [30, 50] },
  },
  needs: { security: { sensitivity: [55, 75] } },
  drivePool: { primary: ['reduce_uncertainty', 'protect_status', 'avoid_blame'], secondary: ['settle_score', 'job_security'] },
  traits: { required: ['cynical'], pool: ['suspicious', 'contrarian', 'pessimist', 'grudge_holder', 'prickly', 'blunt'], count: [2, 3], exclude: ['optimist', 'trusting', 'easygoing'] },
  identity: { seniority: ['senior', 'lead'] },
};

export const THE_IDEALIST: PersonaTemplate = {
  id: 'idealist',
  label: 'The Idealist',
  description: 'Holds to principle and fairness, even when it costs them.',
  archetypeTags: ['integrity'],
  spine: {
    ocean: { openness: [65, 85], conscientiousness: [60, 80], agreeableness: [55, 75] },
    axes: { integrity: [78, 95], loyalty: [45, 65], ambition: [40, 60], discretion: [40, 60] },
  },
  needs: { autonomy: { sensitivity: [55, 75] } },
  drivePool: { primary: ['uphold_fairness', 'expose_wrongdoing', 'master_craft'], secondary: ['earn_respect', 'protect_team'] },
  traits: { required: ['straight_shooter'], pool: ['idealist', 'whistleblower', 'curious', 'rule_follower', 'detail_oriented'], count: [2, 3], exclude: ['spin_doctor', 'opportunist', 'brown_noser'] },
  identity: { seniority: ['junior', 'senior', 'lead'] },
};

export const THE_WORKHORSE: PersonaTemplate = {
  id: 'workhorse',
  label: 'The Workhorse',
  description: 'Conscientious and exacting; carries the load and runs hot.',
  archetypeTags: ['work_ethic'],
  spine: {
    ocean: { conscientiousness: [78, 95], neuroticism: [55, 75], extraversion: [35, 55], openness: [40, 60] },
    axes: { ambition: [45, 65], integrity: [60, 80] },
  },
  needs: { competence: { baseline: [55, 75], sensitivity: [70, 90] }, rest: { baseline: [25, 45], sensitivity: [65, 85] } },
  drivePool: { primary: ['master_craft', 'prove_competence', 'prove_readiness'], secondary: ['job_security', 'avoid_blame'] },
  traits: { required: ['workaholic'], pool: ['perfectionist', 'deadline_driven', 'detail_oriented', 'reliable', 'organized', 'hard_working'], count: [2, 3], exclude: ['slacker', 'coaster', 'flaky'] },
  identity: { seniority: ['junior', 'senior'] },
};

export const THE_SLACKER: PersonaTemplate = {
  id: 'slacker',
  label: 'The Slacker',
  description: 'Coasts on the minimum; allergic to extra effort and conflict.',
  archetypeTags: ['work_ethic'],
  spine: {
    ocean: { conscientiousness: [10, 30], agreeableness: [45, 65], neuroticism: [35, 55], extraversion: [50, 70] },
    axes: { ambition: [20, 40], integrity: [35, 55], loyalty: [30, 50] },
  },
  needs: { rest: { baseline: [60, 80], sensitivity: [70, 90] }, autonomy: { sensitivity: [55, 75] } },
  drivePool: { primary: ['minimize_effort', 'avoid_conflict', 'maximize_autonomy'], secondary: ['be_liked', 'job_security'] },
  traits: { required: ['slacker'], pool: ['coaster', 'procrastinator', 'easygoing', 'class_clown', 'flaky'], count: [2, 3], exclude: ['workaholic', 'perfectionist', 'overachiever'] },
  identity: { seniority: ['intern', 'junior'] },
};

export const THE_CHARMER: PersonaTemplate = {
  id: 'charmer',
  label: 'The Charmer',
  description: 'Likeable and smooth; works the room and the boss alike.',
  archetypeTags: ['social', 'politics'],
  spine: {
    ocean: { extraversion: [72, 92], agreeableness: [60, 80], openness: [50, 70], neuroticism: [25, 45] },
    axes: { ambition: [60, 80], integrity: [35, 55], discretion: [45, 65] },
  },
  needs: { recognition: { sensitivity: [55, 75] }, belonging: { sensitivity: [55, 75] } },
  drivePool: { primary: ['be_liked', 'gain_influence', 'advance_career'], secondary: ['build_alliances', 'impress_leadership'] },
  traits: { required: ['charmer'], pool: ['networker', 'brown_noser', 'social', 'people_pleaser', 'status_conscious'], count: [2, 3], exclude: ['lone_wolf', 'blunt', 'prickly'] },
  identity: { seniority: ['junior', 'senior', 'lead'] },
};

export const THE_VETERAN: PersonaTemplate = {
  id: 'veteran',
  label: 'The Veteran',
  description: 'Old guard — reliable, set in their ways, and quietly resentful of the new.',
  archetypeTags: ['competence', 'temperament'],
  spine: {
    ocean: { openness: [20, 40], conscientiousness: [60, 80], agreeableness: [40, 60], neuroticism: [40, 60] },
    axes: { loyalty: [65, 85], integrity: [55, 75], ambition: [35, 55] },
  },
  needs: { recognition: { baseline: [30, 50], sensitivity: [55, 75] }, security: { sensitivity: [55, 75] } },
  drivePool: { primary: ['protect_status', 'job_security', 'master_craft'], secondary: ['earn_respect', 'contain_variance'] },
  traits: { required: ['set_in_their_ways'], pool: ['traditional', 'reliable', 'grudge_holder', 'pragmatic', 'practical', 'know_it_all'], count: [2, 3], exclude: ['experimental', 'curious'] },
  identity: { seniority: ['senior', 'lead'] },
};

export const THE_WALLFLOWER: PersonaTemplate = {
  id: 'wallflower',
  label: 'The Wallflower',
  description: 'Quiet and anxious; fades into the background and avoids friction.',
  archetypeTags: ['social', 'temperament'],
  spine: {
    ocean: { extraversion: [8, 28], neuroticism: [55, 75], agreeableness: [45, 65], openness: [45, 65] },
    axes: { ambition: [25, 45], discretion: [60, 80], integrity: [55, 75] },
  },
  needs: { belonging: { baseline: [40, 60], sensitivity: [60, 80] }, security: { sensitivity: [55, 75] } },
  drivePool: { primary: ['avoid_conflict', 'job_security', 'reduce_uncertainty'], secondary: ['belong', 'master_craft'] },
  traits: { required: ['wallflower'], pool: ['private', 'lone_wolf', 'worrier', 'sensitive', 'pessimist'], count: [2, 3], exclude: ['social', 'charmer', 'instigator'] },
  identity: { seniority: ['intern', 'junior', 'senior'] },
};

export const THE_HOTHEAD: PersonaTemplate = {
  id: 'hothead',
  label: 'The Hothead',
  description: 'Short fuse, blunt, and combative; takes things personally.',
  archetypeTags: ['temperament'],
  spine: {
    ocean: { agreeableness: [15, 35], neuroticism: [60, 80], extraversion: [55, 75] },
    axes: { ambition: [55, 75], integrity: [45, 65], discretion: [25, 45], loyalty: [35, 55] },
  },
  needs: { recognition: { sensitivity: [55, 75] } },
  drivePool: { primary: ['settle_score', 'protect_status', 'outperform_rivals'], secondary: ['earn_respect', 'challenge_unfair_advancement'] },
  traits: { required: ['hot_headed'], pool: ['blunt', 'competitive', 'contrarian', 'prickly', 'drama_magnet'], count: [2, 3], exclude: ['even_keeled', 'peacemaker', 'diplomat'] },
  identity: { seniority: ['junior', 'senior'] },
};

export const THE_LOYALIST: PersonaTemplate = {
  id: 'loyalist',
  label: 'The Loyalist',
  description: 'Company person — dependable, rule-following, and devoted to the team.',
  archetypeTags: ['integrity', 'work_ethic'],
  spine: {
    ocean: { conscientiousness: [62, 82], agreeableness: [50, 70], neuroticism: [35, 55], openness: [35, 55] },
    axes: { loyalty: [75, 92], integrity: [55, 75], ambition: [40, 60], discretion: [55, 75] },
  },
  needs: { security: { baseline: [55, 75], sensitivity: [55, 75] }, belonging: { sensitivity: [55, 70] } },
  drivePool: { primary: ['job_security', 'preserve_leadership_confidence', 'protect_team'], secondary: ['belong', 'contain_variance'] },
  traits: { required: ['loyalist'], pool: ['rule_follower', 'reliable', 'team_player', 'organized', 'punctual'], count: [2, 3], exclude: ['rule_bender', 'opportunist', 'contrarian'] },
  identity: { seniority: ['junior', 'senior', 'lead'] },
};

export const PERSONA_ARCHETYPES: PersonaTemplate[] = [
  THE_CLIMBER,
  THE_OPERATOR,
  THE_GOSSIP,
  THE_OFFICE_MOM,
  THE_CYNIC,
  THE_IDEALIST,
  THE_WORKHORSE,
  THE_SLACKER,
  THE_CHARMER,
  THE_VETERAN,
  THE_WALLFLOWER,
  THE_HOTHEAD,
  THE_LOYALIST,
];
