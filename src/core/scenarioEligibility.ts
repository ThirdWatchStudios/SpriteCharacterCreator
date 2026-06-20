/**
 * History-seeded scenario eligibility (Epic 0, F0.7) — the last cascade tier:
 * the company's *past* points at the scenarios it should open on. Each formative
 * event kind maps to scenario-library **families** (a layoff lights up power /
 * rivalry scenarios; a leadership change lights up the promotion-rumor family),
 * so a generated seed ships with hot, grounded opening scenarios rather than a
 * flat library.
 *
 * It biases **salience** over Epic 4's scenario-template library and gates on the
 * Epic 3/4 **coverage** path (F3.5) — a scenario only runs "hot" if the cast can
 * actually cast it. No new scenario model: it reads the existing `family` tag and
 * `analyzeTemplateCoverage`. Pure + deterministic. Free-text discipline: an
 * unmapped event kind or family simply contributes nothing (no hard-fail).
 * See …/08-f0-7-history-seeded-scenario-eligibility.
 */
import type { Company } from './company';
import { analyzeTemplateCoverage, type ScenarioTemplate } from './scenarioTemplate';
import { clampUnit, type CharacterProfile } from './profile';

/**
 * Formative-event kind → the scenario families it makes salient (S0.7.1). Targets
 * the library's real families (`attraction`, `rumor`) plus forward-looking ones
 * (`power`, `rivalry`, `scandal`, …) the library will grow into — an unmatched
 * family just never fires, so this stays additive. Exported so the mapping is
 * inspectable (the "documented mapping" the story asks for).
 */
export const HISTORY_FAMILY_MAP: Record<string, string[]> = {
  reorg: ['power', 'rumor', 'rivalry'],
  layoff: ['power', 'rivalry', 'job_security'],
  founder_exit: ['power', 'rumor', 'succession'],
  merger: ['rivalry', 'faction', 'power'],
  acquisition: ['rivalry', 'faction'],
  scandal: ['scandal', 'rumor'],
  failed_product: ['blame', 'rivalry'],
  new_ceo: ['power', 'rumor', 'succession'],
  funding_round: ['celebration'],
  ipo: ['celebration', 'power'],
  pivot: ['rivalry', 'uncertainty'],
  record_quarter: ['celebration'],
  union_drive: ['solidarity', 'power'],
  return_to_office: ['attraction', 'grievance'],
};

/** Coarse recency weight from the event's free-text `when` (unknown → mid). */
const RECENCY_WEIGHT: Record<string, number> = {
  recent: 1,
  last_year: 0.8,
  two_years_ago: 0.6,
  at_founding: 0.3,
};
const DEFAULT_RECENCY = 0.7;

/** How strongly one matching event lifts a family's salience (per magnitude point). */
const FAMILY_GAIN = 0.5;

export interface ScenarioSalience {
  templateId: string;
  family?: string;
  /** 0–100 history-driven heat; 0 = nothing in the company's past points at it. */
  salience: number;
  /** Whether the current cast can actually cast it (the F3.5 coverage gate). */
  castable: boolean;
  /** The formative-event ids that made it hot — the traceability F0.6/F0.10 want. */
  groundedBy: string[];
}

export interface EligibilityReport {
  /** Every template, salience-desc (ties broken by templateId). */
  ranked: ScenarioSalience[];
  /** The opening scenarios: castable AND grounded in history, salience-desc. */
  hot: ScenarioSalience[];
}

export interface EligibilityOptions {
  /** Skip the (potentially expensive) castability check — salience only. */
  skipCoverage?: boolean;
}

/**
 * Rank a scenario-template library for a generated company: how *salient* each
 * template is given the company's history, and whether the cast can cast it.
 * Deterministic + pure. The library is passed in (the UI/export supplies
 * `ROLE_TEMPLATES`) so core carries no `data` dependency.
 */
export function rankScenarioEligibility(
  company: Company,
  library: ScenarioTemplate[],
  cast: CharacterProfile[],
  opts: EligibilityOptions = {},
): EligibilityReport {
  // Pre-sum each family's heat from the company history (independent of templates).
  const familyHeat = new Map<string, number>();
  const familyEvents = new Map<string, Set<string>>();
  for (const event of company.history) {
    const recency = RECENCY_WEIGHT[event.when] ?? DEFAULT_RECENCY;
    const contribution = event.magnitude * recency * FAMILY_GAIN;
    for (const family of HISTORY_FAMILY_MAP[event.kind] ?? []) {
      familyHeat.set(family, (familyHeat.get(family) ?? 0) + contribution);
      (familyEvents.get(family) ?? familyEvents.set(family, new Set()).get(family)!).add(event.id);
    }
  }

  const ranked: ScenarioSalience[] = library.map((t) => {
    const salience = t.family ? clampUnit(familyHeat.get(t.family) ?? 0) : 0;
    const groundedBy = t.family ? [...(familyEvents.get(t.family) ?? [])] : [];
    const castable = opts.skipCoverage ? true : analyzeTemplateCoverage(t, cast).fullyCastable;
    return { templateId: t.templateId, family: t.family, salience, castable, groundedBy };
  });
  ranked.sort((a, b) => b.salience - a.salience || a.templateId.localeCompare(b.templateId));

  const hot = ranked.filter((s) => s.castable && s.groundedBy.length > 0);
  return { ranked, hot };
}
