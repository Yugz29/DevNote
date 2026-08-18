import { useCallback, useSyncExternalStore } from "react";

const listenersByKey = new Map();

const notify = (key) => {
  listenersByKey.get(key)?.forEach((listener) => listener());
};

export function useLocalStorageState(key, defaultValue) {
  const subscribe = useCallback(
    (listener) => {
      const listeners = listenersByKey.get(key) ?? new Set();
      listeners.add(listener);
      listenersByKey.set(key, listeners);

      return () => listeners.delete(listener);
    },
    [key],
  );

  const getSnapshot = useCallback(
    () => localStorage.getItem(key) ?? defaultValue,
    [key, defaultValue],
  );

  const value = useSyncExternalStore(subscribe, getSnapshot);

  const setStoredValue = useCallback(
    (nextValue) => {
      localStorage.setItem(key, nextValue);
      notify(key);
    },
    [key],
  );

  return [value, setStoredValue];
}
