===EXECUTIVE_SUMMARY===
Standard treatments in production globe visualization for country labels, great-circle arcs, and far-side occlusion vary significantly across major libraries (deck.gl, globe.gl, Mapbox GL JS, CesiumJS, ECharts GL, and D3). WebGL-native primitives generally benefit from automatic hardware depth-testing for far-side occlusion, whereas DOM/HTML overlay approaches necessitate manual visibility calculations. Crucially, screen-space label decluttering implementations across the industry predominantly hide or show labels rather than dynamically repositioning them to avoid rendering flicker during rotation. A critical genre pitfall involves complex-script typography (e.g., Arabic, Thai) where canvas/WebGL texture atlas approaches inherently bypass the browser's native contextual shaping, requiring developers to leverage DOM overlays for typographically accurate multi-script labels.
===END_EXECUTIVE_SUMMARY===

===KEY_FINDINGS===
* **three-globe / globe.gl (master):** Supports native WebGL text rendering (`labelsData`) and DOM overlays (`htmlElementsLayer`). HTML DOM elements do not participate in WebGL depth buffers; far-side occlusion is handled automatically via `htmlElementVisibilityModifier`. Defaults: `labelAltitude: 0.02` (globe radius units), `labelSize: 0.5` (angular degrees), `arcAltitude: null` (auto-scaled), and `arcStroke: null` (1px constant line). Source: [three-globe README](https://raw.githubusercontent.com/vasturiano/three-globe/master/README.md).
* **deck.gl (master / v8.2+):** `GreatCircleLayer` computes 3D geodesic paths (equivalent to `ArcLayer` with `greatCircle: true`, `getHeight: 1`, `widthUnits: 'pixels'`). Rendering text relies on `TextLayer` (`sizeUnits: 'pixels'`, `billboard: true`, default `characterSet`: ASCII 32-128). Collision avoidance utilizes `CollisionFilterExtension` (`collisionEnabled: true`), which runs real-time GPU checks using a clamped priority accessor (`getCollisionPriority`: -1000 to 1000). Sources: [TextLayer API](https://raw.githubusercontent.com/visgl/deck.gl/master/docs/api-reference/layers/text-layer.md), [ArcLayer API](https://raw.githubusercontent.com/visgl/deck.gl/master/docs/api-reference/layers/arc-layer.md), [GreatCircleLayer API](https://raw.githubusercontent.com/visgl/deck.gl/master/docs/api-reference/geo-layers/great-circle-layer.md), [CollisionFilterExtension API](https://raw.githubusercontent.com/visgl/deck.gl/master/docs/api-reference/extensions/collision-filter-extension.md).
* **Mapbox GL JS (v8 Style Spec):** The `globe` projection implements screen-space collision driven by `text-allow-overlap: false`, `text-ignore-placement: false`, and `symbol-sort-key: undefined`. Sources: [Mapbox Globe Guide](https://docs.mapbox.com/mapbox-gl-js/guides/globe/), [Mapbox v8 Style Spec](https://raw.githubusercontent.com/mapbox/mapbox-gl-js/main/src/style-spec/reference/v8.json).
* **CesiumJS (1.145):** Uses WebGL primitive batches (`LabelCollection`) or `Entity` objects. Zoom-dependent scaling utilizes `scaleByDistance` and `distanceDisplayCondition: undefined`. Standoffs to avoid z-fighting are managed via `eyeOffset: Cartesian3.ZERO` and `pixelOffset: Cartesian2.ZERO`. Spatial decluttering relies exclusively on `EntityCluster` (`clustering.enabled: false`, `clustering.pixelRange: 80`); there is no `declutter` property on `LabelCollection`. Sources: [Cesium Label API](https://cesium.com/learn/cesiumjs/ref-doc/Label.html), [Cesium LabelCollection API](https://cesium.com/learn/cesiumjs/ref-doc/LabelCollection.html), [Cesium EntityCluster API](https://cesium.com/learn/cesiumjs/ref-doc/EntityCluster.html).
* **D3 (d3-geo master):** `d3.geoOrthographic()` masks far-hemisphere geometries using `clipAngle: 90` (degrees). Great circles interpolate via `d3.geoInterpolate`. Source: [d3-geo README](https://raw.githubusercontent.com/d3/d3-geo/master/README.md).
* **ECharts GL (master):** The `globe` component lacks direct native 2D label properties; labels must be attached via a 3D series (`type: 'scatter3D'`) mapped to `coordinateSystem: 'globe'`. Source: [ECharts GL Globe API](https://raw.githubusercontent.com/apache/echarts-doc/master/en/option-gl/component/globe.md).
===END_KEY_FINDINGS===

===CONSENSUS_AND_ALTERNATIVES===
(1) It is a universal convention in globe visualization that far-side occlusion for WebGL-native primitives is handled automatically via GPU depth-testing (hardware Z-buffering) and hardware horizon culling. By contrast, DOM/HTML overlays do not participate in WebGL depth buffers and universally require manual visibility logic (e.g., globe.gl's camera-vector vs surface-normal dot-product check or D3's `clipAngle(90)`).
(2) NO major library provides automatic screen-space label decluttering that both moves AND declutters countries on a rotating globe without flicker risk. Implementations favor hide/show priority hierarchies over dynamic repositioning: deck.gl's `CollisionFilterExtension` and Mapbox's collision engine both resolve screen-space collisions by hiding or showing labels based on priority, rather than shifting them. CesiumJS has no automatic decluttering at all, relying solely on point-clustering (`EntityCluster`).
(3) The deck.gl `TextLayer` complex-script shaping limitation represents the most decision-relevant documented gap for this specific project's 20-script label set. Because the project has fixed its decision to rely on the browser's own text engine, deck.gl’s fundamental rendering approach—extracting glyphs to a texture atlas character-by-character on the CPU—presents a critical conflict. Despite the library's claims of "full support for Unicode characters", this architecture fundamentally cannot process browser-native contextual shaping (like Arabic RTL ligatures or Thai combining marks), thereby mandating the use of DOM-based overlay methods.
===END_CONSENSUS_AND_ALTERNATIVES===

===RECOMMENDATIONS===
* Adopt DOM/HTML overlay elements (e.g., globe.gl `htmlElementsLayer`) strictly over WebGL text-atlas layers (e.g., deck.gl `TextLayer`) to fulfill the requirement for browser-native contextual shaping of complex scripts.
* Explicitly program manual far-side visibility occlusion checks (such as frustum or surface-normal dot-product tests) for all HTML/DOM text overlay markers, as they will bleed through the globe by default.
* Utilize simple hide/show priority filters (like Mapbox `symbol-sort-key` or deck.gl `getCollisionPriority`) for dense label decluttering to prevent extreme screen-space flicker during continuous globe rotation.
* Maintain label standoff distances around ~0.02 globe radius units and leverage explicit Z-fighting offsets (`eyeOffset`/`pixelOffset`) for concentric feature layers.
===END_RECOMMENDATIONS===

===FURTHER_RESEARCH===
* **Kepler.gl Globe-View Status:** Documentation endpoints for Kepler.gl returned 404s; the existence and status of an `enableGlobeView` prop remain unconfirmed and constitute an open gap.
* **Mapbox Horizon Culling Interaction:** The precise interaction between `text-allow-overlap: true` and horizon-culling during the Mercator-to-Globe transition is currently undocumented in the official Mapbox Globe guide and remains an open gap requiring empirical verification.
* **Concentric Shell Depth Thresholds:** The exact depth-buffer standoff thresholds required to render 14 stacked concentric shells without Z-fighting are not documented by any library and require direct empirical profiling.
* **D3 Geo Functional Documentation:** Narrative coverage of `d3.geoInterpolate` and `d3.geoDistance` from the broad scan requires a follow-up direct fetched-doc citation verification against the d3-geo documentation.
===END_FURTHER_RESEARCH===

===BIBLIOGRAPHY===
- three-globe README: https://raw.githubusercontent.com/vasturiano/three-globe/master/README.md
- globe.gl README: https://raw.githubusercontent.com/vasturiano/globe.gl/master/README.md
- deck.gl TextLayer API: https://raw.githubusercontent.com/visgl/deck.gl/master/docs/api-reference/layers/text-layer.md
- deck.gl ArcLayer API: https://raw.githubusercontent.com/visgl/deck.gl/master/docs/api-reference/layers/arc-layer.md
- deck.gl GreatCircleLayer API: https://raw.githubusercontent.com/visgl/deck.gl/master/docs/api-reference/geo-layers/great-circle-layer.md
- deck.gl CollisionFilterExtension API: https://raw.githubusercontent.com/visgl/deck.gl/master/docs/api-reference/extensions/collision-filter-extension.md
- deck.gl GlobeView API: https://raw.githubusercontent.com/visgl/deck.gl/master/docs/api-reference/core/globe-view.md
- Mapbox GL JS Globe Guide: https://docs.mapbox.com/mapbox-gl-js/guides/globe/
- Mapbox v8 Style Spec Reference: https://raw.githubusercontent.com/mapbox/mapbox-gl-js/main/src/style-spec/reference/v8.json
- Cesium Label API: https://cesium.com/learn/cesiumjs/ref-doc/Label.html
- Cesium LabelCollection API: https://cesium.com/learn/cesiumjs/ref-doc/LabelCollection.html
- Cesium EntityCluster API: https://cesium.com/learn/cesiumjs/ref-doc/EntityCluster.html
- ECharts GL Globe API: https://raw.githubusercontent.com/apache/echarts-doc/master/en/option-gl/component/globe.md
- d3-geo README: https://raw.githubusercontent.com/d3/d3-geo/master/README.md
===END_BIBLIOGRAPHY===

===RESEARCH_META===
The synthesis produced relies solely on the provided accepted quick-scan and deep-dive phase outputs. No external searches or unverified background knowledge were utilized. Unresolved gaps (e.g., Kepler.gl's globe view and Mapbox's `text-allow-overlap` horizon interaction) were preserved verbatim as strictly missing data, and conflicting library documentation claims (e.g., deck.gl's Unicode claims versus architectural limitations) were authentically highlighted rather than smoothed over.
===END_RESEARCH_META===


---

## Host Operational Metadata (appended, not part of AGY output)

- Topic: Standard treatments for country label placement on a sphere, great-circle arc geometry,
  label decluttering at globe scale, far-side occlusion handling, and zoom-dependent label sizing in
  production globe/geo visualization libraries (deck.gl, globe.gl/three-globe, Mapbox GL JS,
  CesiumJS, Kepler.gl, ECharts GL, D3 orthographic).
- Session: emo-globe-convention-20260902-224818
- Request manifest: /tmp/agy-research/emo-globe-convention-20260902-224818/request.json
- Fallback consent: denied (task-scoped; not granted by any upstream agent message) -> policy: off
- Provider workspace: /Users/cs/.local/state/agy-web-research/provider-workspace
- Project ID: a055c4f9-6ae6-4eba-8076-b9a8d19e0005
- MCP target used: agy-public-web/fetch_public_url (via call_mcp_tool), search_web for discovery
- Provider-contract preflight: PASS (scripts/test_web_provider_contract.py)
- Primary account preflight: PASS (chrisp.stel@gmail.com, keychain token_source)
- Model substitution: quick scan requested "Gemini 3.5 Flash (Medium)" per skill default, which AGY
  1.1.24 rejected as an unrecognized model (skill baseline is 1.1.4; models were renamed/rotated in
  the installed runtime). Substituted the current equivalent tier "Gemini 3.6 Flash (Medium)" per
  the troubleshooting table's instruction to "select a current `agy models` label; do not fallback."
  Deep dive and synthesis both used "Gemini 3.1 Pro (High)" as specified, which was available.
- Phases run: quick scan (Flash, single call) -> one combined Pro deep dive covering 3 merged focus
  areas (three-globe/globe.gl + deck.gl; Mapbox + Cesium; D3 + ECharts GL + Kepler.gl, plus explicit
  claim verification and a complex-script-shaping investigation) -> Pro synthesis. This is "standard"
  depth per the skill (quick scan + one combined deep dive of up to three areas + synthesis);
  extended depth (sequential additional deep dives) was not requested by the caller.
- Marker validation: QUICK_FINDINGS/DEEP_DIVE_AREAS/SOURCE_SEEDS/QUICK_GAPS (quick scan) and
  FINDINGS/SOURCES/CONFLICTS/GAPS (deep dive) each present exactly once, non-empty, correctly
  ordered -- verified by grep against raw logs. Final EXECUTIVE_SUMMARY/KEY_FINDINGS/
  CONSENSUS_AND_ALTERNATIVES/RECOMMENDATIONS/FURTHER_RESEARCH/BIBLIOGRAPHY/RESEARCH_META markers
  each present exactly once, non-empty, correctly ordered -- verified the same way.
- URL spot-check: all URLs cited in the deep-dive FINDINGS table were cross-checked against the deep
  dive's own SOURCES list (all present) and against expected official-domain patterns
  (raw.githubusercontent.com/{visgl/deck.gl, vasturiano/three-globe, vasturiano/globe.gl,
  d3/d3-geo, mapbox/mapbox-gl-js, apache/echarts-doc}, docs.mapbox.com, cesium.com/learn/cesiumjs).
  No host-model web fetch was performed to independently re-verify content at those URLs (the skill
  prohibits native URL reading / shell retrieval by the host); acceptance rests on the guarded AGY
  provider's own fetch_public_url calls.
- Repository fingerprint: not applicable. This research task does not read from or write to any
  in-scope local Git repository; no repository content was consulted or modified.
- Known corrected error: the quick scan's initial CesiumJS source seeds pointed at
  cesium.com/learn/ion-sdk/... and the dead cesiumjs.org domain. The deep-dive prompt explicitly
  flagged these as likely wrong and requested cesium.com/learn/cesiumjs/ref-doc/... instead; the
  deep dive returned corrected, working-pattern URLs.
- Named gaps carried into FURTHER_RESEARCH (not resolved by any phase): Kepler.gl globe-view support
  status (docs 404s, existence of an `enableGlobeView`-equivalent prop unconfirmed either way);
  Mapbox `text-allow-overlap` interaction with globe horizon culling (undocumented); exact
  depth-buffer/Z-fighting standoff thresholds for stacked concentric shells (not a library
  convention, would require empirical profiling); d3-geo's `geoInterpolate`/`geoDistance` were
  covered narratively but not re-verified with a direct fetched-doc citation in the deep-dive's
  per-prop table.
- Status: COMPLETE for the areas covered (three-globe/globe.gl, deck.gl, Mapbox GL JS, CesiumJS,
  D3 orthographic, ECharts GL). PARTIAL for Kepler.gl (no verifiable globe-view API found; genuine
  absence vs. undocumented could not be distinguished within the provider's fetch budget).
