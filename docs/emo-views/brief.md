<!--
File attribution
created by Christian Stelmach (chrisp.stel@gmail.com), GitHub: @cstelmach
-->
# Round v4 brief: the opening design round

Last Updated: 2026-09-03
Version: 1.0
Status: **decided.** Sections 1 to 7 are the brief as written before the shortlist was approved,
preserved unedited apart from one measured correction noted in place. Section 8 records what the
operator chose and what was built. Round v4 exists; see `src/emo/viewPresets.ts`.

This is the Phase 7 brief the plan asks for. It distils the five research lanes into the decisions
they can actually support, adds three measurements taken while writing it, and proposes candidates.
It is the input to an approval gate, not a record of work done.

---

## 1. Two statements this round is required to record

Both are carried forward verbatim in intent from the plan and from `PROGRESS.md`. Neither is
optional, and neither may be quietly dropped when the round docstring is written.

**The control confound.** `v1-control_english-sprites` is the incumbent canvas word cloud. It draws
174 countries under the old database `word` (15 sets, 10 of them `neutral`). Every other preset
draws 195 countries under the recomputed 14-category rule. The control therefore differs from every
candidate in **renderer and dataset at once**, so a difference seen between the control and any
candidate cannot be attributed to either alone.

**The one-named-change rule was suspended for round v1 only.** That is a historical statement about
the round that shipped the four language modes and the first networks together. It is recorded, not
claimed: **round v4 does not inherit the exemption.** Every candidate below is therefore written as
*a stated baseline plus exactly one named change*, so that what a candidate demonstrates is what its
name says.

---

## 2. What the five lanes can and cannot support

The lane files are at `docs/emo-views/research/lane-*.md`. Two of the five are **PARTIAL** with
unverified-recall citations. Their labels are carried through here verbatim rather than smoothed
into prose, because a claim's strength is the thing that decides whether it may drive a default.

| lane | host status | what it settles |
|---|---|---|
| `lane-convention.md` | COMPLETE for the named libraries; Kepler globe support unconfirmed | Hide/show decluttering, not repositioning; DOM overlays need manual occlusion |
| `lane-creative.md` | COMPLETE; separates documented prior art from model extrapolation | Halos, leader lines, endpoint gapping, shell stratification, arc treatments |
| `lane-webgl-text.md` | COMPLETE for the discriminating claim | Troika and MSDF cannot shape; the DOM decision stands |
| `lane-cross-domain.md` | **PARTIAL**; Imhof, Christensen/Marks/Shieber, Holten unverified-recall | PFLP vocabulary, `rbush` over GridIndex, partitioned multilayer terminology |
| `lane-clarity.md` | **PARTIAL**; several MEASURED claims relabelled UNVERIFIED on host review | Print size, polarity and halation; edge bundling trade; ecological fallacy |

### 2.1 Load-bearing and already acted on

- **Troika and MSDF cannot shape 20 scripts** (`lane-webgl-text.md`, COMPLETE for this claim,
  established from source-code analysis rather than a screenshot). The DOM overlay is not a
  preference; it is the only path that shapes Arabic joining, Devanagari conjuncts, Khmer reordering
  and Thaana RTL correctly. Nothing in round v4 may put text back into WebGL.
- **No production globe library repositions labels to declutter on rotation.** deck.gl
  `CollisionFilterExtension` and Mapbox's collision engine both hide and show by priority; CesiumJS
  has no decluttering at all, only point clustering (`lane-convention.md`, COMPLETE). This is the
  evidence behind decision 21.
- **`EMST` subset of `RNG` subset of `Gabriel` subset of `Delaunay`, all planar.** Established in
  this repo by direct measurement, not by a lane. It is why the crossing problem is already solved
  structurally rather than by bundling.

### 2.2 Supported strongly enough to drive a candidate

- **Negative polarity induces halation**, where light strokes bleed into dark counters, and the
  documented mitigation is heavier stroke weight and expanded letter spacing (Legge & Bigelow 2011
  and Piepenbrock et al. 2014 both resolve to direct URLs; Buchner & Baumgartner 2007 is
  **UNVERIFIED-MEASURED** on host review, so it is not cited as a measured effect here). The
  background is fixed dark by the product, so mitigation is the only available lever.
  `lane-creative.md` gives the concrete numbers used by SDF text: outline width 8 to 12 percent of
  font size, outline blur 15 to 20 percent. The current CSS is a soft **drop shadow**
  (`0 1px 3px`), which is directional and does not surround the glyph. This is candidate **v4-a**.
- **External labeling and leader lines** are a documented family for dense clusters
  (`lane-cross-domain.md`: Bekos, Niedermann & Nollenburg 2019 taxonomy, **unverified-recall**;
  Fekete & Plaisant 1999 excentric labeling, **unverified-recall**; `lane-creative.md` describes
  radial stalks concretely). The citations are weak, but the geometry is not: this is the only
  strategy in any lane that raises the number of labels that fit. This is candidate **v4-c**, and it
  reopens a locked decision, which is flagged as such below.
- **Monocular depth cues are needed to read stacked shells on a flat display**, specifically aerial
  perspective and motion parallax (`lane-clarity.md` sub-question 5, host status **PARTIAL**, the
  only source being "Visual perception literature (General)" with a redirect-only URL, so this is
  **EXPERT-OPINION** strength). It is enough to justify a candidate, not enough to justify a default.
  Colour, which the repo already implements, is the cheapest such cue. This is candidate **v4-b**.

### 2.3 Considered and rejected, with the reason

Recording these so they are not proposed again.

- **Spherical force-directed edge bundling.** `lane-creative.md` rates the build cost High and
  requires precomputation or GPU caching. `lane-clarity.md` reports that bundling reduces clutter but
  **degrades individual path tracing** through shared-path ambiguity (Holten & van Wijk 2009, host
  status **UNVERIFIED-MEASURED**: tagged MEASURED with no effect size, a redirect-only URL, and a
  venue conflict between CHI and IEEE TVCG 15(6) inside the accepted output). Even at full strength
  the claim argues against bundling for a network whose purpose is to be traced. And the crossing
  problem it exists to solve is already solved exactly, by the Delaunay family. Rejected on cost and
  on evidence pointing the wrong way.
- **Tapered ribbon arcs and animated travelling pulses.** `lane-creative.md` confirms `globe.gl`
  supports dashed animation natively but that tapering needs custom shaders and `BufferGeometry`
  work. Both are decoration on a network whose legibility problem is width and contrast, not shape.
  Rejected as scope.
- **MapLibre-style `text-variable-anchor` placement**, trying a label at four or eight anchor
  positions and keeping the first that fits (`lane-cross-domain.md`, the Christensen/Marks/Shieber
  4/8-position model, **unverified-recall**). This is the textbook answer and it is rejected for this
  globe specifically: the chosen anchor flips discretely as the globe turns, which is the jitter
  decision 21 exists to avoid. A continuous radial displacement (v4-c) achieves the same capacity
  gain without a discrete flip, which is why v4-c is proposed in its place.
- **Marking the labels as generalisations** to mitigate the ecological fallacy
  (`lane-clarity.md` sub-question 6, Correll & Heer 2017, host status **UNVERIFIED-MEASURED** on a
  title conflict for the same DOI; Monmonier 1991 **SECONDARY-ONLY**). **Decision 8 forecloses this**:
  no honesty metadata is surfaced on the labels. Recorded because the lane raised it, not reopened.
- **Sphere-tangent text** instead of billboarded text (`lane-creative.md`, documented as a real
  alternative that `three-globe` supports). Not rejected, but held back as the high-risk option,
  because foreshortening is worst at the limb and the limb is already where legibility is worst.
  Offered separately as **v4-e**.

---

## 3. Three measurements taken while writing this brief

All three were computed from the shipped dataset, `public/emo/emo-data.json`, and from the shipped
`public/borders/ne_110m_admin_0_countries.geojson`. Each changes a candidate.

### 3.1 Thirty-two of 195 bilingual labels print the same word twice

In `labelMode: "bilingual"` the native term sits above the English category label. For 29 countries
whose primary language is English, plus the 3 lexicon gaps that fall back to English (ETH, NRU,
VUT), those two strings are identical. The result is "Grief" over "Grief", "Loneliness" over
"Loneliness", visible in the `v3-a` gallery frame as "Anger / Anger" and "Hardship / Hardship".

That is **16.4 percent of the default view** spending two lines to say one word, and a two-line box
is the thing the overlap rule is most sensitive to.

The 32: ATG AUS BHS BLZ BRB CAN DMA ETH FSM GBR GHA GMB GRD GUY IRL JAM KNA LBR LCA NAM NGA NRU NZL
SGP SSD TTO UGA USA VCT VUT ZAF ZMB.

### 3.2 The declutter priority is a 59-way tie at the top

The overlap rule keeps candidates in descending `score`, which is the winning category's classifier
value. **59 of 195 scores are exactly 1.0000**, because the dummy generator saturates. `Array.sort`
is stable in V8, so those 59 keep their insertion order, which is the JSON key order. **The priority
of nearly a third of all labels is therefore alphabetical by ISO3 rather than meaningful.**

Adding the runner-up margin as a tie-breaker resolves 59 down to 39. It cannot do better, because
those 39 are exactly the documented tied winners where two categories both sit at 1.0000. Margin is
also adjacent to the confidence metadata decision 8 rules out of the display, so it is not proposed.

**Spherical polygon area, computed from the shipped GeoJSON, resolves the tie completely**: 166 of
the 195 countries have a polygon and all 166 areas are distinct, and the 29 without one sort last,
which for a legibility ordering is the correct place for a microstate. It is fixed per country, so
decision 22's stability argument survives unchanged. This is candidate **v4-d**.

### 3.3 The multi-script story is 27 percent of the labels

Script distribution across the 195 labels: Latin 142, Arabic 23, Cyrillic 10, Greek 2, Devanagari 2,
Korean 2, and one each of Armenian, Bengali, Tibetan, Han, Ethiopic, Georgian, Hebrew, Japanese,
Khmer, Lao, Sinhala, Thaana, Myanmar, Thai.

Twenty scripts is accurate, and 53 of the 195 labels, 27 percent, are non-Latin. Recorded because
a round that spends its budget on multi-script typography is spending it on a quarter of the view,
and because the two largest non-Latin blocks, Arabic and Cyrillic, are the two the brand face
already covers in part.

### 3.4 The screen holds 60 to 80 labels, and no candidate changes that

Measured in real Chrome at the gallery camera (`cam=22,86,2.35`, viewport 1500 by 863) with an
in-page greedy model that **reproduces the app's own count of 61 exactly**, which is what makes the
rest of the row trustworthy.

| approach | countries named |
|---|---:|
| bilingual, priority by score (what ships today) | 61 |
| bilingual, priority by country area | 63 |
| bilingual, falling back to one line when crowded | 69 |
| bilingual, radial push clamped to the viewport | 75 |
| native only, one line | 74 |
| native only, one line, priority by area | 77 |

**Every option lands between 61 and 77 of 195.** Naming the whole world at one camera is not
reachable by placement at all, so the round's real question is *which* 60 to 80 countries and how
readable they are, not how to fit more.

Two supporting numbers. The globe's screen radius is **543 pixels against a half-viewport height of
432**, so the disc already overflows the viewport vertically and the only empty space is left and
right; a radial push sends 28 to 51 labels off screen before clamping. And **all 14 categories are
represented in the kept set under both orders**, so a round-robin priority that guarantees category
coverage would buy nothing. That idea is retired here rather than carried forward.

The current order is worse than "arbitrary" in a specific way worth seeing. The first twelve labels
the rule keeps, by score, are **ALB ARE AUT BGD BRN BTN CMR CYP DJI DNK IND IRQ**. That is
alphabetical by ISO3, because 59 countries tie at 1.0000 and the sort is stable. By area they are
**RUS CHN AUS IND KAZ COD DZA SAU SDN IDN LBY IRN**.

---

## 4. The candidate shortlist

Each is *one named change against a stated baseline*. Cost is implementation cost inside this repo.

| id | baseline | the one named change | cost |
|----|----------|----------------------|------|
| `v4-a_halo` | `v3-a_declutter-priority` | Drop shadow becomes a symmetric halo sized as a fraction of the font | low |
| `v4-b_colour-shells` | `v3-c_multiplex-shells` | `colourMode: "category"`, so each of the 14 shells carries its own hue | **none** |
| `v4-c_leader-lines` | `v3-a_declutter-priority` | Labels displace radially outward as they near the limb, joined to their country by a hairline | medium |
| `v4-d_priority-area` | `v3-a_declutter-priority` | Declutter priority becomes country area instead of classifier score | low |
| `v4-e_tangent` | `v1-c_bilingual` | Text lies in the local tangent plane instead of facing the camera | medium |

### v4-a: halo instead of drop shadow

The only lane finding with two resolvable primary sources behind it. The current
`text-shadow: 0 1px 3px rgba(0,3,18,0.85)` is directional: it darkens below the glyph and leaves the
top edge unprotected. Over the bright yellow-green choropleth, which is where the globe is
brightest, that is the weakest case. A symmetric halo surrounds every stroke instead.

Adds one parameter (halo width as a fraction of font size, 0 reproducing today's shadow). Every
existing preset keeps its current appearance because the default is 0.

### v4-b: colour the shells

Zero code. `colourMode: "category"` already exists, is already wired, and already has a 14-step hue
ramp in `emo.css`. It has never been a preset, and Phase 4 explicitly deferred it to this round.
Pairing it with the shells is the cheapest available depth cue and directly answers the one thing
`v3-c` cannot currently show: which shell a label belongs to. The colour ramp's own weakness is
already recorded (the `family` palette is low contrast over the choropleth), so `category` is the
one to try, not `family`.

**Not bundled with arc colour.** Colouring arcs per category is new code and is already open
question 4 for the operator. It stays a question.

### v4-c: leader lines at the limb

**This reopens decision 21, "labels are hidden, never moved."** Presenting it as a reopening rather
than as a new view, with the argument and the costs stated.

The argument for reopening: decision 21 rests on the finding that repositioning churns on rotation
and reads as jitter, which is true of a *solver* and of a *discrete* anchor flip. A displacement that
is a continuous function of a label's own facing, directed radially outward from the globe's screen
centre, has neither property. It changes smoothly as the globe turns and it is fully determined by
geometry, so the same view always produces the same picture.

The argument for it at all was that it is the only candidate that raises the measured ceiling.
**Measured, that argument is much weaker than it looked.** See section 3.4: the gain is 61 to 75,
and the preview render shows the displaced labels landing on the title, all four layer buttons and
both bottom pills. There is no vertical room to push into, because the globe's screen radius is 543
pixels against a half-viewport of 432.

The two costs, stated rather than discovered later:

1. One extra DOM element per drawn label for the hairline. The overlap rule already caps drawn
   labels near 60, so this is tens of nodes, not 195, but it is real.
2. **Displaced labels land in the page's own chrome.** The sweep knows only about labels, so a label
   pushed off the western limb lands on the P.A.I.N. title, and one pushed east lands on the layer
   buttons. That is already a recorded round-2 item and this candidate makes it worse rather than
   causing it.

### v4-d: priority that means something

Same rule, same stability, different order. Measured in 3.2: the current order is arbitrary for 59 of
195 labels. Country area is fixed, fully distinct across the 166 countries that have a polygon, and
puts microstates last, which is where a legibility ordering wants them.

Needs the area in the dataset, which is one field added by `scripts/build-emo-data.mjs` from the
GeoJSON the repo already ships, plus one enum value on the declutter. The existing order stays the
default so no shipped preset changes.

The honest counter-argument, recorded: score is the data and area is not. Ordering by area optimises
the picture rather than the meaning. That is a legitimate thing for a legibility rule to do and a
questionable thing to do silently, which is why it is a named candidate rather than a fix.

### v4-e: sphere-tangent text

The largest visual departure available, and the highest risk. Text lies on the surface like a printed
map instead of floating toward the camera. `lane-creative.md` documents both orientations as real
alternatives and names the trade honestly: billboarding maximises readability and reads as floating
UI, tangent gives geographic realism and foreshortens toward the limb.

Held separate from the other four because the risk is specific and predictable: the limb is where
legibility is already worst, and this makes it worse there in exchange for making the centre read as
part of the globe. Worth seeing once. Not worth shipping unseen.

---

## 5. A finding with a cheap fix, which is not a candidate

**Collapse the duplicated bilingual line.** Measurement 3.1: 32 of 195 labels print one word on two
lines. The fix is to draw one line when the native term and the English label are the same string.

It is **not** proposed as a candidate because it is not a design question, it is a defect in the
operator's chosen default. It must ship as a parameter defaulting to off, because switching it on by
default would silently change `v1-c_bilingual`, and presets are append-only.

**Measured, and it is not what I first assumed.** Collapsing the duplicate line frees no capacity:
14 of the 32 are on screen at the gallery camera, and the drawn count stays at exactly 61 with the
second line removed from all 14. The overlap rule is dominated by horizontal collisions between
neighbouring labels, not by box height. The reason to do this is that "Grief" over "Grief" is wrong,
not that it buys room.

---

## 6. Deferred, and named so they are not rediscovered

- **The density cap.** `density` is implemented and no preset uses it. It selects the N strongest,
  and measurement 3.2 shows the strongest are a 59-way tie, so it currently selects arbitrarily. It
  becomes meaningful only after a priority that discriminates, which is v4-d. Deferred until then.
- **Chrome obstacles.** Feeding the title, subtitle and layer buttons to the overlap rule as
  rectangles. Already recorded as a round-2 parameter in section 18. v4-c would raise its priority.
- **Arc colour per category.** Open question 4. Cheap, since there is already one mesh per category,
  but it is a question for the operator rather than a candidate.
- **Hysteresis and a minimum visible count** for the overlap rule. Already recorded as round-2 ideas.
- **Semantic shell ordering.** Open question 7. The shells stack in category-number order, which
  encodes nothing. Needs the operator to say what it should encode.

---

## 7. What happens next

1. The operator approves a shortlist. **Nothing is rendered before that.**
2. Approved candidates are added to `EMO_PRESETS` as round v4, with the round docstring recording the
   control confound and the round v1 suspension from section 1 of this brief.
3. Only the new ids are shot: `node gallery.mjs 22,86,2.35 v4-`. Settled views are not re-shot.
4. `npm run check` passes and the result is looked at in a real browser before any commit.


---

## 8. What was decided, and what was built

Added after the approval gate. Sections 1 to 7 above are the brief as it stood when the shortlist
was put; they are left as written so the reasoning can be judged against the outcome.

### 8.1 Chosen from the shortlist

| candidate | outcome |
|---|---|
| `v4-c` leader lines | **chosen**, and reframed. See 8.2 |
| bilingual collapse | **chosen**, shipped as `identicalLines: "one"` |
| `v4-a` halo | not chosen |
| `v4-b` colour the shells | not chosen as proposed; replaced by a near-white violet ramp, see 8.3 |
| `v4-d` priority by area | not chosen. Decluttering is off throughout round v4 |

The three unchosen candidates are recorded in section 4 with their measurements. **They should not
be re-proposed as though new.** Each was measured, previewed where possible, and declined.

**Round v5 reopened one of them, at the operator's request.** The halo ships as `v5-h_halo`, with
`labelHalo` as a parameter, shown with every facing label drawn rather than with the decluttered
subset this brief's preview used. This table stays as written: it is the record of what round v4
decided, not a standing verdict. The area-ordered priority and the radial displacement both
still stand as declined.

### 8.2 Leader lines are for attribution, not capacity

The single most useful correction in the round, and it came from the operator rather than from the
research. Every lane that mentions leader lines treats them as a way to displace labels so more of
them fit; section 3.4 measured that at 61 to 75 of 195, and the preview put the displaced labels on
the title, all four layer buttons and both bottom pills. On that evidence I recommended against.

The operator's reason was different: "the labels floating above the countries are not often
attributable that clearly". That is a legibility-of-attachment problem, not a capacity problem, and
it needs no displacement at all. What shipped draws a hairline from each country up to its own
label. Nothing moves, the chrome collision disappears, and decision 21 is untouched rather than
reopened.

**The lesson generalises past this feature.** A technique's documented purpose in the literature is
not the only purpose it can serve, and measuring it against the literature's purpose can lead you
to reject it for a job it was never being asked to do.

### 8.3 Colour: a near-white band instead of fourteen hues

The proposal was `colourMode: "category"`, which already existed. The operator rejected the premise
rather than the candidate: the fourteen-hue ramp is "very different colors" where what is wanted is
"very similar shades of violet ... mostly white with just a few hues of violet, pink", separable
side by side and reading as white from a distance.

That is a different encoding with a different trade, so it shipped as a new `colourMode: "violet"`
rather than as an edit to the existing ramp, and both stay reachable. Four candidate ramps were
rendered as swatches and as text on the dark ground before any values were committed. Measured on
the globe, glyph-core pixels go from 5.4% mean saturation in white mode to 10.9% in violet.

### 8.4 Seven further instructions, all built

Bilingual everywhere and no focal mode; no decluttering for now, kept as an option; the clicked
category to be joinable as Gabriel or Delaunay or all-to-all; the whole clicked category to stay
lit and filled rather than only the country clicked, with everything else stepping back slightly
rather than vanishing; a click on empty globe to clear; arcs to fade round the back rather than
show through; and a gentler zoom ramp with a larger minimum and a later onset.

Two of those were reported as bugs and were real: the arcs leak because the globe's depth mask sits
at 0.994 while arcs ride at 1.05, and the selection lit only the clicked country. One was reported
and **could not be reproduced**: label text is not selectable, and resisted a Range, a double
click, a trusted drag and select-all. The selectable text was the panel's own prose.
