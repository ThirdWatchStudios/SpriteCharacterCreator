# Epic 36 (Surveillance Workstation UI) → what this tool builds

Determination from reading Epic 36 (all 7 features + stories) and the authoritative
`game-design-docs/the-water-cooler/docs/design/ui_visual_design.md`. This scopes which
Epic 36 art assets belong to **this tool** vs. elsewhere.

## The decisive finding: Epic 36 renders across THREE engines

`ui_visual_design.md` → "In-World Overlay Rendering (Shapes)" splits the screen:

| Layer | Rendered by | Tool's role |
|---|---|---|
| **Floor overlays** — relationship arcs, pressure halos, traveling info packets, selection reticles, belief tints, object scan framing | **Shapes** (Freya Holmer GPU vector, immediate-mode, redrawn from sim state every frame) | **NOT assets.** Tool owns only the *style spec* (channel → hue/weight/dash/motion) + palette. |
| **Terminal chrome** — objective banner, roster rail, inspector, event feed, drawers, transport, intervention dock | **Existing UI system** (uGUI → UI Toolkit/USS) | **Icons + theme only.** The containers/controls/text are USS. |
| **Post-process** — fullscreen vignette, scanlines, "REC" framing | **Screen shader** | None. |
| **The floor itself** — agents, props, office, overhead mood/activity emotes | **This tool** (already shipped) | Owned. Roster portraits = our sprites; mood tint = our emotes. |

The consequence: **the tool does not produce floor-overlay sprites.** Arcs, halos, packets,
reticles are drawn procedurally by Shapes — not exported PNG/SVG. That kills any plan to
bake them as assets, and it reshapes the icon set toward *workstation-operator chrome glyphs*.

## Chrome framework decision (2026-06-21): UI Toolkit

The terminal chrome will be built in **UI Toolkit (USS)**, not uGUI. Rationale:
- Team is open — decide on tech fit, no familiarity constraint.
- **Zoom-crisp icons are a hard requirement** (the surveillance camera zooms) → SVG
  `VectorImage` is resolution-independent where PNG sprites soften / need a scale ladder.
  (Same logic `ui_visual_design.md` used to make the Shapes floor layer vector.)
- The chrome is dashboard-shaped (panels / feed / lists / dual-register text) — UIT's
  wheelhouse (flexbox layout, `ListView` virtualization for the feed, USS theming).
- Unity 6 (6000.5) runtime UI Toolkit is production-ready.
- The tool's richest exports (`theme.uss`, per-icon `.svg`) are UIT-native, so central
  theming + tintable vector icons come nearly for free. uGUI's one edge (world-space UI)
  is moot — the diegetic floor layer is Shapes + sprite atlases.

**Consequence:** `theme.uss` + SVG are now the PRIMARY consumption path (validates the
dual-export design); PNG + `theme.json` remain as a fallback. When **Layer C** starts:
add `com.unity.vectorgraphics`, bind the SVG `VectorImage` into `UiIconCatalog` (keep the
PNG sprite as preview/fallback), and route `theme.uss` into the project's stylesheets.

## What the tool SHOULD build for Epic 36

> **Status (2026-06-21):** **All three tool-side items BUILT.** (1) theme re-tuned to the
> surveillance palette + floor-overlay channel tokens; (3) `overlay-style.json` Shapes look spec;
> (2) the workstation icon set — 28 new tintable glyphs in [icons.ts](../src/parts/icons.ts),
> grounded in the UI epic + the *prototype slices* of `behavioral_pressure_model.md` (7 pressures)
> and `interaction_taxonomy.md` (3 supported interventions). Game-side **Layer B importer is also
> built** in The-Water-Cooler (theme/icons/cursors/overlay → 4 SOs). Remaining: **Layer C** (consume
> in live UI) — gated on the Epic 36 build.

### 1. Epic 36 theme alignment (highest leverage) — ✅ BUILT
`ui_visual_design.md` → "Visual Language" mandates a specific palette, and it differs from
the generic one we shipped:
- base: **desaturated charcoal / slate** (not warm paper)
- single institutional accent: **teal-blue** (we shipped `accent = #4C84E0` blue — re-tune)
- **amber** = caution; **red** = used rarely so it means something
- channel hues: trust = cool/teal, suspicion/conflict = amber→red, belief drift = two-pole axis
- type: IRIS/system in mono/grotesk, human names slightly warmer (font concern → USS, not us)

This is the cohesion play already in place — extend `UI_PALETTE`/`theme.uss` with the Epic 36
channel tokens (`--wc-trust`, `--wc-suspicion`, `--wc-belief-rumor`, `--wc-belief-truth`,
`--wc-pressure`, `--wc-surveillance`) so **Shapes (floor) and USS (chrome) resolve the same
colors.** One palette, two renderers.

### 2. Workstation chrome icon set — ✅ BUILT (28 glyphs)
Replaces the speculative control/dept/relationship batches with what the stories name:
- **Transport** (S36.1.3): play ✓, pause ✓, **step**, **speed/fast-forward**. (stop optional)
- **Capture** (F36.5): an aperture / REC dot — the surveillance capture verb.
- **Focus / attention** (F36.5): target reticle + eye (chrome marker; the floor reticle is Shapes).
- **Layer toggles** (Tier 2, 5 icons): names, relationships, information, beliefs, environment.
- **Event feed** (Tier 1): event-type glyphs + alert dot + recent-change pulse marker.
- **Inspector / trace** (F36.4): cause-chain ("because→therefore"), unknown/unavailable, truth-vs-belief.
- **Intervention dock** (F36.5): a "submit request" / requisition glyph (NOT a god-button — see guardrails).
- **Tier-3 review** (F36.6): relationship-graph, belief-vs-truth, info-path-trace, run-comparison, case-file/dossier.
- **Misc chrome**: settings (gear ✓), close ✓, the IRIS mark.
All tintable masks (single flat color from `--wc-*`), per the pipeline already built.

### 3. Floor-overlay STYLE SPEC (the Shapes bridge) — ✅ BUILT
Shapes draws the floor, but **art direction stays tool-side** (matches the project rule that
style must stay tweakable post-build). `overlay-style.json` ([src/core/overlayStyle.ts](../src/core/overlayStyle.ts))
— the same idea as the shipped `conversation-style.json` — encodes the Visual Language table as
data the Shapes layer reads: per channel { color (→ `--wc-*`), form, line weight, dash pattern,
motion (pulse/still), the "one dominant pressure only" rule }. Tool owns the look; Shapes owns
the drawing.

> **Enriched (2026-06-28):** the spec now also carries a static-richness grammar — `glow`
> bloom, directional `flow`, per-agent `endpoints`, emotion-keyed `jitter` — plus a cross-channel
> `focus` (bloom-the-selection / dim-the-rest) model, so relationship lines pop without violating
> the motion-encodes-events rule. Game-side reader contract: **[shapes-overlay-reader-spec.md](shapes-overlay-reader-spec.md)**.

## Reconciliation with the speculative set (steps 5–6)

| Shipped speculatively | Epic 36 verdict |
|---|---|
| `ui-play`, `ui-pause`, `ui-gear`, `ui-close` | **Keep** — directly used (transport, settings). |
| `ui-save` | Defer — not a workstation verb (office doesn't forget; reset/replay are de-emphasized). |
| `ui-divider/corner/spinner` | Keep `ui-spinner`; divider/corner are generic, low priority. |
| `dept-*` (6) | **Defer** — Epic 36 is cast-first (4 employees); departments barely feature in the prototype UI. Relevant later to company/org UI, not this epic. |
| `need-*` (6) | **Repurpose → pressure glyphs.** Reconcile against `behavioral_pressure_model.md` (the dominant-pressure-per-agent set), not the needs list. |
| `rel-*` (4) | **Mostly defer** — relationships render as floor ARCS (Shapes), not icons. Keep only if the Tier-3 relationship graph wants category legends. |
| `cursor-*` (4) | Keep — desktop chrome cursors; floor selection reticle is separately a Shapes job. |

## Dependencies / open items before building deep
- **Pressure glyphs** need `behavioral_pressure_model.md` as the canonical list (as needs/relationships were grounded).
- **Event-type glyphs** need the event/interaction taxonomy (`interaction_taxonomy.md`) for the feed's vocabulary.
- Epic 36 is **downstream of E37/E32/E33** and explicitly "captured reference, not a task queue" until the autonomy loop + player role land — so the tool-side assets (palette, icons, style spec) are safe to build ahead, but should be treated as working-direction, re-checked when the UI firms up.
