# Country Pain Profile and Presentation Goal

Last Updated: 2026-09-05
Status: ready to paste, not active

## Recommended Strategy

Use one implementation goal with a durable plan and one bounded phase or slice per iteration.
Re-read the plan before every slice, verify before each atomic commit, record evidence here, and
continue automatically through the next unblocked phase. Styling decisions are delegated to Codex;
new semantic or product decisions still stop for operator input.

## Rationale

This work has one measurable outcome but crosses data aggregation, interaction, responsive design,
animation, rendering, metrics, accessibility, integration, and performance. The plan fixes the
semantic and product decisions while numbered design rounds keep visual experimentation reversible.
The final gallery is deliberately deferred until adoption.

## Source Files

- `@docs/country-pain-profile/PLAN.md`
- `@docs/country-pain-profile/GOAL.md`
- `@docs/emo-views/design-record.md`
- `@src/main.ts`
- `@src/emo/labelLayer.ts`
- `@src/emo/selectionMotion.ts`
- `@src/globe/GlobeView.ts`
- `@src/globe/choroplethField.ts`
- `@src/survey/globeFlyTo.ts`
- `@src/ui/productionChrome.ts`
- `@src/api/metricsApi.ts`
- `/Users/cs/local/code/apps/web-pain-globe/docs/emo-label-views/HANDOFF.md`
- `/Users/cs/local/code/apps/web-pain-globe/docs/emo-label-views/PROGRESS.md`

## Source Context

Work only in the isolated frontend worktree on `feat/country-pain-profile-rounds`, plus one later
isolated `pain-setup` worktree for the approved PowerShell schema alignment. The frontend starts at
the chosen emotional view, commit `7ca5492`. The historical Claude plan described completed work;
the canonical current plan is `docs/country-pain-profile/PLAN.md`.

Discovery established that API values are normalized signals with unrecoverable raw units. The
profile uses peak-in-country for coordinate grids, accessible source point counts, existing country
values for emotional and socioeconomic pain, proportional glyph area, explicit missingness, exact
polygon surface clicks, human-only country metrics, and an abortable all-pain presentation tour.

## Copyable Goal

```text
/goal Complete the country pain profile, country selection, presentation tour, design rounds, and
performance adoption in @docs/country-pain-profile/PLAN.md, one bounded slice at a time.

Before each phase or bounded slice, read and orient from:
@docs/country-pain-profile/PLAN.md
@docs/country-pain-profile/GOAL.md
@docs/emo-views/design-record.md
@src/main.ts

Work policy:
- Work in feat/country-pain-profile-rounds from 7ca5492. Merge the three approved upstream commits
  first. Use a separate pain-setup worktree only for the approved PowerShell TEXT alignment.
- Start with the first incomplete PLAN phase. Write a short slice plan, trace shared callers, reuse
  existing paths, implement the minimum coherent change, verify it, update this file, then commit.
- Preserve old emo presets. Run immutable country-profile rounds under ?cp=1 and cpPreset. Codex
  chooses each winner from browser, meaning, mobile, accessibility, and performance evidence.
- Load experimental presets lazily. Do not create the durable PNG gallery before final adoption.
- Preserve unrelated changes. Keep frontend and pain-setup commits separate and stage exact paths.

Success means:
- The profile presents truthful normalized signals exactly as PLAN section 6 specifies, with four
  indicators in all-pain, one in single layers, proportional area, source point counts, and explicit
  missingness.
- Label and exact polygon clicks toggle one country across layers. Emotional views use the existing
  network path. Human open and close metrics work on both setup paths. Automated cycles are
  excluded.
- The all-pain tour completes the approved timing, 3x motion, reverse, pause, idle warning and
  resume, layer restore, hidden-tab, and reduced-motion behavior without stale work advancing it.
- Profile, physical-marker, and environmental rounds finish and the selected treatments meet the
  10 percent median, 16.7 ms p95, and 30 kB default-entry gzip limits.
- Desktop, phone, accessibility, integrated port-3000, final-review, and deferred-gallery checks
  pass.

Verification:
- Run npm run check before frontend commits and the relevant pain-setup checks before its commit.
- Use read-only layer endpoints and an independent aggregation comparison for data claims.
- Test real label, polygon, layer, keyboard, pointer, wheel, drag, phone, interruption, hidden-tab,
  and reduced-motion paths in a GPU-backed browser. Record performance and bundle evidence here.
- Build the detached feature commit at port 3000, restore the primary checkout, and record bounded
  test-row growth. Verify independent findings before fixes. Capture the gallery only after
  adoption.

Constraints:
- No schema or arbitrary data mutation. Permit only bounded application-generated user and metric
  rows required by approved browser verification, and record their count. Do not delete them.
- No user-file cleanup, broad rewrite, secrets, .env commit, old emo-preset edits, new dependency,
  or speculative renderer. Remove only task-owned temporary profiles. Use seed 43 and no em-dashes.
- Ask before destructive work or unapproved cross-repository scope. Stop a path after three failed
  attempts without new evidence.

Between iterations report the slice, changed files, evidence, commit, retained candidates, selected
base, and next slice.

Blocked stop condition:
Stop with exact evidence and required input if a destructive or unapproved cross-scope action is
needed, a required runtime is unavailable, a new semantic choice falls outside PLAN.md, or the same
failure repeats three times without new evidence.

Do not complete the goal until every PLAN phase exit passes, final evidence is recorded here, both
worktrees are clean, and all accepted work is committed.
```

## Validation Checklist

- [ ] Phase 0 baseline and upstream reconciliation complete.
- [ ] Country geometry, aggregation, missingness, and data semantics verified.
- [ ] One authoritative selection and metrics path verified in every layer.
- [ ] Profile rounds completed and one design adopted.
- [ ] Layer transitions, responsive layout, and accessibility verified.
- [ ] Presentation state machine and real timing verified.
- [ ] Physical and environmental rounds completed.
- [ ] Performance and bundle limits pass.
- [ ] Integrated port-3000 checks pass.
- [ ] Independent final findings verified.
- [ ] Deferred final gallery captured and inspected.
- [ ] Both worktrees clean and every accepted change committed.

## Stop Conditions

Stop only for verified completion, a newly required destructive or unapproved cross-scope action,
an unavailable required source or runtime, a new semantic decision outside the plan, or the same
blocking failure repeated three times without new evidence. A blocked handoff must include the
exact command or gesture, observed result, artifacts, attempted hypotheses, and the input needed.

## Human Sign-off

Approved through three discovery rounds on 2026-09-05. The operator selected option A for every
question and delegated visual round selection to Codex.

## Progress Record

- 2026-09-05: Discovery converged. Plan v1.1 incorporates verified independent review findings.
  No implementation phase started.
- 2026-09-05: Phase 0, upstream slice complete in `efd736d`. Merged the three approved
  `origin/demo/all-features` commits through a two-parent merge after `npm run check` passed. The
  post-merge bundle is 819.73 kB JavaScript, 216.44 kB gzip, and 41.47 kB CSS. Remaining Phase 0
  work: live schema recheck, detached integration proof, and browser performance baselines.
- 2026-09-05: Phase 0 measurement slice complete. Live metrics columns are TEXT. Chrome
  152.0.7977.76 measured 8.3 ms median and 9.6 to 9.7 ms p95 across desktop rest, desktop India
  settled, and the 393 by 852 viewport. Draw calls were 8 at rest and 11 when selected. The exact
  reusable probe is `scripts/measure-country-profile-frame.js`. Docker integration remains open:
  the detached source switch worked, but the build stalled loading absent Node base-image metadata.
  The primary checkout was restored and verified clean at `feat/emo-label-views` commit `7ca5492`.
- 2026-09-05: Phase 1, country geometry slice ready. Natural Earth loading now has one shared index
  used by the choropleth and future profile paths. The focused check covers holes, boundaries, both
  antimeridian sides, 177 live geometries, three real city points, and a missing microstate. The
  full gate passed. Real Chrome retained 195 labels, selected 13 visible India-category labels, and
  loaded the 204-row socioeconomic layer. Bundle gzip moved from 216.44 to 216.61 kB.
