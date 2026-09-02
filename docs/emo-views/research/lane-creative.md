# AGY Research Report: Unconventional Encodings for a Multilingual Pain-Category Globe (Creative Lane)

Session: emo-globe-creative-20260902-224830
Topic: Unconventional, recent, or purpose-built visual encodings for a dense multilingual pain-category globe (Three.js, art/journalism precedent, multi-label legibility, multiplex network tooling, arc treatments).
Consent: fallback_consent=unknown -> fallback_policy=off (no fallback invoked)
Provider workspace: /Users/cs/.local/state/agy-web-research/provider-workspace
Project ID: a055c4f9-6ae6-4eba-8076-b9a8d19e0005
MCP target: agy-public-web/fetch_public_url (call_mcp_tool only)
Models used: quick scan Gemini 3.8 Flash (Medium) [substituted for unavailable 'Gemini 3.5 Flash (Medium)' per troubleshooting.md invalid-model rule]; deep dive and synthesis Gemini 3.1 Pro (High)

===EXECUTIVE_SUMMARY===
This report synthesizes evidence regarding unconventional visual encodings for a dense, multilingual, multiplex 3D globe visualizing pain/emotion data. It covers solutions for rendering 93 languages/20 scripts, managing 14-shell multiplex topologies, and clarifying k=3-nearest-neighbour ego networks (~360 arcs) on a spherical surface. The analysis distinguishes between documented prior art (e.g., SDF text generation, altitude-stratified shells) and AI-generated creative synthesis (e.g., vertex scarring). Key engineering challenges remain around font payload sizes, collision performance at 60fps, and z-fighting across concentric shells.
===END_EXECUTIVE_SUMMARY===
===KEY_FINDINGS===
**1. SDF Text Generation (troika-three-text)**
*   **What it encodes:** Dense multilingual text labels encompassing 93 languages and 20 scripts (including complex shaping and RTL/Bidi like Arabic, Hebrew, and Thaana).
*   **Why it fits this data:** Avoids pre-baked atlas bloat and handles script complexities natively. Enhances legibility against cluttered backgrounds by supporting halos/outlines via SDF `outlineWidth`/`outlineBlur`, leader lines, and horizon/fog-based culling (using dot(normal, cameraDir) thresholds and `THREE.FogExp2`).
*   **Three.js Build Cost:** Low to moderate integration cost, but payload size for 20 non-Latin script fallback fonts is unvalidated.
*   **Source URL:** [troika-three-text](https://github.com/protectwise/troika/tree/master/packages/troika-three-text)

**2. Altitude-Stratified Shells / Multiplex Tooling**
*   **What it encodes:** 14 distinct categories displayed in a 14-shell multiplex mode.
*   **Why it fits this data:** Provides radial stratification ($R_i = R_0 + i*dr$) to visually separate layers, allowing users to explore multi-layered structural metrics without overlap. Tools like Arena3Dweb also solve inter-layer alignment by permitting live 3D translation/scaling of layers.
*   **Three.js Build Cost:** Base cost is low, as `three-globe`/`globe.gl` natively supports multi-shell multiplexing via multiple transparent spheres or per-node altitudes. However, mitigating z-fighting and moire effects across 14 transparent concentric shells requires unvalidated depthWrite/blending strategies.
*   **Source URLs:** [three-globe](https://github.com/vasturiano/three-globe), [Arena3Dweb](https://www.arena3d.org)

**3. Tapered Ribbon Geometry & Animated Arc Trails**
*   **What it encodes:** k=3-nearest-neighbour ego networks containing ~360 arcs.
*   **Why it fits this data:** Animated flow/particle trails depict directional density (similar to the NYT Covid Globe). Endpoint gapping (evaluating the curve over t in [0.05,0.95]) provides necessary visual breathing room at connection nodes.
*   **Three.js Build Cost:** Standard dashed trails are low-cost (native to `three-globe` via `arcDashLength`, etc.). Tapered ribbon geometry (width as a function of t) carries a high cost, requiring custom Three.js shader and `BufferGeometry` modifications.
*   **Source URLs:** [NYT Covid Globe](https://www.nytimes.com/interactive/2020/03/22/world/coronavirus-spread.html), [globe.gl](https://globe.gl/)

**4. Spherical Force-Directed Edge Bundling (FDEB)**
*   **What it encodes:** Dense, overlapping connection patterns in the ~360 arc network.
*   **Why it fits this data:** Adapts edge bundling to great circles to clarify pathways and reduce visual clutter, using depth routing or halos to clarify the relative depth of bundled edges wrapping the globe.
*   **Three.js Build Cost:** High. Requires dynamic FDEB computation across 360 arcs per interaction, necessitating an unvalidated precomputation or GPU caching strategy.
*   **Source URLs:** [MuxViz](https://github.com/manlius/muxViz), [py3plex](https://github.com/skblaz/py3plex)
===END_KEY_FINDINGS===
===CONSENSUS_AND_ALTERNATIVES===
*   **Authorship Conflict Resolved:** Phase 1 incorrectly attributed the 2018 "Planet: Imaging the Earth Every Day" project to both Nadieh Bremer and Shirley Wu. Phase 2 verification established that it was created solely by Nadieh Bremer (commissioned by Planet). This report treats Phase 2's single-author attribution as authoritative.
*   **Source Roles (Fact vs. Extrapolation):** The deep dive explicitly separates documented historical techniques from AI-extrapolated creative ideas.
    *   *Documented Facts:* 3D extrusion spikes for density (Human Terrain, The Pudding/Matt Daniels); animated flowing particle trails for volume/direction (How the Virus Got Out, NYT); AI-generated fluid latent patterns (Machine Hallucinations: Sphere, Refik Anadol).
    *   *Labeled Extrapolations (Not Evidenced Prior Art):* The use of vertex displacement/scarring to represent "pain", chromatic/interference shaders for linguistic tension, and atmospheric shell membranes pulsing to sound/breath are creative syntheses generated by the AI and are not tied to any specific past project.
===END_CONSENSUS_AND_ALTERNATIVES===
===RECOMMENDATIONS===
*   Utilize `troika-three-text` as the core SDF text engine to satisfy the demands of 20 scripts and RTL/Bidi support, and use `THREE.FogExp2` with dot-product thresholds for label culling near the horizon to reduce visual clutter.
*   Adopt `three-globe`/`globe.gl` as the baseline architecture to natively handle altitude-stratified multiplex shells and animated arcs.
*   For arc treatments, use animated particle trails for ease of implementation, pursuing custom Three.js shader/geometry work for tapered ribbons only if visually mandated by the ego network density.
*   Ensure that any implementation of spherical FDEB includes a robust caching or precomputation layer to mitigate GPU load during user interaction.
===END_RECOMMENDATIONS===
===FURTHER_RESEARCH===
The following engineering questions remain unvalidated and require targeted prototyping:
*   Non-Latin fallback font delivery payload size required to support all 20 scripts on the web.
*   Screen-space label collision performance at 60fps when 97 simultaneous labels are rendered.
*   Z-fighting and moire risk mitigation (e.g., depthWrite/blending configurations) across 14 concentric transparent multiplex shells.
*   Precomputation and caching strategies required to maintain performance for dynamic spherical Force-Directed Edge Bundling (FDEB) across 360 arcs.
*   Locating a specific public `globe.gl` demo explicitly branded "multiplex," or confirming the existence of a dedicated Gephi plugin explicitly for 3D multilayer visualization (currently, data is typically exported to tools like Arena3Dweb or MuxViz).
===END_FURTHER_RESEARCH===
===BIBLIOGRAPHY===
*   Arena3Dweb: [https://github.com/Pavlopoulos-Lab/Arena3D](https://github.com/Pavlopoulos-Lab/Arena3D) and [https://www.arena3d.org](https://www.arena3d.org)
*   FIFA Development Globe (Studio NAND, Moritz Stefaner, Jens Franke, 2012): [http://truth-and-beauty.net/projects/fifa-development-globe](http://truth-and-beauty.net/projects/fifa-development-globe)
*   How the Virus Got Out (NYT Graphics Desk, March 22, 2020): [https://www.nytimes.com/interactive/2020/03/22/world/coronavirus-spread.html](https://www.nytimes.com/interactive/2020/03/22/world/coronavirus-spread.html)
*   Human Terrain (Matt Daniels/The Pudding, Oct 2018): [https://pudding.cool/2018/10/city_3d/](https://pudding.cool/2018/10/city_3d/)
*   IEEE VIS Arts Program (VISAP): [https://visap.net](https://visap.net)
*   Machine Hallucinations: Sphere (Refik Anadol, Sept 1, 2023): [https://refikanadol.com/works/machine-hallucinations-sphere/](https://refikanadol.com/works/machine-hallucinations-sphere/)
*   MuxViz: [https://github.com/manlius/muxViz](https://github.com/manlius/muxViz)
*   Planet: Imaging the Earth Every Day (Nadieh Bremer, 2018): visualcinnamon.com / planet.com pulse blog
*   py3plex: [https://github.com/skblaz/py3plex](https://github.com/skblaz/py3plex)
*   three-globe / globe.gl: [https://github.com/vasturiano/three-globe](https://github.com/vasturiano/three-globe) and [https://globe.gl/](https://globe.gl/)
*   troika-three-text: [https://github.com/protectwise/troika/tree/master/packages/troika-three-text](https://github.com/protectwise/troika/tree/master/packages/troika-three-text)
===END_BIBLIOGRAPHY===
===RESEARCH_META===
This synthesis reconciles findings from a Phase 1 Quick Scan and a Phase 2 Deep Dive, strictly adhering to constraints to include only cited evidence. Corrected attributions (e.g., Planet Globe authorship) are implemented based on Phase 2 authoritative verification. AI-extrapolated concepts were explicitly separated from historical precedents.
===END_RESEARCH_META===

---

## Appendix: Accepted Phase Outputs

### Phase 1 - Quick Scan (Gemini 3.8 Flash Medium)
```
===QUICK_FINDINGS===
* **Dense Multilingual Text on Three.js Globes:** Standard Three.js text techniques (`CanvasTexture`, standard MSDF generator atlases) fail when confronted with 20 distinct scripts spanning complex text shaping (Devanagari, Bengali, Khmer, Myanmar, Sinhala, Lao, Thai, Tibetan), Right-to-Left / Bidirectional text (Arabic, Hebrew, Thaana), and expansive CJK character sets. The battle-tested solution in WebGL is `troika-three-text` (built on Typr and Web Workers), which performs dynamic glyph parsing, on-the-fly SDF generation, native Bidi/RTL shaping, ligature glyph substitution, and automatic Unicode fallback font resolution while patching Three.js materials to support fog, depth offsets, and custom shaders.
* **Label Legibility & Visual Encodings on Spheres:**
  - *Orientation Strategy:* Billboarding (`THREE.Sprite` or camera-quaternion locked quads) ensures upright readability from all viewing angles. However, for an organic "planetary body" artwork, surface-tangent text (aligned to the local sphere normal vector) anchors typography tangibly to the Earth's crust, naturally foreshortening toward the silhouette limb.
  - *Separation & Contrast:* Signed distance field outlines (`outlineWidth`, `outlineBlur`, `outlineColor`) create soft luminescence or dark protective halos around pale cyan text over navy backgrounds. Leader lines (radial stalks elevating labels into low orbit) decouple dense country clusters from geographic coordinate anchors.
  - *Silhouette & Horizon Culling:* Clutter at the globe edges is prevented by smooth horizon fading using normal dot camera vector checks (`dot(surfaceNormal, cameraLookDir) < threshold`), combined with distance fog or radial Fresnel fading.
* **Multiplex & Multilayer 3D Network Tooling:**
  - *MuxViz* (R/OpenGL/WebGL) pioneered 2.5D stacked and 3D multiplex visualization, solving visual density by segregating intra-layer and inter-layer connectivity, applying layer-specific transparency, and using bounding-box force layouts.
  - *Py3plex* provides Python-based multilayer network manipulation and diagonal-projection visualization with node embeddings.
  - *Arena3Dweb* (Pavlopoulos Lab) is an interactive, browser-based 3D multilayer platform supporting intra- and inter-layer Bézier curves, discrete 3D spatial alignment, and per-layer topological transformations.
  - *three-globe / globe.gl* (Vasturiano) demonstrates altitude-stratified spherical shell rendering, where independent data layers reside at discrete radial radii ($r > 1.0$) above the base sphere.
* **Expressive Arc Treatments:**
  - *Tapered / Teardrop Meshes:* Custom ribbon geometries or instanced triangle strips where arc thickness varies along parametric path $t \in [0, 1]$.
  - *Endpoint Gapping:* Truncating curve evaluations to $t \in [\epsilon, 1 - \epsilon]$ (e.g. $[0.05, 0.95]$) leaves a negative-space breathing room between arc ends and country centroid pins/labels, avoiding visual collisions.
  - *Dynamic Shaders & Particle Trails:* Using line dash offsets (`stroke-dashoffset` equivalents) or instanced particle packets traversing 3D splines (as popularized by NYT graphics desk) communicates active emotional transmission.
  - *Spherical 3D Edge Bundling:* Adapting Force-Directed Edge Bundling (FDEB) to great-circle geodesics routes $k=3$ nearest neighbor arcs into bundled "arterial trunks", reducing 360 individual lines into cohesive neural/vascular pathways.
* **Artistic Metaphors for Planetary Pain & Emotion:**
  - *Earth as Suffering Organism:* Resonates with Maurice Benayoun's *Emotion Forecast* (planetary nervous system) and the P.A.I.N. research initiative.
  - *Photoelastic Stress Birefringence:* Rendering emotional network tension as chromatic dispersion / iridescent fringes along arc trajectories.
  - *Surface Topography & Scarring:* Displacing sphere vertices dynamically via vertex shaders based on collective hardship intensity to produce geographic depressions, rifts, or weeping scars.
  - *Resonant Atmospheric Shells:* Instead of rigid wireframe layers, the 14 multiplex layers can be visualized as undulating, semi-translucent membranous envelopes (Fresnel atmospheric glow) that resonate and expand when their ego-network is engaged.
===END_QUICK_FINDINGS===

===DEEP_DIVE_AREAS===
### 1. Dense Multilingual Globe Typography & Horizon Culling (Encodings A & B)
* **Precedents:**
  - *FIFA Development Globe* (2012, Moritz Stefaner, Studio NAND, Jens Franke): Abstracted geometric globe utilizing adaptive recursive subdivision of country borders, displaying dense layered program points with contextual filtering.
  - *Planet: Imaging the Earth Every Day* (2018, Nadieh Bremer & Shirley Wu): WebGL-rendered globe processing 600,000 daily satellite image events using minimal, pixelated visual language and high-performance WebGL points.
  - *Human Terrain* (2018, The Pudding / Matt Daniels): Granular global population density extruded as 3D geographic peaks using WebGL tile systems.
  - *ReCollection* (VISAP): Interactive multimodal installation handling text across 89 distinct languages.
* **Technical & Visual Solutions for 20 Scripts in Three.js:**
  - Standard Three.js font approaches fail because pre-baked font atlases cannot scale across Latin, Arabic, Cyrillic, Thaana, Tibetan, Sinhala, Khmer, Lao, Ethiopic, Myanmar, Hebrew, Indic scripts, and CJK ideographs.
  - *Implementation:* Integrate `troika-three-text`. It parses raw TTF/OTF/WOFF font data on-the-fly inside web workers, supports complex bidirectional layout (BiDi) for Arabic, Hebrew, and Thaana, performs ligature substitutions for joined scripts, and queries systemic Unicode fallback font chains dynamically.
  - *Legibility Encodings:*
    - Halo / Glow Separation: Configure `outlineWidth` (8-12% of `fontSize`) and `outlineBlur` (15-20%) with dark navy background colors to create an optical isolation cushion between overlapping continent vectors and cyan text.
    - Curvature & Tangency: Use `curveRadius` to gently mold label planes along the sphere's local curvature, or orient quads to the surface normal vector with a radial altitude offset ($r = 1.015$).
    - Horizon & Fog Occlusion: Discard or attenuate labels where $\vec{N}_{\text{country}} \cdot \vec{V}_{\text{cam}} < 0.15$ to eliminate cluttered silhouettes along the sphere's visual rim. Couple this with Three.js distance fog (`THREE.FogExp2`) to gently dissolve labels on the receding hemisphere.

### 2. Multiplex & Multilayer Spherical Network Encodings (Encoding C)
* **Tooling Landscape:**
  - *Arena3Dweb* (Pavlopoulos Lab, bio.tools/GitHub): Purpose-built interactive 3D platform for multilayer networks. Employs 3D coordinate staging, intra- and inter-layer Bézier curves, layer-specific layout engines (force-directed, circular, grid), and opacity controls to decouple concurrent network topologies.
  - *MuxViz* (Domenico Manlio et al.): Foundational platform for multiplex network analysis. Visualizes interdependent network slices stacked across parallel spatial dimensions using transparency gradients, layer-specific node projections, and inter-slice coupling vectors.
  - *Py3plex* (Škrlj et al.): Specialized in multilayer decomposition and diagonal projection rendering.
  - *three-globe / globe.gl* (Vasturiano): Demonstrates concentric 3D layer stacks, managing arcs, heatmaps, and rings at explicit spherical radius offsets.
* **Solving Visual Chaos Across 14 Concentric Shells:**
  - *Radial Shell Stratification:* Map each of the 14 hardship categories to a calibrated radial shell: $R_i = R_0 + i \cdot \Delta r$, where $R_0 = 1.0$ and $\Delta r \approx 0.035$ (ranging from $r = 1.035$ to $r = 1.49$).
  - *Selective Translucency & Layer Attenuation:* In resting multiplex mode, render inactive shells with low alpha ($0.08 - 0.15$) and fine stroke widths. When an ego node or category is selected, illuminate its shell to full vibrancy while expanding non-target shells radially outward (an "exploded shell" view) to isolate the target layer.
  - *Radial Alignment Rays:* Render faint radial anchor lines connecting each country’s surface centroid ($r = 1.0$) through all 14 concentric shells, establishing a visual plumb line that confirms layer alignment without cluttering the spherical airspace.

### 3. Expressive Arc Encodings & Great-Circle Flow (Encoding D)
* **Precedents:**
  - *How the Virus Got Out* (2020, New York Times Graphics Desk / Jin Wu, Weiyi Cai, Derek Watkins, James Glanz): Seminal Three.js globe visualizing global flight paths and viral transmission using glowing, curved arcs with traveling particle packets on dark backgrounds.
  - *Jazz Luminaries* & *The Dark Side and the Light* (Kirell Benzi): Organic network science visualizations translating relational graphs into intricate, glowing curvilinear ribbons and affective topologies.
* **Advanced Arc Techniques in Three.js (r0.170):**
  - *Great-Circle Slerp Curves:* Construct 3D arcs via spherical linear interpolation (slerp) between source $\mathbf{p}_1$ and target $\mathbf{p}_2$, elevating the midpoint along the radial normal:
    $$\mathbf{p}(t) = \text{slerp}(\mathbf{p}_1, \mathbf{p}_2, t) \cdot \left(1.0 + h_{\max} \cdot \sin(\pi t)\right)$$
  - *Endpoint Gapping:* Evaluate curves strictly over $t \in [0.06, 0.94]$. The 6% gap at each terminus creates visual breathing room around country pins and labels, preventing edge lines from obscuring text legibility.
  - *Tapered Ribbon Geometry:* Build custom `BufferGeometry` quads or triangle strips where the ribbon cross-section width $w(t)$ scales proportionally:
    $$w(t) = w_0 \cdot \sin(\pi t)^{0.8}$$
    yielding an organic, teardrop-tapered capillary that swells at its mid-flight apogee and narrows at ground contact.
  - *Spherical Edge Bundling (FDEB on a Sphere):* For the $\approx 360$ intra-category edges, bundle nearby trajectories along great-circle geodesics using spherical force-directed attraction. This groups individual $k=3$ nearest neighbor arcs into primary arterial highways before branching out to destination countries.
  - *Animated Flow / Traveling Pulses:* Implement custom fragment shaders with a moving pulse uniform `uTime`:
    $$\alpha(t) = \alpha_{\text{base}} + \alpha_{\text{pulse}} \cdot \exp\left(-\frac{(t - \text{fract}(u_{\text{time}} \cdot v))^2}{2 \sigma^2}\right)$$
    producing subtle, biomorphic pulses of light traveling along the network.

### 4. Affective & Biological Art Encodings for Planetary Pain (Encoding E)
* **Precedents:**
  - *Emotion Forecast* (2010, Maurice Benayoun): Visualizing the internet and global data streams as a planetary nervous system exhibiting collective psychological states.
  - *Machine Hallucinations: Sphere* (2023, Refik Anadol): Monumental data sculpture projected across the Las Vegas Sphere, rendering collective planetary memory as fluid, organic, self-organizing dynamics.
  - *Network Effect* (Jonathan Harris & Greg Hochmuth): Sensorially immersive affective network exploring psychological distress, emotion, and digital human presence.
* **Unconventional Conceptual Encodings:**
  - *Somatosensory Homunculus of the Earth:* Treat the globe not as a political map, but as a living biological body. Arcs behave as visceral neural pathways or capillary beds.
  - *Photoelastic Stress Birefringence:* In material science, physical objects under mechanical strain exhibit double refraction and rainbow interference fringes under polarized light. Simulate this in the arc shader: edges connecting countries with acute hardship disparity or high distance tension shimmer with subtle chromatic aberration (splitting pale cyan into faint prismatic magenta/violet fringes).
  - *Topographic Scarring & Weeping Depressions:* Use vertex displacement shaders on the sphere mesh. Instead of a smooth radius $r = 1.0$, displace vertices inward ($r < 1.0$) based on localized hardship scores, forming subtle tectonic fissures, emotional craters, or scarred depressions where pain categories concentrate.
  - *Atmospheric Resonant Membranes:* Rather than wireframe concentric orbits, render the 14 multiplex shells as luminous gas mantles or auroral membranes (using Fresnel atmosphere shaders). When a user selects "Grief" or "Trauma", that category's shell pulses with a low-frequency breathing expansion, while non-selected shells dim to faint gossamer veils.
===END_DEEP_DIVE_AREAS===

===SOURCE_SEEDS===
* **FIFA Development Globe (Moritz Stefaner, Studio NAND, Jens Franke, 2012):** [truth-and-beauty.net/projects/fifa-development-globe](https://truth-and-beauty.net/projects/fifa-development-globe) — Seminal 3D geometric abstracted data globe featuring recursive triangular border subdivisions, elastic list multi-attribute filtering, and temporal event mapping.
* **Troika Text for Three.js (ProtectWise / Loic Goyet):** [github.com/protectwise/troika/tree/master/packages/troika-three-text](https://github.com/protectwise/troika/tree/master/packages/troika-three-text) — Definitive runtime SDF text engine for Three.js handling complex multilingual scripts, Bidi/RTL, HarfBuzz-style ligature shaping, dynamic fallback Unicode fonts, curved text planes (`curveRadius`), and halo outlines (`outlineWidth`, `outlineBlur`).
* **Arena3Dweb: Interactive 3D Multilayer Network Visualization (Pavlopoulos Lab):** [github.com/Pavlopoulos-Lab/Arena3D](https://github.com/Pavlopoulos-Lab/Arena3D) and [arena3d.org](https://www.arena3d.org) — Browser-based WebGL platform for multilayer and multiplex network visualization, featuring multi-channel Bézier curves, layer alignment, and 3D intra/inter-layer navigation.
* **Py3plex: Multilayer Network Analysis and Visualization (Škrlj et al.):** [github.com/skblaz/py3plex](https://github.com/skblaz/py3plex) — Python library supporting multiplex decomposition, embedding-based multilayer layouts, and diagonal projection visual encodings.
* **MuxViz: Framework for Multilayer Analysis and Visualization (Domenico Manlio et al.):** [github.com/manlius/muxViz](https://github.com/manlius/muxViz) — Foundational framework for 2.5D and 3D multiplex layouts, opacity-based depth attenuation, and cross-layer topology.
* **Human Terrain: Visualizing Global Population Density in 3D (The Pudding / Matt Daniels, 2018):** [pudding.cool/2018/10/city_3d/](https://pudding.cool/2018/10/city_3d/) — WebGL 3D volumetric extrusion of global human settlement data, demonstrating spatial density metaphors on spherical coordinates.
* **Planet: Imaging the Earth Every Day (Visual Cinnamon / Nadieh Bremer & Shirley Wu, 2018):** [visualcinnamon.com](https://www.visualcinnamon.com) — High-density WebGL satellite constellation visualization on an interactive globe handling 600k geographic events.
* **How the Virus Got Out (New York Times Graphics / Jin Wu, Weiyi Cai, Derek Watkins, James Glanz, 2020):** [nytimes.com](https://www.nytimes.com/interactive/2020/03/22/world/coronavirus-spread.html) — Landmark journalistic 3D Three.js globe employing glowing, particle-pulsed transit arcs and scrollytelling camera choreography.
* **Machine Hallucinations: Sphere (Refik Anadol Studio, 2023):** [refikanadol.com](https://refikanadol.com) — Monumental generative AI data sculpture on the 580,000 sq ft Las Vegas Sphere, modeling environmental data flows and planetary archives.
* **Three-Globe & Globe.gl (Vasco Asturiano):** [github.com/vasturiano/three-globe](https://github.com/vasturiano/three-globe) — Core open-source Three.js data globe library providing layers for arcs, labels, rings, and altitude-offset geometries.
* **IEEE VIS Arts Program (VISAP):** [visap.net](https://visap.net) — Archive of cutting-edge data art and physicalization papers exploring artistic network models, multilingual typography (*ReCollection*, *FaceType*), and biological network metaphors.
===END_SOURCE_SEEDS===

===QUICK_GAPS===
* **Non-Latin Fallback Font Delivery over WebGL:** While `troika-three-text` supports Unicode fallbacks, loading full glyph sets for 20 scripts (specifically comprehensive CJK, Indic, Ethiopic, Thaana, and Tibetan fonts) can incur heavy network payloads (50MB+ if unoptimized). A strategy for pre-subsetted font packages or Google Fonts CDN subset streaming needs validation for production load times.
* **Screen-Space Collision vs. Sphere Occlusion:** Dynamic auto-spinning OrbitControls globes produce continuous coordinate transformations. Real-time screen-space 2D label collision engines (e.g. dynamic bounding box repulsion or d3-force) may stutter at 60fps across 97 simultaneously visible labels if not computed via lightweight spatial partitioning (e.g., a screen-space 2D grid or KD-tree updated every $N$ frames).
* **Multiplex Shell Visual Depth Perception:** When all 14 concentric multiplex shells are rendered simultaneously, concentric transparent spheres can cause severe z-buffer fighting, moiré patterns, and alpha-blending sorting artifacts in WebGL. Explicit sorting or depth-write disabling (`depthWrite: false`, additive blending, or order-independent transparency) is required.
* **GPU Memory Footprint of Bundled 3D Arcs:** Computing spherical Force-Directed Edge Bundling (FDEB) dynamically in JavaScript across 360 arcs may introduce frame drop during interactive node selection. Precomputing bundled B-spline control points offline or caching them per category is essential for maintaining 60fps Three.js animation loops.
===END_QUICK_GAPS===
```

### Phase 2 - Deep Dive (Gemini 3.1 Pro High)
```
===FINDINGS===
**AREA 1 - Dense-label globe art/journalism pieces and many-label legibility techniques**
*   **FIFA Development Globe**: Confirmed. Created in **2012** by Studio NAND, Moritz Stefaner (information visualizer), and Jens Franke. It uses an elegant geometric abstraction and recursive subdivision process to represent country borders.
*   **Planet: Imaging the Earth Every Day**: Confirmed as **2018** (visualizing data from January 25, 2018), but authored solely by **Nadieh Bremer**, who was commissioned by Planet to visualize their fleet of "Dove" satellites.
*   **Human Terrain**: Confirmed. Created by Matt Daniels for The Pudding in **October 2018**. It uses 3D population pyramids (spikes) rather than heatmaps to visualize global density.
*   **How the Virus Got Out**: Confirmed. Published by the NYT Graphics Desk on **March 22, 2020**. It tracked early COVID-19 spread using anonymized mobile phone and air travel data.
*   **Machine Hallucinations: Sphere**: Confirmed. Created by Refik Anadol and debuted on **September 1, 2023**, on the Las Vegas Exosphere.
*   **Other Pieces**: 
    *   *Google Arts & Culture*: Hosts the "Heartbeat of the Earth" series (e.g., "Diving into an Acidifying Ocean"), but no single dense-text globe experiment was surfaced. 
    *   *Kirell Benzi*: Creates 3D network data art (e.g., Montreux Jazz Archive), balancing scientific accuracy with aesthetics.
    *   *Financial Times / Reuters*: Both have dedicated visual journalism desks. FT launched "FT Graphic World" in 2012 featuring 3D infographics by David McCandless.
*   **Legibility Techniques**:
    *   *Billboarding vs. Sphere-Tangent*: **Billboarding** (text always faces the camera) maximizes readability but creates a "floating UI" effect. **Sphere-tangent** aligns text to the surface, providing geographic realism but causing foreshortening near the horizon. `three-globe` supports both (e.g., via `labelDotOrientation`).
    *   *Fog/Depth-based Culling*: Used to fade labels as they approach the horizon, preventing backface clutter and z-fighting.
    *   *Halo/Outline Separation*: Libraries like `troika-three-text` use stroke outlines (halos) to separate text from noisy backgrounds.
    *   *Leader Lines & Radial Rings*: Common cartographic techniques to pull dense labels away from crowded geographic centers.

**AREA 2 - Multiplex/multilayer 3D network visualization tools and inter-layer alignment**
*   **MuxViz**: A real, maintained platform (GUI over an R backend) for the analysis and visualization of multilayer networks. It renders 3D visualizations and calculates complex structural metrics.
*   **py3plex**: A real Python library focused on scalable, programmatic network analysis. It features an SQL-like domain-specific language (DSL) for querying layers, but is less focused on interactive web 3D rendering than MuxViz or Arena3Dweb.
*   **Arena3Dweb**: A fully interactive, dependency-free 3D web tool. It solves inter-layer alignment visually by allowing users to translate, scale, and rotate distinct network layers in real-time 3D space, featuring Bézier curves for connections and VR support.
*   **three-globe / globe.gl**: Inherently supports multi-shell (altitude-stratified) multiplexing by rendering multiple transparent spheres or assigning altitude values to network nodes above the base globe.

**AREA 3 - Arc treatments and unusual encodings**
*   **globe.gl / three-globe arc API**: The API natively supports animated dashed trails using `arcDashLength`, `arcDashGap`, and `arcDashAnimateTime`. It does **not** natively support geometry tapering (varying width along the curve); achieving tapered ribbons requires custom three.js shaders/geometry.
*   **NYT Covid Globe**: Utilized animated, flowing particle trails along arcs to represent the volume and direction of transnational passenger traffic.
*   **Spherical FDEB (Force-Directed Edge Bundling)**: Real implementations exist (often GPU-accelerated) that adapt FDEB to a sphere's curvature to reduce visual clutter in global networks. Techniques like "depth routing" or "halos" are used to clarify relative depths of bundled edges wrapping around the globe.
*   **Unusual Artistic Encodings (Documented vs. Extrapolated)**:
    *   *Documented*: 3D extrusion spikes for density (The Pudding), AI-generated fluid latent patterns representing data layers (Refik Anadol).
    *   *Extrapolated (Your extrapolation)*: Vertex displacement/scarring to represent "pain" in languages; chromatic/interference shaders for linguistic tension; atmospheric shell membranes pulsing to sound/breath. These are visually viable in Three.js but represent creative synthesis rather than specific past globe projects.
===END_FINDINGS===

===SOURCES===
*   **FIFA Development Globe**: http://truth-and-beauty.net/projects/fifa-development-globe (Fetched via MCP tool)
*   **Human Terrain**: https://pudding.cool/2018/10/city_3d/ (Fetched via MCP tool)
*   **How the Virus Got Out**: https://www.nytimes.com/interactive/2020/03/22/world/coronavirus-spread.html (March 22, 2020)
*   **Machine Hallucinations: Sphere**: https://refikanadol.com/works/machine-hallucinations-sphere/ (Fetched via MCP tool, Sept 1, 2023)
*   **Planet Globe**: visualcinnamon.com / planet.com pulse blog (Jan 25, 2018)
*   **three-globe / globe.gl API**: https://github.com/vasturiano/three-globe and https://globe.gl/
===END_SOURCES===

===CONFLICTS===
*   **Authorship of "Planet: Imaging the Earth Every Day"**: The quick-scan context attributed this 2018 project to both Nadieh Bremer and Shirley Wu. The project was created solely by Nadieh Bremer (commissioned by Planet). While Bremer and Wu are frequent collaborators (famously on the "Data Sketches" project, which included a different May 2017 environmental piece), Wu was not a co-author of the specific Planet satellite visualization.
===END_CONFLICTS===

===GAPS===
*   **IEEE VIS/VISAP**: The search did not surface a specific, named piece from the IEEE VIS/VISAP art programmes that exclusively focuses on dense multilingual text on a sphere, though the technical challenges are frequently discussed in their layout papers.
*   **Gephi Multiplex Plugin**: A dedicated Gephi plugin exclusively branded for 3D multilayer/multiplex visualization was not explicitly confirmed; researchers typically export Gephi data to dedicated multiplex tools like MuxViz or Arena3Dweb.
*   **globe.gl Multiplex Demo**: While `globe.gl` supports altitude-stratified shells, a specific prominent open-source demo URL explicitly labeled as a "multiplex" network was not isolated in the results.
===END_GAPS===
```
