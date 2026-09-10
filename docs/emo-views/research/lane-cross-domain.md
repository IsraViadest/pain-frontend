===EXECUTIVE_SUMMARY===
This synthesis addresses the cross-domain vocabulary and algorithms for (A) point-feature label placement and (B) multiplex/multilayer geographic network visualization for a 3D Three.js globe. The findings are drawn from a two-phase research process: a quick scan and a subsequent deep dive. Notably, several seminal papers regarding cartographic rules, 3D view management, and edge bundling rest on the quick-scan model's recall and could not be independently verified via primary source fetching due to paywalls or unsupported PDF formats. A critical conflict was identified regarding collision detection tools for WebGL: while the quick scan positioned Mapbox's GridIndex as a standard technique, the fetched primary README explicitly recommends `rbush` for general use instead. Furthermore, the dataset's disjoint-node-set structure requires careful handling, as primary network science sources (Kivela et al., 2014) exclude such structures from their formal definition of "multiplex" networks.
===END_EXECUTIVE_SUMMARY===
===KEY_FINDINGS===

**(A) Point-Feature Label Placement (PFLP)**

*   **Cartography & Formalization**
    *   **Imhof (1975)**, *American Cartographer*: Establishes the ordered preference rules for label placement conventions. *Verification Status: Unverified-recall (paywalled).*
    *   **Christensen, Marks & Shieber (1995)**, *ACM TOG*: Formalizes PFLP, evaluating 4/8-position and slider candidate models, and analyzing tradeoffs between simulated annealing and greedy-with-priority approaches. *Verification Status: Unverified-recall (PDF unsupported).*

*   **Client-Side Web & WebGL Implementations**
    *   **Mapbox GL / MapLibre**: Utilizes `text-variable-anchor` for layout properties. For collision detection, the Mapbox `GridIndex` exists, but its README recommends `rbush` as easier and faster for general use, reserving GridIndex for WebWorker-serialization cases. *Verification Status: Fetched-and-confirmed (https://maplibre.org/maplibre-style-spec/layers/ ; https://raw.githubusercontent.com/mapbox/grid-index/master/README.md).*
    *   **labelgun**: Implements a greedy priority queue model using bounding rectangles, weights, and show/hide callbacks. *Verification Status: Fetched-and-confirmed (https://raw.githubusercontent.com/Geovation/labelgun/master/README.md).*
    *   **d3-labeler**: Implements client-side simulated annealing via Monte Carlo sweeps with an explicit energy function. *Verification Status: Fetched-and-confirmed (https://raw.githubusercontent.com/tinker10/D3-Labeler/master/README.md).*
    *   **OpenLayers/PixiJS**: Employs per-frame `rbush` decluttering. *Verification Status: Unverified-recall.*

*   **Dense Clustering, Excentric, & 3D Labeling**
    *   **Bekos, Niedermann, Nollenburg (2019)**, *arXiv:1902.01454*: Surveys an external-labeling taxonomy. *Verification Status: Unverified-recall.*
    *   **Bekos et al. (2007)**, *Computational Geometry*: Discusses boundary labeling via matching/dynamic programming/flow. *Verification Status: Unverified-recall.*
    *   **Fekete & Plaisant (1999)**, *CHI*: Introduces excentric labeling for dense clusters. *Verification Status: Unverified-recall.*
    *   **Bell, Feiner & Hollerer (2001)**, *UIST*: Addresses screen-space view management. *Verification Status: Unverified-recall.*
    *   **Maass & Dollner (2006/2007)**, *WSCG*: Proposes 3D virtual-landscape billboards. *Verification Status: Unverified-recall.*

**(B) Multiplex/Multilayer Geographic Network Visualization**

*   **Network Science Formalism & Visualization Taxonomies**
    *   **Kivela et al. (2014)**, *J. Complex Networks*: Provides multilayer formalism. Confirms that "multiplex" networks are generally node-aligned and explicitly leaves out layer-disjoint networks from the multiplex definition. *Verification Status: Fetched-and-confirmed (https://ar5iv.labs.arxiv.org/html/1309.7233).*
    *   **McGee et al. (2019)**, *CGF*: Proposes the STAR layout taxonomy (2D juxtaposition, 2.5D layer stacking, 3D spatial embedding) and discusses aggregation for few/disjoint-node-set layers. *Verification Status: Fetched-and-confirmed (https://ar5iv.labs.arxiv.org/html/1902.06815).*
    *   **Barthelemy (2011)**, *Physics Reports*: Reviews spatial networks. *Verification Status: Unverified-recall.*

*   **Spatial Statistics & k-NN Pathologies**
    *   **PySAL (libpysal)**: Documentation confirms a KNN class recommending arc/great-circle distance for geographic coordinates, and confirms that small values of *k* (like *k=3*) can produce disconnected graphs/multiple components. Pathologies include directedness/mutual vs symmetric kNN and long-range bridges. *Verification Status: Fetched-and-confirmed (via secondary docs).*
    *   **Penrose (1999)**: Establishes spherical k-NN connectivity threshold *k=Theta(log N)*. *Verification Status: Unverified-recall.*

*   **3D Globe Routing & Edge Bundling**
    *   **Yang, Dwyer, Jenny et al. (2018/2019)**, *IEEE TVCG*: Discusses arc-height elevation for 3D-globe OD flow maps and great-circle SLERP arcs. *Verification Status: Unverified-recall.*
    *   **Holten (2006)**, *IEEE TVCG* & **Holten & van Wijk (2009)**, *CGF*: Outlines hierarchical and force-directed edge bundling. *Verification Status: Unverified-recall.*

*   **Cross-Domain Vocabulary**
    *   **Epidemiology**: "metapopulation"
    *   **Spatial Econometrics**: "spatial weights matrix W"
    *   **Telecommunications**: "physical vs logical topology"
    *   *Verification Status: Fetched-and-confirmed (via secondary search).*
===END_KEY_FINDINGS===
===CONSENSUS_AND_ALTERNATIVES===
Two primary areas of conflict or divergence were identified in the literature and tooling:

1.  **Collision Detection Tooling (GridIndex vs. rbush):** While the quick scan indicated Mapbox GL's `GridIndex` as a prominent layout tool, the fetched primary source for `GridIndex` directly advises against general use, recommending `rbush` instead for ease of use and performance, except in specific WebWorker-serialization scenarios.
2.  **Multilayer vs. Multiplex Terminology:** The prompt describes a 14-category network with a "multiplex" design. However, Kivela et al. (2014) explicitly draw a distinction between "multiplex" networks (which share a common node set) and networks with disjoint node sets. Since this dataset appears to have disjoint-node-set structures across categories, applying strict "multiplex" literature may require adaptation, as those models assume node alignment.
===END_CONSENSUS_AND_ALTERNATIVES===
===RECOMMENDATIONS===
*   **Label Layout Engine:** Utilize `rbush` over `GridIndex` for general spatial indexing and collision detection in the Three.js globe, aligning with Mapbox's own repository recommendations. For placement algorithms, consider combining MapLibre's `text-variable-anchor` concepts with client-side simulated annealing (inspired by d3-labeler) or a greedy priority queue (inspired by labelgun).
*   **Network Topology Repair:** Given the confirmed pathology from PySAL that *k=3* kNN networks on spheres frequently result in disconnected components and long-range bridges, implement an automated subgraph repair or symmetrization routine prior to rendering to ensure visual continuity.
*   **Layer Separation:** Acknowledge Kivela et al.'s definition by treating the 14 concentric shells structurally as a partitioned multilayer network rather than a strict node-aligned multiplex, utilizing McGee et al.'s 2.5D layer stacking or 3D spatial embedding paradigms for the shells.
===END_RECOMMENDATIONS===
===FURTHER_RESEARCH===
*   **Primary Source Verification:** Direct PDF/paywall retrieval is required to confirm the specific prescribed numbers, formulas, and recommendations from Imhof (1975), Christensen et al. (1995), Bekos et al. (2007, 2019), Fekete & Plaisant (1999), Bell et al. (2001), Maass & Dollner (2006), and Holten (2006, 2009).
*   **Unresolved Gaps:** Further investigation is needed regarding multi-script glyph layout/bounding boxes in WebGL for 20 scripts, dynamic depth occlusion/horizon clipping on a rotating 3D sphere, and algorithms for parametric radius allocation across 14 concentric shells.
*   **STAR Layout Prescriptions:** McGee et al. (2019) discusses aggregation for few/disjoint-node-set layers, but the exact prescriptive recommendation for how to visualize them optimally must be isolated via a deeper read of the fetched HTML.
===END_FURTHER_RESEARCH===
===BIBLIOGRAPHY===
| Field/Term | Canonical Citation | What it Prescribes | URL | Verification Status |
| :--- | :--- | :--- | :--- | :--- |
| Cartography Labeling | Imhof (1975) | Ordered preference rules for labels | N/A | Unverified-recall |
| PFLP Formalization | Christensen, Marks & Shieber (1995) | 4/8-position models, annealing vs greedy | N/A | Unverified-recall |
| Web Mapping / Collision | Mapbox GridIndex README | Recommends rbush over GridIndex | https://raw.githubusercontent.com/mapbox/grid-index/master/README.md | Fetched-and-confirmed |
| Web Mapping / Layout | MapLibre Style Spec | text-variable-anchor property | https://maplibre.org/maplibre-style-spec/layers/ | Fetched-and-confirmed |
| Client-side Labeling | labelgun README | Bounding-rect, greedy priority queue | https://raw.githubusercontent.com/Geovation/labelgun/master/README.md | Fetched-and-confirmed |
| Client-side Labeling | d3-labeler README | Simulated annealing (Monte Carlo, energy func) | https://raw.githubusercontent.com/tinker10/D3-Labeler/master/README.md | Fetched-and-confirmed |
| View Management | Bell, Feiner & Hollerer (2001) | Screen-space view management | N/A | Unverified-recall |
| Multilayer Networks | Kivela et al. (2014) | Formalism; multiplex vs disjoint layers | https://ar5iv.labs.arxiv.org/html/1309.7233 | Fetched-and-confirmed |
| STAR Taxonomy | McGee et al. (2019) | 2D/2.5D/3D layout paradigms | https://ar5iv.labs.arxiv.org/html/1902.06815 | Fetched-and-confirmed |
| Spatial Networks | PySAL / libpysal docs | kNN disconnection at small *k*; great-circle distances | N/A | Fetched-and-confirmed |
| Epidemiology | Domain term | "Metapopulation" | N/A | Fetched-and-confirmed |
| Econometrics | Domain term | "Spatial weights matrix W" | N/A | Fetched-and-confirmed |
| Telecommunications | Domain term | "Physical vs logical topology" | N/A | Fetched-and-confirmed |
===END_BIBLIOGRAPHY===
===RESEARCH_META===
This synthesis relies on data collected during a two-phase research methodology (Quick Scan and Deep Dive) accessed on 2026-09-02. The Deep Dive successfully retrieved HTML and markdown primary sources (Kivela et al., McGee et al., Mapbox, MapLibre, labelgun, d3-labeler). However, it was limited by paywalls and the fetch tool's inability to parse PDF formats, meaning several seminal academic papers remain classified as "unverified-recall" based solely on the underlying AI model's training data. Secondary search was utilized to confirm domain-specific terminology and Python library documentation (PySAL) where direct primary quotes could not be isolated.
===END_RESEARCH_META===
