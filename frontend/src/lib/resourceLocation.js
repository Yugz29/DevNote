const storageKey = (resource, projectId) =>
  `devnote_${resource}_location_${projectId}`;

export const EMPTY_LOCATION = { path: [], itemId: null, scrollTop: 0 };

export function readLocation(resource, projectId) {
  if (!projectId) return EMPTY_LOCATION;

  try {
    const stored = JSON.parse(
      localStorage.getItem(storageKey(resource, projectId)),
    );

    const path = Array.isArray(stored?.path)
      ? stored.path
          .filter((entry) => entry?.id && entry?.name)
          .map((entry) => ({ id: entry.id, name: entry.name }))
      : [];

    const scrollTop =
      Number.isFinite(stored?.scrollTop) && stored.scrollTop > 0
        ? stored.scrollTop
        : 0;

    return { path, itemId: stored?.itemId ?? null, scrollTop };
  } catch {
    return EMPTY_LOCATION;
  }
}

export function writeLocation(
  resource,
  projectId,
  { path, itemId = null, scrollTop = 0 },
) {
  if (!projectId) return;

  if (!path.length && !itemId) {
    localStorage.removeItem(storageKey(resource, projectId));
    return;
  }

  localStorage.setItem(
    storageKey(resource, projectId),
    JSON.stringify({ path, itemId, scrollTop }),
  );
}
