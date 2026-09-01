# Frontend ↔ pain-server contract

Checklist for changes that touch data loading or deployment. Automated gate: **`npm run check`**.

## Deployment

- Production ships **`dist/`** only (`npm run build`). No Node server in the static bundle.
- Layer list: **pain-server** `GET /init` (or `VITE_PAIN_API_BASE` + `/init`).
- Point data: **pain-server** `GET /init/:layer` (or `VITE_PAIN_API_BASE` + `/init/:layer`).
- Do **not** import `server/` or read `data/*.csv` from `src/`.

## Local dev commands

| Command | What runs | Use when |
|--------|-----------|----------|
| **`npm run dev:pain-server`** | Vite only; proxies `/init` → pain-server on `:3000` (`PAIN_SERVER_HOST` / `PAIN_SERVER_PORT` in `.env.local`) | Testing against real pain-server (Docker `ppp_map` stack or remote host) |
| **`npm run dev`** | Vite + local mock Express on `:3847` (`server/index.ts`, CSV fixtures) | Frontend-only work; no backend required |

- **`npm run dev:pain-server`** sets `VITE_USE_MOCK_API=false`. Do **not** run `npm run dev` at the same time (mock `/server` on `:3847` conflicts with the pain-server workflow).
- Mock mode uses different layer ids (`environmental`, `physical`, …) than production (`Env`, `Phys`, …). See [Layer id vs row fields](#layer-id-vs-row-fields) below.

## API call order

The UI must call **`fetchLayers` before `fetchPoints`** (`src/api/client.ts`):

1. `fetchLayers` → `GET /init` (production) or static mock list → **`setCachedMapLayers`**
2. `fetchPoints(layerId)` → `GET /init/:layer` → `mapInitResponseToPainPoints(rows, layerId)` → `PainPoint[]`

Calling `fetchPoints` before `fetchLayers` throws in production (`fetchPoints` requires a warm layer cache). The UI must always call `fetchLayers` first.

## pain-server endpoints

### GET `/init` — layer metadata

Returns a JSON object with:

- `userId`: string cached by the frontend and added to later survey and metrics POSTs
- `layerInfo`: JSON array of layer objects (HUD tabs, tint color, word-cloud flag)

| Field | Type | Role |
|-------|------|------|
| `id` | string | Layer id passed to `GET /init/:layer` (e.g. `Env`, `Emo`, `Phys`, `Socioeco`) |
| `label` | string | Short HUD label |
| `desc` | string | Longer description for the layer picker |
| `color` | string | Hex tint for globe markers / heat (e.g. `#4ade80`) |
| `geospatial` | boolean | Layer has map points (all current layers: `true`) |
| `text` | boolean | Layer supports word-cloud HUD (`true` for `Emo` only today) |

**Frontend types:** GET `/init` envelope → `PainServerInitResponse` (`src/types/painServer.ts`);
`layerInfo` → validated `MapLayer` (`src/types/api.ts`) via `parseInitLayerListResponse` in
`src/api/initLayerList.ts`. HTTP: `fetchLayerInfo` in `src/api/painServer.ts` returns
`MapLayer[]`.

Example (truncated): `http://178.63.65.178:3000/init`

### GET `/init/:layer` — point rows

`:layer` is the **`id` from GET `/init`**.

Returns a JSON **array** of point rows. Field names match pain-server `db-config.env` / `PainServerDbConfig` (`src/api/painServerDbConfig.ts`).

**One data shape for all layers** — mandatory columns always present; optional columns appear depending on layer type:

| Field | Required | Type | Maps to |
|-------|----------|------|---------|
| `id` | mandatory | number | `PainPoint.id` (unique per layer, not globally unique; use with `category` to identify a point) |
| `aggrid` | mandatory | number \| null | Normalized only (not on `PainPoint`) |
| `value` | mandatory | number | **`PainPoint.intensity` as-is** (stored as-is; never clamped or modified before rendering) |
| `category` | mandatory | string | `PainPoint.category` (empty → `"unknown"` + warn) |
| `lat` | optional | number | `PainPoint.lat` (WGS84; invalid → row skipped when present) |
| `lng` | optional | number | `PainPoint.lng` (WGS84) |
| `country` | optional | string | `PainPoint.country` / `metadata.country` |
| `word` | optional | string | `PainPoint.word` / preferred `text` |

**Which layers typically carry which optional fields:**

- **Geospatial layers** (e.g. environmental, physical): `lat` / `lng` present; used for globe plotting.
- **Country-based layers** (e.g. emotional, socioeconomical): `country` present; country-only rows (no lat/lng) are **normalized** but **skipped for globe plotting** with `console.warn` until a country→position path exists.
- **Emotional layer:** `word` present (in addition to country-based fields).

**Frontend types:** raw row → `PainServerRow` (`src/types/painServer.ts`); globe shape → `PainPoint` (`src/types/api.ts`). Normalizer: `normalizePainServerRow` in `src/api/painServerRow.ts`. Adapter: `mapInitResponseToPainPoints(rows, layerId)` in `src/api/adapter.ts`.

`PainPoint.uiLayer` is the **`layerId` from the request** (`GET /init/:layer`), not a row field.

#### Pattern 19 — do not mutate API `value`

The frontend stores `value` in `PainPoint.intensity` **without clamping, rounding, or rescaling**. If `value` is outside `0…1`, the adapter logs `console.warn` and still stores it as-is. Rendering may clamp for display safety in `src/globe/` only; the stored model must reflect the API.

## Layer id vs row fields

| Source | Example values | Used for |
|--------|----------------|----------|
| **Layer list `id`** (GET `/init`) | `Env`, `Emo`, `Phys`, `Socioeco` | HUD selection, `fetchPoints(layerId)`, `PainPoint.uiLayer`, marker tint from cached `MapLayer.color` |
| **Row `category`** (GET `/init/:layer`) | `Fire`, `CancerRate`, … | `PainPoint.category` / hover metric label |

The frontend does **not** derive `uiLayer` from row fields; all points from `GET /init/Env` get `uiLayer: "Env"`.

## Survey submission

The survey UI sends `POST /survey` to pain-server after Screen 5. The request contains
`wordBubbles`, `wordBody`, `temporality`, `relations`, and `painDescription`; the frontend adds the
cached `userId`.

Pain-server returns:

```json
{
  "lat": 12.5,
  "lng": -47.25,
  "text": "Ice cracks beside the iron rail."
}
```

`lat` and `lng` are the message service's selected point. A visitor-placed speaking pain keeps its
exact map coordinate; an unplaced speaking pain uses its deterministic pain-specific point. The
known consequence is clustering at up to 46 fixed points for visitors who place nothing.

`text` is the body-only custom paragraph. The result card owns the heading and formatted coordinate,
so pain-server must not return the message service's full text field here.

The result card renders `text` with `textContent`, not HTML. A failed survey request returns `null`
from `submitSurvey`; the frontend shows a visible retry status and does not invent fallback copy.
The result is a nonmodal dialog with close-button focus, Escape dismissal, and focus return to
`Share your pain`.

## API adapter (implementation)

- Map `/init/:layer` JSON in `src/api/adapter.ts` + `painServerRow.ts`.
- Map `/init` JSON in `src/api/initLayerList.ts`.
- Use clear parameter names (`initLayerRow`, `initLayerRows`, not `raw` / `data`).
- Shared types live in `src/types/` when used across files.

## Geo

- Coordinates are **WGS84 `lat` / `lng`** from the API (not legacy x/y or normalized 0–1 pairs).
- Texture UV ↔ lat/lng uses `globeEquirectUV` / documented constants (1000×482), not ad-hoc 1000×500.

## Before every commit / push

```bash
npm run check
```

This runs:

1. **`tsc --noEmit`** — TypeScript errors (Vite build alone does not catch these).
2. **`vite build`** — production bundle.
3. **`ts-prune`** — no unused exports in `src/` (Mike’s review standard).
4. **Pattern Check Reminder** — prints pattern titles from local `.cursor/PATTERN_CHECK.md` if present (advisory; does not fail the run).
5. **JSDoc** on exported functions in `src/api/*.ts`.
6. Static rules (no `server/` imports in `src/`, no magic row counts, etc.).

Optional: install git hook once:

```bash
bash scripts/install-git-hook.sh
```

## Cursor / AI

Before asking for review: run `npm run check` and fix all failures. Do not push with ts-prune or tsc failures.
