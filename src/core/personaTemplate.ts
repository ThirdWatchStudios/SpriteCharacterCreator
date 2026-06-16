/**
 * Persona templates — seeded archetype generators that stamp out a coherent
 * `CharacterProfile`. They are the **supply** side to scenario templates' demand
 * (role slots + preconditions), and the behavioral counterpart to the Visual DNA
 * the office population generator already produces (`employee.ts`). See the design
 * note in docs/persona-template-model.md.
 *
 * A persona template owns only the durable, individual character — spine (OCEAN +
 * game axes), needs, drives, traits, identity flavor — expressed as **ranges** over
 * the existing catalogs, sampled per seed so two of the same archetype differ. The
 * derived fields (temper/grudge/reactions/volatility) are computed by `applyDerived`,
 * never sampled. It deliberately does NOT set beliefs/knowledge or relationship
 * overrides (scenario-owned), and baseline relationships are a separate cast-level
 * graph-wiring pass that is **deferred** (note §5) — so a freshly generated cast has
 * no baseline relationships yet, and relationally-gated scenarios won't cast onto it.
 */
import {
  NEEDS,
  OCEAN_AXES,
  PRIMARY_GAME_AXES,
  applyDerived,
  clampUnit,
  createDefaultProfile,
  type CharacterProfile,
  type NeedId,
  type OceanAxis,
  type PrimaryGameAxis,
  type Seniority,
} from './profile';
import { mulberry32, type Rng } from './random';
import { seedToInt } from './employee';
import type { CharacterRecipe } from './types';

// --- the template ------------------------------------------------------------

/** Inclusive `[min, max]` sampling range on the 0–100 scale. */
export type Range = [number, number];

export interface PersonaTemplate {
  id: string;
  label: string;
  description: string;
  /** For grouping + blend affinity (free text). */
  archetypeTags?: string[];
  /** Per-axis ranges; an omitted axis samples a neutral 40–60. */
  spine: {
    ocean?: Partial<Record<OceanAxis, Range>>;
    axes?: Partial<Record<PrimaryGameAxis, Range>>;
  };
  /** Need baseline/sensitivity ranges; omitted needs keep the neutral default. */
  needs?: Partial<Record<NeedId, { baseline?: Range; sensitivity?: Range }>>;
  /** Drive ids (into the drive catalog) to draw primary/secondary from. */
  drivePool: { primary: string[]; secondary?: string[] };
  /** Trait ids (into the trait catalog): always-on `required`, sampled `pool`, never-on `exclude`. */
  traits: { required?: string[]; pool: string[]; count: Range; exclude?: string[] };
  /** Identity leanings (flavor only). */
  identity?: { seniority?: Seniority[]; departments?: string[] };
}

/** A secondary archetype blended into the primary at `weight` (0–0.5). */
export interface PersonaBlend {
  template: PersonaTemplate;
  weight: number;
}

export interface GeneratePersonaOptions {
  agentId?: string;
  name?: string;
  /** The visual recipe to bind to; a placeholder is synthesized when omitted. */
  recipe?: CharacterRecipe;
  blend?: PersonaBlend;
}

// --- sampling helpers --------------------------------------------------------

const NEUTRAL: Range = [40, 60];
const sample = (rng: Rng, [lo, hi]: Range): number => clampUnit(lo + rng() * (hi - lo));
const sampleInt = (rng: Rng, [lo, hi]: Range): number => lo + Math.floor(rng() * (hi - lo + 1));
const pick = <T>(rng: Rng, arr: T[]): T => arr[Math.floor(rng() * arr.length)];

/** Pull range `a` toward range `b` by `w` (per endpoint). */
const blendRange = (a: Range, b: Range, w: number): Range => [a[0] + (b[0] - a[0]) * w, a[1] + (b[1] - a[1]) * w];

/** Effective range: primary, secondary, or the two blended when both are present. */
const effRange = (a: Range | undefined, b: Range | undefined, w: number): Range | undefined => {
  if (a && b) return blendRange(a, b, w);
  return a ?? b;
};

function shuffle<T>(rng: Rng, arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const placeholderRecipe = (id: string, name: string): CharacterRecipe => ({
  id,
  name,
  parts: { body: '', head: '', hair: '', outfit: '', accessories: [] },
  palette: { skin: '#000000', hair: '#000000', outfitPrimary: '#000000', outfitSecondary: '#000000', accent: '#000000' },
});

// --- generation --------------------------------------------------------------

/**
 * Generate a coherent `CharacterProfile` from an archetype + seed (deterministic:
 * same template + seed + opts → identical profile). With `opts.blend`, a secondary
 * archetype pulls the spine toward itself and widens the drive/trait pools — a
 * "Climber with a gossip streak," not a 50/50 mush.
 */
export function generatePersona(template: PersonaTemplate, seed: number | string, opts: GeneratePersonaOptions = {}): CharacterProfile {
  const rng = mulberry32(typeof seed === 'number' ? seed >>> 0 : seedToInt(seed));
  const agentId = opts.agentId ?? `persona_${typeof seed === 'string' ? seed : seed >>> 0}`;
  const recipe = opts.recipe ?? placeholderRecipe(agentId, opts.name ?? agentId);
  const p = createDefaultProfile(recipe);

  const sec = opts.blend?.template;
  const w = sec ? Math.max(0, Math.min(0.5, opts.blend!.weight)) : 0;

  // Spine — OCEAN, then the four primary game axes (derived axes follow from these).
  for (const axis of OCEAN_AXES) {
    let r = template.spine.ocean?.[axis] ?? NEUTRAL;
    const s = sec?.spine.ocean?.[axis];
    if (s) r = blendRange(r, s, w);
    p.personality.ocean[axis] = sample(rng, r);
  }
  for (const axis of PRIMARY_GAME_AXES) {
    let r = template.spine.axes?.[axis] ?? NEUTRAL;
    const s = sec?.spine.axes?.[axis];
    if (s) r = blendRange(r, s, w);
    p.personality.axes[axis] = sample(rng, r);
  }

  // Needs — only override the ones the template (or blend) names.
  for (const need of NEEDS) {
    const baseR = effRange(template.needs?.[need]?.baseline, sec?.needs?.[need]?.baseline, w);
    if (baseR) p.needs[need].baseline = sample(rng, baseR);
    const sensR = effRange(template.needs?.[need]?.sensitivity, sec?.needs?.[need]?.sensitivity, w);
    if (sensR) p.needs[need].sensitivity = sample(rng, sensR);
  }

  // Drives — with probability w, draw from the blended archetype's pool instead.
  const fromPools = (prim: string[], second: string[] | undefined, avoid?: string): string => {
    let poolArr = sec && second && second.length && rng() < w ? second : prim;
    if (avoid) {
      const filtered = poolArr.filter((x) => x !== avoid);
      if (filtered.length) poolArr = filtered;
    }
    return poolArr.length ? pick(rng, poolArr) : '';
  };
  p.drives.primary = fromPools(template.drivePool.primary, sec?.drivePool.primary);
  p.drives.secondary = fromPools(
    template.drivePool.secondary ?? template.drivePool.primary,
    sec?.drivePool.secondary ?? sec?.drivePool.primary,
    p.drives.primary,
  );

  // Traits — required always; fill up to `count` from the (blended) pool.
  const required = [...new Set(template.traits.required ?? [])];
  const exclude = new Set([...(template.traits.exclude ?? []), ...(sec?.traits.exclude ?? [])]);
  const pool = [...new Set([...template.traits.pool, ...(sec?.traits.pool ?? [])])].filter((t) => !exclude.has(t) && !required.includes(t));
  const target = Math.max(required.length, sampleInt(rng, template.traits.count));
  const drawn = [...required];
  for (const t of shuffle(rng, pool)) {
    if (drawn.length >= target) break;
    drawn.push(t);
  }
  p.personality.traitTags = drawn;

  // Identity leanings (flavor) — primary's only.
  if (template.identity?.seniority?.length) p.identity.seniority = pick(rng, template.identity.seniority);
  if (template.identity?.departments?.length) p.identity.department = pick(rng, template.identity.departments);
  p.identity.prototypeRole = template.label;

  return applyDerived(p);
}

// --- cast generation (individuals only; relationships are a deferred pass) ----

export interface CastSlot {
  agentId: string;
  name?: string;
  template: PersonaTemplate;
  blend?: PersonaBlend;
  recipe?: CharacterRecipe;
}

/**
 * Generate N personas, one per slot, each independently deterministic from the
 * master seed + its agentId. Produces individuals only — baseline relationships are
 * the deferred cast-level graph-wiring pass (note §5), so the result has none.
 */
export function generateCast(slots: CastSlot[], seed: number | string): CharacterProfile[] {
  const base = typeof seed === 'string' ? seed : String(seed >>> 0);
  return slots.map((slot) =>
    generatePersona(slot.template, seedToInt(`${base}:${slot.agentId}`), {
      agentId: slot.agentId,
      name: slot.name,
      recipe: slot.recipe,
      blend: slot.blend,
    }),
  );
}

// --- validation --------------------------------------------------------------

export interface PersonaTemplateValidationContext {
  /** Drive ids in the catalog — pool drives must resolve when provided. */
  driveIds?: string[];
  /** Trait ids in the catalog — required/pool/exclude must resolve when provided. */
  traitIds?: string[];
}

/** Human-readable issues with a persona template. Empty = valid. */
export function validatePersonaTemplate(t: PersonaTemplate, ctx: PersonaTemplateValidationContext = {}): string[] {
  const issues: string[] = [];
  const checkRange = (label: string, r: Range, lo = 0, hi = 100) => {
    if (!Array.isArray(r) || r.length !== 2) {
      issues.push(`${label} must be a [min, max] range.`);
      return;
    }
    if (r[0] > r[1]) issues.push(`${label} has min > max (${r[0]} > ${r[1]}).`);
    if (r[0] < lo || r[1] > hi) issues.push(`${label} must stay within ${lo}–${hi} (got ${r[0]}..${r[1]}).`);
  };

  if (!t.id) issues.push('Persona template is missing id.');
  if (!t.label) issues.push(`Persona template "${t.id}" is missing a label.`);

  for (const axis of OCEAN_AXES) if (t.spine.ocean?.[axis]) checkRange(`"${t.id}" ocean.${axis}`, t.spine.ocean[axis]!);
  for (const axis of PRIMARY_GAME_AXES) if (t.spine.axes?.[axis]) checkRange(`"${t.id}" axes.${axis}`, t.spine.axes[axis]!);
  for (const need of NEEDS) {
    const n = t.needs?.[need];
    if (n?.baseline) checkRange(`"${t.id}" needs.${need}.baseline`, n.baseline);
    if (n?.sensitivity) checkRange(`"${t.id}" needs.${need}.sensitivity`, n.sensitivity);
  }

  if (!t.drivePool.primary.length) issues.push(`"${t.id}" has an empty primary drive pool.`);
  if (!t.traits.pool.length && !(t.traits.required ?? []).length) issues.push(`"${t.id}" has no traits (empty pool + required).`);
  checkRange(`"${t.id}" traits.count`, t.traits.count, 0, 20);
  if (t.traits.count[1] < (t.traits.required ?? []).length)
    issues.push(`"${t.id}" traits.count max (${t.traits.count[1]}) is less than its required-trait count.`);

  if (ctx.driveIds) {
    const set = new Set(ctx.driveIds);
    for (const id of [...t.drivePool.primary, ...(t.drivePool.secondary ?? [])]) if (!set.has(id)) issues.push(`"${t.id}" references unknown drive "${id}".`);
  }
  if (ctx.traitIds) {
    const set = new Set(ctx.traitIds);
    for (const id of [...(t.traits.required ?? []), ...t.traits.pool, ...(t.traits.exclude ?? [])]) if (!set.has(id)) issues.push(`"${t.id}" references unknown trait "${id}".`);
  }

  return issues;
}
