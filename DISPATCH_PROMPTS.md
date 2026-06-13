# Dispatch prompts — unattended work while away

Paste each block into **Agent View** (`claude agents`) as its own dispatched
background session. Different repos / goals → run them in parallel, no conflict.

**Suggested set for a full window:** 1 + 2 + 4 in parallel (verifiable tool
progress + a reviewable head-start on the biggest Unity piece). Run **1 before
3** (snapshots are the safety net for the refactor).

**The rule that makes unverifiable work safe** (already baked into the Unity
prompt): the agent must not claim code compiles/runs it can't verify, and must
not fabricate test results — write carefully and produce a verification
checklist for you instead.

---

## 1 — Golden-snapshot tests (tool-side, verifiable; do first)

```
In ~/git/SpriteCharacterCreator, implement ROADMAP.md §3.3: add vitest golden-file snapshot tests for the compositor — compose the cast, every part, all 16 wall masks, each floor, and each prop to committed SVG snapshots so engine changes can't silently regress art. Add a `test` npm script. Verify with `npm run build` and the test run. Tool-side TypeScript only — do NOT touch the Unity repo (~/git/The-Water-Cooler).
```

## 2 — Headless export CLI (tool-side, verifiable)

```
In ~/git/SpriteCharacterCreator, implement ROADMAP.md §2.5: a headless `npm run export -- project.json out/` that regenerates the full export (same zip contents: characters/character-layers/props/walls/floors + office-layout.json) without a browser, using resvg-js for SVG→PNG. Factor SVG→PNG behind an interface so the in-browser export path is unchanged. Verify by running it on the default project and comparing the output structure to the in-app export. Tool-side only — don't touch the Unity repo.
```

## 3 — Phase 4 keystone: dependency inversion (tool-side; run AFTER 1)

```
In ~/git/SpriteCharacterCreator, do step 1 of TOOL_ARCHITECTURE.md only: invert the engine→content dependency so core/* stops importing parts/props/tiles/data directly — introduce a ContentPack/registry the engine reads, with the current office content registered as the pack. Keep behavior identical. Verify with `npm run build` and the preview (render a character + scene before/after to confirm no visual change). Do NOT split files or extract multiple packs yet. Tool-side only.
```

## 4 — C# layout generator port (Unity; write-only, you verify at desk)

```
Port ~/git/SpriteCharacterCreator/src/core/layout.ts to a C# OfficeLayoutGenerator in ~/git/The-Water-Cooler/Assets/WaterCooler/Runtime/Phase2/. It must produce a SpriteToolkitOfficeLayout (the existing SO in that folder — match its exact shape: cols, rows, flattened row-major floor/wall grids, props with propId/templateId/x/y/rotation/projection/placement, characterSpawns with characterId/x/y/facing/mood) from a seed, so the existing SpriteToolkitSceneAssembler renders it unchanged.

Read first: SpriteCharacterCreator/ROADMAP.md §2.4 (the port checklist), SpriteCharacterCreator/src/core/layout.ts and src/core/random.ts (the algorithm + mulberry32), The-Water-Cooler/SPRITE_INTEGRATION.md (W1), and the existing SpriteToolkit* C# to match conventions (namespace WaterCooler.Phase2, one ScriptableObject/MonoBehaviour per file named after the class, sealed classes).

Requirements: port mulberry32 to deterministic C# (NOT UnityEngine.Random — same seed must give the same office, matching the TS); replicate room templates (shared-edge rects), wall drawing (office shell re-asserted last, single-tile doorways + one door prop each), comb cubicles (spines never parallel-adjacent to a room wall, skip door-gap columns, return seats), size-scaled furnishing, non-destructive spawns. Resolve prop/floor/wall instance ids: the TS pulls them from a live project; in C# resolve from the imported SpriteToolkitImportCatalog (or the canonical default ids like prop-water-cooler, floor-carpet, wall-office) — flag this decision explicitly. Add a small OfficeLayoutGeneratorDriver MonoBehaviour (seed field + ContextMenu "Generate & Assemble") that builds a layout and feeds the existing assembler.

CRITICAL: you cannot compile or run Unity. Do NOT claim the code compiles or works, and do NOT fabricate test results. Write careful, idiomatic C#, document every place the port isn't 1:1 or you're uncertain, and end with a VERIFICATION CHECKLIST the human runs at their desk. Only touch ~/git/The-Water-Cooler — do not modify the tool repo.
```

---

### When you're back

- Review the **#4** diff as a first draft to verify-and-fix (likely friction:
  mulberry32→C# determinism, prop/floor/wall id resolution, the two render rules
  the assembler expects). Run its verification checklist in Unity.
- #1/#2/#3 should arrive verified (build + tests/preview); still skim the diffs.
