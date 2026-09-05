# Country Pain Profile and Presentation Plan

Last Updated: 2026-09-05
Version: 1.1
Status: approved after three discovery rounds

## 1. Objective

Add a selected-country profile and an optional presentation tour to the P.A.I.N. globe. Preserve
the chosen emotional-pain view, keep every experimental candidate reachable through a separate
country-profile preset, and adopt the strongest result only after desktop, mobile, semantic, and
performance checks.

The completed emotional-label feature remains the base. This work has its own branch, modules,
preset namespace, design rounds, and final gallery.

## 2. Working State

| Item | Value |
|---|---|
| Frontend worktree | `pain-frontend-worktrees/country-pain-profile-rounds` |
| Frontend branch | `feat/country-pain-profile-rounds` |
| Base | `7ca5492`, the chosen `v14-a_base` emotional-pain view |
| Baseline gate | `npm run check` passes |
| Plan and goal | Tracked in `pain-frontend/docs/country-pain-profile/` |
| Frontend merge target | None in this goal; team acceptance decides the later PR target |
| Setup branch | `fix/powershell-metrics-text`, created from `pain-setup/development` |
| Country-profile gate | `?cp=1` |
| Country-profile preset | `cpPreset=v{round}-{letter}_{slug}` |
| Random seed | `43` for any randomized texture offset, sample, or visual probe |
| Durable gallery | Deferred until final adoption |

Before feature code, merge the three current `origin/demo/all-features` commits after `f60826a`:

- `e157476`: current legend assets and placement
- `3f3b5f9`: restored dark and blue theme control
- `11152ef`: session cache for layer point arrays

The merge simulation found no conflict with `feat/emo-label-views`. Re-run the frontend gate and
capture a fresh performance baseline after merging.

The frontend branch deliberately continues from the selected emotional-view experiment rather
than `main`, because `main` does not contain that required base. This goal does not merge or open a
PR. The later team-acceptance step will choose the target branch.

The root Docker build always copies `pain-frontend/`, not the sibling worktree. Final integration
therefore uses this reversible procedure:

1. Require the primary `pain-frontend/` checkout to be clean and record its current branch and SHA.
2. Switch that checkout to a detached state at the feature worktree's exact verified commit.
3. Build and smoke through the canonical root Compose file.
4. Restore the recorded branch and SHA, then confirm its tree is still clean.

Do not edit Compose to point at the worktree. A branch already held by a worktree cannot also be
checked out in the primary checkout, which is why the integration checkout is detached.

## 3. Evidence From Discovery

### 3.1 Live data

Read-only checks against `GET /init/:layer` on 2026-09-05 found:

| Layer | Rows | Shape | Categories | Value range |
|---|---:|---|---:|---:|
| Emotional | 174 | country | 1 API category | 0.2965 to 0.7238 |
| Environmental | 10,439 | coordinates | 8,100 Temperature, 2,339 CO2 | 0 to 1 |
| Physical | 15,282 | coordinates | 6 conditions, 2,547 each | 0 to 1 |
| Socioeconomic | 204 | country | GDP | 0 to 0.7655 |

The repository does not contain the database-ready source files or the complete transformation
pipeline. Raw temperature, CO2, physical, and socioeconomic units cannot be reconstructed. The UI
must describe these as normalized signals and must not show degrees C, ppm, prevalence, GDP, or
probability claims.

The live `togglemetrics` table was inspected read-only on 2026-09-05. Both `kind` and `element` are
unbounded PostgreSQL TEXT columns, so `ISO3:English name` fits without a migration. The PowerShell
setup still creates enum-backed columns and must be aligned for future installs.

### 3.2 Existing paths to reuse

- `loadEmoData()` supplies 195 English country names, native emotional terms, English terms,
  category winners, and normalized classifier scores.
- `aggregateChoroplethValues()` already applies the globe's socioeconomic maximum-per-country rule.
- `EmoLabelLayer.selectCountry()` and `clearSelection()` are the authoritative emotional selection
  entry points.
- `EmoSelectionMotion` already drives the origin leader, breadth-first network, country marks,
  label emphasis, and exact reverse motion.
- `flyGlobeToLatLng()` already supplies the cubic camera movement.
- `choroplethField.ts` already loads and caches Natural Earth country polygons.
- `GlobeView` already owns the raycaster, globe rotation, `InstancedMesh` markers, `DataTexture`
  fields, and renderer statistics.
- `trackToggle()` already records a text kind, element, and enabled state in the current schema.

### 3.3 Confirmed constraints

- Global card selection and emotional network selection need separate lifetimes.
- A surface hit must be converted from world space into the rotating globe's local coordinates.
- The existing label click router and the new surface picker must not both process one click.
- Natural Earth has no polygon for 29 of the 195 labelled countries. Do not invent surface areas.
- Camera flights need cancellation. A paused controller must not leave an old animation or timeout
  able to move the camera later.
- Auto-updating presentation content needs a persistent keyboard-operable Play or Pause control.
- Reduced-motion mode uses cuts and fades rather than camera flight.
- Existing `InstancedMesh` and texture rendering are the performance baseline. No Nanite-style
  system, SEA3D conversion, or new rendering dependency is justified.

## 4. Locked Decisions

1. Use peak normalized signal inside a country for physical pain, Temperature, and CO2. A mean
   would imply an undocumented sampling or area-weighting model.
2. Use the existing emotional and socioeconomic country values because they match the rendered
   semantics.
3. Do not apply another logarithmic transform. The API values are already normalized and upstream
   transforms are unknown.
4. Encode a value through glyph area. A glyph's linear scale is `sqrt(value)`, making its visible
   area proportional to the value.
5. Treat missing data as unavailable rather than zero. Draw an empty outline and provide an
   accessible description.
6. Enter all-pain mode for presentation. It contains all four indicators and the emotional network.
7. Restore the previous layer when presentation is turned off. Presentation must not replace the
   user's prior view.
8. Never auto-resume a manual pause. It is the persistent control required for long motion.
9. Resume an interaction pause after three idle minutes with a warning. This preserves exhibition
   behavior without overriding a manual pause.
10. Log human country opens and closes. Do not count automated cycles as click events.
11. Use exact available polygons for surface clicks. The 29 missing microstates remain selectable
    through labels and presentation.
12. Use an independent `cp` gate and `cpPreset` registry so this chain stays separate from the
    emotional-view rounds.
13. Test profile and globe environmental treatments independently. A card decision must not be
    confounded with a globe texture decision.
14. Change the survey copy to `locate your pain`. It is short and describes the location step.
15. Allow retained views to add at most 10 percent to median frame time, paired against the fresh
    post-merge baseline.
16. Keep retained p95 frame time below 16.7 ms in the heaviest view on the test machine.
17. Cap gzipped JavaScript growth at 30 kB. The card and controller do not justify more.
18. Load experimental presets only behind `cp=1`. Rejected configurations must not burden the
    normal entry path.
19. Use inline SVG only for new dynamic glyphs. Existing image legends stay unchanged until a
    trial proves that one must change.
20. Freeze the exact partial state on interaction pause. Resume clears and replays the same country.
21. Align the PowerShell metrics table with the existing TEXT schema so country names work there.
22. Show no visible normalized numbers. Accessible SVG descriptions expose the value without
    making the artwork read as a dashboard.
23. Let Codex choose each round winner, with evidence required for every choice.
24. Preserve candidates as URL presets and defer PNG capture until the design is adopted.
25. Apply the 30 kB gzip budget to the default entry graph without `cp=1`. Report the lazy
    experimental chunk separately.
26. Retain the hard 16.7 ms p95 requirement selected by the operator. If the post-merge baseline
    already fails, performance work must first bring it under the limit or stop with evidence.
27. Include source point count in accessible signal descriptions and measure its relationship to
    peak value before presenting the peak as a country summary.
28. Cycle all 195 labelled countries in presentation, including countries without polygons.
29. Retain every published `cpPreset` as replayable. Temporary spikes that never enter the registry
    are not retained candidates.
30. Count unavoidable test users and metrics instead of deleting them. Integrated page loads and
    metrics checks write bounded rows to the current database.
31. Use a detached primary checkout for the final integrated build, then restore it exactly.

## 5. Architecture

Keep the shared production path small. Do not add a framework or rendering dependency.

```text
main.ts
  CountrySelectionController
    selected ISO3 and source
    active layer
    one open/close metrics path
    emotional selection bridge
  CountryProfileData
    cached layer arrays
    country polygon lookup
    normalized summaries
  CountryProfileView
    English country name
    active indicators
    inline SVG glyphs
    responsive placement
  CountryPresentation
    abortable state machine
    camera and emotional motion bridge
    manual and interaction pauses
```

Suggested ownership:

```text
src/countryProfile/data.ts          country summaries and missingness
src/countryProfile/presets.ts       append-only cp design registry
src/countryProfile/profile.ts       DOM and inline SVG view
src/countryProfile/presentation.ts  tour state machine
src/countryProfile/countryProfile.css
```

Reuse narrow exports from existing files where required. Do not create interfaces with one
implementation or factories for a single view.

The experimental preset registry is loaded only when `cp=1`. The adopted configuration may use the
normal entry path later. Vite should keep the experimental registry and its round-only CSS in an
async chunk.

## 6. Data Contract

For each ISO3 country:

```ts
type CountryPainProfile = {
  iso3: string;
  countryName: string;
  emotional: {
    category: string;
    nativeTerm: string;
    englishTerm: string;
    value: number;
  };
  temperature: CountrySignal;
  co2: CountrySignal;
  physical: CountrySignal;
  socioeconomic: CountrySignal;
};

type CountrySignal = {
  value: number | null;
  pointCount: number;
};
```

Rules:

1. Emotional uses the same 195-country dataset as the visible labels.
2. Socioeconomic uses the maximum normalized row for the exact ISO3, matching the choropleth.
3. Temperature uses the maximum `Temperature` point inside the country polygon.
4. CO2 uses the maximum `CO2` point inside the country polygon.
5. Physical uses the maximum point across the six physical conditions inside the country polygon.
6. Values remain numeric `[0,1]` signals. Clamp only for drawing safety and preserve the source
   value for diagnostics.
7. Build the spatial index once per fetched layer array. Never scan every polygon on every click or
   frame.
8. Bounding boxes may reject impossible polygon checks. No spatial dependency is needed for 177
   coarse polygons and about 25,700 coordinate rows.
9. Include `pointCount` in each accessible signal description. It is invisible in the visual card
   but discloses how much source coverage produced the peak.
10. Measure the per-country relationship between `pointCount` and peak value for physical pain,
    Temperature, and CO2. Record the result before the opening design round.

## 7. Design-Round Policy

This is a new `figure-design-rounds` chain adapted to a live WebGL view.

- Every candidate uses `v{round}-{letter}_{slug}` inside the `cpPreset` namespace.
- The opening round may compare structurally different card designs.
- From round 2 onward, each candidate differs from the chosen base in one named dimension.
- Every later round includes the settled base as `control`.
- Candidates are immutable after the round closes.
- Each round records SETTLED, VARIES, traps, measurements, and selection in the preset module's
  docstring or adjacent source comment.
- Codex opens every candidate in a real browser and chooses the winner from meaning, hierarchy,
  visual quality, desktop and mobile fit, accessibility, and performance.
- Temporary screenshots may be used for inspection and removed after the round. Do not build the
  durable gallery until final adoption.
- After choosing a winner, begin the next unblocked round without asking for styling approval.
- Ask only if new evidence exposes a material semantic or product decision outside the locked set.

## 8. Implementation Phases

### Phase 0: Reconcile the base and record measurements

1. Merge `origin/demo/all-features` into the new frontend branch.
2. Verify the expected three commits and no unrelated changes.
3. Run `npm run check`.
4. Inspect the live `togglemetrics` column types through `information_schema`. Record that `kind`
   and `element` are TEXT before emitting country events.
5. Prove the detached-checkout integration procedure in section 2 can build this exact baseline and
   restore the primary checkout without a diff.
6. Measure current production bundle and gzip sizes. Record the default entry graph separately from
   any lazily loaded experimental chunk.
7. Measure median and p95 frame time, draw calls, triangles, textures, and DOM count for:
   - all-pain at rest;
   - `v14-a_base` settled after a country click;
   - mobile viewport at 393 by 852 CSS pixels.
8. Use the same local Chrome build, `npm run dev:pain-server`, viewport, camera, and scripted
   gesture in Phase 0 and Phase 7. Sample each state for 20 seconds after a two-second settle and
   record the exact `eval.mjs` invocation here.
9. If baseline p95 is already at or above 16.7 ms, keep the hard limit. Phase 7 must reduce the
   baseline before adoption or stop with evidence rather than relaxing an approved criterion.
10. Record the baseline in this plan before any rendering change.

Exit: merged base is clean, committed, and all baseline evidence is reproducible.

#### Phase 0 evidence, 2026-09-05

Upstream reconciliation:

- `efd736d` is a two-parent merge of the planning commit and `11152ef`.
- It contains the expected legend, theme, and point-cache changes from `e157476`, `3f3b5f9`, and
  `11152ef`.
- `npm run check` passed before the merge commit.

Live metrics schema:

```text
kind|text||text
element|text||text
```

The query used `information_schema.columns` against `togglemetrics`; it did not mutate data.

Bundle after the upstream merge:

| Asset | Raw | Gzip |
|---|---:|---:|
| HTML | 2.29 kB | 0.83 kB |
| CSS | 41.47 kB | 7.88 kB |
| Default JavaScript entry | 819.73 kB | 216.44 kB |
| Country-profile lazy chunk | not built | not built |

Browser measurement used Google Chrome 152.0.7977.76 and the existing GPU-backed
`artifacts/emo-views/eval.mjs` runner. The injected expression is tracked at
`scripts/measure-country-profile-frame.js`. Each scenario sampled requestAnimationFrame gaps and
wrapped the live WebGL draw and texture-bind methods for 20 seconds after the page settled.

```bash
eval_runner=/Users/cs/local/code/apps/web-pain-globe/artifacts/emo-views/eval.mjs
desktop_url='http://127.0.0.1:5173/?ev=2&emoPreset=v14-a_base&freeze=1&cam=22,86,2.35'
mobile_url='http://127.0.0.1:5173/?ev=2&emoPreset=v14-a_base&freeze=1&cam=22,86,4.0'

node "$eval_runner" \
  "${desktop_url}&perfScenario=rest&perfMs=20000" \
  9000 1500 950 < scripts/measure-country-profile-frame.js

node "$eval_runner" \
  "${desktop_url}&perfScenario=selected&perfIso=IND&perfMs=20000" \
  9000 1500 950 < scripts/measure-country-profile-frame.js

node "$eval_runner" \
  "${mobile_url}&perfScenario=rest&perfMs=20000" \
  11000 393 852 < scripts/measure-country-profile-frame.js
```

| Scenario | Frames | Median | p95 | Max | Draws/frame | Primitives/frame | Textures |
|---|---:|---:|---:|---:|---:|---:|---:|
| Desktop, all-pain rest | 2,400 | 8.3 ms | 9.6 ms | 10.4 ms | 8 | 239,452 | 4 |
| Desktop, India settled | 2,400 | 8.3 ms | 9.7 ms | 10.4 ms | 11 | 293,786 | 5 |
| 393 by 852, all-pain rest | 2,401 | 8.3 ms | 9.7 ms | 10.4 ms | 8 | 239,452 | 4 |

All scenarios had 1,622 DOM elements and 195 emotional labels. The desktop rest and mobile rest
each drew 144 labels. The settled India selection drew 13 visible emphasized labels.

Integrated-build proof remains open. The primary checkout was switched cleanly to detached
`57db4ea`, but Docker stalled while loading metadata for `node:20-bookworm-slim`, which is absent
locally. The attempted wrapper was interrupted after the log made no progress. Its shell trap did
not run under the external interrupt, so the checkout was restored explicitly and verified clean at
`feat/emo-label-views` commit `7ca5492`. Do not count Phase 0 complete until a later build reaches
the feature source, serves the read-only 174-row emotional endpoint, and restores the same checkout.

### Phase 1: Country geometry and normalized data index

1. Expose the existing cached Natural Earth geometries through the smallest shared API.
2. Add globe-local surface coordinate picking.
3. Add point-in-polygon support for Polygon, MultiPolygon, holes, and the antimeridian.
4. Build country summaries from cached layer arrays using the contract in section 6.
5. Preserve `null` and point counts for missingness and verification.
6. Add one runnable focused check for polygon lookup, holes, antimeridian handling, area scaling,
   and aggregation.

Verify:

- Compare live row counts and category spellings with section 3.1.
- Compare socioeconomic results with `aggregateChoroplethValues()`.
- Spot-check a large country, a border country, an island with a polygon, and one missing
  microstate.
- Record coverage for the 166 label-matched polygons and the full 195-country set: countries with
  Temperature, CO2, physical, socioeconomic, and emotional data.
- Record the correlation between `pointCount` and peak value for physical pain, Temperature, and
  CO2. Keep the approved peak statistic, but carry its measured density limitation into the
  accessible description and design record.
- `npm run check` passes.

Exit: a country profile can be computed without changing pixels or adding requests, and its signal
coverage and sampling-density limitation are recorded.

#### Phase 1 data evidence, 2026-09-05

The live index built 195 profiles from the existing cached-array shapes in 85.9 ms. It assigned
coordinate points through the 177 Natural Earth geometries, of which 166 match the label roster.

| Signal | Full 195 coverage | Mapped 166 coverage | Missing | Mapped source points |
|---|---:|---:|---:|---:|
| Emotional | 195 | 166 | 0 | not spatially aggregated |
| Temperature | 132 | 132 | 63 | 2,004 |
| CO2 | 139 | 139 | 56 | 1,857 |
| Physical | 152 | 152 | 43 | 13,153 |
| Socioeconomic | 188 | 160 | 7 | 188 |

CO2 covers 83.7 percent of the mapped label countries, so Phase 3 may keep its permanent outer
ring. Countries without polygon geometry cannot receive a coordinate-grid signal and remain
explicitly unavailable for those measures.

The Pearson correlation between contributing point count and the selected peak is substantial:

| Signal | Correlation |
|---|---:|
| Temperature | 0.4884 |
| CO2 | 0.7608 |
| Physical | 0.3744 |

The operator already selected the peak statistic. These measurements do not reopen that choice;
they require every accessible description to include its source-point count.

An independent maximum-by-ISO reduction over all 204 socioeconomic rows produced zero mismatches
against the 195 profile records. Representative checks:

| Country | Temperature | CO2 | Physical | Socioeconomic |
|---|---|---|---|---|
| India | 0.1511 from 31 | 0.2555 from 40 | 0.9427 from 266 | 0.1190 from 1 |
| Austria | 0.2769 from 2 | 0.1945 from 1 | 0.0979 from 15 | 0.2304 from 1 |
| New Zealand | 0.0035 from 7 | 0.1727 from 12 | 0.0834 from 84 | 0.2760 from 1 |
| Singapore | unavailable | unavailable | unavailable | 0.2280 from 1 |

The focused synthetic check covers peak selection, source counts, missingness, emotional fallback,
and proportional area. A real GPU browser then aimed the camera at two known local coordinates
while the globe was rotated by 1.2 and -0.8 radians. `pickSurfaceLatLng()` recovered both points
with errors below `4e-14` degrees. Phase 1 exit passes.

### Phase 2: One authoritative country selection path

1. Add a country selection owner separate from emotional network state.
2. Route label, legend, surface, presentation, layer, and clear actions through it.
3. A label or exact polygon click toggles the profile once.
4. Emotional and all-pain selections also call the existing emotional selection path.
5. Other single layers select the profile without creating an emotional network.
6. Layer changes retain the country and update only the profile contents.
7. Human replacement emits old-country close followed by new-country open.
8. Log `kind=category`, `element=ISO3:English name`, and `enabled=true|false`.

Create a separate `pain-setup` worktree and commit that changes the PowerShell metrics columns to
TEXT, matching the shell setup. Create it from `pain-setup/development`. This affects fresh installs
only and does not migrate the current database, whose columns are already TEXT. Review the generated
SQL and run `docker compose config`; never run `populate-db.sh --init` against the populated volume.

Verify real label clicks, polygon clicks, empty-globe clear, repeat clear, layer switches, and all
29 no-polygon countries through their labels.

Exit: all human selection routes agree and metrics state matches the painted profile state.

#### Phase 2 evidence, 2026-09-05

- The state check covers human open, replacement, close, inert same-country selection, unknown ISO3,
  automated selection, and automated takeover of a tracked human selection.
- `?cp=1` loads `runtime.ts`, `data.ts`, and `selection.ts`; ordinary `?ev=2` loads none of them.
- The built lazy profile code is 3.77 kB gzip JavaScript plus 1.40 kB gzip CSS. The default entry
  grew by 1.61 kB gzip from the Phase 0 baseline.
- A live label, layer, surface, return, and clear sequence wrote India on/off and Moldova on/off.
  Switching to Environmental Pain wrote no country close.
- A later painted-profile pass retained India while each single layer showed exactly its one
  indicator, then showed all four in all-pain. A second India click hid the card and cleared the
  emotional emphasis together.
- All 29 no-polygon countries have live label elements. Singapore was clicked directly and showed
  explicit unavailable spatial signals plus its available socioeconomic value.
- Browser testing has written 16 bounded `kind=category` metric rows. They remain in the database.
- `pain-setup` commit `20b7c76` aligns fresh PowerShell installs with the Bash TEXT schema. Its
  PowerShell parse and Compose configuration checks passed.

Phase 2 exit passes.

### Phase 3: Opening country-profile design round

Build the literal specification as a control and three structurally different candidates:

- a quiet horizontal row of four organic glyphs;
- a compact vertical or staggered constellation;
- a divided typographic card where the emotional term anchors three numeric shapes.

All candidates show:

- English country name in the established white font;
- a thin divider;
- emotional native term with smaller English text;
- environmental, physical, and socioeconomic shapes derived from the production button family;
- temperature as a red fill and CO2 as an outer-ring opacity;
- physical in the physical-layer red;
- socioeconomic in the current yellow family;
- proportional area, explicit empty state, and accessible normalized descriptions.

The desktop view is centered. The mobile view sits above the share button and any visible legend.
The card body remains pointer-transparent. Only the presentation control accepts input.

Read the Phase 1 coverage table before fixing the candidate encodings. If CO2 covers fewer than
half of the 166 label-matched polygons, at least one candidate must make the CO2 ring conditional
rather than reserve an empty ring in most countries.

Inspect representative long and short country names, RTL and multi-script emotional terms, high and
low values, missing values, and both themes. Choose and record the winner.

Exit: one opening design is selected and all candidates remain URL-addressable.

#### Opening round v1 evidence, 2026-09-05

| Candidate | Result |
|---|---|
| `v1-control_literal-row` | Clear, but the emotional term lacks hierarchy |
| `v1-a_quiet-row` | Best hierarchy and spacing; selected |
| `v1-b_constellation` | Absolute positions collide with changing globe text |
| `v1-c_typographic-anchor` | Compact, but crowds the lower-left controls |

`v1-a_quiet-row` is the base for round 2. The final desktop profile rectangle is 760 by 136 px and
does not intersect the title, layer stack, share button, or bottom-left controls. At 393 by 852 it
is 361 by 134 px, leaves a 26 px vertical gap above the share button, and creates no horizontal
overflow. Blue and dark themes, India, Singapore, and United Arab Emirates were inspected. Arabic
shaping and the long English name fit; the English secondary term now matches the existing
emotional category label. The accessibility tree exposes normalized values and source-point counts.
No PNG gallery was created; inspection used inline Computer Use screenshots.

Phase 3 exit passes. Phase 4 opens spacing, fade transitions, and single-layer composition from
the selected quiet-row base.

### Phase 4: Layer composition and transition rounds

1. In all-pain mode show all four indicators.
2. In a single layer show only its centered indicator.
3. Keep the country name in place while values fade out and the new set fades in.
4. Do not bold or enlarge the emotional legend's active word through the profile.
5. Replace the survey button label with `locate your pain` and confirm the blob still fits.
6. Run one-variable rounds for divider, spacing, scale, opacity, mobile position, and transition
   timing only when direct inspection finds an open visual question.
7. Respect `prefers-reduced-motion` by using immediate replacement or a short opacity dissolve.

Exit: desktop and mobile layouts do not overlap production chrome in any layer.

#### Round v2 and Phase 4 evidence, 2026-09-05

| Candidate | Total fade | Result |
|---|---:|---|
| `v2-control_instant` | 0 ms | Control; the indicator set snaps |
| `v2-a_fade-160` | 160 ms | Fast, with little time to read each half |
| `v2-b_fade-240` | 240 ms | Selected; visibly intentional and still quick |
| `v2-c_fade-360` | 360 ms | Clear, but slow beside the layer controls |

`v2-b_fade-240` is the default. Its two 120 ms cubic halves painted these sampled opacities:

```text
out: 0.908, 0.557, 0.061, 0.000
in:  0.019, 0.168, 0.792, 0.992, 1.000
```

The indicator set changes only at zero opacity, while the country name remains visible. A rapid
Environmental-to-Physical sequence ended with only the physical indicator, full opacity, and no
stale timer. A reduced-motion probe changed directly to the environmental indicator at opacity 1.

The first two implementations set the CSS transition before a synchronous globe rebuild. The main
thread then blocked for about 230 ms, and no intermediate opacity reached a painted frame. The final
ordering awaits `loadPoints()` and starts the profile transition after the last `setMarkers()` call.

The survey button now reads `locate your pain`. Its label is 194 px wide inside a 216 px desktop
button and 181 px inside a 201 px phone button. The phone document remained 393 px wide with no
horizontal overflow. No gallery files were created.

Phase 4 exit passes.

### Phase 5: Presentation mode

Implement one abortable state machine with these states:

```text
idle
preparing
flying
building
dwelling
paused-interaction
paused-user
backgrounded
```

Sequence for all 195 labelled countries, in English alphabetical order:

1. Hide the previous card and start emotional retraction together.
2. Wait for retraction to finish, then wait 3 seconds.
3. Move to the next country with cubic camera motion.
4. Select it through the existing emotional path with leader, network, and reverse motion durations
   multiplied by 3.
5. Wait for construction to finish, then wait 1 second.
6. Reveal the country profile.
7. Dwell for 30 seconds.
8. Repeat. After the last country, return to the first.

At roughly 40 seconds per country, a full 195-country loop lasts about 2 hours and 10 minutes. The
exact total is recorded after Phase 5 uses the measured camera and teardown durations.

Rules:

- Starting presentation remembers the current layer and enters all-pain mode.
- Turning it off restores the remembered layer, freezes the current view, and never arms idle
  resume.
- Turning it on again replays the saved country from its beginning.
- Pointer, wheel, touch, keyboard, or OrbitControls start freezes the exact partial state and enters
  interaction pause.
- After 165 seconds idle, show a 15-second resume warning. Any interaction restarts the timer.
- At 180 seconds, clear the partial state and replay the same country from its beginning.
- Focus inside presentation controls suppresses idle resume.
- Hidden tabs freeze timers and motion. They do not catch up on return.
- `prefers-reduced-motion` defaults presentation to paused and replaces camera flight with a cut and
  short fade.
- Automated country cycles do not emit human country metrics.
- The changing profile is `aria-live=off` during autoplay and `polite` while paused or manual.

Verify every state transition with shortened probe timings, then run one real-duration country.
Also run the last two countries through wraparound to the first, and run 30 minutes with shortened
dwell while monitoring timer drift, memory, DOM nodes, and stale controllers.

Exit: no aborted promise, timeout, hidden tab, or prior run can advance the current presentation.

#### Phase 5 evidence in progress, 2026-09-05

The controller is implemented in `cd613fb`, `b314ebc`, and `eebc9e6`. Production timings for the
first country measured:

| Milestone | Time from Play |
|---|---:|
| Afghanistan flight starts | 3.02 s |
| Afghanistan network starts | 5.53 s |
| Afghanistan card appears | 10.04 s |
| Card hides and reverse starts | 40.04 s |
| Albania flight starts | 44.75 s |
| Albania network starts | 47.26 s |

One complete country interval is about 40.04 seconds. A 195-country loop therefore lasts about
2 hours and 10 minutes before returning to Afghanistan.

Accelerated checks preserve the same state order and established:

- Afghanistan and Albania each build while hidden, reveal, dwell, and reverse before the next.
- A complete pass contains 195 unique English-alphabetical countries and wraps from Yemen, Zambia,
  Zimbabwe to Afghanistan, Albania, Algeria.
- Pointer interruption during construction holds every label transform and emphasis value exactly.
- The scaled idle warning appears at 165 seconds and replay starts at 180 seconds from the same
  country.
- Manual Stop during construction reverses to zero, remains stopped beyond the idle interval, and
  Play redoes the same country.
- A hidden-tab event enters `backgrounded`; returning enters `paused-interaction` without advancing.
- Real Computer Use drag and wheel gestures each enter `paused-interaction` from an active state.
- No Afghanistan or Albania country metric exists. Automated cycles remain outside click analytics.
- The profile uses `aria-live=off` during autoplay and `polite` while paused or manual.

The remaining Phase 5 check is the 30-minute accelerated stability run with memory and DOM sampling.

### Phase 6: Physical marker and environmental rounds

Run independent rounds from the selected profile base.

Physical:

- keep the current marker treatment as control;
- test a slightly larger default;
- test camera-distance compensation so markers do not shrink when zooming in;
- keep one `InstancedMesh` draw path and measure close and far screen sizes.

Environmental profile glyph:

- compare simple temperature fill plus CO2 ring;
- compare a restrained grain or cell pattern inside the same silhouettes;
- keep the two variables perceptually separable and accessible.

Environmental globe:

- keep the current haze and temperature textures as control;
- test texture-space grain or hexagonal quantization without adding one mesh per particle;
- test at close and far cameras because a useful texture must read as atmosphere from afar and
  structure nearby;
- keep existing image legends unless the chosen treatment cannot be explained by them.

Physical round v3 is complete. The visible red field is the existing 82,000-point stipple draw,
not the dormant debug marker mesh. Its control size is already independent of camera distance:
2.52 CSS px at the centre and 1.80 CSS px at the rim. The three retained candidates are
`v3-control_current-points`, `v3-a_larger-points`, and `v3-b_close-boost`. At the normal camera the
close-boost candidate is pixel-identical to control. A fixed 18 percent increase raises red-like
coverage in the globe crop from 10,821 to 17,038 pixels at the normal camera and from 3,907 to
5,625 pixels close up. The close-only candidate reaches 5,169 pixels close up. Codex selected
`v3-a_larger-points`: it improves both views and does not add a draw, mesh, point, or dependency.
Its 20-second all-pain trace remains at 8.30 ms median and 9.10 ms p95 with the same eight draws
and 239,452 primitives per frame as the Phase 0 control.

Environmental profile round v4 is complete. `v4-control_simple-environment` retains the solid
temperature fill, `v4-a_environment-grain` adds sparse flecks, and `v4-b_environment-cells` adds a
fine cell trace. Every candidate keeps the same proportional area and independent CO2 ring. Codex
selected `v4-b_environment-cells`: the pattern remains readable in the 88 px desktop glyph and the
70 px phone glyph, distinguishes Temperature from the solid physical fill, and does not obscure
the CO2 ring. The pattern is decorative inside an aria-hidden SVG; the existing accessible peak
value, missingness, and source-count text remains the semantic source.

Reject any candidate that exceeds the frame or bundle budgets, hides country boundaries, implies
unsupported raw units, or introduces visible temporal aliasing.

Exit: each selected treatment has a recorded visual and measured reason to replace its control.

### Phase 7: Simplification and performance

1. Re-measure the heaviest combined retained view against Phase 0.
2. Inspect `renderer.info`, DOM count, aggregation time, long tasks, bundle chunks, static assets,
   and network requests.
3. Optimize only measured regressions.
4. Keep aggregation off the render loop and avoid per-frame DOM measurement.
5. Lazy-load the experimental preset registry and round-only controls.
6. Keep every published `cpPreset` replayable. Remove only temporary spikes that never entered the
   registry and shared paths made unused by every retained preset.
7. Confirm there is no new rendering dependency, per-point draw call, or leaked browser profile.
8. Measure the default entry graph without `cp=1` against the 30 kB gzip budget. Report the lazy
   experimental JavaScript and CSS chunks separately.

Exit: median regression is at most 10 percent, p95 is below 16.7 ms, gzip growth is at most 30 kB,
and the page remains responsive at the phone viewport.

### Phase 8: Final adoption and evidence

1. Consolidate the selected configuration into the production path.
2. Verify it renders equivalently to its final experimental preset before intentional cleanup.
3. Re-run the opening round's `v1-control` candidate to prove the retained chain still works.
4. Run real desktop and mobile gestures for selection, clear, drag, wheel, layer switching,
   presentation interruption, manual pause, idle resume, hidden tab, and reduced motion.
5. Use the detached-checkout procedure in section 2 to build the exact verified feature commit into
   pain-server, smoke-test the same paths at port 3000, and restore the primary checkout.
6. Run independent Codex, Claude, and AGY reviews when available. Verify every finding against the
   implementation before changing code.
7. Only now capture the final gallery: one PNG for every retained `cpPreset`, plus the adopted
   desktop, mobile, single-layer, all-pain, selected, and presentation states.
8. Inspect every final image. Do not retain temporary browser profiles or duplicate captures.
9. Update this tracked plan and `GOAL.md` with final measurements and commit IDs.
10. Count user and metrics rows before and after integrated browser tests. Record the bounded delta
    and do not delete test rows without explicit approval. Use `/` rather than `/init` for health
    probes; normal application page loads still call `/init` and register a user.

Exit: all acceptance criteria pass, both repositories are clean, and all verified work is committed.

## 9. Verification Matrix

| Concern | Evidence |
|---|---|
| Data meaning | Live read-only row audit, source-code trace, explicit normalized labels |
| Aggregation | Focused geometry and reducer check plus independent socioeconomic comparison |
| Selection | Real label and surface clicks; one state and metric sequence per gesture |
| Responsive layout | Desktop, 430 by 900, and 393 by 852 checks against actual chrome boxes |
| Accessibility | Keyboard toggle, focus, reduced motion, live-region state, Select All guard |
| Presentation | State probe with shortened clocks plus one real-duration country |
| Rendering | Real GPU-backed browser inspection, no headless-only visual conclusions |
| Performance | Same-session median and p95, renderer info, bundle gzip, DOM and request counts |
| Integration | Detached feature commit built into server, port-3000 smoke, primary restored |
| Regression | `npm run check` before every commit and retained early-preset replay at the end |

## 10. Commit Policy

- One coherent feature or fix per commit, after verification.
- Frontend changes commit only in `pain-frontend`.
- PowerShell schema alignment commits separately in `pain-setup`.
- Create the setup fix from `pain-setup/development` and run `docker compose config`.
- The plan and goal are tracked frontend files and are staged with their owning planning commit.
- Stage exact owned paths only.
- Verify no `.env`, credentials, temporary profiles, or generated gallery files are staged.
- Do not change old emotional presets.
- Do not open or merge a PR in this goal. Team acceptance decides the frontend target afterward.

## 11. Stop Conditions

Stop implementation only when:

- every phase exit and acceptance criterion is verified;
- a destructive or cross-scope action needs operator approval;
- a required external source or runtime is unavailable;
- the same blocking failure repeats three times without new evidence; or
- new evidence exposes a material semantic decision outside section 4.

A blocked handoff must name the exact command or gesture, observed result, tried hypotheses,
artifacts, and input needed to continue.

## 12. Convergence Assessment

Discovery is complete. All semantic and product decisions needed to implement are locked. Remaining
choices are visual micro-decisions delegated to Codex and settled by the design-round evidence.
There are no open operator questions.
