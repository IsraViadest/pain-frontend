# Frontend ↔ pain-server contract

Checklist for changes that touch data loading or deployment. Automated gate: **`npm run check`**.

## Deployment

- Production ships **`dist/`** only (`npm run build`). No Node server in the static bundle.
- Layer list: **pain-server** `GET /init/` (or `VITE_PAIN_API_BASE` + `/init/`).
- Point data: **pain-server** `GET /init/:layer` (or `VITE_PAIN_API_BASE` + `/init/:layer`).
- Do **not** import `server/` or read `data/*.csv` from `src/`.

## Local dev commands

| Command | What runs | Use when |
|--------|-----------|----------|
| **`npm run dev:pain-server`** | Vite only; proxies `/init` → pain-server on `:3000` (`PAIN_SERVER_HOST` / `PAIN_SERVER_PORT` in `.env.local`) | Testing against real pain-server (Docker `ppp_map` stack or remote host) |
| **`npm run dev`** | Vite + local mock Express on `:3847` (`server/index.ts`, CSV fixtures) | Frontend-only work; no backend required |

- **`npm run dev:pain-server`** sets `VITE_USE_MOCK_API=false`. Do **not** run `npm run dev` at the same time (mock `/server` on `:3847` conflicts with the pain-server workflow).
- Mock mode uses different layer ids (`environmental`, `physical`, …) than production (`Env`, `Phys`, …). See [Layer id vs row `painorigin`](#layer-id-vs-row-painorigin) below.

## API call order

The UI must call **`fetchLayers` before `fetchPoints`** (`src/api/client.ts`):

1. `fetchLayers` → `GET /init/` (production) or static mock list → **`setCachedMapLayers`**
2. `fetchPoints(layerId)` → `GET /init/:layer` → adapter → `PainPoint[]`

`painOriginToUiLayerId` uses the cached layer list when row `painorigin` is unknown (falls back to the first cached layer id). Calling `fetchPoints` first leaves the cache empty and produces misleading fallbacks.

## pain-server endpoints

### GET `/init/` — layer metadata

Returns a JSON **array** of layer objects (HUD tabs, tint color, word-cloud flag).

| Field | Type | Role |
|-------|------|------|
| `id` | string | Layer id passed to `GET /init/:layer` (e.g. `Env`, `Emo`, `Phys`, `Socioeco`) |
| `label` | string | Short HUD label |
| `desc` | string | Longer description for the layer picker |
| `color` | string | Hex tint for globe markers / heat (e.g. `#4ade80`) |
| `geospatial` | boolean | Layer has map points (all current layers: `true`) |
| `text` | boolean | Layer supports word-cloud HUD (`true` for `Emo` only today) |

**Frontend types:** raw row → `PainServerLayerRow` (`src/types/painServer.ts`); normalized UI shape → `MapLayer` (`src/types/api.ts`). Parser: `src/api/initLayerList.ts` → `mapInitLayerListToMapLayers`. HTTP: `fetchInitLayerList` in `src/api/painServer.ts`.

Example (truncated): `http://178.63.65.178:3000/init/`

### GET `/init/:layer` — point rows

`:layer` is the **`id` from GET `/init/`** (not the row `painorigin` value).

Returns a JSON **array** of point rows. Field order matches pain-server `db-config.env` / `PainServerDbConfig` (`src/api/painServerDbConfig.ts`):

| Field | Type | Maps to |
|-------|------|---------|
| `id` | number \| string | `PainPoint.id` (coerced to string) |
| `lat` | number \| string | `PainPoint.lat` (WGS84; invalid coords → row skipped) |
| `lng` | number \| string | `PainPoint.lng` (WGS84) |
| `value` | number \| string | **`PainPoint.intensity` as-is** (see Pattern 19 below) |
| `datatype` | string | `PainPoint.datatype` |
| `painorigin` | string | Mapped to `PainPoint.uiLayer` via `painOriginToUiLayerId` |

**Frontend types:** raw row → `PainServerRow` (`src/types/painServer.ts`); globe shape → `PainPoint` (`src/types/api.ts`). Normalizer: `normalizePainServerRow` in `src/api/painServerRow.ts`. Adapter: `mapInitResponseToPainPoints` in `src/api/adapter.ts`.

#### Pattern 19 — do not mutate API `value`

The frontend stores `value` in `PainPoint.intensity` **without clamping, rounding, or rescaling**. If `value` is outside `0…1`, the adapter logs `console.warn` and still stores it as-is. Rendering may clamp for display safety in `src/globe/` only; the stored model must reflect the API.

## Layer id vs row `painorigin`

Two different string namespaces:

| Source | Example values | Used for |
|--------|----------------|----------|
| **Layer list `id`** (GET `/init/`) | `Env`, `Emo`, `Phys`, `Socioeco` | HUD selection, `fetchPoints(layerId)`, marker tint from cached `MapLayer.color` |
| **Row `painorigin`** (GET `/init/:layer` rows) | `EnvNat`, `Emo`, `Phys`, `Socioeco` | Per-row origin label; mapped to a layer id for styling / multiplex |

They often differ for the environmental layer: layer id **`Env`**, row painorigin **`EnvNat`**.

| Row `painorigin` | Layer id (`uiLayer`) |
|------------------|----------------------|
| `EnvNat` | `Env` |
| `Emo` | `Emo` |
| `Phys` | `Phys` |
| `Socioeco` | `Socioeco` |

Mapping lives in **`painOriginToUiLayerId`** (`src/api/layers.ts`). Unknown `painorigin` → `console.warn` + fallback to the first cached layer id from `fetchLayers`.

## API adapter (implementation)

- Map `/init/:layer` JSON in `src/api/adapter.ts` + `painServerRow.ts`.
- Map `/init/` JSON in `src/api/initLayerList.ts`.
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
