<!--
File attribution
created by Christian Stelmach (chrisp.stel@gmail.com), GitHub: @cstelmach
-->
# Reading and analysing interaction logs

Last updated: 2026-09-10. Version: 1.0.

Interaction logs describe interface activations, selected map countries and emotion categories,
and aggregate time or counts. They do not record survey answers, typed text or coordinates.
Map activity can be logged without survey consent. Survey activity requires consent and contains
only counts, text presence/length, steps and elapsed time.

- [Files and exports](#where-the-data-lives)
- [Map events](#map-page-and-window-events) and [survey events](#web-survey-and-link-events)
- [Field dictionary](#field-dictionary) and [category keys](#layer-and-emotion-keys)
- [Analysis recipes](#analysis-recipes-and-common-mistakes)
- [Limits and privacy](#limits-inactive-codes-and-privacy)

**The current preview recordings and first export are development/test activity. They are not a
participant dataset.** Keep them separate from any later visitor study or exhibition analysis.
The current browser verification exercised event delivery and retries; it does not establish
participant coverage or a complete history.

## Where the data lives

The web preview runs at `http://127.0.0.1:5176`. Its separate collector runs on port `5180`, with
the explicit allowed `webPreviewOrigin=http://127.0.0.1:5176`. This opt-in admits canonical,
consent-safe survey aggregates. Default Windows collection continues to exclude survey/result
events. Earlier port `5178` and temporary logs are separate recordings, not merged history.

| Deployment | Stored data | Export |
|---|---|---|
| Current web preview | Workspace `artifacts/interaction-logs/preview-5176/pain-events-00.jsonl` through `09` | Call `exportEvents` with `{includeSurvey:true}` to retain consented survey aggregates. |
| First preview test export | Development/test activity only | [interactions.csv](/Users/cs/local/code/apps/web-pain-globe/artifacts/interaction-exports/preview-5176/pain-interactions-2026-09-09T22-30-04-858Z-eHbpMI/interactions.csv) |
| Windows offline exhibition | `%LOCALAPPDATA%\PAIN Offline\events\pain-events-00.jsonl` through `09` | Staff dialog exports to Windows Downloads. `Export interactions.cmd` beside the executable exports to its adjacent `interaction-exports` folder. |
| PostgreSQL web deployment | `interactionevents`, linked to installation-local numeric `users.id` | Setup export launchers produce `interaction-events.csv`, `summary.json`, and `data-dictionary.txt` in a timestamped ZIP. |

The current preview's full log directory is:

```text
/Users/cs/local/code/apps/web-pain-globe/artifacts/interaction-logs/preview-5176
```

Open the [current JSONL file](/Users/cs/local/code/apps/web-pain-globe/artifacts/interaction-logs/preview-5176/pain-events-00.jsonl).
JSONL files receive live batches. A CSV export is a fixed snapshot; rerun the export for new data.

The temporary local-data preview does **not** implement survey processing at `/survey`.
It can record a consented submit attempt, but cannot currently produce its survey response.
Result-window events need a working survey backend; absence here is expected.

### Start and export commands

The services are already running. These commands are for a later restart, not a second copy.
Run only one collector per log directory. Use the exact `127.0.0.1:5176` preview URL; another
host or port requires a corresponding explicit collector origin.

In one terminal, start the collector using the preserved package's data and site assets:

```sh
cd /Users/cs/local/code/apps/web-pain-globe
node --input-type=module <<'JS'
import { startOfflineServer } from
  './pain-frontend-worktrees/windows-offline-exhibition/offline/server.mjs';
const assets = './pain-frontend-worktrees/windows-offline-exhibition/' +
  'offline-release/1.0.2-2c486d1/P.A.I.N. Offline-win32-x64/resources/app';
const app = await startOfflineServer({
  siteDir: assets + '/site', dataDir: assets + '/data',
  logDir: './artifacts/interaction-logs/preview-5176', port: 5180,
  webPreviewOrigin: 'http://127.0.0.1:5176',
});
console.log(app.origin);
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal,
  () => void app.close().then(() => process.exit(0)));
JS
```

In a second terminal, start the frontend with that backend:

```sh
cd /Users/cs/local/code/apps/web-pain-globe/pain-frontend-worktrees/country-pain-profile-rounds
VITE_USE_MOCK_API=false PAIN_SERVER_PORT=5180 \
  ./node_modules/.bin/vite --host 127.0.0.1 --port 5176 --strictPort
```

To export, let the preview flush its events before closing it. This command creates a new
timestamped folder without changing source logs. On this Mac it produces a folder, not a ZIP:

```sh
cd /Users/cs/local/code/apps/web-pain-globe
node --input-type=module <<'JS'
import { exportEvents } from
  './pain-frontend-worktrees/windows-offline-exhibition/offline/export-events.mjs';
console.log(await exportEvents(
  './artifacts/interaction-logs/preview-5176',
  './artifacts/interaction-exports/preview-5176',
  { includeSurvey: true },
));
JS
```

JSONL exports contain `interactions.csv`, `summary.json`, and `README.txt`. Default columns are
`timestamp,userId,tabId,seq,type,target,action,country,emotion,enabled,layer,count,durationMs,`
`occurred_at`.
The explicit `{includeSurvey:true}` option adds `consent,step,selectedCount,hasText,characters`.
The default Windows export excludes survey/result records and retains its original columns.

## Start an analysis

1. Identify the installation, recording period and deployment. Separate development/test records.
2. Export data, preserve its folder or ZIP, and read its summary and dictionary before aggregating.
3. Deduplicate overlapping exports. Check missing fields and distinguish receipt from device time.
4. Choose the event family that answers the question. A click, a resulting selection and a visible
   panel can all describe different parts of the same action.

The tables below list real emitter paths, not every combination the schema technically accepts.
“Both” means current preview and Windows collection support the event family. “Web” means the
normal web UI; survey rows also work in the preview when consented, except result display.
Availability still depends on visible controls, selected layer, loaded data and consent.

## Map, page and window events

Every queued event also has `seq` and device time `atMs`. Optional fields are listed below.

| Type | Target | Action | Additional fields | Trigger and availability |
|---|---|---|---|---|
| `page` | `page` | `open` | None | Metrics observer installs. Both. |
| `page` | `page` | `hidden`, `visible` | `durationMs` | Browser visibility/pageshow; visible also marks each 15-second checkpoint. Both. |
| `page` | `page` | `close` | `durationMs` | `pagehide`; a cached page can subsequently return. Both. |
| `control` | `sound` | `click` | `enabled` | Sound activation; true means sound on. Both. |
| `control` | `theme` | `click` | `enabled` | Theme activation; true means blue, false dark. Both. |
| `control` | `menu` | `click` | `enabled` | Mobile menu activation; true means expanded. Both where the layout exposes it. |
| `control` | `about`, `sources` | `click` | Usually none | Corresponding opening button. Both. |
| `control` | `about`, `sources` | `close` | None | Explicit close button. Backdrop dismissal instead produces only window close. Both. |
| `control` | `layer` | `click` | `layer` | A layer button, including the all-pain button normalized to `all-layers`. Both. |
| `control` | `layer` | `enable`, `disable` | `layer`, `enabled` | State handler activates/deactivates a layer. Includes automatic startup activation. Both. |
| `country` | `country` | `open`, `close` | `country` | Country-selection controller. Changing country closes the previous one and opens the next. Both. |
| `emotion` | `emotion` | `click` | `emotion` | Emotion legend activation. A busy blocked selection can still have a click. Both. |
| `emotion` | `emotion` | `open`, `change` | `country`, `emotion`, `enabled=true` | Emotional label/network selection callback. Both. |
| `emotion` | `emotion` | `close` | `country`, `emotion`, `enabled=false` | Selection clears, or outgoing network data is replaced by filtering. Both. |
| `emotion` | `emotion-filter` | `click` | `emotion` | Direct filter callback in current web preview. Existing Windows source does not yet emit this click. |
| `emotion` | `emotion-filter` | `enable`, `disable` | `emotion`, `enabled` | Category inclusion changes; true means included, false excluded. Both. |
| `window` | `about`, `sources`, `country` | `open` | `country` for country window | DOM observer sees the panel open; no duration on open. Both. |
| `window` | `about`, `sources`, `country` | `close`, `hidden`, `visible` | `durationMs`; `country` for country window | Panel closes/changes country, browser visibility changes, or periodic checkpoint. Both. |
| `gesture` | `globe` | `click`, `end` | `count`, `durationMs` | Canvas pointer sequence: stationary tap/click, cancellation, or three-plus contacts. Both. |
| `gesture` | `globe-rotate` | `end` | `count=1`, `durationMs` | Single pointer moves more than 4 CSS pixels. Both. |
| `gesture` | `globe-zoom` | `end` | `count`, `durationMs` | Two-pointer sequence or wheel burst. Pointer count is 1; wheel count is wheel events. Both. |

Sources: [observer](../../src/api/interactionMetrics.ts), [adapter](../../src/api/metricsApi.ts),
[main callbacks](../../src/main.ts), [country selection](../../src/countryProfile/selection.ts),
[legend](../../src/emo/legend.ts), [label selection](../../src/emo/labelLayer.ts).

## Web survey and link events

Survey/result rows below require consent. The `share` and `consent` controls, consent-window
events and public links do not require survey consent. Declining still allows the survey to open,
but its survey/result analytics are suppressed. Offline projection hides the share control,
does not mount festival links, and turns about/source links into non-link text.

| Type | Target | Action | Additional fields | Actual trigger |
|---|---|---|---|---|
| `control` | `share` | `click` | None | Locate/share-your-pain button; hidden in projection mode. |
| `control` | `festival`, `workshop` | `click` | None | Festival/workshop link. Workshop availability follows its countdown/end date. |
| `control` | `about-link`, `source-link` | `click` | None | Link inside corresponding information modal; URL is excluded. |
| `control` | `consent` | `click` | `enabled` | Agree=true, Decline=false. Backdrop decline is not a button-click record. |
| `window` | `consent` | `open`, `close`, `hidden`, `visible` | `durationMs` except open | Consent modal's observed visibility. |
| `survey` | `survey` | `open` | `step=0` | Survey opens screen 1 after consent. |
| `survey` | `survey` | `click` | `step`, `count=1`; `selectedCount` on steps 1,3,4 | Survey button/map-pin/advance-wrapper activation, including blocked advance attempts. |
| `survey` | `survey` | `next` | Departing `step=1..4`, `selectedCount`, `durationMs` | Accepted forward-navigation attempt. |
| `survey` | `survey` | `back` | Departing `step`, `durationMs`, count/text snapshot | Back navigation; no separate destination-step field. |
| `survey` | `survey` | `submit` | `step=5`, `durationMs`, `hasText`, `characters` | Submit callback before request processing; an attempt, not server success. |
| `survey` | `survey` | `close` | Current `step`, `durationMs`, count/text snapshot | Close button, Escape or submit. Submit immediately also calls close. |
| `survey` | `survey-options` | `change` | `step=1,3,4`, `count=1` | Word, temporality or relation toggle. Which option and toggle direction are excluded. |
| `survey` | `survey-body` | `change` | `step=2`, `count=1`, `selectedCount` | Committed placement/reposition; no word or coordinates. |
| `survey` | `survey-text` | `input` | `step=5`, `count`, `hasText`, `characters` | Input aggregate after 500 ms idle, blur, hidden, submit or unmount. |
| `window` | `survey`, `result` | `open`, `close`, `hidden`, `visible` | `durationMs` except open | Observed survey/result visibility; result requires working response backend. |
| `control` | `result` | `close` | None | Result close button; result is unavailable in the current local-data preview. |

Step meaning: 0=open, 1=words, 2=placements, 3=temporality, 4=relations, 5=text/submit.
Text snapshots replace selected-count snapshots on step 5. Deselecting all words can produce
one option-change record per removed option. Input-event counts are not characters typed.

Sources: [survey modal](../../src/survey/SurveyModal.ts),
[text input](../../src/survey/SurveyScreen5.ts), [placements](../../src/survey/SurveyScreen2.ts),
[consent storage](../../src/survey/consentStorage.ts),
[consent dialog](../../src/survey/consentModal.ts).

## Windows staff events

| Type | Target | Action | Meaning |
|---|---|---|---|
| `control` | `operator` | `click` | Return to globe button, not staff-dialog opening. |
| `control` | `data-export` | `click` | Export-button activation, not successful export. |
| `control` | `exit` | `click` | Exit-button activation, not successful authentication/shutdown. |
| `control` | `update-settings` | `click` | Save-update-credential activation, without credential or success state. |

Staff-dialog dwell/open/close is not instrumented as a window. Export/handoff flushes add a
page/window visible-time checkpoint. No password, token, checkbox value or typed value is logged.
See [native controls](../../../windows-offline-exhibition/offline/preload.cjs).

## Field dictionary

| Field | Meaning |
|---|---|
| `userId` | JSONL visit ID: 16 alphanumeric characters, obtained from `/init`; not a stable person ID. |
| `userid` | PostgreSQL export's numeric, installation-local users-table reference; differs from JSONL userId. |
| `tabId` / `tabid` | Random UUID for one page's metrics queue. Reload creates another; cached return can retain it. |
| `seq` | Increasing per-queue sequence, assigned on admission; stable across retries. |
| `id` | PostgreSQL event-row ID; unique only within that database. |
| `type` / `event_type` | Event family: control, country, emotion, survey, window, gesture or page. |
| `target`, `action` | Fixed interface code and operation from the event tables; not arbitrary text. |
| `layer` | One fixed globe-layer key from the mapping below. |
| `step` | Survey step 0..5; on next/back, the step being left. |
| `atMs` / `occurred_at` | Device event time: epoch milliseconds in JSONL, converted to UTC text in exports. |
| `timestamp` / `received_at` | Collector/database receipt time. A batch can arrive later than its events occurred. |
| `country` | Uppercase three-letter map/source code, never visitor residence or location. |
| `emotion` | Fixed map-category key, never the visitor's self-reported emotional state. |
| `enabled` | Optional control/selection state; meaning depends on target. Absence is not false. |
| `count` | Event-family-specific aggregate, maximum 10000. Not universally one and not always supplied. |
| `selectedCount` / `selected_count` | Current survey selection/placement count, maximum 10000; a snapshot. |
| `hasText` / `has_text` | Whether the current string is nonempty; whitespace counts as text. |
| `characters` | Unicode code-point length, maximum 100000; not words, bytes or input-event count. |
| `durationMs` / `duration_ms` | Integer milliseconds, maximum 86400000; interpretation depends on event family. |
| `consent` / `survey_consent` | Client survey-consent declaration at sending/ingestion; not an identity attestation. |

Only known fields and fixed codes cross the analytics boundary. Numbers are nonnegative and
rounded/clamped by the frontend. Absent fields become empty CSV cells, not zero or false.
Older events can lack device time. See [queue and field limits](../../src/api/metricsQueue.ts).

## Layer and emotion keys

| Layer key | Display meaning |
|---|---|
| `emopain` | Emotional pain |
| `envpain` | Environmental pain |
| `physpain` | Physical pain |
| `socioecopain` | Socioeconomic pain |
| `all-layers` | Combined all-pain view |

| Emotion key | Label | Emotion key | Label |
|---|---|---|---|
| `01_pain` | Body pain | `08_displacement` | Displacement |
| `02_hurt` | Hurt | `09_trauma` | Trauma |
| `03_eco_anxiety` | Eco-anxiety | `10_loneliness` | Loneliness |
| `04_uncertainty` | Uncertainty | `11_depression` | Depression |
| `05_grief` | Grief | `12_fear` | Fear |
| `06_anger` | Anger | `13_helplessness` | Helplessness |
| `07_hardship` | Hardship | `14_shame` | Shame |

## Analysis recipes and common mistakes

- **Control use:** count relevant `click` rows. Analyse enable/disable effects separately.
  Startup emits layer/all-layers enable without a click. Debouncing, blocked actions or loading
  failures can separate click counts from effects. Target handlers can emit effects before the
  bubbling click observer, so sequence order alone does not link an effect to a preceding click.
- **Country choices:** use country/open for new selections. A switch emits old-country close and
  new-country open. There is no country/change event. Emotion/change can happen on the same
  country again. Countries with missing emotional data can still have country/window events.
- **Visible time:** deduplicate, then sum non-open page/window duration segments within each
  `(tabId,target,country)` scope. The visible action includes periodic checkpoints. Do not add
  page and window totals together: their intervals overlap. Visibility does not prove attention.
- **Survey time:** infer each step visit from survey navigation, then use its final/maximum
  duration. Never sum cumulative snapshots: submit and close can repeat step 5 time. Re-entering
  a step creates a new interval. There is no explicit survey/step-visit ID; incomplete histories
  can make reconstruction uncertain. Selection/text-length fields are snapshots, not totals.
- **Gesture volume:** keep wheel, pointer and survey counts separate. Wheel count means wheel
  events; two-pointer zoom has count=1; three-plus contacts use maximum simultaneous contacts.
  Wheel duration includes the 300 ms idle deadline. Pointer duration covers the full gesture.
- **Combine exports:** JSONL exports overlap; deduplicate by `tabId+seq`. For PostgreSQL use
  installation+id, or tabid+seq. Never combine numeric IDs across installations without namespacing.
  Offline CSV file order is not chronological; order per tab by seq when reconstructing actions.
- **Missingness and clocks:** leave missing values missing. Absence can mean unavailable UI,
  no consent, missing source data, lost events or an uninstrumented path. Device clocks can drift;
  receipt time measures arrival. Older device timestamps may be absent. Neither ID counts nor
  page-open counts prove unique human participants. Scripted activations can also be logged.

## Limits, inactive codes and privacy

The queue holds at most 256 events in memory, sending batches of 32 every 5 seconds or at the
batch threshold. Retries retain IDs; timeouts/backoff and missing initialization can delay them.
When full, new events are dropped before sequence assignment. The `dropped` counter stays only
in memory: there is no `bufferloss` event or exported loss count, and gaps cannot measure loss.
Hide beacons are best effort. Crashes can lose queued events and unfinished gestures.

JSONL storage rotates ten 10 MiB slots, at most 100 MiB. This is a byte limit, not a fixed number
of days. Export regularly before rotation. Export summaries count exported/duplicate/skipped
records, not losses before storage. Appending is acknowledged before every batch is fsynced;
power loss can lose recent writes. PostgreSQL deduplicates tabid+seq; no automatic retention
expiry was found in the inspected implementation. Verify operational backups separately.

`cycle`, `quality`, action `start`, and target `all-layers` are reserved/unused emitter codes.
Actual combined-layer events use target=layer, layer=all-layers. Country autoplay is disabled.
Video controls are hidden and old `media:*` adapter calls are discarded. Hover, camera position,
tooltip content, rendering success, URLs, IP addresses and user-agent strings are not collected.
The current web filter-click fix is separate from the older Windows effect-only implementation.

Consent is checked on admission and sending. Revocation drops queued survey/result events;
it does not erase records already accepted. The survey service itself still processes answers
in deployments where it runs, and may store a consented derived coordinate outside this log.
Do not treat legacy raw logs or coordinate tables as equivalent to these restricted exports.
Interaction histories remain pseudonymous behavioural data; keep them within team access.

## Verification of this setup

On 2026-09-10, a fresh browser activated layers, About, emotion filters, a category and two
dummy survey choices, then returned to the map. Its 38 captured events all reached JSONL exactly
once; three closing events were also saved. Both captured requests returned HTTP 200 and replay
of a captured batch accepted zero additional events. This test visit is `73a4daf4130efb5c`;
its tab ID is `82ccff59-4603-4af1-9c71-37b7be17d8c6`. Other setup checks also generated events.

The first linked export has 164 events, 19 columns, zero duplicates and zero skipped records.
Counts and headers were checked after reading the CSV back. The 25 collector tests and the
frontend privacy/consent/queue/timing checks pass. Unrelated origins and HTTP access to private
log files return 403. An independent source review found no introduced defect in the collector
and exporter changes. This verifies the local setup, not every deployed installation.

## Implementation and other guides

- [Frontend collection and lifecycle](../../src/api/interactionMetrics.ts)
- [Queue, sanitization and durations](../../src/api/metricsQueue.ts)
- [Collector and preview opt-in](../../../windows-offline-exhibition/offline/server.mjs)
- [JSONL export and survey option](../../../windows-offline-exhibition/offline/export-events.mjs)
- [Windows operator guide](../../../windows-offline-exhibition/offline/OPERATOR.md)
- PostgreSQL schema/export tools: workspace `pain-setup-worktrees/powershell-metrics-text/`.
  Read `interaction-data-dictionary.txt`, `export-interactions.sql`, and its `README.md`.
- Backend contract: workspace `pain-server-worktrees/country-profile-layer-delivery/README.md`,
  Validation is in `src/validation/interaction-events.ts`;
  storage is in `src/loader/db-loader.ts`.
