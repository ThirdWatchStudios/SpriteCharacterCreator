/**
 * Representative office-layout configs shared by the golden generator
 * (`scripts/gen-golden-layouts.ts`) and the golden test (`tests/goldenLayout.test.ts`)
 * so the two can never drift. Each config is deterministic over `defaultProject()`
 * + a fixed seed + a verbatim department list (F1.5 / S1.5.2).
 *
 * These golden `office-layout.json` files are the **shared parity artifact**: the
 * C# runtime port's Unity-side tests assert a structural match against the same
 * fixtures (copied into the Water Cooler repo).
 */
export interface GoldenLayoutConfig {
  /** File stem under tests/golden/office-layout/<name>.json. */
  name: string;
  seed: number;
  /** Omitted/empty → the single-office path; non-empty → packed department wings. */
  wingDepartmentIds?: string[];
}

export const GOLDEN_LAYOUT_CONFIGS: GoldenLayoutConfig[] = [
  // Single-office regression lock (no wings → one implicit wing-main).
  { name: 'single', seed: 7 },
  // Two and three department wings — footprint scaling + connectivity.
  { name: 'wings-2', seed: 7, wingDepartmentIds: ['sales', 'engineering'] },
  { name: 'wings-3', seed: 7, wingDepartmentIds: ['sales', 'engineering', 'it'] },
  // Seats the base cast (operations) in its own wing — exercises desk/spare-desk
  // anchors and the cross-wing connectivity graph.
  { name: 'wings-cast', seed: 7, wingDepartmentIds: ['operations', 'sales'] },
];
