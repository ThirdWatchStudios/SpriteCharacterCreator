# Shapes overlay reader spec — consuming `overlay-style.json`

Game-side (The-Water-Cooler) implementation target for the enriched floor-overlay
grammar. The tool now ships more than `color/weight/dash/motion` per channel; this
doc says exactly what the **Shapes** floor layer must do with the new fields so the
relationship/interaction layer reads ("pops") on a busy floor.

**The seam is unchanged.** Tool owns the *look* (`overlay-style.json`, authored in
[src/core/overlayStyle.ts](../src/core/overlayStyle.ts)); Shapes owns the *drawing*
(immediate-mode, from sim state, every frame). This spec adds reader behavior, not a
new asset path. See [epic-36-ui-assets.md](epic-36-ui-assets.md) §3 for the seam, and
[CONTRACT.md](../CONTRACT.md) row `overlay-style.json` for the boundary.

---

## 0. The one discipline that governs everything

`rules.motionEncodesEvents: true` — **stillness encodes state, motion encodes events.**

A relationship is *state*, so a relationship line must be **visually rich but still**.
Its "pop" comes from static layering (a soft bloom, a directional gradient, anchored
endpoints, weight), NOT from constant animation. Animation is reserved for events and
escalation (a dash scroll on an active suspicion, a single-pulse change flash, a heat
jitter as a tie escalates toward hostility).

If you implement only one thing from this doc, implement the **glow pass** (§3.1) and
the **focus model** (§4) — together they are most of the readability win, and neither
adds motion.

---

## 1. The JSON shape (current)

`overlay-style.json` emitted by `overlayStyleJson()`:

```jsonc
{
  "kind": "floor-overlay-style",
  "generator": "sprite-character-creator",
  "schema": "ui_visual_design.md#visual-language",
  "renderer": "shapes",
  "rules": {
    "motionEncodesEvents": true,
    "oneDominantPressurePerAgent": true
  },
  "focus": { "focusWeightMul": 1.6, "dimAlpha": 0.18, "fadeMs": 180 },
  "channels": {
    "trust": {
      "concept": "Trust",
      "form": "arc-line",
      "color": "--wc-trust",
      "motion": "still",
      "weightByStrength": true, "minWeight": 1.5, "maxWeight": 6, "dash": null,
      "glow": { "color": "--wc-trust", "widthMul": 3.5, "alpha": 0.22 },
      "flow": { "direction": "bidirectional", "speedHz": 0 },
      "endpoints": { "cap": "pip", "radius": 2.5, "color": "--wc-trust" }
    },
    "suspicion": {
      "concept": "Suspicion / conflict",
      "form": "arc-line",
      "color": "--wc-suspicion", "escalateColor": "--wc-hostility",
      "motion": "dash-offset", "weight": 2.5, "dash": [6, 4],
      "glow": { "color": "--wc-suspicion", "widthMul": 3, "alpha": 0.18 },
      "flow": { "direction": "a-to-b", "speedHz": 0.6, "pip": { "radius": 1.5, "spacingMul": 4 } },
      "endpoints": { "cap": "ring", "radius": 3, "color": "--wc-hostility" },
      "jitter": { "ampPx": 1.2, "freqHz": 7 }
    },
    "belief":       { "form": "marker-tint",   "motion": "still",        "axis": { "truth": "--wc-belief-truth", "rumor": "--wc-belief-rumor" } },
    "pressure":     { "form": "halo",          "motion": "pulse",        "color": "--wc-pressure", "minPulseHz": 0.3, "maxPulseHz": 1.6, "maxConcurrentPerAgent": 1 },
    "information":  { "form": "carried-token", "motion": "travels-path", "color": "--wc-information", "tokenRadius": 3 },
    "change":       { "form": "flash",         "motion": "single-pulse", "color": "--wc-change", "durationMs": 450 },
    "surveillance": { "form": "scan-framing",  "motion": "scanline",     "color": "--wc-surveillance", "alpha": 0.15 }
  }
}
```

Field reference: [src/core/overlayStyle.ts](../src/core/overlayStyle.ts) (`OverlayChannel`,
`OverlayGlow`, `OverlayFlow`, `OverlayEndpoints`, `OverlayJitter`).

### Colors are tokens, not hexes
Every `--wc-*` resolves through the same theme the chrome uses (`theme.uss` / `theme.json`).
The importer already resolves these (Layer B). New `glow.color`, `endpoints.color`, and
`escalateColor` resolve the same way; **omitted color fields fall back to the channel's
`color`.**

### Forward-compat
Treat `channels` as an open map and every new sub-object field as optional. Unknown
channel keys → draw nothing + log (matches the §7 fallback rule). A missing `glow`/`flow`/
`endpoints`/`jitter` means "don't draw that embellishment," not an error.

---

## 2. Per-form draw contract (recap of existing)

| `form` | What Shapes draws | `motion` it honors |
|---|---|---|
| `arc-line` | bowed line between two agents | `still`, `dash-offset` |
| `marker-tint` | tint on the agent's floor marker (belief axis blends `truth`↔`rumor`) | `still` |
| `halo` | ground ring under an agent | `pulse` (rate = intensity; cap 1/agent) |
| `carried-token` | small disc riding the agent / path | `travels-path` |
| `flash` | brief full-marker flash | `single-pulse` (`durationMs`) |
| `scan-framing` | REC/scan frame on a watched object | `scanline` |

The new fields below apply primarily to **`arc-line`** (relationships), with `glow`
also valid on `halo` and `carried-token`.

---

## 3. New field reader behavior

### 3.1 `glow` — the legibility lever (STATIC)
Draw a **second, wider, lower-alpha pass UNDER the core stroke**, then the core stroke
on top. Same path geometry.

- width = `coreWeight * glow.widthMul`
- color = resolve(`glow.color` ?? channel `color`), alpha = `glow.alpha`
- Shapes: a fatter line with soft/feathered ends, or an additive-blended duplicate;
  a 2–3 px Gaussian-ish falloff reads best. No animation — the bloom is constant.
- Applies to `arc-line`, `halo`, `carried-token`.

Draw order per edge: **glow pass → core stroke → flow pips → endpoints.**

### 3.2 `flow` — direction without (usually) motion
Encodes *which way the tie points* (who trusts whom; which way info moved).

- `speedHz === 0` → **static gradient** along the arc from start→end per `direction`
  (`bidirectional` = symmetric center-bright gradient). **No animation** — safe for
  state lines. This is trust's case.
- `speedHz > 0` → pips travel the arc at `speedHz` arc-lengths/sec, spaced
  `pip.spacingMul * coreWeight`, radius `pip.radius`, color resolve(`pip.color` ?? channel).
  **This is motion → only legal on event/active channels** (suspicion's case). Do not
  animate flow on a `motion: "still"` channel even if `speedHz>0` is present — clamp to
  static and log; stillness wins (rule §0).
- `direction`: `a-to-b` = source→target (suspicion: the suspicious agent → the suspected),
  `b-to-a` reverse, `bidirectional` = mutual.

### 3.3 `endpoints` — make a line read as a bond
Draw a marker at **each agent anchor** so the arc terminates on people, not in space.

- `cap: "pip"` = filled disc, `"ring"` = stroked ring, `"none"` = skip.
- radius = `endpoints.radius`, color = resolve(`endpoints.color` ?? channel).
- Anchor at the same per-agent point the arc uses (foot/marker center — match existing
  arc endpoints). For suspicion, the `--wc-hostility` ring hints the escalation target.

### 3.4 `jitter` — heat (RESERVED for active/escalated ties)
High-frequency positional wobble of the arc control point(s): amplitude `ampPx`,
frequency `freqHz`. This is the *one* motion allowed to express intensifying STATE,
and only because it reads as agitation/heat rather than a discrete event.

- Gate it on escalation: scale amplitude `0 → ampPx` by the sim's escalation/intensity
  factor for that edge (0 when calm suspicion, full as it tips into hostility). A
  non-escalating tie shows no jitter.
- Pair with the `color` → `escalateColor` cross-fade (suspicion amber → hostility red).

---

## 4. `focus` model — the busy-floor fix

The floor only pops when it stops competing with itself. When the sim has a **selection**
(hovered/selected agent, inspected edge), bias every overlay by whether it *touches the
selection*:

- **Relevant** edge/marker (touches the selected agent): weight ×= `focus.focusWeightMul`
  (and you may raise `glow.alpha` proportionally).
- **Irrelevant**: multiply final alpha by `focus.dimAlpha`.
- **No selection**: everything draws at base (neither bloomed nor dimmed).
- Cross-fade in/out over `focus.fadeMs` so selection changes don't pop harshly.

A channel may override globally-applied values via its own `focusWeightMul` / `dimAlpha`
(none do by default). **Selection state is sim-owned**; these three numbers are the
tweakable art direction.

This composes with everything else: a dimmed edge still draws its glow/flow/endpoints,
just at `dimAlpha`.

---

## 5. Protective rules the reader must enforce

| Rule | Reader behavior |
|---|---|
| `motionEncodesEvents` | Never animate a `motion: "still"` channel. `flow.speedHz>0` and `jitter` are ignored/clamped on still channels (log once). Static gradient + glow + endpoints are always allowed. |
| `oneDominantPressurePerAgent` | At most ONE `pressure` halo per agent at a time (highest intensity wins). Pre-existing rule; unchanged. |

---

## 6. Importer (Layer B) changes

The existing overlay→SO importer must carry the new sub-objects through to the
`FloorOverlayStyle` SO so the Shapes draw code can read them:

- Add `glow {colorToken, widthMul, alpha}`, `flow {direction, speedHz, pip?}`,
  `endpoints {cap, radius, colorToken}`, `jitter {ampPx, freqHz}` to the per-channel
  struct (all nullable).
- Add a top-level `focus {focusWeightMul, dimAlpha, fadeMs}`.
- Resolve `glow.color` / `endpoints.color` / `escalateColor` through the same
  `--wc-*` → Color map already used for `color`; null color → inherit channel color.
- Re-import is idempotent and tweakable post-build (the project rule): editing
  `overlay-style.json` and re-running the importer must change the look with no code edit.

---

## 7. Acceptance — "done" looks like

1. Trust arcs render with a visible soft bloom, a still center-bright gradient, and a pip
   on both agents — and **do not animate**.
2. Suspicion arcs scroll their dash, show traveling pips, and as the sim escalates an edge
   the color cross-fades amber→red and a heat jitter ramps in.
3. Selecting an agent blooms its ties and dims the rest, cross-fading over ~180 ms.
4. No channel marked `motion: "still"` ever animates.
5. Deleting any new field from `overlay-style.json` and re-importing degrades gracefully
   (embellishment disappears; no errors).

## 8. Non-goals / out of scope here

- **Overhead badges/puffs** (mood/activity/attention) — different seam (tool-authored
  sprite atlases, sim places/animates). Separate workstream; see CONTRACT.md §3.9.
- **No tool-authored line assets.** Lines stay procedural; this spec only enriches the
  data Shapes reads.
- The actual `--wc-*` hex values live in `theme.uss` / [uiPalette.ts](../src/data/uiPalette.ts),
  not here.
