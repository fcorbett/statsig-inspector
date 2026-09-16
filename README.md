# Statsig Inspector

A Chrome extension that lets PMs, CSMs, and engineers verify a Statsig web install **without changing the host app**. Open any site, pin the toolbar icon, and read identity, flag health, live events, and session-replay status from the Statsig client already running on the page.

This is a community project. **It is not affiliated with Statsig or Amplitude.** See [CONTRIBUTING.md](CONTRIBUTING.md) if you want to build from source, and [PRIVACY.md](PRIVACY.md) for what the extension reads.

## What it does

In under two minutes on a production page you can:

- See that Statsig is installed and finished initializing
- Read the exact `userID` and `stableID` in use
- Learn whether Session Replay is recording, and if not, which of four reasons applies
- Click around and watch client events appear
- Screenshot the Verify tab into Slack without opening DevTools

The side panel is the home (it does not cover the app under test). A thin on-page HUD shows SDK found/not found, identity, recording, and the last event. Toggle it with **Alt+Shift+S**.

### Verify tab

Traffic-light scorecard, identity card, replay card, live event ticker.

### Inspect tab

Evaluations with reasons, network timeline, bootstrap warnings, optional hashed-name decode.

## Install (unpacked)

Chrome Web Store listing is not part of v1. Load it unpacked:

1. Clone this repo and install:

   ```bash
   git clone https://github.com/fcorbett/statsig-inspector.git
   cd statsig-inspector
   pnpm install
   pnpm build
   ```

2. Open `chrome://extensions`, enable **Developer mode**, click **Load unpacked**, and select `.output/chrome-mv3`.

3. Pin **Statsig Inspector** and open it on a tab that runs Statsig (or a local fixture).

Development with live reload:

```bash
pnpm dev
```

That launches Chrome with the extension loaded.

## Local fixtures (no Statsig account)

A real `client-` SDK key is **not** required to build or verify the extension. Fixtures bootstrap a public CDN build of `@statsig/js-client` with a synthetic initialize payload.

```bash
pnpm fixtures
```

Then open [http://127.0.0.1:8787](http://127.0.0.1:8787):

| Page | What it simulates |
| --- | --- |
| `/` | Healthy install: identity, bootstrap values, replay on, autocapture on |
| `/no-init.html` | Client constructed, never initialized |
| `/no-userid.html` | Empty user object |
| `/no-replay.html` | No `runStatsigSessionReplay` |
| `/replay-sampled-out.html` | Plugin present, `can_record_session: false` |
| `/network.html` | Dummy key `initializeAsync` + `flush` (HTTP 401 is success for this page) |

Bootstrap pages never hit `featureassets.org`. That is expected (same as Next.js SSR) and is **not** an ad-blocker failure. Only `/network.html` exercises initialize/rgstr.

## How it works

```
Host page (MAIN world)
  StatsigClient / SessionReplay / AutoCapture / fetch
        |
        v
probe.content.ts  --window.postMessage-->  bridge.content.ts (ISOLATED)
                                                    |
                                                    v
                                           background service worker
                                                    |
                                                    v
                                           side panel + HUD
```

The probe reads documented SDK globals (`window.__STATSIG__`, plus legacy `__STATSIG_JS_SDK__` / `__STATSIG_SDK__`). It does **not** call `getContext()` on a timer — that would bump the session idle clock and corrupt customer analytics. It uses `getContextHandle()` and `getSession(false)`.

Every inspector gate/config read passes `{ disableExposureLog: true }`. Suppressed checks still increment an aggregate `statsig::non_exposed_checks` counter. That is not an exposure and does not change assignment, but it is not literally zero-footprint.

## Permissions

| Permission | Why |
| --- | --- |
| `storage` | Optional Console API key. Default is `chrome.storage.session` (clears on browser restart). `chrome.storage.local` only if you tick “Remember on this device”. |
| `sidePanel` | The inspector UI. |
| `activeTab` / `scripting` | Talk to the current tab. |
| `https://statsigapi.net/*` | Optional Console API (GET only), from the service worker. |
| Optional `*://*/*` | Site access is requested per origin from the side panel. |

The MAIN-world probe patches `fetch` / XHR / `sendBeacon` so it can see initialize (`featureassets.org`) and event logging (`prodregistryv2.org`), plus legacy `api.statsig.com` hosts and any custom `networkConfig` endpoints.

Nothing leaves the browser except optional Console API calls you authorize.

## Console API key (optional)

The core inspector works with **no Statsig credentials**. A personal Console API key unlocks:

- Human names for hashed gates / experiments / configs
- Logs Explorer “did this userID land?”
- Deep links to the Console Users tab

**Use a personal key, not a project key.** A project Console key can mutate the whole project. This extension issues **GET requests only**, but still do not paste a production project secret you do not trust.

The key is stored in the extension service worker. It is never put on `window.postMessage` and is never readable from a content script. Emails are masked (`f***@example.com`) unless you toggle “show full values”. `privateAttributes` are always stripped before messages leave the page.

Live Logs Explorer round-trips require a real key and are a manual check.

## What it cannot see

Server SDKs are essentially invisible from a browser. Exceptions:

- A page that **bootstraps** from a server SDK exposes those evaluations on the client (`Bootstrap:…`, with `warnings` for `StableIDMismatch` / `PartialUserMatch`).
- With a Console key, Logs Explorer can look up server-logged events for the same `userID`.

Client recordings key on `stableID`. A server exposure keyed only on `userID` [will not match a recording](https://docs.statsig.com/session-replay/watch).

v1 probes the **top frame only**. If Statsig lives in an iframe, the panel says so instead of reporting a clean “not installed”.

## Comparison to other tools

| Tool | What it is |
| --- | --- |
| **Statsig Inspector (this)** | Overlay + side panel install verifier. No host-app change. |
| [Official SDK Debugger](https://github.com/statsig-io/statsig-sdk-debugger-chrome-extension) | One-shot snapshot into a console popup. Engineer-oriented. [Does not work for Google SSO accounts](https://docs.statsig.com/sdks/debugging) because it depends on a console cookie. |
| [Community “Features and Experimentation”](https://github.com/aaron5670/statsig-browser-extension) | Console remote control (search/manage gates). Not a verifier. |

This project does **not** clone the official debugger popup, does not cookie-login to `console.statsig.com`, and does not create or edit gates.

## Architecture notes

- **Checks** (`src/shared/checks.ts`) are pure functions. A single `Unrecognized` gate is a pass — Statsig omits default-false gates from the payload. Only *every* evaluation unrecognized fails the scorecard.
- Evaluation reasons are `Source:Reason` (for example `Network:Recognized`). Source and reason are split on `:` independently.
- Session Replay diagnosis mirrors `SessionReplay._attemptToStartRecording`: plugin missing → no values → blocked → targeting gate → not eligible → `isRecording()`.
- `forceStartRecording` is labeled as a debug action. It bypasses sample rate, still respects the targeting gate, and creates a **real** recording.

```bash
pnpm test      # vitest
pnpm compile   # tsc --noEmit
pnpm build     # production zip in .output
```

## Privacy

See [PRIVACY.md](PRIVACY.md). In short: page data stays in the tab and extension process; the only network this extension itself initiates is optional GET calls to `https://statsigapi.net/console/v1/*` when you save a Console key; SDK keys in the UI are masked.

## License

MIT. See [LICENSE](LICENSE).
