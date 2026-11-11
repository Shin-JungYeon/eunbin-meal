import {useSyncExternalStore} from 'react';
import {toLocalIso} from './age';

export * from './age';

const noopSubscribe = () => () => {};

/** 서버 렌더에서는 null, 브라우저에서만 오늘 날짜를 읽어 hydration 불일치를 피한다. */
export function useTodayIso() {
  return useSyncExternalStore(
    noopSubscribe,
    () => toLocalIso(new Date()),
    () => null,
  );
}
