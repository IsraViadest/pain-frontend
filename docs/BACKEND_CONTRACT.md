# Frontend ↔ pain-server contract

Checklist for changes that touch data loading or deployment. Automated gate: **`npm run check`**.

## Deployment

- Production ships **`dist/`** only (`npm run build`). No Node server in the static bundle.
- Point data: **pain-server** `GET /init/:layer` (or `VITE_PAIN_API_BASE` + `/init/...`).
- Do **not** import `server/` or read `data/*.csv` from `src/`.

## Before every commit / push

```bash
npm run check
```

This runs:

1. **`tsc --noEmit`** — TypeScript errors (Vite build alone does not catch these).
2. **`vite build`** — production bundle.
3. **`ts-prune`** — no unused exports in `src/` (Mike’s review standard).
4. **JSDoc** on exported functions in `src/api/*.ts`.
5. Static rules (no `server/` imports in `src/`, no magic `39000`, etc.).

Optional: install git hook once:

```bash
bash scripts/install-git-hook.sh
```

## API adapter

- Map `/init/:layer` JSON in `src/api/adapter.ts` + `painServerRow.ts`.
- Use clear parameter names (`initLayerRow`, `initLayerRows`, not `raw` / `data`).
- Shared types live in `src/types/` when used across files.

## Geo

- Use `globeEquirectUV` / documented constants (1000×482), not ad-hoc 1000×500.

## Cursor / AI

Before asking for review: run `npm run check` and fix all failures. Do not push with ts-prune or tsc failures.
