import { useCallback, useMemo } from "react";

import { useLocalStorageState } from "./useLocalStorageState.js";

const EMPTY = "[]";

function parse(raw) {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((id) => typeof id === "string")
      : [];
  } catch {
    return [];
  }
}

/**
 * Applies a stored order to a list keyed by `id`.
 *
 * Entries the stored order does not know about come first, in the order the
 * caller supplied them: a freshly pinned item stays visible at the top rather
 * than sinking to the bottom of a long list.
 */
export function applyOrder(items, order) {
  if (order.length === 0) return items;

  const rank = new Map(order.map((id, index) => [id, index]));
  const known = [];
  const unknown = [];

  for (const item of items) {
    (rank.has(item.id) ? known : unknown).push(item);
  }

  known.sort((a, b) => rank.get(a.id) - rank.get(b.id));

  return [...unknown, ...known];
}

export function useOrder(key, items) {
  const [raw, setRaw] = useLocalStorageState(key, EMPTY);

  const order = useMemo(() => parse(raw), [raw]);
  const ordered = useMemo(() => applyOrder(items, order), [items, order]);

  const store = useCallback(
    (nextItems) => setRaw(JSON.stringify(nextItems.map((item) => item.id))),
    [setRaw],
  );

  const reset = useCallback(() => setRaw(EMPTY), [setRaw]);

  return { ordered, store, reset, isCustom: order.length > 0 };
}
