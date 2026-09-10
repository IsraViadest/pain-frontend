<!--
File attribution
created by Christian Stelmach (chrisp.stel@gmail.com), GitHub: @cstelmach
-->
===EXECUTIVE_SUMMARY===
Bottom-line: The only rendering paths capable of correctly shaping all 20 complex scripts natively are DOM Overlays (`CSS2DRenderer`), Canvas 2D (`fillText`), and WASM shaping engines (`harfbuzzjs` or `three-text`). `troika-three-text` (v0.52.5) and standard MSDF/SDF bitmap atlases do not support full OpenType shaping and will fail on complex scripts like Indic, Khmer, and Myanmar. While DOM and Canvas paths provide correct shaping via browser engines, they present severe performance or occlusion challenges for rendering 195 labels at 60fps. WASM-based HarfBuzz solutions (combined with MSDF) offer the optimal balance of correct shaping and WebGL performance, though they add bundle size.
===END_EXECUTIVE_SUMMARY===

===KEY_FINDINGS===
- **troika-three-text (v0.52.5)**: Fails to shape all 20 scripts. Source code analysis confirms it uses `Typr.ts` and `bidi-js` for basic RTL and ligatures but lacks a full OpenType GSUB/GPOS shaping engine. It cannot handle Indic reordering, conjuncts, or Khmer/Myanmar rules (Troika GitHub Issues #91, #303).
- **MSDF/SDF Bitmap Atlases**: Fail to shape all 20 scripts. Standard tools like `msdf-bmfont-xml` and `layout-bmfont-text` map raw Unicode codepoints 1-to-1 to glyphs without a shaping step, failing completely on complex scripts unless strings are pre-shaped upstream.
- **CSS2DRenderer (DOM Overlay)**: Successfully shapes all 20 scripts by delegating to browser layout engines. However, rendering 195 labels at 60fps causes main-thread style thrashing (DOM transform and `style.zIndex` updates every frame), and lacks native WebGL 3D occlusion against the globe.
- **Canvas 2D (`fillText`)**: Successfully shapes all 20 scripts using browser engines. While static textures render well, redrawing 195 canvases and updating textures (`needsUpdate = true`) per frame causes severe WebGL texture upload bottlenecks.
- **WASM Shaping (harfbuzzjs / three-text)**: Successfully shapes all 20 scripts by porting the full C++ HarfBuzz OpenType engine to WebAssembly. **Note**: The claim regarding `three-text` resolving these issues natively using HarfBuzz is of lower confidence, as it is based on a Web Search Result rather than a direct fetch of its source or documentation.
===END_KEY_FINDINGS===

===CONSENSUS_AND_ALTERNATIVES===
The consensus between background scans and primary sources is strong: native WebGL text rendering solutions without HarfBuzz (like Troika and standard MSDF atlases) unequivocally fail at complex script shaping, while browser-native text APIs (DOM/Canvas) succeed at shaping but struggle with the performance requirements of 195 dynamic 3D labels. An alternative bridging both needs is passing HarfBuzz WASM outputs into a batched WebGL quad renderer, which provides correct shaping without main-thread DOM layout thrashing or WebGL texture upload bottlenecks.
===END_CONSENSUS_AND_ALTERNATIVES===

===RECOMMENDATIONS===
- To achieve both correct shaping for all 20 scripts and 60fps performance for 195 labels, adopt a WebGL quad batching approach paired with a WASM HarfBuzz shaper (e.g., `harfbuzzjs` + MSDF).
- Evaluate the `three-text` library as a potential ready-made HarfBuzz integration, but verify its capabilities directly due to lower confidence in initial search results.
- Implement a composite fallback font strategy (e.g., Google Noto Sans sub-families), as a single font file cannot cover all 20 scripts.
- If opting for `CSS2DRenderer`, disable `sortObjects` and manage matrix transforms and horizon occlusion manually to avoid z-index layout thrashing.
- If utilizing Canvas 2D, avoid redrawing and uploading textures every frame. Ensure fonts are fully loaded via `document.fonts.load(fontSpec, text)` before `fillText()` to avoid unstyled text, scale the canvas by `window.devicePixelRatio`, and disable mipmapping for crisp text.
===END_RECOMMENDATIONS===

===FURTHER_RESEARCH===
- Verify the exact publish date of `troika-three-text` v0.52.5 (npm metadata was truncated in the initial fetch; the "time" dictionary chunk exceeded the 3000-character single-fetch limit).
- Obtain specific engineering benchmarks measuring the exact frame rate drop for 195 absolutely positioned DOM elements to quantify the CSS2DRenderer layout thrashing bottleneck (no named engineering blog with matching-scale numbers was found within budget).
- Directly fetch and audit the `three-text` (countertype) repository and documentation to confirm its HarfBuzz implementation and WebGL performance characteristics; current evidence for it is a web-search result, not a direct source/doc fetch.
- CSS Houdini and Canvas TextMetrics as text-shaping surfaces, and any dedicated WebGPU text-rendering library, were named as candidates (E) in the original lane question but were not reached by AGY's fetch budget within this deep dive; not covered by accepted evidence.
===END_FURTHER_RESEARCH===

===BIBLIOGRAPHY===
- npm registry for troika-three-text (API Metadata, v0.52.5): https://registry.npmjs.org/troika-three-text/latest
- troika-three-text README (Source Repository Documentation): https://raw.githubusercontent.com/protectwise/troika/master/packages/troika-three-text/README.md
- troika-three-text Typesetter.js (Source Code): https://raw.githubusercontent.com/protectwise/troika/master/packages/troika-three-text/src/Typesetter.js
- Troika GitHub Issue #91, "Feature: allow advanced text shaping via an optional Harfbuzz wasm URL" (Issue Tracker; open, created 2020-12-04, updated 2021-04-19): https://api.github.com/repos/protectwise/troika/issues/91
- Troika GitHub Issue #303, "troika-three-text: Indic shaping" (Issue Tracker; open, created 2024-01-30): https://api.github.com/repos/protectwise/troika/issues/303
- msdf-bmfont-xml README (Source Repository Documentation): https://raw.githubusercontent.com/soimy/msdf-bmfont-xml/master/README.md
- layout-bmfont-text index.js (Source Code): https://raw.githubusercontent.com/Jam3/layout-bmfont-text/master/index.js
- harfbuzzjs README (Source Repository Documentation): https://raw.githubusercontent.com/harfbuzz/harfbuzzjs/main/README.md
- harfbuzzjs npm registry (API Metadata, v1.6.1): https://registry.npmjs.org/harfbuzzjs/latest
- three-text GitHub Repository (Web Search Result, 2025/2026 context -- NOT a direct source fetch, lower confidence): https://github.com/countertype/three-text
- three.js CSS2DRenderer.js (Source Code): https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/jsm/renderers/CSS2DRenderer.js
- MDN Web Docs: FontFaceSet.load() (Documentation): https://developer.mozilla.org/en-US/docs/Web/API/FontFaceSet/load
- MDN Web Docs: FontFaceSet.ready (Documentation): https://developer.mozilla.org/en-US/docs/Web/API/FontFaceSet/ready
===END_BIBLIOGRAPHY===

===RESEARCH_META===
- Session: webgltext-shaping-20260902-224930. Topic: WebGL text rendering paths for 195 short
  multi-script labels on a Three.js globe (troika-three-text vs MSDF/SDF atlases vs CSS2DRenderer/
  DOM overlay vs canvas fillText+CanvasTexture; 20 scripts incl. Arabic joining, Indic reordering/
  conjuncts, Khmer/Myanmar reordering, Thaana RTL).
- Consent: fallback_consent "unknown" (parent gave no explicit consent statement) mapped to
  fallback_policy "off" per skill rule (only "granted" maps to "auto"). No fallback account was
  used or needed; primary preflight passed (agy-failover.sh preflight primary).
- Provider workspace: /Users/cs/.local/state/agy-web-research/provider-workspace. Project ID:
  a055c4f9-6ae6-4eba-8076-b9a8d19e0005. Provider-contract test passed
  (scripts/test_web_provider_contract.py: "PASS: provider workspace is restricted; custom profile
  remains search-only").
- Models: quick scan used "Gemini 3.6 Flash (Medium)". The skill's specified label
  "Gemini 3.5 Flash (Medium)" was rejected as an unrecognized model at call time (AGY's available
  model list no longer includes a 3.5 tier); substituted per the skill's troubleshooting table rule
  ("Invalid model -> Select a current agy models label; do not fallback"), not treated as an
  account-fallback event. Deep dive and synthesis both used "Gemini 3.1 Pro (High)".
- Repository fingerprint: not applicable. This is pure web research; the host cwd
  (web-pain-globe workspace root) is not a Git repository and no in-scope repository content was
  read or written.
- All FINDINGS/SOURCES/CONFLICTS/GAPS and QUICK_FINDINGS/DEEP_DIVE_AREAS/SOURCE_SEEDS/QUICK_GAPS
  marker pairs were present exactly once in both the quick-scan and deep-dive raw logs, and all
  seven final-report marker pairs were present exactly once in the synthesis raw log. No malformed
  output was encountered; no reformatting retry was needed.
- Known lower-confidence item, carried forward rather than presented as settled: the "three-text"
  (countertype) library's HarfBuzz-based shaping claim rests on a web-search result, not a direct
  fetch of its own README/source; AGY's fetch budget within the single Pro deep dive was spent
  primarily on troika-three-text (per host-directed area-1 priority) and did not reach a direct
  fetch of three-text.
- Named gaps carried into FURTHER_RESEARCH (not resolved by any phase): exact npm publish
  timestamp for troika-three-text v0.52.5 (truncated by the 3000-character fetch cap); a named
  engineering benchmark for ~195 simultaneously-updated absolutely-positioned DOM elements at 60fps
  (none found within budget, so not extrapolated from unrelated benchmarks); CSS Houdini / Canvas
  TextMetrics and WebGPU text libraries (candidate E items) not reached within the single deep dive.
- Status: COMPLETE for troika-three-text shaping mechanism (Area 1, the discriminating claim for
  the build decision), MSDF/SDF atlas shaping capability, harfbuzzjs verification, CSS2DRenderer
  per-frame behavior, and FontFaceSet load/ready semantics. PARTIAL for three-text (unverified
  beyond a search result), for a numeric 195-element DOM performance benchmark (no source found),
  and for CSS Houdini/TextMetrics/WebGPU text libraries (not reached).
===END_RESEARCH_META===

---

## HOST VERIFICATION NOTE (added after adversarial re-check of the accepted logs; not AGY output)

The synthesis phase's EXECUTIVE_SUMMARY and RECOMMENDATIONS call harfbuzzjs+MSDF the "optimal
balance." Re-checking that claim against the deep-dive log it was built from shows it overstates
what was actually verified:

1. **"Optimal" is not supported; correct tiered verdict on shaping correctness:**
   - **Verified, turnkey, correct for all 20 scripts today:** (C) CSS2DRenderer/DOM overlay and
     (D) canvas 2D fillText into CanvasTexture -- both delegate to the browser's own shaping engine
     by construction, no library-side shaping code needed.
   - **Verified real shaper, but NOT a turnkey library integration:** (E) harfbuzzjs 1.6.1 does
     expose the real `hb.shape()` HarfBuzz function compiled to WASM (confirmed by direct fetch of
     its README). However, the deep dive's own Area 2 conclusion states an MSDF/bitmap atlas can
     only represent contextual/conjunct forms "if the text is passed through an external shaper
     ... the atlas is generated using those explicit glyph IDs, and the layout engine is modified
     to accept arrays of glyph IDs" -- i.e. no fetched source shows an existing off-the-shelf
     harfbuzzjs+MSDF pipeline; it would need to be built. The only primary source touching this
     pipeline is Troika issue #91, an OPEN, unimplemented 2020 feature request whose own author
     declined to ship it by default -- evidence someone wanted this, not evidence a working
     integration exists. The "three-text" library that reportedly does this ready-made was never
     directly fetched (web-search result only, explicitly flagged lower-confidence in the report).
   - **Fails on complex scripts as shipped:** (A) troika-three-text v0.52.5 (no GSUB/GPOS shaper;
     confirmed no Indic reordering/conjuncts per open issue #303, Jan 2024) and (B) MSDF/SDF bitmap
     atlases via msdf-bmfont-xml/layout-bmfont-text (raw per-codepoint glyph lookup, no shaping
     step at all).
   - Read RECOMMENDATIONS' harfbuzzjs+MSDF suggestion as "the only path to unify WebGL-native
     batching with real shaping, at the cost of building the shaper-to-atlas integration yourself,"
     not as an existing, drop-in optimal solution.

2. **harfbuzzjs WASM size figure is misattributed.** FINDINGS cites "~180kB after many rounds of
   optimization" as harfbuzzjs's binary size, sourced to Troika issue #91 -- but that is a
   2020-2021 comment about Typr.js's optional HarfBuzz integration, not a fetch of harfbuzzjs
   1.6.1's own README or build output. Mark this figure UNVERIFIED for harfbuzzjs 1.6.1
   specifically (the quick scan's unsourced "150KB-300KB gzipped" is likewise UNVERIFIED).

3. **The `.load()` "fail or reject" line is an AGY paraphrase, not a quoted MDN behavior.** No MDN
   text was quoted in the log for this claim, only the paraphrase that omitting size in the font
   shorthand argument "will cause it to fail or reject." Treat the exact runtime behavior of
   `FontFaceSet.load()` with a malformed/bare-family argument as UNVERIFIED against MDN's actual
   documented text; the general point (the argument must follow CSS font shorthand syntax including
   size) is corroborated but the failure mode's specifics are not confirmed from a direct quote.

4. **U+200C ZWNJ handling was not verified for any path.** The lane's required test term contains
   ZWNJ (بی‌ثباتی). No FINDINGS entry in the accepted deep dive addresses ZWNJ specifically for
   troika-three-text, MSDF atlases, DOM overlay, canvas fillText, or harfbuzzjs. This is a real gap,
   not settled by inference from general Arabic-joining claims, and is added here to
   FURTHER_RESEARCH/GAPS explicitly: **U+200C ZWNJ handling: UNVERIFIED for every candidate path.**

None of the above required a new provider call; all corrections rest on re-reading the already
accepted deep-dive and quick-scan logs at
`/tmp/agy-research/webgltext-shaping-20260902-224930/deep-dive-raw.log` and
`/tmp/agy-research/webgltext-shaping-20260902-224930/quick-scan-raw.log`.
