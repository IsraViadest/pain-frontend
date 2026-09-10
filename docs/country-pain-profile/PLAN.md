<!--
File attribution
created by Christian Stelmach (chrisp.stel@gmail.com), GitHub: @cstelmach
-->
# Country Profiles and Expressive Globe Rendering

Last Updated: 2026-09-09
Version: 2.3
Status: historical plan; approved rendering restoration is ready for a local trial

The current work is governed by the approved
[rendering comparison plan](RENDERING-COMPARISON-PLAN.md), dated 2026-09-09. The user requested
discussion and approval before implementation, then approved it on 2026-09-09. Preserve the
completed work below as history and follow the narrower rendering comparison for current work.
Its execution checkpoint records the trial source, validation and remaining device acceptance.

## Current objective and working boundary

Build a tactile, atmospheric artwork: softly sculpted land, gently rounded country contours,
red stipple that reveals detail on approach, atmospheric volume, and emotional networks with an
unmistakable origin. Preserve the compact profile and country-cycle decisions from discovery.

Work in `pain-frontend-worktrees/country-pain-profile-rounds` on
`feat/country-pain-profile-rounds`, starting at `4b3d6f7`. The old plan below is completed
history. This current plan supersedes its conflicting restrictions; do not redo Phases 0-8.

The operator approved this replacement plan and implementation on 2026-09-05. Autonomous visual
selection is authorized. Keep each published preset replayable. No release, PR, deployment,
renderer migration, database schema change, or replacement of the emotional-view branch is approved.
See [GOAL.md](GOAL.md) for the current checklist, copyable goal, and append-only execution evidence.

## Decisions and shared contracts

### Data and meaning

- Keep existing datasets, peak-in-country aggregation, normalized source values, source counts,
  missingness, human metrics, and square-root glyph area scaling.
- Do not add a second logarithm, country ranks, raw-unit claims, or observations.
- Added stipple samples refine the display of the same field. Atmospheric height, lighting,
  cloud shape, and noise are artistic; they do not represent altitude, wind, or measured volume.
- Temperature remains coral-red, Physical Pain red stipple, and CO2 green. Profile and legend
  treatments must agree with the selected layer treatment.
- Socioeconomic color remains a continuous linear function of the source value. Use the existing
  Japan/Germany low-value appearance as the new visible minimum, then recolor every country from
  its actual value. Keep a matching legend; do not rescale countries by rank.

### Geography and shared surface

- Canonical polygons remain unchanged for country identity, aggregation, centroids, and picking.
- Derive one shared rounded display boundary network. Reuse paths for neighboring fills, borders,
  highlights, and render-only land masks. Pin junctions; preserve holes, islands, and corridors.
- Display rounding must not create gaps, overlaps, self-intersections, lost islands, or new land.
- Bound source/display discrepancy to at most one CSS pixel throughout the supported camera and
  viewport matrix. Use fixed contours constrained by the closest and most oblique views.
- Canonical picking can disagree inside that bounded edge strip. Do not claim exact visual parity.
  Keep original local contours wherever topology or the displacement bound cannot be preserved.
- Use one wrap, pole, and texture-sampling convention for the scar field and its CPU/GPU consumers.
  Scars, country fills, dots, borders, highlights, and the depth surface must agree.
- Keep leader feet connected in all-pain and Emotional Pain. Reuse the actual warped surface;
  expose it directly instead of discovering it by a hardcoded tessellation signature.

### Selection

- Origin fill and border highlight strength remain 1.00; compare peer strengths 1.00, 0.50, 0.65.
  Start at 0.50, keeping stroke width unchanged. Do not apply this factor to labels or network
lines.
- Preserve origin leader up, network spread, target leaders down, then country arrival.
  Retraction is the same process reversed.
- Each wave retains its origin during reversal. Take the strongest visible contribution on overlap.
  Role changes must repaint even if category and arrived counts remain unchanged.
- Shared peer borders must not brighten through duplicate drawing.
- Emotional/all-pain show category-wave marking. Other single layers mark only the selected ISO3
  with a restrained layer-colored fill and bright outline, using the same highlight surface.
- Preserve centroid location symbols for countries without polygons; do not invent outlines.

### Profile and country cycle

- Four aligned equal desktop slots, stable width, right-aligned emotional text extending left,
  shorter divider, tighter spacing, and translucent black plate.
- Operator reminder: equal gaps between equal-width slots; Environmental and Physical glyphs
  centered within their slots. Socioeconomic aligns left, facing the right-aligned emotional term.
- On phones hide visible captions and English translations; preserve complete accessible labels.
  Keep country-name size, avoid semantic truncation, and sit above share/legend with safe-area
inset.
- Solid Temperature, dotted Physical, solid Socioeconomic, inset fills, strokes painted last.
- CO2 uses a thicker neutral under-stroke with a narrower colored stroke. Real zero stays faint.
  Missing CO2 hides both band strokes independently of Temperature. When both signals are missing,
  show a separate neutral empty silhouette. This supersedes the old universal empty-outline rule.
- Keep the 240 ms cubic indicator fade. Country name persists through layer changes.
- Put the stable `country cycle` toggle beside sound/theme, showing off/running/paused.
  Use honest `pause 3 more minutes` wording. Survey text: `share your pain` above `locate it`.
- Cycle timing: 1 s gap, 2.5 s cubic flight, 1.5 times manual build/reverse, 0.5 s reveal, 30 s
dwell.
- Starting with a manual country replays it first; otherwise replay the saved cursor. Advance only
  after completed dwell; wrap alphabetically through all 195 countries.
- Show a side-effect-free heading preview during flight, then indicators after construction.
- Ordinary interaction cancels schedule/flight while active build/retraction completes. A completion
  owner independent of the canceled cycle must establish the right final profile visibility.
- Canceled flight clears the destination preview or restores the actual selection. Manual country
  selection supersedes the automated target and animates at manual timing.
- Hidden tabs freeze clocks. Returning settles unfinished motion before idle-resume timing starts.
  Interaction pause resumes after 180 s, warning for the final 15 s. Explicit off disables resume.
- Stop reverses active motion, clears the profile, and restores the prior layer. Stale completion
  cannot reveal or advance a newer selection. Automated actions emit no human country opens.
- Near-camera globe/label depth behavior remains unchanged except the named dot-detail trials.

### Rendering scope and quality

- Bounded WebGL shaders, offscreen targets, and batched cloudlets are explicitly allowed. The old
  no-custom-shader and fixed-dot-only restrictions are superseded by these named experiments.
- No scene object per observation, unbounded subdivision, new renderer dependency, or WebGPU switch.
- Preserve old visual choices through preset-specific settings; common correctness fixes may apply
  across presets, with intended changes measured. Do not duplicate the renderer.
- Keep `?cp=1&cpPreset=...`; add `cpQuality=auto|light|standard|rich` for reproducible comparisons.
- Quality changes rendering detail only, never data, text, country selection, or motion progress.
  Start conservatively, avoid oscillation, and defer structural swaps until gestures settle.
- Count resident/outgoing CPU and GPU detail allocations and all concurrent targets against one
  additional-resource ceiling: 64 MiB Light, 128 MiB richer tiers. Document both ownership totals.
- Forced Rich is a comparison mode. Adopt the richest measured fit; if no advanced effect fits,
  keep the informational control and report why. If even the control fails, report that separately.

## Execution phases

Each slice has a short local plan, relevant tests, live visual evidence, an append-only GOAL entry,
and an atomic verified commit. Visual comparison is part of implementation, not deferred QA.

### Phase 9: Network and interaction correctness

1. Record first/middle/last rendered frames and reversal for the current control.
2. Initialize planned arc geometry instance count before exposing it to the renderer.
3. Separate cycle scheduling from emotional-motion completion, including profile reveal.
4. Cover flight/build/retract/dwell interruption, repeated gesture events, manual replacement,
   hidden tabs, and reduced motion.

Exit: no premature complete-network frame, no stranded wave, exact terminal segment counts,
no stale country reveal, and no completed transition that silently advances the paused cycle.

### Phase 10: Final chrome and cycle sequence

Move cycle controls before profile layout judging. Implement stable status, honest warning action,
two-line survey button, approved timing, manual-country replay, saved cursor, and heading preview.
Keep human metric opens/closes balanced and automated cycles untracked.

Exit: controls fit at 320 px; keyboard and pointer agree; Stop/restart choose the correct country;
every interruption leaves an understandable visible state and no stale scheduled work.

### Phase 11: Compact profile and glyph rounds

Opening v8 structural candidates, plus the retained v7 control:

| Candidate | Desktop rail | Phone card | Desktop glyph | Phone glyph |
|---|---:|---:|---:|---:|
| Compact A | 420 px | 272 px | 54 px | 34 px |
| Compact B | 460 px | 296 px | 58 px | 36 px |
| Compact C | 500 px | 320 px | 62 px | 38 px |

Constrain these starting sizes to the available viewport. All use the shared profile contract.
After choosing the structure, compare inset factors 0.84/0.88/0.92, restrained desktop native/tiny
English typography, and plate opacity. Temperature stays solid and Physical dotted.
Missingness remains independent. Verify the cubic fade through painted intermediate frames.

Exit: all layers fit long country/native names, RTL, duplicate words, and missing values in both
themes without chrome overlap or horizontal overflow.

### Phase 12: Continuous rounded scars

Repair periodic longitude, poles, and CPU/GPU parity first. Compare current and smoothly tapered
scar shoulders at matched depth and footprint. Subdivide borders that bridge dents; compare
existing versus denser shared surface only where silhouette faceting remains. Consider restrained
slope shading after samples and geometry agree. Preserve repeated-point accumulation semantics.

Exit: continuous seams/poles, rounded shoulders, intended depth envelope, attached overlays and
leader feet, and improved near/limb appearance without flattening the globe.

### Phase 13: Gently rounded country contours

Derive shared display paths, pin junctions, preserve holes/islands/corridors, and compare no/gentle/
moderate rounding. Reuse selected paths across every display-geography consumer and common scar
surface. Keep canonical picking/data unchanged.

Exit: no topology loss or shared-edge mismatch; fixed shape through zoom; measured one-pixel
discrepancy bound; border-adjacent picking checked and its narrow ambiguity documented.

### Phase 14: Origin and peer emphasis

Compare 1.00/0.50/0.65 peer fill and border weights. Preserve origin roles, wave timing, and
reversal.
Avoid double-bright shared borders. Keep exact-country single-layer feedback on the same mesh.

Exit: origin identifiable, peers readable, no early marking. Verify same/different-category
replacement, partially reversed waves, and a newly selected origin previously reached as a peer.

### Phase 15: Physical dot growth and refinement

Compare fixed original 82,000-point control, regrowth, one four-child split, and two splits.
Use local projected spacing, viewport and depth, not raw radius alone. Start at about 5 px parent
diameter with room for four 2.5 px children, short crossfade and 15 percent threshold hysteresis.
Stable children sample their own geographic field/land coordinates. Verify uniform-field visual
weight. Submit bounded active detail; alpha-zero descendants still cost vertex work.
Keep ocean stipple unchanged unless a separate comparison proves otherwise.

The second level has 1,312,000 theoretical leaves; all three levels total 1,722,000 records.
These are capacities to evaluate, not mandatory allocations.

Exit: readable stable split/merge, no severity pulse, zoom request, global per-frame rebuild,
coastal leak, clustered holes, or sparkle. Second split ships only on levels that pass its cost.

### Phase 16: Atmospheric prototypes

Compare three distinct families on the same inputs:

| Family | Intended look | Main constraint |
|---|---|---|
| Mantle | Soft shallow sculpted field with gentle lighting | Must read as air, not another land
shell |
| Cloudlets | Translucent clusters with depth and parallax | Bounded batches, ordering and overdraw
|
| Volume | Continuous airy body with internal depth | Bounded ray samples and offscreen resources |

Keep coral Temperature and green CO2 distinguishable. Ground registration and actual displaced
surface occlusion apply even when the visible solid globe is hidden. Keep DOM text/chrome outside
volume passes. Bound cloudlet count and temporary overlap. Trial 16/32/48 volume sample caps;
state target resolution relative to drawing-buffer dimensions, including DPR.
Do not animate data into another location. Respect reduced motion.

Exit: each family has an inspected prototype or concrete feasibility rejection. Keep one low-cost
informational atmospheric treatment. Reject detached shells, obscured land, clipping rims,
unstable noise, and unexplained severity changes.

### Phase 17: Socioeconomic color and pattern

Use the approved low-color reference as the new visible minimum and map source values linearly.
Recolor all countries and match the legend. Compare color-only, fine hatch, and restrained woven/
dashed texture. Pattern redundantly encodes the same value and stays geographically fixed.
Filter unresolved pattern toward its average and distinguish missing from zero.

Exit: correct ordering/ties, explained color+pattern legend, no moire or zoom-dependent value.
Prefer hatching initially to avoid competing with physical stipple.

### Phase 18: Composition and quality tiers

Combine winners. Order attention: selected origin, network, labels, fields, atmosphere. Verify
volume does not conceal scars or socioeconomic differences and patterns do not compete with dots.
Define measured Light/Standard/Rich tiers and conservative stable auto selection; vary samples,
subdivision and texture/surface detail only. Preserve gesture progress during tier changes.
Count simultaneous allocations against aggregate budgets.

Exit: chosen composition, documented profiles, no oscillation, lost layer, reset or leaked resource.
Optional visual effects may all be rejected with evidence; forced Rich is not a universal promise.

### Phase 19: Final performance and simplification

Final code-development phase, after functional and visual review. Profile layer rebuilds, scar
filtering, highlight uploads, point submission, overdraw, shader warmup and startup. Reuse/cache
only measured bottlenecks; preserve lazy experiments and off-frame aggregation. Separate frame
cadence, CPU work and GPU duration; release superseded resources.

Server worktree: `pain-server-worktrees/country-profile-layer-delivery`,
branch `perf/country-profile-layer-delivery`, expected base `2d6407b` after live verification.
Benchmark 50 concurrent read-only layer clients: cold/warm response equality, errors, p95,
wire bytes, query counts and memory. Add five-minute successful-response cache with miss
coalescing only if justified, and compression only for a measured transfer win.
Keep registration `/init`, survey and metrics uncached; preserve body/schema.

Exit: gates below pass without changing semantics, wave order, alignment or interaction.

### Phase 20: Product acceptance and final gallery

Run complete matrix on final code, 30-minute accelerated 195-country cycle, exact port-3000 build
and primary-checkout restoration. Run independent final reviews when available; verify findings
before fixes. Capture final PNGs only after fixes/performance. Inspect each; preserve old galleries.
No new video. Clean only task-owned temporary profiles/captures, commit accepted work, leave
relevant worktrees clean.

### Post-acceptance rounds v19-v24

The operator reopened the compact profile and country-cycle sequence after Phase 20. Preserve
v18 and every earlier preset. The new default must:

- space adjacent painted indicator edges by approximately one rendered lowercase `n` in the
  country-name font, with the same gap across all three boundaries;
- keep the native emotional term right-aligned while centering its English translation beneath
  the native term itself;
- add a broad, low-alpha profile edge glow that fades smoothly into transparency;
- show no destination country during automated travel, rotate without changing camera radius,
  and reveal the full profile as network construction begins;
- shorten the country dwell and transition while retaining a readable artistic cadence.

Rounds v19-v23 isolate spacing, translation alignment, glow, rotation-only travel, and reveal
order. Round v24 compares 10/14/18 second dwells with corresponding 1.2/1.5/1.8 second flights.
Choose by painted-edge measurements, live motion, mobile fit, interruption behavior, and paired
performance. Temporary captures support inspection; do not extend the durable gallery for this
post-acceptance round unless the operator asks.

## Verification and adoption

### Round feedback

Every candidate supplies a live preset/quality URL, control, one design question, camera/layer/
country/gesture recipe, visual and cost observation, and selected/rejected reason.
Use existing browser tooling and small temporary captures. Judge motion live, not by stills alone.
Number new rounds from v8; after structural comparisons vary one named dimension at a time.

### Required scenarios

| Concern | Cases |
|---|---|
| Selection | label, source polygon, empty globe, repeat, replacement, every layer |
| Network | first/middle/final frame, partial reverse, same/different category replacement |
| Input | drag, wheel, pinch, keyboard, rapid layer changes, resize during selection |
| Cycle | manual start, Stop/restart, interrupted flight/build, warning, hidden tab, wrap |
| Text | longest names/native terms, RTL, mixed scripts, duplicates, missing signals |
| Geography | shared borders, holes, islands, corridors, dateline, poles, closest/limb views |
| Scar | neutral, isolated/overlapping points, seam/pole, CPU/GPU parity, depth, leader contact |
| Dots | slow/fast threshold crossings, rotate at threshold, uniform brightness, coastal children |
| Air | Temperature/CO2 separate+together, zero/missing, front/back depth, near/inside shell |
| Socioeconomic | zero, missing, ties, references, high values, matching pattern legend |
| Quality | forced/auto levels, recovery, no state reset, aggregate resources bounded |
| Accessibility | keyboard/focus, status, reduced motion, no selectable artwork text |
| Regression | original view, v7, old emotional presets, survey, human metrics |

Widths: 320, 393, 430, 768, 1080, 1500 CSS px; portrait/landscape, both themes, supported DPR.

### Performance gates

- Reference host: paired median at most 10 percent above control; p95 below 16.7 ms. Record display
  cadence; the recorded 8.3 ms value is frame interval, not GPU execution.
- Report CPU work and actual GPU duration where supported.
- Physical 60 Hz phone: stable nominal 60 fps, p95 within one interval plus 1 ms, no sustained drop.
- Cumulative default-entry growth <=30 kB gzip above the 216.44 kB baseline; lazy assets separate.
- No new zoom data requests, unbounded allocations, or memory growth through repeated transitions.
- Server: zero errors/mismatches, warm p95 not worse. Input-to-paint/long tasks improve or stay
  within the paired control range.
- Responsive emulation does not prove physical-phone GPU performance. Keep unavailable required
  physical-device acceptance explicitly open.

### Adoption and stop rules

Adopt richer effects only with visible benefit in intended use, correct meaning, coherent all-pain
composition, near/far/limb/mobile fit, and a measured shipping quality tier. A rejected trial is
complete only with evidence. Do not promise all optional effects will ship.

Preserve source/preset/data history. Stage exact owned paths, verify functionality before commits,
and do not commit credentials, env files, payload mirrors or galleries. Bounded application test
users/metrics remain authorized and are counted, not deleted. Seed 43; no em-dashes.
Stop a blocked path after three repeats without new evidence and report required input.
Do not start the Codex goal automatically; the operator requested implementation in this task.

## Research anchors

- Shared-edge cartography:
  <https://pro.arcgis.com/en/pro-app/3.4/tool-reference/cartography/smooth-shared-edges.htm>
- Existing Three.js volume example:
  <https://raw.githubusercontent.com/mrdoob/three.js/r170/examples/webgl_volume_cloud.html>
- LOD hysteresis:
  <https://raw.githubusercontent.com/mrdoob/three.js/r170/src/objects/LOD.js>
- Coherent hatching: <https://gfx.cs.princeton.edu/proj/hatching/>
- GPU measurement:
  <https://developer.mozilla.org/en-US/docs/Web/API/EXT_disjoint_timer_query>

---

# Historical plan v1.1: completed Phases 0-8

The following original plan and measurements are preserved as history. Current decisions and
Phases 9-20 above take precedence. Old instructions to merge upstream, create the setup worktree,
or begin Phase 0 are already satisfied and must not run again.


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
22. Show no visible normalized numbers in the new profile glyphs. Accessible SVG descriptions
    expose the value without making the artwork read as a dashboard. Existing image legends remain
    the approved upstream state under decision 19.
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
    categoryKey: string;
    category: string;
    nativeTerm: string;
    englishTerm: string;
    language: string;
    script: string;
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
- Turning it off restores the remembered layer, clears the country and network, and never arms
  idle resume.
- Turning it on again replays the saved country from its beginning.
- Pointer, wheel, touch, keyboard, or OrbitControls start freezes the exact partial state and enters
  interaction pause.
- A manual country selection during interaction pause releases that freeze at normal timing,
  reveals the human selection, and leaves the automated sequence paused with idle replay armed.
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

The final 30-minute accelerated stability run passed on the fixed controller:

```bash
cd /Users/cs/local/code/apps/web-pain-globe/pain-frontend-worktrees/country-pain-profile-rounds
node /Users/cs/local/code/apps/web-pain-globe/artifacts/emo-views/eval.mjs \
  'http://127.0.0.1:5173/?cp=1&cpTimeScale=0.005&freeze=1&stabilityMs=1800000' \
  8000 1500 950 < scripts/measure-country-presentation-stability.js
```

It recorded 7,224 country changes, all 195 unique countries, 37 wraps, zero sequence errors, and
no runtime errors. Country intervals were 249.5 ms median, 257.9 ms p95, and 331.1 ms maximum. DOM
count stayed exactly 916. JavaScript heap ranged from 41,222,693 to 182,118,409 bytes and ended at
82,923,382 after garbage collection cycles. Ten long tasks were observed, three after the probe
started; the 444 ms maximum was in the buffered startup set. Stop left the profile hidden and the
toggle off. `passed` was true. Phase 5 exit passes.

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
coverage in the globe crop from 10,821 to 16,475 pixels at the normal camera and from 3,907 to
5,619 pixels close up. The close-only candidate reaches 5,164 pixels close up. Codex selected
`v3-a_larger-points`: it improves both views and does not add a draw, mesh, point, or dependency.
The multiplier applies to the land stipple that carries the physical red field; ocean stipple keeps
its control size.
Its 20-second all-pain trace remains at 8.30 ms median and 9.10 ms p95 with the same eight draws
and 239,452 primitives per frame as the Phase 0 control.

Environmental profile round v4 is complete. `v4-control_simple-environment` retains the solid
temperature fill, `v4-a_environment-grain` adds sparse flecks, and `v4-b_environment-cells` adds a
fine cell trace. Every candidate keeps the same proportional area and independent CO2 ring. Codex
selected `v4-b_environment-cells`: the pattern remains readable in the 88 px desktop glyph and the
70 px phone glyph, distinguishes Temperature from the solid physical fill, and does not obscure
the CO2 ring. The pattern is decorative inside an aria-hidden SVG; the existing accessible peak
value, missingness, and source-count text remains the semantic source.

Environmental globe round v5 retains `v5-control_smooth-field`, `v5-a_grain-field`, and
`v5-b_hex-field`. Both textured candidates fail the far-camera requirement. Four-texel grain turns
into square banding across the outer haze; the twelve-texel cell trace reads as a separate shell
and competes with country boundaries. Close views remain readable, so the failure is scale and
contrast rather than the texture-space approach. The two candidates remain as the upper bound for
a finer, lower-contrast round.

Environmental globe round v6 retains `v6-control_smooth-field`, `v6-a_fine-grain-field`, and
`v6-b_fine-hex-field`. The fine candidates remain atmospheric from afar, but their structure is
only discernible in a side-by-side crop at camera distance 1.6. Contrast strong enough to read at
rest reproduces the v5 defects. Codex therefore selected `v6-control_smooth-field`; the globe keeps
its smooth Temperature and CO2 shells and existing image legends. The rejected candidates remain
URL-addressable and add no per-frame work because their texture modulation runs only on rebuild.

Phase 6 exits with `v3-a_larger-points` for the physical treatment,
`v4-b_environment-cells` for the environmental profile glyph, and the v6 smooth control for the
environmental globe. Every selected treatment preserves country boundaries and normalized data
semantics. No new mesh, draw path, renderer, asset, or dependency was added.

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

Phase 7 found no retained rendering regression to optimize:

| State | Median | p95 | Max | Draws/frame | Primitives/frame | Textures | DOM |
|---|---:|---:|---:|---:|---:|---:|---:|
| Selected desktop | 8.30 ms | 9.50 ms | 10.40 ms | 11 | 293,786 | 5 | 916 |
| Selected 393 by 852 | 8.30 ms | 9.40 ms | 10.40 ms | 11 | 293,786 | 5 | 916 |

The Phase 0 selected baseline was 8.30 ms median and 9.70 ms p95. Profile aggregation is outside
the render loop and took a 74.75 ms median across ten complete 195-country builds after the wide
ring correction. The experimental registry and profile CSS remain lazy: 5.22 kB gzip JavaScript
and 1.85 kB gzip CSS, with the presentation controller at 2.26 kB gzip. The default entry is
219.53 kB gzip, 3.09 kB above the 216.44 kB baseline and 26.91 kB below the limit. A normal
`?ev=2` load requested no
`countryProfile` module and created neither the profile nor presentation controls.

The retained view still uses the same draw and primitive counts as its Phase 0 counterpart. There
is no new dependency, per-point draw call, per-frame DOM measurement, or static asset. The largest
requests remain the pre-existing background audio, layer payloads, and two detailed button SVGs;
none is caused by this feature. Browser profile cleanup reported zero leaked `emoeval-*` or
`emoshot-*` directories before the long stability run began. No code was changed for performance
because every measured limit already passes.

Buffered Long Tasks report five startup tasks without `cp=1` (932 ms total, 436 ms maximum) and
six with it (1,011 ms total, 438 ms maximum). The added task is 83 ms and matches the measured
profile aggregation. A safe 10 degree country-grid candidate reduced ten warm aggregations from a
71.15 ms median to 62.35 ms, only 8.80 ms. Codex rejected and removed it before commit because the
extra index and correctness surface were not justified by a one-time 12 percent reduction. Moving
the build off-thread would cost a duplicate geometry/data transfer and is also unwarranted while
interactive frame time, load completion, and bundle limits pass.

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

Final preset `v7-a_base` consolidates the selected chain without changing values. A settled India
selection against `v6-control_smooth-field` differed by at most 2 of 255, with zero pixels above 8
and mean delta 0.0278. The opening `v1-control_literal-row` also replayed with its literal-row
layout, India, and all four indicators intact.

A final single-layer geometry check found that the Emotional Pain item inherited the selected
all-pain row's left alignment inside a centred 210 px container. India's native term was therefore
50 px left of the screen centre. The single-layer rule now centres that content like the other
three single indicators and removes its inherited 22 px bottom pad; all-pain keeps its selected
left alignment.

Presentation chrome was measured while Afghanistan, the warning, the profile, and the toggle were
all painted. At 1500 by 950 the profile ended at y=840 and the warning began at y=842.8. At 430 by
900 they were y=784 and y=603.8 to 645; at 393 by 852 they were y=736 and y=555.8 to 597. The
toggle and share button also remained disjoint at all three widths. No tested pair overlapped.

The emotional category legend is a set of native buttons, so keyboard users can select a category
and its deterministic random country through the same selection path. Exact named-country choice
on the globe remains a pointer interaction; presentation mode is the non-pointer path through all
195 named countries.

The deferred gallery is
`artifacts/country-pain-profile/gallery/`: 21 immutable `cpPreset` images and eight adopted-state
images, 29 PNGs total. The desktop images are 1080 by 684 and the two phone images are 1179 by
2556. Mean brightness spans 37.16 to 95.27. Every prescript returned the expected preset, layer,
country, or presentation state. Contact-sheet inspection found one warning capture that resumed
before the screenshot completed; it was replaced with a verified visible-warning frame. A later
single Emotional Pain capture was also replaced after the vertical centring fix. No duplicate or
known stale capture remains.

Independent review produced actionable defects rather than a ceremonial pass. Codex reproduced a
hidden manual selection after interruption, an A to B to A fade race, a consumed focus-resume
timer, and missing pause announcements. Claude additionally found stale writes after layer-fetch
awaits and the wide Antarctica ring error. The fixes are in `69ffe6c`, `a5f5097`, `afc82a4`,
`4928988`, `0c5da1e`, `04ad110`, `9b5801b`, `8bea50e`, and `d3b107a`. The browser race probe now
checks layer reversal, early Stop, manual selection, accessible status, held focus, active resume,
and explicit pass/fail output. The final Codex closure reported no remaining issue.

Three suggestions were deliberately not implemented. All 195 current countries completed the
tour, so a missing centroid remains a loud data-integrity failure rather than a silent skip. Fixed
SVG pattern ids are safe because the runtime owns exactly one profile view. The image legends are
the approved upstream state and decision 19 keeps them outside this profile experiment. The
emotional category legend already consists of keyboard-operable native buttons.

The Claude review completed through its degraded legacy provider path after the preferred hub
failed. Two bounded current-tip delta attempts then exceeded their own timeouts. AGY returned
nonempty prose twice but omitted every required structured marker both times, so neither AGY run
produced an accepted verdict. Their raw claims were still treated as hypotheses and checked against
the app. No third retry was made for either repeated transport failure.

Canonical integration built frontend code tip `d3b107a` through the root Compose file and served
it at port 3000. The public Node base-image pull initially hung in Docker Desktop's credential
helper while the Mac was locked; an isolated anonymous Docker config resolved it. A task-owned
temporary `.dockerignore` reduced the canonical build context from 1.65 GB to 5.15 MB by excluding
the gallery and sibling worktrees, then removed itself. The primary checkout was restored clean to
`feat/emo-label-views` at `7ca5492` after every detached build.

The final port-3000 race probe returned `passed: true`. Its bounded database interval was 1,371 to
1,372 users, 2,597 to 2,617 total toggle metrics, and 72 to 74 country-category metrics. The two
country rows are the expected manual open and close; automated presentation selections added none.
The 20 total rows include the probe's deliberate layer changes. No test row was deleted.

Exit: all acceptance criteria pass, both repositories are clean, and all verified work is committed.

## 9. Verification Matrix

| Concern | Evidence |
|---|---|
| Data meaning | Live read-only row audit, source-code trace, explicit normalized labels |
| Aggregation | Focused geometry and reducer check plus independent socioeconomic comparison |
| Selection | Real label and surface clicks; one state and metric sequence per gesture |
| Responsive layout | Desktop, 430 by 900, and 393 by 852 checks against actual chrome boxes |
| Accessibility | Keyboard controls, focus, reduced motion, live status, Select All guard |
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
