# Pre-review checklist (for you and Mike)

Run this before opening or updating a PR:

```bash
npm run check
```

If anything fails, **do not ask Mike to review yet**.

## What `npm run check` enforces

| Check | Why |
|--------|-----|
| `tsc --noEmit` | Catches type errors Vite ignores |
| `vite build` | Deployable static site |
| `ts-prune` | No dead exports; `(used in module)` → remove `export` |
| JSDoc on `src/api` exports | Readable public API for backend dev |
| No `server/` in `src/` | Production uses pain-server only |

## ts-prune (Mike’s rule)

- **`src/foo.ts:12 - bar`** → `bar` is exported but unused → delete or use it.
- **`… (used in module)`** → only used in that file → drop `export`.

## Self-review (2 minutes)

- [ ] `npm run check` green
- [ ] PR description says how to build and that `/init` must be proxied
- [ ] No experimental dead code in the diff
- [ ] Renamed vague params (`data` → `initLayerRows`, etc.)

## For Mike

Branch to test: `feat/pain-server-api` until merged.

```bash
git fetch && git checkout feat/pain-server-api
npm ci
npm run check
npm run build
# deploy dist/ + proxy GET /init/:layer to pain-server
```
