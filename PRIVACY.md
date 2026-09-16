# Privacy

Statsig Inspector is a community Chrome extension. It is not affiliated with Statsig or Amplitude.

## What the extension reads

On a page you open the inspector against, it reads Statsig client state already present in that tab: whether the SDK is installed, user identity fields the SDK already has, flag/config evaluation metadata, live client events, session-replay plugin status, and Statsig-related network calls. It does this so you can verify an install. It does not change the host app.

`privateAttributes` on the Statsig user are stripped before any message leaves the page. Emails are masked (for example `f***@example.com`) unless you turn on “show full values” in the side panel. SDK keys shown in the UI are masked; the full key stays in the probe only to match SDK instances.

## What leaves the browser

Page data stays in the tab and the extension process.

The extension itself initiates network requests only when you paste a Statsig Console API key. Those are GET requests to `https://statsigapi.net/console/v1/*` (gate/experiment/config names and optional Logs Explorer lookup). Nothing is sold, and there is no analytics backend for this project.

The Statsig JavaScript SDK on the host page may still talk to Statsig as it normally would. This extension does not disable that.

## Console API keys

Prefer a **personal** Console key. Project keys can mutate a Statsig project. This extension issues GET requests only, but you should still not paste a production project secret you do not trust.

Keys are stored in `chrome.storage.session` by default (cleared when the browser restarts). “Remember on this device” writes `chrome.storage.local`. The key is never put on `window.postMessage` and is never readable from a content script.

## Source

The source is public: [https://github.com/fcorbett/statsig-inspector](https://github.com/fcorbett/statsig-inspector).
