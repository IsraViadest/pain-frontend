# Exhibition presenter guides

Last updated: 2026-09-09. Version: 1.1.

## Agreed delivery

English presenter guides for ages 18, 5, 12, undergraduate/graduate, and expert, produced
one audience at a time in that order. Each receives a separate one-page keyword PDF.
Start with age 18 and present the pair for review before adapting the other audiences.

Each guide contains nine complete scripts: museum guide, science educator, and artist talk,
each at 2-3, 5-10, and 15-20 minutes. Shared presenter notes explain the project, four layers,
source counts and coverage, processing, classifier, geography, graph construction, visual
encodings, interaction, uncertainty, and approximately 25 country stories.

Use the selected exhibition datasets. Treat current live screenshots as dated illustrations;
the worktree also contains concurrent visual changes owned by other work. Source scores are
distinct from rendering controls. Missing original source methods are identified, not inferred.

## Files and verification

Editable Markdown, a small ReportLab builder, screenshots, and the two PDFs live here.
The source Markdown holds the factual foundation for subsequent audience adaptations.
Rebuild with the Python runtime described at the top of `build_guides.py`.

Before delivery, verify source numbers and script timing, render and inspect every PDF page,
check bookmarks and links, confirm a one-page cheat sheet, and commit only this directory.

## Progress

- 2026-09-09: User approved implementation. Source refresh and first audience authoring started.
  Subsequent audiences remain pending review of the age-18 pair.
- 2026-09-09: Completed the age-18 authoring source, nine timed scripts, 25 story cards,
  source atlas, graph/pipeline/economic-scale diagrams, annotated live illustrations,
  glossary, references, and separate keyword sheet. Final guide: 43 A4 pages; sheet: one.
- Verification: selected emotional values matched all 3,072 recomputed scores; 1,338 spatial
  country/condition values and point counts matched fresh API arrays; GDP source and formula
  matched the selected file. A separate content review found no factual defect and suggested
  the tight-shell explanation of convex hull, which was added.
- PDF checks: all nine scripts satisfy their timing bands at 120-140 words per minute plus
  stated pauses; all 25 stories are present; bookmarks and 23 public links are embedded;
  text bounds and A4 dimensions pass. Every page was rendered and visually inspected.
  Caption placement and two annotation/layout issues found during inspection were corrected.
- Exact original health/environmental source methods remain explicitly unresolved in the
  documents. No website data, classifier, or concurrent visual implementation was changed.
  The next step is user review of this pair, then one subsequent audience adaptation at a time.
