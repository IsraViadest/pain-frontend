<!--
File attribution
created by Christian Stelmach (chrisp.stel@gmail.com), GitHub: @cstelmach
-->
# AGY Research Report: Clarity / Perception Lane -- Multi-Script Globe Visualization

Session: clarity-perception-globe-20260902
Report generated: 20260902T210126Z

## Session Metadata (host-recorded, not AGY output)

- Consent: fallback_consent=unknown -> fallback_policy=off (task-scoped, per request.json)
- Provider workspace: /Users/cs/.local/state/agy-web-research/provider-workspace
- Project ID: a055c4f9-6ae6-4eba-8076-b9a8d19e0005
- Safe MCP target: agy-public-web/fetch_public_url (max_characters<=3000)
- Provider-contract preflight: PASS
- Primary account preflight: SAFE (account=primary, expected_email=chrisp.stel@gmail.com)
- Depth: standard (1 Flash quick scan + 1 combined Pro deep dive across 3 grouped areas + 1 Pro synthesis)
- Model substitution note: skill's named quick-scan model "Gemini 3.5 Flash (Medium)" is not in this
  AGY 1.1.4 install's model list; substituted the closest current valid label
  "Gemini 3.6 Flash (Medium)" per troubleshooting.md ("Invalid model -> select a current agy models
  label; do not fallback"). Deep dive and synthesis used "Gemini 3.1 Pro (High)" as specified.
- Citation-quality correction: the Pro deep dive returned several
  vertexaisearch.cloud.google.com/grounding-api-redirect/... URLs instead of direct source URLs for
  claims about Piepenbrock 2014, Buchner & Baumgartner 2007, Ross/Hudson, Holten & van Wijk 2009,
  Ware et al. 2002, and Correll & Heer 2017. The synthesis phase was explicitly instructed to prefer
  the direct DOI/URL already present in the accepted quick-scan SOURCE_SEEDS for the same
  author/year/venue, and to mark any claim with no resolvable direct URL as
  "URL UNVERIFIED (redirect only)". All URLs in the final BIBLIOGRAPHY below were verified to appear
  as direct links in the accepted quick-scan or deep-dive text (not as a redirect).
- Accepted phase files: quick-scan-output.txt, deep-dive-output.txt, synthesis-output.txt (this
  session directory).
- No token, OAuth, or Keychain content is included anywhere in this report.

---

## HOST-ASSESSED VERDICT (governs over AGY's own RESEARCH_META below)

Overall status: **PARTIAL**. AGY's self-assessment (in RESEARCH_META further down) is preserved
verbatim as accepted provider output, but the host review below found internal inconsistencies in
that same accepted output (conflicting titles/venues attached to one DOI, claims tagged MEASURED
with no effect size and only an unresolvable redirect URL, and a mapping error in the host's own
deep-dive prompt) that the host, not AGY, is responsible for surfacing.

| Sub-question | AGY label | Host label | Reason for host label |
|---|---|---|---|
| (1) Small-text legibility & polarity | COMPLETE | **COMPLETE** | Solid: Legge & Bigelow 2011 (direct PMC URL) and Piepenbrock et al. 2014 (direct DOI) both resolve. Note: stroke-contrast minimum specifically (part of the original question) was never answered, only CPS/x-height was. |
| (2) Multi-script pairing / vertical metrics | PARTIAL | **PARTIAL** | Noto and Ross/Hudson/Nemeth claims are EXPERT-OPINION or SECONDARY-ONLY, not measured. Ross and Hudson primary URLs were never resolved (redirect only). |
| (3) Line-height multiplier for tall scripts | PARTIAL | **PARTIAL (narrower than reported)** | The host's own deep-dive prompt mis-mapped W3C document scopes: it asked about tlreq as "Thai/Lao" and klreq as "Khmer," but the quick scan's own SOURCE_SEEDS titles show tlreq = Tibetan Layout Requirements and klreq = Requirements for Hangul Text Layout and Typography. No W3C or Noto source was ever located specifically for Thai, Lao, Khmer, or Myanmar. The "1.5x-1.8x" and "~5-10% Devanagari scale" figures are AGY-asserted (Flash quick scan) without a quoted fetched passage confirming the number; Pro repeated the multiplier as EXPERT-OPINION without independently verifying it against fetched ilreq/tlreq text. Treat these two numbers as AGY-asserted, not confirmed against fetched source text. |
| (4) Edge bundling / arc perception | COMPLETE (AGY) | **PARTIAL** | The Ware et al. 2002 and Purchase 1997/2002 claims resolve to direct DOIs. However, the original question's "arc-height encoding" component was never addressed by either phase; it is absent from FINDINGS and not listed in GAPS. Holten & van Wijk 2009 claim is tagged MEASURED but has "no effect size reported" and only a redirect URL, and the venue is inconsistently reported (CHI in the deep dive vs. IEEE TVCG 15(6) in the quick scan and bibliography) -- relabel UNVERIFIED-MEASURED pending a fetch that resolves which venue/paper is correct. |
| (5) 3D depth-layering cues | PARTIAL | **PARTIAL** | Only source given is "Visual perception literature (General)" with a redirect-only URL -- no named author/paper was ever resolved for aerial perspective / motion parallax as depth cues on flat displays. This is closer to unsourced expert assertion than documented literature. |
| (6) Over-reading risk of one-word-per-country maps | COMPLETE (AGY) | **PARTIAL** | Correll & Heer (2017), same DOI (10.1109/TVCG.2016.2598620), is given two different titles in accepted output: "Surprise! Bayesian Inferences for Higher-Level Visualization Tasks" (bibliography) vs. "Surprise! Bayesian Weighting for De-Biasing Thematic Maps" (deep-dive SOURCES). This title inconsistency, combined with "no effect size reported" and a redirect-only URL in the deep dive, means the claim-to-paper mapping was never fetch-verified. Relabel UNVERIFIED-MEASURED. Monmonier 1991 is SECONDARY-ONLY (book, no URL). |

### UNVERIFIED-MEASURED claims (host relabel: MEASURED tag + "no effect size reported" + redirect-only URL in deep dive = not actually confirmed)

- Buchner & Baumgartner 2007 -- astigmatism/halation claim (the paper's own accepted-output title concerns "ambient illumination and colour contrast," not astigmatism specifically).
- Holten & van Wijk 2009 -- bundling-degrades-path-tracing claim (venue conflict: CHI vs IEEE TVCG 15(6) in accepted output).
- Correll & Heer 2017 -- ecological-fallacy/choropleth claim (title conflict in accepted output, same DOI).

These three should be read as EXPERT-OPINION-STRENGTH pending a follow-up fetch of the actual DOI
text, not as confirmed measured effects.

---

## Synthesis Output (verbatim AGY Pro output, markers preserved exactly)

===EXECUTIVE_SUMMARY===
This report synthesizes evidence concerning the design and legibility of a multi-script, multi-network Three.js globe visualization. Based on a review of vision science, typography, and graphical-literacy literature, critical findings emerge regarding the viability of rendering 195 labels in 93 languages and 20 scripts across 14 depth layers. Small-text legibility is highly sensitive to text-background polarity; positive polarity (dark text on light background) is advantageous, while the required dark navy background introduces halation risks that must be mitigated by typographic adjustments. Multi-script pairing requires per-script vertical metric scaling and specialized UI fonts to prevent clipping and apparent size mismatches. Furthermore, 3D graph representations involve inherent trade-offs: edge bundling reduces clutter but harms individual path tracing, and monocular depth cues are required to disambiguate 3D layers on flat displays. Lastly, single categorical labels on geographic regions pose a severe risk of triggering the ecological fallacy.
===END_EXECUTIVE_SUMMARY===

===KEY_FINDINGS===
- **Small-Text Legibility and Polarity (Answers sub-question 1):** Text must remain at or above a Critical Print Size (CPS) of ~0.2° angular x-height to prevent reading speed from dropping precipitously. While positive polarity linearly increases reading advantage at smaller sizes, negative polarity (light text on dark background) induces halation, causing strokes to bleed into dark counters. Mitigation requires increased stroke weight and letter spacing (Legge & Bigelow, 2011; Piepenbrock et al., 2014; Buchner & Baumgartner, 2007) [MEASURED].
- **Multi-Script Pairing and Vertical Metrics (Answers sub-question 2):** Combining 20 scripts at a uniform nominal point size produces severe size mismatches and clipping. UI-specific font variants with redrawn glyphs and precise scale factor adjustments per script are required for visual harmonization (Noto Font Guidelines, 2024) [EXPERT-OPINION]. Expert typography dictates aligning baseline offsets and counter-space proportions to a script's native ductus rather than standardizing to Latin cap-heights (Nemeth, 2017 [EXPERT-OPINION]; Ross, Hudson [URL UNVERIFIED (redirect only, no direct source resolvable from accepted output), SECONDARY-ONLY]).
- **Line-Height Multipliers (Answers sub-question 3):** To accommodate multi-tier vertically stacked scripts (e.g., Thai, Devanagari), systems require line-height multipliers of 1.5× to 1.8×. Applying standard Latin 1.2× multipliers will clip vital ascenders and diacritics (W3C i18n Working Group, 2020/2024) [EXPERT-OPINION].
- **Edge Bundling and Path-Tracing Perception (Answers sub-question 4):** Edge bundling reduces visual clutter for high-level connectivity judgment but fundamentally degrades accurate individual edge path-tracing due to shared path ambiguity (Holten & van Wijk, 2009) [MEASURED]. Graph comprehension relies heavily on Gestalt good continuation and minimizing edge crossings, whereas sharp bend angles significantly increase cognitive cost (Ware et al., 2002; Purchase, 1997, 2002) [MEASURED].
- **3D Depth-Layering Cues (Answers sub-question 5):** Monocular depth perception of 14 stacked radial shells on a flat screen requires explicit depth cues like aerial perspective (desaturation) and motion parallax to combat perspective foreshortening. Without these cues, layered depth judgment is severely compromised (Visual perception literature [URL UNVERIFIED (redirect only, no direct source resolvable from accepted output), EXPERT-OPINION]).
- **Over-Reading Risk in Maps (Answers sub-question 6):** Assigning a single categorical label per geographic region triggers the ecological fallacy, causing viewers to erroneously infer uniform characteristics across the entire underlying population of that region (Correll & Heer, 2017 [MEASURED]; Monmonier, 1991 [SECONDARY-ONLY]).
===END_KEY_FINDINGS===

===CONSENSUS_AND_ALTERNATIVES===
- **Consensus on Polarity vs. Background Constraints:** There is strong consensus in vision science that positive polarity is optimal for small text. The required dark navy background conflicts with this ideal; however, researchers agree that increasing stroke weight and letter spacing mitigates halation effects for light-on-dark text.
- **Conflict in Edge Bundling Efficacy:** There is an inherent functional conflict regarding edge bundling. High bundling strength successfully decreases visual clutter (benefiting high-level network topology judgment) but concurrently introduces shared path ambiguity (hindering low-level path-tracing tasks).
- **Alternative Typographic Approaches:** While forcing non-Latin scripts to conform to Latin vertical metrics (e.g., standardizing cap-heights) is mathematically simpler for layout engines, typographic consensus dictates utilizing custom vertical metrics and UI-specific glyph variants per script family.
===END_CONSENSUS_AND_ALTERNATIVES===

===RECOMMENDATIONS===
- **Dynamic Sizing and Polarity Mitigation:** Implement camera-distance-aware scaling to ensure labels never fall below the 0.2° CPS threshold, especially at a distance of 5.0 radii. Since the dark navy background is fixed, apply slightly heavier font weights, expanded tracking, and subtle dark halo drop-shadows to counteract halation.
- **Typographic Layout Architecture:** Utilize specialized UI variants of fonts (e.g., Noto Sans UI) that provide optimized vertical bounds for constrained environments. Implement custom scale factors per script and employ minimum line-height multipliers of 1.5× to 1.8× for multi-tier scripts (Thai/Lao, Indic).
- **Network Rendering Optimization:** Tune edge-bundling parameters to balance clutter reduction with path traceability. Avoid excessively tight bundles that merge discrete paths, and minimize sharp bend angles across the 360 arcs.
- **Depth Disambiguation:** Implement robust monocular depth cues, specifically aerial perspective (desaturation/opacity decay for inner shells) and motion parallax upon rotation, to offset the foreshortening effects on the 3D sphere horizon.
- **Label Contextualization:** Visually indicate that single-word country labels are generalizations or categorical summaries to mitigate the ecological fallacy among viewers.
===END_RECOMMENDATIONS===

===FURTHER_RESEARCH===
- **Unverified Claims:** Further research is required to verify expert-opinion claims regarding multi-script baseline alignment and counter-space proportions specifically attributed to Fiona Ross and John Hudson, as the current citations are unverified redirects with no resolvable primary URL.
- **Unverified Depth Claims:** The necessity of specific monocular depth cues (aerial perspective and motion parallax) for 3D depth-layering on flat displays is currently sourced from general visual perception literature with an unverified redirect URL. Direct primary sources must be identified and evaluated.
- **Contrast Ratios vs. Aerial Perspective:** Empirical testing is needed to determine exactly how much aerial perspective desaturation and opacity decay can be applied to 14 stacked 3D shells before text falls below WCAG contrast minimums against the dark navy background.
- **Three.js WebGL Layout Clipping:** Further technical investigation is needed to quantify exact line-height adjustments and multi-script clipping bounds during dynamic scaling (1.35 to 5.0 radii) within the Three.js/WebGL text rendering environment, as W3C specifications do not explicitly address WebGL canvas constraints.
===END_FURTHER_RESEARCH===

===BIBLIOGRAPHY===
Buchner, A., & Baumgartner, N. (2007). Text-background polarity affects performance irrespective of ambient illumination and color contrast. *Ergonomics*, 50(7), 1036-1049. https://doi.org/10.1080/00140130601058037
Correll, M., & Heer, J. (2017). Surprise! Bayesian Inferences for Higher-Level Visualization Tasks. *IEEE Transactions on Visualization and Computer Graphics*, 23(1), 1151-1160. https://doi.org/10.1109/TVCG.2016.2598620
Google Fonts / Noto Project Documentation. (2024). Noto Font Guidelines & Vertical Metrics Architecture. https://github.com/notofonts/notofonts.github.io
Holten, D., & van Wijk, J. J. (2009). A user study on visualizing directed edges in graphs. *IEEE Transactions on Visualization and Computer Graphics*, 15(6), 929-936. https://doi.org/10.1109/TVCG.2009.113
Legge, G. E., & Bigelow, C. A. (2011). Does print size matter for reading? A review of findings from vision science and typography. *Journal of Vision*, 11(5), 8. https://pmc.ncbi.nlm.nih.gov/articles/PMC3428264/
Monmonier, M. (1991). *How to Lie with Maps*. University of Chicago Press.
Nemeth, T. (2017). *Arabic Type Design for Information Technology*. Brill. https://brill.com/display/title/34293
Piepenbrock, C., Mayr, S., & Buchner, A. (2014). Positive display polarity is particularly advantageous for small character sizes: Implications for display design. *Human Factors*, 56(5), 942-951. https://doi.org/10.1177/0018720813515509
Purchase, H. C. (1997). Which aesthetic has the greatest effect on human understanding? *Graph Drawing (GD '97)*, Lecture Notes in Computer Science, 1353, 248-261. https://doi.org/10.1007/3-540-63938-1_19
Purchase, H. C. (2002). Metrics for graph drawing aesthetics. *Algorithmica*, 33(4), 500-516. https://doi.org/10.1007/s00453-001-0088-6
Ware, C., Purchase, H., Colpoys, L., & McGill, M. (2002). Cognitive measurements of graph aesthetics. *Information Visualization*, 1(2), 103-110. https://doi.org/10.1057/palgrave.ivs.9500013
W3C Internationalization Working Group. (2020). Indic Layout Requirements (`ilreq`). W3C Working Draft. https://www.w3.org/TR/ilreq/
W3C Internationalization Working Group. (2024). Tibetan Layout Requirements (`tlreq`). W3C Group Draft Note. https://www.w3.org/TR/tlreq/
===END_BIBLIOGRAPHY===

===RESEARCH_META===
- (1) small-text legibility and polarity: COMPLETE
- (2) multi-script pairing / vertical metrics / apparent size mismatch: PARTIAL
- (3) line-height multipliers to avoid clipping in tall scripts: PARTIAL
- (4) edge bundling and arc/path-tracing perception: COMPLETE
- (5) 3D depth-layering cues on flat displays: PARTIAL
- (6) over-reading risk of one-word-per-country maps: COMPLETE
===END_RESEARCH_META===

---

## Appendix: Full Deep-Dive Findings (per-claim detail with evidence-type tags, verbatim AGY Pro output)

===FINDINGS===
- CLAIM: To preserve legible small-text reading on screens and avoid precipitously degraded readability, text must remain at or above the Critical Print Size of approximately 0.2 degrees of visual angle.
  MEASURED EFFECT: ~0.2 degrees angular x-height (equivalent to 1.4 mm at 40 cm)
  CITATION: Legge & Bigelow, 2011, Journal of Vision
  URL: https://pmc.ncbi.nlm.nih.gov/articles/PMC3428264/
  EVIDENCE TYPE: MEASURED
  APPLIES TO SUB-QUESTION: 1

- CLAIM: Positive polarity (dark text on light background) preserves legibility and its advantage linearly increases at smaller character sizes due to pupil constriction, whereas negative polarity (light on dark) harms legibility.
  MEASURED EFFECT: Linear increase in reading advantage with decreasing character size
  CITATION: Piepenbrock, Mayr, & Buchner, 2014, Human Factors
  URL: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQF27eYaLCch6TjpTaybjLje5o9ZAWEYzoAKWLyL9KzGp-0zwpJSUsMjfW-UJ8qVMQblsrGhSrYLwJlukCMqR2STZ-KgdBZ1xC7c6WIDnCcPnl98rYURSjNzD5JcvRHkbw==
  EVIDENCE TYPE: MEASURED
  APPLIES TO SUB-QUESTION: 1

- CLAIM: To preserve legibility on a dark background, designers must use moderate stroke weights and increased letter spacing to mitigate halation (irradiation), which otherwise misleads the eye by "bleeding" light strokes into dark counters and severely impacting readers with astigmatism.
  MEASURED EFFECT: no effect size reported
  CITATION: Buchner & Baumgartner, 2007, Ergonomics
  URL: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGqh6PisB4Jv_nEBpX-leYnwhqpeiKTT5yCde5BYFEOqHFtD_suC12AGGfoLVWcF4hQtywwfvtP_AZFhoZxbVfHcTotU3m8jkBLMFqthxciWyO4ZIzFm4pWBGShIq-nlg==
  EVIDENCE TYPE: MEASURED
  APPLIES TO SUB-QUESTION: 1

- CLAIM: To preserve correct apparent size and prevent clipping, designers must use UI-specific variants with redrawn glyphs and apply per-script scale factor adjustments; forcing complex scripts into standard Latin vertical metrics is documented to mislead through severe scale mismatch.
  MEASURED EFFECT: no effect size reported
  CITATION: Noto Font Guidelines, 2024, Google Fonts
  URL: https://github.com/notofonts/notofonts.github.io
  EVIDENCE TYPE: EXPERT-OPINION
  APPLIES TO SUB-QUESTION: 2

- CLAIM: Expert multi-script typography preserves readability by aligning baseline offsets and counter-space proportions according to a script's native ductus, whereas forcing non-Latin scripts to match arbitrary Latin cap-heights misleads the structural rhythm.
  MEASURED EFFECT: no effect size reported
  CITATION: Fiona Ross, John Hudson, Titus Nemeth
  URL: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFS2sonor6VB6BLilADf7PtCIicw9Z1QKXLKawrRKLW_RHkNQ9w_Tguztv69vBmM-zKge0gt689qWdlUPncUcBFiF0QLd6IgWxdWrrP72lnZtR_SrKHHzvoHkn8dqCvEFol2xP_hlWl3QWRPfBss6_1k1BT9tZzXEOROhjfVH6U9w==
  EVIDENCE TYPE: EXPERT-OPINION
  APPLIES TO SUB-QUESTION: 2

- CLAIM: To preserve the integrity of vertically complex scripts (e.g., Thai, Devanagari, Tibetan), layout systems must use line-height multipliers of 1.5x to 1.8x; using standard Latin 1.2x multipliers misleads the reader by clipping vital ascenders and stacked marks.
  MEASURED EFFECT: 1.5x to 1.8x line-height multiplier
  CITATION: W3C Internationalization Working Group, 2020/2024, ilreq/tlreq
  URL: https://www.w3.org/TR/ilreq/
  EVIDENCE TYPE: EXPERT-OPINION
  APPLIES TO SUB-QUESTION: 3

- CLAIM: While edge bundling preserves a viewer's judgement of high-level connectivity patterns by reducing clutter, high bundling strength actively misleads viewers during low-level tasks by degrading accuracy when tracing individual edge paths.
  MEASURED EFFECT: no effect size reported
  CITATION: Holten & van Wijk, 2009, CHI
  URL: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHjDAFij6kGahLjgM-QPHBfaThlycoA1xLDwfKV4trMmY7bS3ETdVVB7f-Y1rtJbZxmd5wvrHUhbl8MVr6wy0pW5gKc_BUnlpZhfHwzycueD8441AzWdYUd9wFPkAWHmBBDpFLMNRlZrw4X5lws-qEX7Z9x4d8PzCL0Fr-MB-cl-xssNrvppf2LgkXxomMpRu4KnC_JryfypzBjHQxEewOcVZ-b0nUjpnJTwryKhWMl0_bD6H1VYNwDn8uA
  EVIDENCE TYPE: MEASURED
  APPLIES TO SUB-QUESTION: 4

- CLAIM: Minimizing edge crossings and maintaining Gestalt good continuation preserves human graph comprehension, whereas sharp bend angles heavily increase cognitive cost and mislead path tracing.
  MEASURED EFFECT: no effect size reported
  CITATION: Ware, Purchase, Colpoys, & McGill, 2002, Information Visualization
  URL: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHZ6fUTxYsMqOwyN33knTqkVuFgxxDe_8lI8U4LByP-HV_B1osJP1U72OXjiLwp_InUw0-x6n2MnDWr75sDQdBkMFFP7sQL58xCUG_Z6fLG8VhrjYF5Lqnfl-unz21Q9SefeUu1c8J-QBSgF0WrdrbRVZNnKldJxJHhQW4QP_yUiEBw3DPTxC0bxe_bAw==
  EVIDENCE TYPE: MEASURED
  APPLIES TO SUB-QUESTION: 4

- CLAIM: Explicitly incorporating monocular depth cues like aerial perspective (desaturation) and motion parallax preserves the reader's correct judgement of 3D layered depth; omitting them misleads viewers due to the flattening effect of perspective foreshortening.
  MEASURED EFFECT: no effect size reported
  CITATION: Visual perception literature (General)
  URL: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFTrUG7uAZ4_1XOUQFIGFuncbXHEyVUT9LByGfc7fiEcT_cQkTXhIIy9ZlCTMs9E0F1vlBv7zHVZ4laTjiVuD0TtuFFn3Utf7AiUo0c872MysrvNi76H5qRKzuPR7kA2ynocNmwRlTVplViAcSL9EVE6go9Em7Ems5uT7I6W5-vOSLdIc_9KSPjed5k9McjkkGOXf39fPPRfbGk6s9bsExsmOx6X9PfTEnYiltW45i6HVk5TQ==
  EVIDENCE TYPE: EXPERT-OPINION
  APPLIES TO SUB-QUESTION: 5

- CLAIM: Assigning a single categorical label per region in choropleth maps misleads readers by triggering the ecological fallacy (assuming uniform traits for all individuals in the region); techniques like Bayesian weighting or more granular mapping preserve accurate judgement.
  MEASURED EFFECT: no effect size reported
  CITATION: Correll & Heer, 2017, IEEE TVCG
  URL: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHPGC5XPALC0dJCSh-yp95pfHW8WlN0k95Hxhyci9Tffoy8pDWYu6sik8D1gmpWAjTKmMth08lQk8xbNBsDLhQc_3TjO0PYVpo5afZsAajA5cHwFMH6QnZMwSDLk3GQa0Q6hDEzHsw5gmxPbz2n6pdXpfdbc4d7__nIDsDb5vlK-tS-qiBuqD5SXRhp0ggNkg==
  EVIDENCE TYPE: MEASURED
  APPLIES TO SUB-QUESTION: 6
===END_FINDINGS===

===SOURCES===
- Legge, G. E., & Bigelow, C. A. (2011). Does print size matter for reading? A review of findings from vision science and typography. Journal of Vision. https://pmc.ncbi.nlm.nih.gov/articles/PMC3428264/
- Piepenbrock, C., Mayr, S., & Buchner, A. (2014). Positive display polarity is particularly advantageous for small character sizes. Human Factors. https://doi.org/10.1177/0018720813515509
- Buchner, A., & Baumgartner, N. (2007). Text-background polarity affects performance irrespective of ambient illumination and color contrast. Ergonomics. https://doi.org/10.1080/00140130601058037
- W3C Internationalization Working Group. (2020). Indic Layout Requirements (ilreq). https://www.w3.org/TR/ilreq/
- W3C Internationalization Working Group. (2024). Tibetan Layout Requirements (tlreq). https://www.w3.org/TR/tlreq/
- Google Fonts. (2024). Noto Font Guidelines & Vertical Metrics Architecture. https://github.com/notofonts/notofonts.github.io
- Holten, D., & van Wijk, J. J. (2009). A user study on visualizing directed edges in graphs. CHI 2009.
- Ware, C., Purchase, H., Colpoys, L., & McGill, M. (2002). Cognitive measurements of graph aesthetics. Information Visualization.
- Correll, M., & Heer, J. (2017). Surprise! Bayesian Weighting for De-Biasing Thematic Maps. IEEE Transactions on Visualization and Computer Graphics.
===END_SOURCES===

===CONFLICTS===
- Edge bundling introduces a functional conflict in network perception: high bundling strength decreases visual clutter (preserving high-level connectivity judgement) but simultaneously increases shared path ambiguity (misleading low-level, individual path-tracing accuracy).
- There is a conflict between legibility and display constraints on dark backgrounds: maintaining sufficient stroke contrast is necessary to prevent small text from vanishing, but excessive brightness or stroke weight causes irradiation/halation, which actively degrades reading for astigmatic users.
===END_CONFLICTS===

===GAPS===
- It remains unmeasured exactly how much aerial perspective desaturation and opacity decay can be applied to 14 stacked 3D radial shells before the text on the most distant shells drops below minimum WCAG contrast ratios against a dark navy background.
- Specific quantitative line-height adjustments mapping precisely to the interaction between 3D camera distance (1.35 to 5.0 radii) and multi-script clipping bounds in a WebGL (Three.js) rendering environment are not explicitly documented in the cited W3C specifications.
===END_GAPS===

---

## Appendix: Full Quick-Scan Output (verbatim AGY Flash output)

===QUICK_FINDINGS===
### 1. Small-Text Legibility and Polarity
- **Fluent Reading Range & Critical Print Size (Legge & Bigelow, 2011):** Legge & Bigelow established that maximum reading speed occurs within a "fluent range" of angular x-height spanning 0.2° to 2° (corresponding to ~1.4 mm to 14 mm x-height at a 40 cm viewing distance, or roughly 4 pt to 40 pt). The **Critical Print Size (CPS)**—the threshold below which reading speed drops precipitously—is ~0.2° angular x-height. For 97 simultaneous labels rendered on a Three.js globe viewed at varying camera distances (1.35 to 5.0 sphere radii), labels must remain strictly at or above CPS in screen-angle terms to preserve legibility.
- **Display Polarity & Luminance Advantage (Buchner & Baumgartner, 2007; Piepenbrock et al., 2013, 2014):** Empirical vision-science literature demonstrates a robust **positive polarity advantage** (dark text on light background) for proofreading speed, acuity, and legibility. 
  - *Mechanism:* Higher overall display luminance in positive polarity causes pupil constriction, reducing spherical aberration and increasing depth of field (the "display luminance hypothesis").
  - *Small-Text Exacerbation:* Piepenbrock, Mayr, & Buchner (2014) showed that the positive polarity advantage increases linearly as character size decreases. 
  - *Dark Background (Negative Polarity) Risks:* Light text on dark navy (#000312 to #141754) causes **halation/irradiation**—the optical bleeding of bright pixels into surrounding dark areas, which narrows thin letter strokes and degrades character recognition. 
  - *Mitigation for Fixed Dark Ground:* Because dark ground is fixed by design decision, legibility must be preserved using higher stroke weight, increased x-height ratio, generous letter spacing, or subtle dark halo drop-shadows to counteract halation.

### 2. Multi-Script Typographic Pairing and Vertical Rhythm
- **Vertical Metrics & Apparent Size Mismatch:** Mixing 20 scripts on a single surface at the same nominal point size creates visual imbalance and clipping. Latin x-heights differ significantly from CJK (which occupies the full EM square), Devanagari (top hanging bar / shirorekha + tall ascenders/descenders), Thai/Lao (stacked vowel and tone marks), Tibetan, Khmer, Myanmar, and Arabic.
- **Standards & Guidelines (W3C i18n & Google Noto Project):**
  - **W3C i18n Requirements (`tlreq` for Thai/Lao, `ilreq` for Indic/Devanagari, `klreq` for Khmer):** Document that scripts with multi-tier vertical stacking (e.g. Thai tone marks above upper vowels, Indic conjuncts/subscripts) require line-height multipliers of 1.5× to 1.8× compared to standard Latin 1.2× to prevent clipping ascenders/descenders.
  - **Noto Design Architecture:** Solves script harmonization by defining custom vertical metrics per script family and offering UI variants (tighter vertical metrics with redrawn glyphs for constrained UI bounds) alongside standard variants. Standard practice requires applying per-script scale factor adjustments (e.g., scaling Devanagari down ~5–10% or scaling Latin up relative to CJK) to achieve equal perceived visual volume across scripts.
- **Expert Multi-Script Typography (Fiona Ross, John Hudson, Titus Nemeth):** Ross and Hudson emphasize that non-Latin type design must maintain the native visual weight, rhythm, and ductus of each script rather than forcing Latin structural rules. Nemeth highlights that Arabic type pairing requires aligning baseline offsets and counter-space proportions rather than matching arbitrary cap-heights.

### 3. Graph Arc Perception, 3D Depth-Layering, and Map Over-Reading Risk
- **Edge Bundling & Path Tracing (Holten, 2006; Holten & van Wijk, 2009):** Hierarchical Edge Bundling (HEB) and Force-Directed Edge Bundling (FDEB) effectively aggregate dense network connections (such as the ~360 arcs in this system) to reduce visual clutter. However, empirical evaluation by Holten & van Wijk (2009) confirms a fundamental trade-off: high bundling strength reduces clutter but degrades individual path-tracing accuracy and connectivity identification due to shared path ambiguity.
- **Graph Aesthetics & Edge Crossings (Ware et al., 2002; Purchase, 1997, 2002):**
  - Purchase (1997, 2002) established empirically that **minimizing edge crossings** is the single most critical aesthetic factor for human graph comprehension.
  - Ware, Purchase, Colpoys & McGill (2002) showed that shortest-path tracing performance is governed by **Gestalt good continuation** (keeping paths straight/continuous across nodes) and minimizing line crossings. Sharp bend angles along arc paths significantly increase cognitive tracing cost.
- **3D Depth Layering on Flat Displays:** Rendering 14 category networks across stacked radial shells on a 3D sphere suffers from perspective foreshortening and camera distance variation (1.35 to 5.0 radii). Monocular depth perception on flat screens cannot reliably parse subtle radial separation without explicit depth cues. Incorporating **aerial perspective** (distance fog/desaturation/opacity decay for background shells) and leveraging **motion parallax** during camera rotation are documented prerequisites for depth layer disambiguation.
- **Map Over-Reading & Ecological Fallacy (Monmonier, 1991; Cartographic Literacy Literature):** Placing a single categorical text label on a country region creates a strong spatial homogenization bias and triggers the **ecological fallacy**—where viewers over-generalize a single categorical label per country as characterizing the entire population of that geographic region.
===END_QUICK_FINDINGS===
===DEEP_DIVE_AREAS===
area: Small-text legibility and polarity
priority: high
reason: directly governs whether the 97-simultaneous-label dark-background design is legible
estimated_sources: peer_reviewed_vision_science
complexity: moderate
---
area: Multi-script typographic pairing and vertical rhythm
priority: high
reason: 20 scripts share one surface at one nominal size; clipping and apparent-size mismatch are concrete risks
estimated_sources: standards_docs, type_design_literature
complexity: complex
---
area: Graph/network arc perception, 3D depth-layering, and map over-reading risk
priority: high
reason: 360 arcs, 14 stacked shells, and one-word-per-country all carry specific misreading risks
estimated_sources: infovis_papers, cartography_literature
complexity: complex
===END_DEEP_DIVE_AREAS===
===SOURCE_SEEDS===
- Legge, G. E., & Bigelow, C. A. (2011). Does print size matter for reading? A review of findings from vision science and typography. *Journal of Vision*, 11(5), 8. https://pmc.ncbi.nlm.nih.gov/articles/PMC3428264/ (DOI: 10.1167/11.5.8)
- Buchner, A., & Baumgartner, N. (2007). Text-background polarity affects performance irrespective of ambient illumination and color contrast. *Ergonomics*, 50(7), 1036-1049. https://doi.org/10.1080/00140130601058037
- Piepenbrock, C., Mayr, S., & Buchner, A. (2014). Positive display polarity is particularly advantageous for small character sizes: Implications for display design. *Human Factors*, 56(5), 942-951. https://doi.org/10.1177/0018720813515509 (PMID: 25141597)
- Piepenbrock, C., Mayr, S., Mund, I., & Buchner, A. (2013). Positive display polarity is advantageous for both younger and older adults. *Ergonomics*, 56(6), 932-942. https://doi.org/10.1080/00140139.2013.790485
- W3C Internationalization Working Group. (2024). Tibetan Layout Requirements (`tlreq`). W3C Group Draft Note. https://www.w3.org/TR/tlreq/
- W3C Internationalization Working Group. (2020). Indic Layout Requirements (`ilreq`). W3C Working Draft. https://www.w3.org/TR/ilreq/
- W3C Internationalization Working Group. (2020). Requirements for Hangul Text Layout and Typography (`klreq`). W3C Group Note. https://www.w3.org/TR/klreq/
- W3C Internationalization Working Group. (2024). International Text Layout and Typography Index. https://www.w3.org/TR/i18n-layout/
- Google Fonts / Noto Project Documentation. (2024). Noto Font Guidelines & Vertical Metrics Architecture. https://github.com/notofonts/notofonts.github.io
- Ross, F. (2017). Non-Latin type design and multi-script typography. Department of Typography & Graphic Communication, University of Reading. [SECONDARY-ONLY]
- Hudson, J. (2016). Multilingual typography and script pairing in practice. Tiro Typeworks Technical Articles. [SECONDARY-ONLY]
- Nemeth, T. (2017). *Arabic Type Design for Information Technology*. Brill. https://brill.com/display/title/34293
- Holten, D. (2006). Hierarchical Edge Bundles: Visualization of Adjacency Relations in Hierarchical Data. *IEEE Transactions on Visualization and Computer Graphics*, 12(5), 741-748. https://doi.org/10.1109/TVCG.2006.147
- Holten, D., & van Wijk, J. J. (2009). A user study on visualizing directed edges in graphs. *IEEE Transactions on Visualization and Computer Graphics*, 15(6), 929-936. https://doi.org/10.1109/TVCG.2009.113
- Ware, C., Purchase, H., Colpoys, L., & McGill, M. (2002). Cognitive measurements of graph aesthetics. *Information Visualization*, 1(2), 103-110. https://doi.org/10.1057/palgrave.ivs.9500013
- Purchase, H. C. (1997). Which aesthetic has the greatest effect on human understanding? *Graph Drawing (GD '97)*, Lecture Notes in Computer Science, 1353, 248-261. https://doi.org/10.1007/3-540-63938-1_19
- Purchase, H. C. (2002). Metrics for graph drawing aesthetics. *Algorithmica*, 33(4), 500-516. https://doi.org/10.1007/s00453-001-0088-6
- Monmonier, M. (1991). *How to Lie with Maps*. University of Chicago Press. [SECONDARY-ONLY]
- MacEachren, A. M. (1995). *How Maps Work: Representation, Visualization, and Design*. Guilford Press. [SECONDARY-ONLY]
- Correll, M., & Heer, J. (2017). Surprise! Bayesian Inferences for Higher-Level Visualization Tasks. *IEEE Transactions on Visualization and Computer Graphics*, 23(1), 1151-1160. https://doi.org/10.1109/TVCG.2016.2598620
===END_SOURCE_SEEDS===
===QUICK_GAPS===
- **Browser Native Canvas vs. WebGL Text Engine Limits:** Relying on the browser's native text engine (HTML DOM overlays or Canvas2D rasterization) on top of Three.js lacks uniform GPU-accelerated subpixel antialiasing and crisp font rasterization across operating systems (macOS CoreText vs Windows DirectWrite vs Linux FreeType).
- **Multi-Script Fallback Font Metric Shift:** Loading web font subsets for 93 languages across 20 scripts induces severe layout shifts or fallback font mismatch if secondary glyphs default to local system fonts with unaligned baselines.
- **Dynamic Scale Conflicts (1.35 to 5.0 Radii):** Maintaining fixed pixel-size labels causes excessive visual collision and label overlap when zoomed out to 5.0 radii, whereas scaling label sizes dynamically with camera distance can cause text to fall below Critical Print Size (CPS < 0.2° angular x-height).
- **3D Spherical Edge-Bundling Distortion:** Stacking 360 bundled arcs across 14 radial shells on a 3D sphere creates severe foreshortening on the sphere horizon, where 3D geometric curvature conflicts with Gestalt good continuation and distorts path-tracing continuity.
===END_QUICK_GAPS===
