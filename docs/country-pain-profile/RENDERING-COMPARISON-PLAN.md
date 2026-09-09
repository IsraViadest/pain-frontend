# Rendering comparison against the evening Windows version

Last Updated: 2026-09-09
Version: 1.0
Status: proposed; awaiting user comments and approval before implementation

## Purpose and boundary

Recover the visual quality of the Windows version the user liked on September 8, while
removing demonstrated unnecessary rendering and computation. Treat that package as the
appearance reference, rather than assuming the newest implementation is better.

This plan covers the five visualization states, atmosphere, dots, scars, country fills,
outlines, contours, emotional labels/networks, and rendering-quality settings. It does not
reopen survey behavior, analytics, exports, kiosk controls, updates, credits or festival UI.
No application code, running preview, release or operator settings changed during this review.

Comments on this document refine the plan. They do not authorize implementation. Implementation
starts only after the user approves it. The earlier autonomous design-round authorization does
not override this requested pause.

## 1. Exact reference and limits of this analysis

The selected reference is the later evening archive:

```text
Windows worktree: pain-frontend-worktrees/windows-offline-exhibition
Archive directory: offline-release/0.1.0-487e682
ZIP: PAIN-Offline-0.1.0-windows-x64-487e682.zip
Frontend: 487e6824c75d0f7507eed34343190221fb680248
Embedded build time: 2026-09-08 20:24:16 Europe/Vienna
Preset: v46-dots_water-depth
Quality: auto
Electron: 44.2.0
```

The earlier `0.1.0-9267ce9` ZIP has the same 143 packed site files, byte for byte, and the same
four raw layer snapshots. Its embedded build time is 19:08; its ZIP filesystem time is 19:28.
The source difference only concerns packaging. Either evening ZIP is the same visual reference.

The current web comparison point is `cf3e15fd87be9f3fb253325ab7d630c5028f2776`, in
`pain-frontend-worktrees/country-pain-profile-rounds`, branch `feat/exhibition-web`.
Today's Windows 1.0.1 preview is a separate checkpoint at `b848893`, not yesterday's baseline.

The user reports that the evening build looked good and performed well. This is valuable
target-computer feedback. This review establishes source and package differences; it has not
yet measured the two versions together on the exhibition computer.

Opening an old `cpPreset` URL on today's server does not restore the old renderer. Those URLs
now resolve to the selected release. A comparison must actually load the archived build/source.

## 2. What has changed

| Aspect | Evening reference | Current preview |
| --- | --- | --- |
| Environmental treatment | Separated sampled volume | Two shaped mantle meshes |
| CO2 color | `#90dcb5` | Brighter `#b4ffd2` |
| Temperature color | `#d74846` | Same |
| Root dots / mode / scale | 82,000 / regrow / 1.18 | Same |
| Scar scale / bias | 0.4 / -0.2 | Same |
| Scar relief / contour style | Coral relief, water contours | Same |
| Surface at automatic Light | Detail 2 | Detail 1 |
| Near emotional font endpoint | 20 px | 25 px, explicitly requested |
| Selected outline | Stroke inside a texture | Separate vector border batches |
| Selected-country occlusion | Earlier wash path | Added depth mask and surface projection |
| GDP input | Earlier socioeconomic series | Inverse log GDP per capita, 2024 |
| Emotional input | Original dataset | Combined-v2 dataset |

The dot-size and elevation experiments have already been reversed. Do not repeat that rollback:
the selected dot settings and radial-displacement shader now match the evening reference.
Regrow does not activate the four-child refinement hierarchy. Its allocated capacity is not
the number of additional dots being drawn.

Light now uses 192 by 128 sphere segments, compared with the reference's 384 by 256. That is
48,768 versus 195,840 triangles per complete sphere. This affects scar and border sampling,
even though the scar values and radius are unchanged. It is a quality reduction to review,
not evidence that data points disappeared.

The atmospheric change is structural. A volume integrates density through space; the mantle
paints shaped surfaces. Opacity tuning alone does not make them equivalent. Also, the retained
volume code in today's tree has additional scar-edge/subpixel work that the evening shader
did not have. Merely switching today's mode back to volume is not an exact historical comparison.

Changed GDP and emotion inputs can change colors, membership and network size independently
of rendering. Preserve the latest requested data and missingness. Compare the archived output
as delivered first, then hold inputs constant when evaluating rendering changes.

### Resolution and apparent size

The globe radius, 45-degree FOV, initial camera `(0, 0.35, 2.6)`, camera limits and full-size
canvas CSS are unchanged. No source change shrinking the globe was found. Check actual viewport,
browser/display scaling and camera position if “smaller” means visually smaller.

| Entry | Effective rendering policy |
| --- | --- |
| Evening Windows executable | Normal resolution; automatic quality |
| Current web `?hq=0` | Normal resolution; automatic quality |
| Current web `?hq=1` | HQ; Rich unless `cpQuality` is specified |
| Windows 1.0.1 HQ executable | HQ; automatic quality |
| Windows 1.0.1 Standard executable | Normal resolution; Light when config says auto |

At 1920 by 1080 CSS pixels and device-pixel ratio 1, HQ requests a 3840 by 2160 drawing buffer:
four times the output pixels. It does not change the camera's apparent scale. Other display
scales give different multipliers. Thus browser Standard, packaged Standard, browser HQ and
packaged HQ are not interchangeable benchmarks today.

## 3. What “render only once” means here

One visible representation of each intended signal is the goal. One draw call for the whole
globe is not. Some separate passes protect surface contact and prevent seeing through Earth.

Source-derived idle expectations, before selection, are the same in both versions:

| View | Expected nonempty draws, including offscreen work |
| --- | ---: |
| Emotional | 4 |
| Physical | 4 |
| Environmental | 6 |
| Socioeconomic | 4 |
| All the pain | 10 |

These counts require runtime verification. They assume both atmospheric fields, normal loaded
geometry, no debug override and no selection. Equal counts do not mean equal GPU cost: a volume
draw can execute many texture samples per output pixel.

### Keep unless a replacement proves equivalent

- There is one recurring main render loop, not two whole-scene loops.
- Original atmospheric shells are hidden while the custom atmosphere is active in the normal
  path. Two mantle meshes represent Temperature and CO2, not the same field twice.
- Volume integration into a small target and its composite are different necessary operations.
- Coastline and inland borders are separate geographic datasets.
- The socioeconomic pattern shares its country-fill material; it is not another fill mesh.
- The old selected outline is disabled in the raster when the new vector outline is drawn.
- Main surface depth, atmospheric depth and selection depth currently differ in target, surface
  or scale. Do not delete one just because it resembles another sphere.
- Thin resting leaders and stronger growing leaders are intentional. Preserve their visible
  sequence and the underlying resting line, including the current interval partition.
- Allocated but invisible legacy or inactive-category objects are not extra visible draws.

### Confirmed opportunities

| Finding | Scope | Proposed treatment |
| --- | --- | --- |
| Border projection twice per repaint | New vector borders | Project once per batch |
| Hidden label updates | Both versions | Skip hidden presentation safely |
| Legacy shell re-enabled by debug | Debug only | Reuse field/visibility sync |
| Unused spherical-volume depth | Both volume paths | Skip only the analytic-sphere case |

The border duplication happens on repaint/arrival, not every settled frame. The second call uses
the same coordinates and unchanged surface. It is a particularly small, testable first fix.

For hidden labels, keep required motion, selection reset and re-entry invalidation. Do not stop
the shared animation clock indiscriminately. The old version has this waste too, so removing it
is an opportunity rather than an explanation for every recent slowdown.

The spherical-depth saving applies only to a complete sphere in the volume renderer. Mantle
always samples that depth; scarred all-pain volume also needs real surface depth. The normal
production path does not have the debug-only duplicate color problem.

## 4. Proposed implementation sequence, after approval

### Phase A: establish a fair comparison

- [ ] Serve the pristine evening website and current renderer using existing local tooling.
- [ ] First inspect the archived version with its actual preset and quality policy.
- [ ] Then hold data, fonts, exclusions, camera, theme, viewport and output resolution constant.
- [ ] Record actual active quality, drawing-buffer dimensions and renderer/runtime version.
- [ ] Use disposable test settings and log directories. Preserve exhibition logs and caches.
- [ ] Compare at 1080p normal resolution first. Test HQ separately, explicitly labeled.

Output: two live comparison views and a compact change table. No permanent switcher, new
application framework, screenshot gallery or rebuilt release is needed for this phase.

### Phase B: measure actual rendering and wasted work

- [ ] Count main-scene and offscreen draws by named object/effect across all five views.
- [ ] Record invisible-object submissions, triangles, field samples and texture/buffer uploads.
- [ ] Measure CPU time, GPU time where supported, frame pacing, startup and layer-switch stalls.
- [ ] Profile idle rotation, close zoom, country selection, construction, reversal and rapid
  layer changes. Include cold first selection as well as settled behavior.
- [ ] Attribute each repeated operation to necessary composition, confirmed waste or an
  unresolved hypothesis. A source call alone is not proof of a GPU allocation or draw.

Use existing measurement scripts. Run comparisons sequentially, control/candidate/candidate/
control, at a fixed tier before testing Auto. Avoid other builds and GPU capture jobs during
measurements. Aggregate every render invocation within an application frame: Three.js defaults
to resetting renderer.info per render, so reading it after the main scene misses prepasses.
Earlier timing comparisons of today's mantle revisions do not compare the
evening volume and cannot establish that abandoning it was necessary.

### Phase C: remove confirmed waste without changing appearance

- [ ] Eliminate the duplicate border projection while retaining surface-version invalidation.
- [ ] Skip hidden label presentation after measuring it; restore measurements and transforms
  before revealing labels on re-entry.
- [ ] Synchronize atmospheric fields after debug rebuilds if those controls remain available.
- [ ] Verify inactive layers submit no color work after switches and transitions settle.
- [ ] Inspect point-detail updates and uploads if profiling identifies them as expensive.
  Do not assume a dormant split hierarchy is active under regrow.

Exit: unchanged visible behavior at matching settings, fewer demonstrated operations, and no
new stale labels, stranded networks, lost data or layer leakage. Keep each correction atomic.

### Phase D: recover the preferred atmospheric appearance efficiently

- [ ] Use the evening separated-volume implementation as the visual control, not the newer
  dormant volume implementation with additional edge reintegration.
- [ ] Retain current field inputs, geographic registration, missingness and requested colors.
- [ ] First test the analytic-sphere depth-pass saving in Environmental Pain alone.
- [ ] In all-pain mode, retain scar-aware occlusion and measure expensive edge/composite work.
- [ ] If necessary, test one bounded reconstruction or sampling change at a time. Compare its
  edge quality and near-field visibility directly with the reference.
- [ ] Retain the mantle as the current performance control during evaluation. Do not adopt it
  solely because it is cheaper if it loses the appearance the user prefers.

Reject back-side leakage, detached or clipped air, pixelated rims, disappearing close-up fields,
changed geographic coverage, or opacity changes disguised as data changes. If the preferred
appearance cannot fit the target budget, present the measured tradeoff for discussion.

### Phase E: reconcile geometry detail and quality defaults

- [ ] Test reference detail 2 at normal resolution after removing the demonstrated waste.
- [ ] Compare Light's coarser scar and border geometry at the limb and minimum camera distance.
- [ ] Compare the baseline raster selection outline with the current vector outline at matching
  apparent width. Choose by close-up clarity, occlusion correctness and measured cost.
- [ ] Align web and Windows comparison settings so the same named mode means the same effective
  resolution and quality policy. Start from the evening normal-resolution experience.
- [ ] Keep HQ explicit and benchmark it independently. Do not change canvas size, camera scale,
  data coverage, dot count or typography merely to improve FPS.
- [ ] Keep the requested larger near labels and brighter palette unless user feedback reopens
  them. Preserve crisp outlines and origin/peer strengths. If vector borders are retained,
  preserve their verified cap-overlap fix; retaining that particular renderer is not mandatory.

Exit: an explained Standard policy and optional HQ policy, with no hidden quality difference
between the URL used for review and the executable delivered for exhibition.

### Phase F: verify and deliver the accepted result

- [ ] Run the existing frontend checks and focused atmosphere/highlight/geometry tests.
- [ ] Re-run the full layer/selection/zoom matrix on the final code and chosen quality policy.
- [ ] Inspect desktop and narrow/landscape layouts for rendering regressions. Physical phone
  acceptance remains deferred as requested.
- [ ] Deliver the updated local web preview and a verified Windows preview ZIP, preserving the
  evening ZIP and stable release. Keep user data outside release folders.
- [ ] Record exactly what was retained, reverted, optimized and left unresolved.
- [ ] Stop task-owned test services and remove their temporary browser profiles.

No public website deployment, PR merge, stable-release replacement or automatic-update promotion
is part of this plan. Do not create a gallery unless the user requests one.

## 5. Acceptance checks

| Concern | Required evidence |
| --- | --- |
| Visual reference | Side-by-side at matching camera, data, resolution and active tier |
| All five layers | Only their intended colors, contours, labels and atmospheric effects |
| Surface contact | Dots, fills, borders, highlights and leaders follow the correct surface |
| Selection | Exact-country and category modes; origin/peer emphasis; complete reverse motion |
| Depth | No far-side countries, network fragments or atmospheric bleed-through |
| Detail | No lost islands, broken close-up contours or new border beads |
| Updates | No wasted hidden presentation; one projection per changed border batch |
| Resource use | No repeated GPU buffer/texture reallocation or growth across switching |
| Performance | Separate CPU, GPU and pacing measurements, including first-interaction stalls |
| Framing | Same CSS globe size and camera; resolution changes reported independently |

On the reference development host, retain the paired median limit of no more than 10% above
the matching control and p95 frame intervals below 16.7 ms. Instrumentation can perturb timing;
report its method, actual refresh rate and outliers rather than treating FPS as GPU duration.

On the Fujitsu at 1080p/60 Hz, target nominal 60 fps with p95 pacing at or below 17.7 ms and no
sustained dropped-frame sequence. The user's favorable evening-build report establishes the
qualitative reference; instrumented old/new comparison is still needed to quantify differences.
If device access is unavailable, deliver a labeled preview and leave target acceptance open.
Do not claim success on the Fujitsu from a phone-sized desktop window or an M4 benchmark.

## 6. Recommendation for review

Approve a selective restoration and optimization, not a whole-application rollback:

1. Keep the evening appearance as the reference and the latest agreed data/features intact.
2. Match resolution first, then remove confirmed wasted work.
3. Recover the volume treatment and reference surface detail where measurements support them.
4. Retain correct occlusion and outlines without doubled joints, using the least costly valid path.
5. Decide any remaining visual/performance tradeoff from live comparisons.

This is the proposed direction for the user's comments and approval. No implementation has begun.

## Source navigation

- [Main loop and layer gating](../../src/main.ts)
- [Renderer, surface detail and HQ](../../src/globe/GlobeView.ts)
- [Atmospheric passes](../../src/globe/environmentalAtmosphere.ts)
- [Volume implementation](../../src/globe/atmosphereVolume.ts)
- [Mantle implementation](../../src/globe/atmosphereSurface.ts)
- [Selection borders](../../src/emo/selectionBorders.ts)
- [Hidden-label presentation](../../src/emo/labelLayer.ts)
- [Quality policy](../../src/countryProfile/quality.ts)
- [Selected configuration](../../src/countryProfile/presets.ts)

Historical versions of these files are available at `487e682`; current comparison at `cf3e15f`.
The read-only investigation reports are temporarily saved under `/tmp/` as
`evening-visual-diff-20260909.md`, `render-pass-audit-20260909.md`, and
`quality-framing-diff-20260909.md`. The decision-relevant findings are preserved above.
