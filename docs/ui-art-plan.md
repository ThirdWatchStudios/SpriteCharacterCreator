# UI art plan — Terrarium as a UI asset source for The Water Cooler

Status: draft for sign-off. Owner question answered: produce assets for **all four UI
layers** (diegetic glyphs, HUD overlays, app chrome, cursors/trim); Unity target is
**uGUI today, migrating to UI Toolkit (USS)**.

## Governing principle

> **This tool owns every shape with no state, no layout, and no text.**
> **USS/uGUI owns every container, control, state, and string.**

An icon can live *inside* a button, but a button is not an icon. States
(`:hover`/`:active`/`:disabled`/`:focus`), 9-slice (`-unity-slice-*`), tokens (USS
custom properties), typography, and layout are the UI framework's job — never baked
into an asset. This keeps the design system decoupled from the asset baker, the same
way [CONTRACT.md](../CONTRACT.md) keeps style decoupled from parts.

### Why the tool fits the icon half

- The pipeline already **builds SVG, then rasterizes** (`Rasterizer.rasterizeSheet`
  over `SheetDesc`/`RasterCell`, [exporter.ts](../src/core/exporter.ts)). The SVG —
  exactly what UI Toolkit's `VectorImage` wants — already exists; we currently throw
  it away after rastering.
- Overhead **mood/activity badges already are UI**: character-independent
  `{color, glyph}` bubbles drawn by `composeOverheadEmote` and shipped as shared
  atlases. An icon is the same object class. The precedent is in the tree.
- The `rr/circle/ellipse/path` + `$token` vocabulary maps 1:1 onto flat geometric
  icons, so they inherit world art-direction for free.

### Dual-target consequence (uGUI now, UI Toolkit later)

One authored icon emits **both**: a `.svg` (UI Toolkit `VectorImage`) and a PNG ladder
at `EXPORT_SCALES` `[1,2,4]` (uGUI `Sprite`). No re-authoring across the migration.

---

## (a) Asset taxonomy

Legend — **Tool** = authored here; **USS** = framework (UXML/USS or uGUI prefab);
**Split** = icon/shape from the tool, container/state/layout from the framework.
"DONE" = already exported today.

### Layer 1 — Diegetic world glyphs → **Tool**

In-fiction marks the player reads as part of the world. Squarely this tool's domain.

| Asset | Owner | Notes |
|---|---|---|
| Mood emotes | Tool (DONE) | `mood-emotes@Nx` shared atlas |
| Activity badges | Tool (DONE) | `activity-badges@Nx` shared atlas |
| Department icons (Eng, Sales, HR, …) | Tool | literal-colored, one hue per dept |
| Need/status pips (coffee, rest, social, stress, bladder) | Tool | small monochrome glyphs |
| Relationship glyphs (friend / rival / crush) | Tool | literal-colored |
| In-world signage glyphs (exit, kitchen, meeting, restroom) | Tool | monochrome on sign prop |
| Per-agent alert bubble (`!`, `?`) | Tool | same bubble shape as emotes |

### Layer 2 — HUD overlays → **Split**

Drawn over the game world. Icons are the tool's; the frames/counters/positioning are
the framework's (uGUI world-space canvas, later UI Toolkit).

| Asset | Owner | Notes |
|---|---|---|
| Selection ring / placement reticle | Tool | world-space vector shape under the agent |
| Conversation connector | Tool (DONE) | `conversation-style.json` — tool owns look, sim owns pairing/placement |
| Build-menu item icons (desk, plant, cooler…) | Tool | reuse prop silhouettes as glyphs |
| Build-menu grid/container | USS | layout + scroll |
| KPI/resource icons (money, morale, productivity) | Tool | monochrome, tintable |
| KPI counter chrome + number | USS | text + framing |
| Tooltip leading icon | Tool | — |
| Tooltip frame/positioning | USS | — |
| Minimap markers | Tool | glyphs |
| Minimap frame | USS | — |
| Clock / time-of-day icon | Tool | glyph; the widget is USS |

### Layer 3 — App chrome → **USS** (icons excepted)

The frame around the game. Not this tool — except the glyphs *inside* controls.

| Asset | Owner | Notes |
|---|---|---|
| Menus, panels, modals, tabs, dropdowns | USS | layout + states |
| Buttons, toggles, sliders, scrollbars, fields | USS | states via pseudo-classes |
| Progress / loading bars | USS | fill via USS |
| Control glyphs (gear, X, play/pause, save, +/−, chevrons) | Tool | monochrome, tintable |
| Panel background pattern (if any) | USS | gradient/solid; only Tool if a deliberately "world-material" texture |

### Layer 4 — Cursors & decorative trim → **Split**

| Asset | Owner | Notes |
|---|---|---|
| Cursor shapes (default, grab, place, invalid) | Tool → **PNG** | USS `cursor` needs a raster texture; author shape here, export PNG only |
| Dividers / corner ornaments / section flourishes | Tool | SVG |
| Loading spinner shape | Tool | SVG shape; **animation is USS** (`rotate` transition) |
| 9-slice frame art (only for "world-material" frames, e.g. wooden sign) | Split | Tool authors the border art; `-unity-slice-*` does the slicing. Default chrome should use plain USS border/radius — reserve tool-authored 9-slice for diegetic frames |

### Hard "do NOT author as a sprite" list

Panels, buttons, scrollbars, sliders, text, layouts, and any per-state variant. These
re-couple the design system to the baker. UI Toolkit/uGUI *is* the design system.

---

## (b) Tool extension specs

Two additive extensions. Both fit the existing single-source export tree in
`exportAll` ([exporter.ts](../src/core/exporter.ts)); neither touches the world-asset
output.

### Extension 1 — SVG (+ PNG) export for icon-class assets

**Goal:** a new `icons/` asset class that emits resolution-independent SVG for UI
Toolkit and a PNG ladder for uGUI, from one authored definition.

**Library** — add `src/parts/icons.ts`, modeled on
[activities.ts](../src/parts/activities.ts):

```ts
export type IconMode = 'tintable' | 'literal';
export interface IconDef {
  id: string;          // stable export key, e.g. 'dept-engineering', 'ui-gear'
  label: string;
  mode: IconMode;      // 'tintable' → monochrome white mask; 'literal' → full color
  shapes: ShapeSpec[]; // rr/circle/ellipse/path, fills as '$token' or literal hex
}
export const ICONS: IconDef[] = [ /* … */ ];
```

**Compositor** — add `composeIcon(iconId, pixelSize)` next to `composeOverheadEmote`
([compositor.ts](../src/core/compositor.ts)). Returns a `<svg viewBox="0 0 128 128">`.
Reuse `svgWrap`. For `mode: 'tintable'`, reuse the existing white-mask convention
(`emitMaskShape`: `$token`/literal-stroke → `#FFFFFF`) so USS recolors the whole glyph
via one tint. For `mode: 'literal'`, emit real colors (like badges).

> **Tinting reality:** USS (`unity-background-image-tint-color`) and uGUI multiply a
> sprite by a single flat color. Multi-region recoloring is not possible per-icon.
> So: **control/status icons are `tintable` monochrome** (one theme color, swappable);
> **diegetic department/relationship icons are `literal`** (fixed multi-hue). This is
> the same token-vs-literal split `emitMaskShape` already encodes.

**Authoring guideline (not a pipeline change):** icons must read at ~24px. Heavy
strokes, generous negative space, snap to a coarse grid on the 128u canvas. Keeping the
128u design canvas preserves `geometry.ts`/`svgWrap` reuse and world coherence.

**Exporter** — in `exportAll`, add an icons pass. `ExportSink.file` already accepts
strings (it writes JSON today), so writing `.svg` needs **no rasterizer**:

```
icons/<id>.svg              // UI Toolkit VectorImage — raw composeIcon() string
icons/<id>@1x.png           // uGUI Sprite — single-cell SheetDesc through Rasterizer
icons/<id>@2x.png
icons/<id>@4x.png
icons/icons-manifest.json   // [{ id, mode, sizes:[1,2,4], svg:'<id>.svg' }] index
```

PNG cells reuse the existing single-cell `SheetDesc` path (cell svg = `composeIcon`).
SVG output skips rastering entirely. Update the `total` progress count: `+ ICONS.length
* (EXPORT_SCALES.length)` for the PNG renders (SVG writes are instant).

**Cursors** reuse this class with PNG-only output (drop the `.svg`), since USS `cursor`
requires a texture.

### Extension 2 — Canonical palette → USS theme export

**Prerequisite (the real work):** there is no single palette object today. Define one
canonical semantic palette in one place — `src/data/uiPalette.ts`:

```ts
export const UI_PALETTE = {
  ink:    '#2C2C2A',        // = INK in parts/library.ts (single source)
  line:   /* style.outline.color */,
  surface:'#…', panel: '#…', accent: '#…',
  status: { focus:'#4C84E0', positive:'#46C07A', warning:'#E0A03A', danger:'#CE4038', /* … */ },
};
```

Make the existing literals **reference this** so colors genuinely agree, not merely
match by eye:
- `INK` in [library.ts](../src/parts/library.ts) → `UI_PALETTE.ink`
- badge `color:` hex in [activities.ts](../src/parts/activities.ts)/[moods.ts](../src/parts/moods.ts) → `UI_PALETTE.status.*`
- `theme.uss --wc-line` ← `style.outline.color`

**Exporter** — write two sibling files at the bundle root (plain strings via
`sink.file`):

```
theme.uss     // UI Toolkit — :root { --wc-ink:#2C2C2A; --wc-line:…; --wc-accent:…; --wc-status-focus:#4C84E0; … }
theme.json    // framework-neutral — same map for uGUI consumers today
```

This is the cohesion contract: icons ship as recolorable masks; `theme.uss` ships the
colors; chrome authored in USS and world sprites both resolve the **same** palette
without sharing a pipeline.

### Contract doc update

Add a "UI assets" section to [CONTRACT.md](../CONTRACT.md) documenting the `icons/`
tree, `theme.uss`/`theme.json`, the tintable-vs-literal rule, and the ownership
boundary — the same way the Family=recipe-id binding is pinned for sprites.

---

## Suggested build order

1. `uiPalette.ts` + repoint `INK`/badge colors (no output change; pure refactor to one source).
2. `theme.uss` + `theme.json` export (Extension 2 — small, unblocks USS theming immediately).
3. `icons.ts` + `composeIcon` + a first batch of control glyphs (`ui-gear`, `ui-close`, `ui-play`, `ui-pause`, `ui-save`).
4. Icons export pass (SVG + PNG + manifest).
5. Diegetic batches (department, status, relationship icons).
6. Cursors (PNG-only) + decorative trim.
7. CONTRACT.md "UI assets" section.
```

