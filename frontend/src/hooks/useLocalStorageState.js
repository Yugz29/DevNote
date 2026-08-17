import { useCallback, useState } from "react";

export function useLocalStorageState(key, defaultValue) {
  const [value, setValue] = useState(
    () => localStorage.getItem(key) ?? defaultValue,
  );

  const setStoredValue = useCallback(
    (nextValue) => {
      localStorage.setItem(key, nextValue);
      setValue(nextValue);
    },
    [key],
  );

  return [value, setStoredValue];
}
