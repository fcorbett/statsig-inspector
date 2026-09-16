function djb2(value) {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0;
  }
  return String(hash >>> 0);
}

function buildFixturePayload(overrides = {}) {
  const gateName = djb2('a_gate');
  return {
    feature_gates: {
      [gateName]: {
        name: gateName,
        value: true,
        rule_id: 'fixture_rule',
        secondary_exposures: [],
        id_type: 'userID',
      },
    },
    dynamic_configs: {},
    layer_configs: {},
    has_updates: true,
    time: Date.now(),
    hash_used: 'djb2',
    can_record_session: true,
    session_recording_rate: 100,
    recording_blocked: false,
    passes_session_recording_targeting: true,
    ...overrides,
  };
}

window.djb2 = djb2;
window.buildFixturePayload = buildFixturePayload;
window.FIXTURE_PAYLOAD = buildFixturePayload();
window.FIXTURE_SAMPLED_OUT_PAYLOAD = buildFixturePayload({
  can_record_session: false,
  session_recording_rate: 10,
});
