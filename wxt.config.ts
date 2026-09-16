import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'Statsig Inspector',
    description:
      'Verify a Statsig web install: identity, flags, live events, and session replay. Not affiliated with Statsig.',
    permissions: ['storage', 'sidePanel', 'activeTab', 'scripting'],
    host_permissions: ['https://statsigapi.net/*'],
    optional_host_permissions: ['*://*/*'],
    action: { default_title: 'Open Statsig Inspector' },
    commands: {
      'toggle-hud': {
        suggested_key: { default: 'Alt+Shift+S' },
        description: 'Toggle the Statsig Inspector HUD',
      },
    },
  },
});
