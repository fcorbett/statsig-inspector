export const INSPECTOR_CHANNEL = 'statsig-inspector';

export const TOGGLE_HUD_COMMAND = 'toggle-hud';

export type ProbeToBridgeType =
  | 'HEARTBEAT'
  | 'SNAPSHOT'
  | 'EVENTS'
  | 'HUD_STATE';

export type BridgeToProbeType =
  | 'REQUEST_SNAPSHOT'
  | 'SET_ACTIVE_SDK_KEY'
  | 'SET_SHOW_FULL_VALUES'
  | 'FORCE_START_RECORDING'
  | 'SET_HOVER_INSPECT'
  | 'HIGHLIGHT_SELECTOR'
  | 'REFRESH_SNAPSHOT';

export type ExtensionMessageType =
  | ProbeToBridgeType
  | 'SNAPSHOT_UPDATED'
  | 'GET_ACTIVE_SNAPSHOT'
  | 'ACTIVE_SNAPSHOT'
  | 'SET_CONSOLE_KEY'
  | 'CLEAR_CONSOLE_KEY'
  | 'CONSOLE_KEY_STATUS'
  | 'LOOKUP_LOGS'
  | 'LOGS_RESULT'
  | 'REQUEST_SITE_PERMISSION'
  | 'SITE_PERMISSION_STATUS'
  | 'TOGGLE_HUD'
  | 'SET_HOVER_INSPECT'
  | 'HIGHLIGHT_SELECTOR'
  | 'FORCE_START_RECORDING'
  | 'SET_ACTIVE_SDK_KEY'
  | 'SET_SHOW_FULL_VALUES'
  | 'REFRESH_SNAPSHOT';

export interface InspectorEnvelope<T = unknown> {
  channel: typeof INSPECTOR_CHANNEL;
  type: string;
  payload?: T;
}

export function isInspectorEnvelope(
  data: unknown,
): data is InspectorEnvelope {
  return (
    typeof data === 'object' &&
    data !== null &&
    (data as InspectorEnvelope).channel === INSPECTOR_CHANNEL &&
    typeof (data as InspectorEnvelope).type === 'string'
  );
}

export function envelope<T>(
  type: string,
  payload?: T,
): InspectorEnvelope<T> {
  return { channel: INSPECTOR_CHANNEL, type, payload };
}
