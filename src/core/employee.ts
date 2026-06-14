import type { CharacterRecipe, Slot, StyleSheet } from './types';
import { partsForSlot } from '../parts/library';
import { mulberry32, type Rng } from './random';

/**
 * Office Population Generator core. An employee's appearance is fully determined
 * by a (visualSeed, profile) pair — the same pair always reproduces the same
 * character. We also store the resolved recipe so a definition renders exactly
 * even if generation logic later changes, and so Unity can consume it directly.
 */

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------

/** Deterministic 32-bit hash of a seed string (FNV-1a). */
export function seedToInt(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

const SEED_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous chars

/** A short human-friendly random seed, e.g. "A9F7C2". */
export function randomSeed(rng: Rng = Math.random, length = 6): string {
  let out = '';
  for (let i = 0; i < length; i++) out += SEED_ALPHABET[Math.floor(rng() * SEED_ALPHABET.length)];
  return out;
}

// ---------------------------------------------------------------------------
// Generation profiles (departments) — declarative bias, never a hard lock.
// Slot-dynamic (Feature 8): weights are keyed by part id; any slot/part without
// an entry falls back to uniform, so new parts and new slots need no code here.
// ---------------------------------------------------------------------------

export interface GenProfile {
  id: string;
  label: string;
  /** Multiplicative weight per part id (default 1). Higher = more likely. */
  weights: Record<string, number>;
  /** Accessory count range, inclusive. */
  accessories: { min: number; max: number };
}

const PROFILES: GenProfile[] = [
  {
    id: 'random',
    label: 'Random office worker',
    weights: {},
    accessories: { min: 0, max: 2 },
  },
  {
    id: 'accounting',
    label: 'Accounting',
    weights: {
      'outfit-shirt-tie': 3, 'outfit-blazer': 3, 'outfit-cardigan': 2, 'outfit-polo': 2,
      'outfit-hoodie': 0.1, 'outfit-dress': 0.5, 'outfit-tee': 0.4,
      'acc-glasses': 2, 'acc-lanyard': 2, 'acc-badge': 2, 'acc-headset': 0.2,
    },
    accessories: { min: 0, max: 1 },
  },
  {
    id: 'it',
    label: 'IT',
    weights: {
      'outfit-hoodie': 4, 'outfit-tee': 3, 'outfit-polo': 2, 'outfit-turtleneck': 1.5,
      'outfit-suit-jacket': 0.1, 'outfit-blazer': 0.3, 'outfit-dress': 0.3,
      'acc-glasses': 3, 'acc-earbuds': 3, 'acc-headset': 2.5, 'acc-lanyard': 1.5,
    },
    accessories: { min: 1, max: 2 },
  },
  {
    id: 'hr',
    label: 'HR',
    weights: {
      'outfit-cardigan': 3, 'outfit-blazer': 2.5, 'outfit-polo': 2, 'outfit-turtleneck': 2,
      'outfit-dress': 1.5, 'outfit-hoodie': 0.3,
      'acc-lanyard': 2.5, 'acc-badge': 2, 'acc-glasses': 1.5,
    },
    accessories: { min: 0, max: 2 },
  },
  {
    id: 'management',
    label: 'Management',
    weights: {
      'outfit-suit-jacket': 4, 'outfit-shirt-tie': 3, 'outfit-blazer': 2.5,
      'outfit-hoodie': 0.05, 'outfit-tee': 0.1,
      'acc-watch': 3, 'acc-glasses': 2, 'acc-lanyard': 1.5, 'acc-badge': 1.5,
    },
    accessories: { min: 1, max: 2 },
  },
];

export function generationProfiles(): GenProfile[] {
  return PROFILES;
}

export function getProfile(id: string): GenProfile {
  return PROFILES.find((p) => p.id === id) ?? PROFILES[0];
}

// ---------------------------------------------------------------------------
// Employee definition
// ---------------------------------------------------------------------------

export interface EmployeeDefinition {
  visualSeed: string;
  profile: string;
  name: string;
  /** Resolved appearance — the source of truth for rendering / Unity. */
  recipe: { parts: CharacterRecipe['parts']; palette: CharacterRecipe['palette'] };
  /** Water Cooler integration fields (Feature 9). Present, often empty. */
  metadata: {
    department: string;
    role: string;
    agentId: string;
    displayName: string;
  };
}

const FIRST_NAMES = [
  'Alex', 'Sam', 'Jordan', 'Casey', 'Morgan', 'Riley', 'Quinn', 'Avery',
  'Dana', 'Jesse', 'Robin', 'Marge', 'Doug', 'Pam', 'Greg', 'Tina',
  'Howard', 'Cheryl', 'Vince', 'Donna', 'Phil', 'Rhonda', 'Stan', 'Bev',
  'Naomi', 'Wes', 'Priya', 'Omar', 'Ingrid', 'Theo', 'Lena', 'Marcus',
];

const LAST_NAMES = [
  'Jensen', 'Park', 'Okafor', 'Reyes', 'Cohen', 'Nguyen', 'Walsh', 'Diaz',
  'Patel', 'Brooks', 'Ferro', 'Maddox', 'Schmidt', 'Yates', 'Ibarra', 'Long',
];

/** Weighted pick over an id list; ids absent from `weights` use weight 1. */
function weightedPick(rng: Rng, ids: string[], weights: Record<string, number>): string {
  let total = 0;
  for (const id of ids) total += Math.max(0, weights[id] ?? 1);
  if (total <= 0) return ids[Math.floor(rng() * ids.length)];
  let r = rng() * total;
  for (const id of ids) {
    r -= Math.max(0, weights[id] ?? 1);
    if (r <= 0) return id;
  }
  return ids[ids.length - 1];
}

/** Slots picked one-of (dynamic — iterate whatever the library declares). */
const SINGLE_SLOTS: Slot[] = ['body', 'head', 'hair', 'outfit'];

/** Deterministically generate a recipe from a seeded rng under a profile. */
function generateRecipe(rng: Rng, profile: GenProfile, style: StyleSheet) {
  const pools = style.palettePools;
  const parts: Record<string, string> = {};
  for (const slot of SINGLE_SLOTS) {
    const ids = partsForSlot(slot).map((p) => p.id);
    parts[slot] = weightedPick(rng, ids, profile.weights);
  }

  const accessoryPool = partsForSlot('accessory').map((p) => p.id);
  const span = profile.accessories.max - profile.accessories.min;
  const count = profile.accessories.min + Math.floor(rng() * (span + 1));
  const accessories: string[] = [];
  let guard = 0;
  while (accessories.length < count && guard++ < 20) {
    const id = weightedPick(rng, accessoryPool, profile.weights);
    if (!accessories.includes(id)) accessories.push(id);
  }

  return {
    parts: {
      body: parts.body,
      head: parts.head,
      hair: parts.hair,
      outfit: parts.outfit,
      accessories,
    },
    palette: {
      skin: weightedPick(rng, pools.skin, {}),
      hair: weightedPick(rng, pools.hair, {}),
      outfitPrimary: weightedPick(rng, pools.clothing, {}),
      outfitSecondary: weightedPick(rng, pools.secondary, {}),
      accent: weightedPick(rng, pools.accent, {}),
    },
  };
}

/** Generate a full employee definition from a seed + profile (deterministic). */
export function generateEmployee(seed: string, profileId: string, style: StyleSheet): EmployeeDefinition {
  const profile = getProfile(profileId);
  // Salt the rng with the profile so a seed means a consistent person within a
  // profile but isn't forced identical across profiles.
  const rng = mulberry32(seedToInt(`${seed}|${profile.id}`));
  const recipe = generateRecipe(rng, profile, style);
  const first = FIRST_NAMES[Math.floor(rng() * FIRST_NAMES.length)];
  const last = LAST_NAMES[Math.floor(rng() * LAST_NAMES.length)];
  const displayName = `${first} ${last}`;
  return {
    visualSeed: seed,
    profile: profile.id,
    name: displayName,
    recipe,
    metadata: { department: profile.label, role: '', agentId: '', displayName },
  };
}

/** A renderable recipe for an employee (adds a stable id/name). */
export function employeeRecipe(emp: EmployeeDefinition): CharacterRecipe {
  return {
    id: `emp-${emp.visualSeed}`,
    name: emp.name,
    parts: emp.recipe.parts,
    palette: emp.recipe.palette,
  };
}

// ---------------------------------------------------------------------------
// Bulk population + variety metrics
// ---------------------------------------------------------------------------

/** Stable signature of an appearance (parts + palette) for duplicate detection. */
export function appearanceSignature(emp: EmployeeDefinition): string {
  const p = emp.recipe.parts;
  const c = emp.recipe.palette;
  return [p.body, p.head, p.hair, p.outfit, [...p.accessories].sort().join('+'),
    c.skin, c.hair, c.outfitPrimary, c.outfitSecondary, c.accent].join('|');
}

/** Same parts, palette aside — a "near duplicate" (reads as a similar person). */
function partsSignature(emp: EmployeeDefinition): string {
  const p = emp.recipe.parts;
  return [p.body, p.head, p.hair, p.outfit, [...p.accessories].sort().join('+')].join('|');
}

export interface Population {
  baseSeed: string;
  profile: string;
  employees: EmployeeDefinition[];
  /** Distinct appearances (exact). */
  unique: number;
  /** Pairs that share parts but differ only by palette. */
  nearDuplicates: number;
  /** True if the generator couldn't keep finding fresh appearances. */
  exhausted: boolean;
}

/**
 * Generate a roster of employees with unique appearances, derived
 * deterministically from a base seed (so the whole population is reproducible).
 * Retries collisions by nudging the per-employee seed; flags pool exhaustion.
 */
export function generatePopulation(
  count: number,
  profileId: string,
  style: StyleSheet,
  baseSeed: string = randomSeed(),
): Population {
  const n = Math.max(0, Math.min(500, Math.floor(count)));
  const employees: EmployeeDefinition[] = [];
  const seen = new Set<string>();
  let exhausted = false;

  for (let i = 0; i < n; i++) {
    let emp: EmployeeDefinition | null = null;
    for (let attempt = 0; attempt < 12; attempt++) {
      const seed = randomSeed(mulberry32(seedToInt(`${baseSeed}#${i}.${attempt}`)));
      const candidate = generateEmployee(seed, profileId, style);
      if (!seen.has(appearanceSignature(candidate))) {
        emp = candidate;
        break;
      }
      emp = candidate; // keep the last even if duplicate
    }
    if (!emp) continue;
    if (seen.has(appearanceSignature(emp))) exhausted = true;
    seen.add(appearanceSignature(emp));
    emp.name = `Employee ${String(i + 1).padStart(3, '0')}`;
    emp.metadata.displayName = emp.name;
    employees.push(emp);
  }

  const exactSeen = new Set<string>();
  const partsSeen = new Set<string>();
  let unique = 0;
  let near = 0;
  for (const emp of employees) {
    const sig = appearanceSignature(emp);
    if (!exactSeen.has(sig)) {
      exactSeen.add(sig);
      unique++;
    }
    const psig = partsSignature(emp);
    if (partsSeen.has(psig)) near++;
    else partsSeen.add(psig);
  }

  return { baseSeed, profile: getProfile(profileId).id, employees, unique, nearDuplicates: near, exhausted };
}
