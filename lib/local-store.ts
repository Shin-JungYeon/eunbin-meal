import {useCallback, useSyncExternalStore} from 'react';

/**
 * 이 기기의 localStorage에 값 하나를 저장하는 작은 스토어.
 * - 서버 렌더에서는 기본값을 쓰고, 브라우저에서 저장값으로 바뀐다.
 * - 저장소를 못 쓰는 환경(사생활 보호 모드 등)에서도 세션 동안은 메모리 값으로 동작한다.
 * - 다른 탭에서 바뀐 값도 storage 이벤트로 따라간다.
 */
export function createLocalStore<T>(key: string, fallback: T, parse: (raw: unknown) => T) {
  const listeners = new Set<() => void>();
  let cachedRaw: string | null | undefined;
  let cached: T = fallback;

  function read(): T {
    let raw: string | null;
    try {
      raw = localStorage.getItem(key);
    } catch {
      return cached;
    }
    if (raw !== cachedRaw) {
      cachedRaw = raw;
      if (raw === null) {
        cached = fallback;
      } else {
        try {
          cached = parse(JSON.parse(raw));
        } catch {
          cached = fallback;
        }
      }
    }
    return cached;
  }

  function write(next: T) {
    cached = next;
    try {
      const raw = JSON.stringify(next);
      localStorage.setItem(key, raw);
      cachedRaw = raw;
    } catch {
      // 저장 실패 시에도 이번 세션 동안은 메모리 값으로 동작
    }
    listeners.forEach(listener => listener());
  }

  function subscribe(listener: () => void) {
    listeners.add(listener);
    const onStorage = (e: StorageEvent) => {
      if (e.key === key) listener();
    };
    window.addEventListener('storage', onStorage);
    return () => {
      listeners.delete(listener);
      window.removeEventListener('storage', onStorage);
    };
  }

  function useValue() {
    const value = useSyncExternalStore(subscribe, read, () => fallback);
    const set = useCallback((next: T) => write(next), []);
    return [value, set] as const;
  }

  return {read, write, useValue};
}
