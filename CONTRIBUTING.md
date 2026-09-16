# Contributing

This is a community Chrome extension. It is not affiliated with Statsig or Amplitude.

## Setup

```bash
pnpm install
pnpm test
pnpm compile
```

Live reload in Chrome:

```bash
pnpm dev
```

Production unpacked build (load `.output/chrome-mv3` from `chrome://extensions` with Developer mode on):

```bash
pnpm build
```

## Fixtures

No Statsig account is required. From the repo root:

```bash
pnpm fixtures
```

Then open [http://127.0.0.1:8787](http://127.0.0.1:8787). See the README for what each page simulates.

## What not to commit

- Console API keys, `client-` SDK keys, or anything in `.env` / `.env.local`
- `tests/fixture/.env.local` or `tests/fixture/live.html` (gitignored on purpose)
- `node_modules`, `.output`, `.wxt`

## Pull requests

CI runs `pnpm test`, `pnpm compile`, and `pnpm build` on `main` and on PRs. Keep changes in the same spirit as the product: inspect the in-page SDK, do not mutate Statsig projects, GET-only Console API.
