# Emotional pain label views: design record

Last Updated: 2026-09-04
Version: 1.0
Status: **the design phase is settled.** `v14-a_base` is the chosen view. 72 presets across 14
rounds, all reachable, none ever edited.

This is the SETTLED and VARIES record the plan asks for at the end of the design rounds. It is the
part of the work that is not already in the code: what was chosen, against what, and why. The
parameters themselves are documented where they live, in `src/emo/viewParams.ts`; the presets
carry their own notes in `src/emo/viewPresets.ts`; the opening round's brief and the five research
lanes behind it are in [`brief.md`](brief.md) and [`research/`](research).

---

## 1. What this is, and how to see it

The globe's emotional layer used to draw one English pain word per country as a canvas sprite at a
fixed height. A country-emotion lexicon supplies the same pain categories in the primary language
of each of 195 countries across 20 scripts. This renders those, as a DOM overlay, with a network
that grows out of the country you click.

It is **dev-gated and does not affect a normal visitor.** Nothing here runs unless the gate is
open, which is `?ev=1` or `?ev=2` in the URL, or `localStorage.setItem("pain-emo-views", "1")`
and a reload. `?emoViews=1` is still accepted as the original spelling.

```
http://127.0.0.1:5173/?ev=2                       the chosen view, controls closed
http://127.0.0.1:5173/?ev=1                       the same, with the parameter panel open
http://127.0.0.1:5173/?ev=2&emoPreset=<id>        any of the 72, by id
http://127.0.0.1:5173/?ev=1&freeze=1&cam=22,86,2.35   frozen at a fixed camera, for captures
```

`[` and `]` step between presets. Every parameter has a live control, and "Reload with these"
serialises the whole state into the URL.

**The gate comes off by changing one constant**, `DEFAULT_EMO_PRESET_ID` plus the `?ev` check in
`src/emo/emoViewConfig.ts`. It has deliberately not been taken off: the percentages the classifier
reads are documented upstream as dummy data, so promoting this would publish a native-language
pain word attributed to each of 195 real countries on the strength of numbers that do not mean
anything yet. The blocker is the data, not the views, and the pipeline takes real percentages with
no code change.

## 2. Why a DOM overlay rather than WebGL text

Decided by measurement in Phase 0, not by preference. Text goes through the browser's own shaping
engine, which is the only path that correctly handles Arabic joining (the Dari term carries a
ZWNJ), Devanagari conjuncts, Khmer reordering and Thaana right-to-left. Canvas sprites and MSDF
atlases both shape these wrongly. It is also crisp at every zoom and gives native click targets.

The cost is that **the overlay always paints over the WebGL canvas**, at any radius. An arc can
never be drawn in front of a label by moving it outward, and a whole round was spent establishing
that; see `selectionLift` and the note on it below.

## 3. The chosen view, and what still holds the alternative

`v14-a_base`. Every value below was chosen by the operator against at least one alternative that
is still reachable by id, which is the point of an append-only registry.

| what | value | the alternative, still reachable |
|---|---|---|
| Language | bilingual, native above English | `v1-a_english-dom` English only, `v1-b_native` native only, `v1-d_focal` camera-aware |
| Identical lines | collapse to one, for the 29 English-primary countries | `v1-c_bilingual` and every preset before the parameter existed draw both |
| Category network | Delaunay within the clicked category | `v4-d_category-gabriel` sparser, `v4-f_category-complete` all-to-all, ruled out as too dense |
| Resting world network | **none** | `v4-b_world-gabriel`, `v4-c_world-delaunay`. Ruled out: a network built from proximity alone says nothing |
| Selection mark | glow, fill and outline together | `v5-c_mark-glow`, `v5-d_mark-outline` each alone |
| Selection emphasis | dim the rest and bold the category | `v5-f_emphasis-bold` bold only |
| Depth fade | cubic, `labelDepthFadeCurve: 3` | `v6-d_fade-linear`, `v6-e_fade-quadratic` |
| What a click moves | the rest sinks; the clicked category holds its height | `v6-b_no-lift`, and the whole lift family. Inverted deliberately: a lift pushed the thing you clicked out of frame when zoomed in |
| Non-category leader lines | held, not shortened, and dimmed to 0.55 | `v7-d_sink-deep` and the sink family |
| Chosen leader lines | heavier than the network arcs, and they grow with the wavefront | `v9-b`, `v9-c`, `v9-d` are the weight ladder; `v9-g_leader-only` drops the country colour |
| Growth direction | the clicked country's line grows up, every other grows down | `v10-b_grow-from-foot` grows all of them up |
| Whole gesture | 1160 ms, 260 lead plus 900 spread | `v10-d_under-a-second` at 800 |
| Depth step split | 0.3 to the line, so 0.7 to the arc | `v13-a_base` holds 0.5 |
| Teardown | twice the build rate, 580 ms, the build in reverse | `v11-b_retract-1x`, `v11-c_retract-half`, `v10-c_retract-slow`, `v10-a_base` at ten times |
| Repeat legend click | clears the selection | `v13-a_base` rerolls to another country of the category |
| Mark for a country with no polygon | 0.9 degrees of great-circle radius | measured against 0.4 and 1.6; see section 5 |
| Declutter | **off**, by instruction | `v3-a_declutter-priority` and `v3-b_declutter-dense` |
| Multiplex shells | **off** | `v4-h_multiplex-violet`, `v4-i_multiplex-wide` |
| Colour | white | `v4-g_violet-flat`, and `colourMode` has family and category ramps |

## 4. SETTLED and VARIES, by round

| round | presets | what it varied | what it settled |
|---|---|---|---|
| v1 | 9 | the renderer and the language mode | bilingual, native above English |
| v2 | 7 | world network family, category network density | the non-crossing families exist and are measurable; no world network is wanted |
| v3 | 4 | declutter and multiplex | both off. Declutter hides more than half the labels; that is geometry, not tuning |
| v4 | 9 | the opening design round, one candidate per idea | Delaunay within a category; no resting world network; all-to-all too dense |
| v5 | 9 | how a selection is marked and emphasised | fill and outline together, dim and bold together, the halo adopted |
| v6 | 6 | the depth fade curve and the lift | cubic; and the lift inverted into a sink |
| v7 | 6 | arc height, type size, sink depth, spread speed | the shipped values; `v7-f_no-motion` is the control with nothing animated |
| v8 | 4 | the spread's per-country easing, and holding the leaders | `v8-d_hold-dim`: nothing steps back, and the rest dims a little more |
| v9 | 7 | the chosen leader's weight | the boldest, and it grows with the wavefront |
| v10 | 5 | the whole gesture as a sequence | line, then network, then mark, in that order, and the reverse on the way out |
| v11 | 3 | teardown speed | twice the build rate |
| v12 | 1 | leader foot and the no-polygon mark | foot at 0.8, mark at 0.9 degrees |
| v13 | 1 | how a depth step divides | 0.3 to the line |
| v14 | 1 | what a repeat legend click does | it clears |

**Still varying, deliberately.** Declutter, the multiplex shells, colour, the world network
families, and every language mode other than bilingual. None is a defect; each is a preset away.

## 5. The measurements that back the defaults

Every one of these was taken in real GPU-backed Chrome against the running app.

**Cost.** 8.30 ms median frame time with the whole feature on, against 8.30 ms with it off, in
all-layers mode while spinning. Unchanged during the spread animation, during a teardown, and
settled. The animation is one integer per mesh per frame, because `LineSegmentsGeometry` honours
`instanceCount`, so writing the segments in wavefront order **is** the animation.

**The non-crossing families**, over the 195 country label points. The convex hull of points on a
sphere is their Delaunay triangulation, and `EMST` is a subset of `RNG` is a subset of `Gabriel`
is a subset of `Delaunay`, so all four are planar and connected:

| graph | edges | median arc | components | crossings |
|---|---|---|---|---|
| MST | 194 | 5 deg | 1 | 0 |
| RNG | 233 | 5 | 1 | 0 |
| Gabriel | 360 | 7 | 1 | 0 |
| Delaunay | 579 | 9 | 1 | 0 |
| kNN k=3 | 389 | 6 | **2** | **43** |

**Declutter.** At the default camera 144 labels are drawn and 76 percent of them collide. A hard
non-overlap rule leaves 61. About 60 bilingual labels fit on this screen without touching, and no
placement strategy changes that; it is a trade between coverage and legibility, and coverage won.

**The depth step split.** `arrivalOf` ramps from `arcLandsAt(depth, span) = (depth - 1 + (1 -
share)) / span`, so the share moves when a word lights by `0.2 / span` of the sweep. Measured at a
span of 4: the word lights **41 ms later at 0.3 than at 0.5** at the shipped speed, and 455 ms
later at a tenth of it. The country's mark does not move at all, because `markArrivalOf` is
measured from the end of the step.

**The mark for a country with no polygon.** Singapore, drawn diameter measured by differencing
against the mark switched off: 0.4 degrees gives 45 device px and reads as a smudge; **0.9 gives
74 px**, about the label's own two-line height, and stays inside the strait; 1.6 gives 113 px and
spills across Malaysia and Indonesia, which are in other categories. Singapore's true angular
radius is 0.138 degrees, so at true size the disc would be 6 px and invisible: every value is a
symbol rather than a footprint.

## 6. Rules for changing this code

- **`src/globe/GlobeView.ts` is unmodified and should stay that way.** Everything here parents to
  `globe.earthContent`, which is the object the auto-spin rotates, so it inherits the spin for
  free and cannot be forgotten in `syncWorldRotation()`.
- **Presets are append-only. Never edit a shipped one.** A behaviour *fix* may apply to all of
  them; a *value* may not. When a change is a choice rather than a fix, add a parameter whose
  default preserves what shipped, then a new preset that carries the new value.
- **A parameter that is exposed must work.** Adding an enum parameter fails the build until the
  panel has an entry for it, and it must also be added to whatever `setParams` comparison decides
  it needs a repaint, above the assignment.
- **Booleans do not work as parameters. Use a two-value enum.**
- **Test what is painted, not what is set.** Three separate defects here passed a check that read
  back the value that had been assigned: a `visibility` clear that the stylesheet overrode, a
  `hidden` attribute that a `display: flex` rule outranked, and a connectivity guarantee that a
  later trim deleted 19 percent of. Read `getComputedStyle`, count what is drawn, or compare a
  rendered count against an independently computed one.
- **Two clocks for one gesture is this feature's recurring bug.** A teardown runs at
  `selectionRetractSpeed` times the build; a category's emphasis fades over `selectionMotionMs`;
  nothing ties them together. Any new code asking "is this category selected" has to decide which
  of the two it means.
- **The globe breathes.** The temperature shell and the CO2 haze run on
  `sin(elapsedTime * 0.3)`, a 20.9 second period at plus or minus 15 percent, so two captures of
  the same untouched frozen page 8 seconds apart differ by 38 percent of pixels. No whole-frame
  diff of two captures taken seconds apart means anything, and any brightness check must be a band.

## 7. Where the rest of it is

The full archive lives at the workspace root, **outside every git repository**:

```
../../../docs/emo-label-views/HANDOFF.md   the map: state, reading list, open questions, rules
../../../docs/emo-label-views/PROGRESS.md  the append-only archive: 32 sections, 101 decisions,
                                           67 numbered failures, every measurement
../../../artifacts/emo-views/              the capture helpers, the probes, and the gallery
```

That is a risk worth naming: the workspace root is not Git-managed, so the archive has no undo and
no second copy. This file is the part that belongs with the code, and it is written so that losing
the archive would not lose the decisions.
