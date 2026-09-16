const CDN =
  'https://cdn.jsdelivr.net/npm/@statsig/js-client@3/build/statsig-js-client+session-replay+web-analytics.min.js';

const DUMMY_KEY = 'client-inspector-offline';
const FIXTURE_STABLE_ID = 'fixture-stable-id-1';

function fixtureUser() {
  return {
    userID: 'fixture-user-1',
    email: 'test@example.com',
    customIDs: { stableID: FIXTURE_STABLE_ID },
  };
}

async function loadStatsig() {
  if (window.Statsig) return window.Statsig;
  await new Promise((resolve, reject) => {
    const el = document.createElement('script');
    el.src = CDN;
    el.crossOrigin = 'anonymous';
    el.onload = resolve;
    el.onerror = () => reject(new Error('Failed to load Statsig CDN bundle'));
    document.head.appendChild(el);
  });
  return window.Statsig;
}

function setStatus(text) {
  const el = document.getElementById('status');
  if (el) el.textContent = text;
  console.log('[fixture]', text);
}

/**
 * Current js-client setData() no-ops unless the JSON includes a `user` field.
 * Offline fixtures use setDataLegacy with the same user object the client was
 * constructed with. disableBackgroundCacheRefresh keeps a dummy-key 401 from
 * wiping bootstrap values.
 */
function bootstrapClient(client, user, payload) {
  const current = client.getContextHandle?.()?.user ?? user;
  const data = JSON.stringify({ ...payload, user: current });
  if (typeof client.dataAdapter.setDataLegacy === 'function') {
    client.dataAdapter.setDataLegacy(data, current);
  } else {
    client.dataAdapter.setData(data);
  }
  client.initializeSync({ disableBackgroundCacheRefresh: true });
}

window.FIXTURE = {
  DUMMY_KEY,
  FIXTURE_STABLE_ID,
  loadStatsig,
  fixtureUser,
  setStatus,
  bootstrapClient,
};
