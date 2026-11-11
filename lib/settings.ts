import {useCallback} from 'react';
import {createLocalStore} from './local-store';
import {DEFAULT_SETTINGS, parseSettings, type Settings} from './prompt';

export * from './prompt';

// 이 기기의 localStorage에 저장 (서버 연동 전까지)
export const settingsStore = createLocalStore(
  'eunbin-meal:settings:v1',
  DEFAULT_SETTINGS,
  parseSettings,
);

export function useSettings() {
  const [settings, set] = settingsStore.useValue();
  const update = useCallback(
    (patch: Partial<Settings>) => set({...settingsStore.read(), ...patch}),
    [set],
  );
  const reset = useCallback(() => set(DEFAULT_SETTINGS), [set]);
  return {settings, update, reset};
}
