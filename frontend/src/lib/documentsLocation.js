const KEY_PREFIX = "devnote_documents_location_";

const storageKey = (projectId) => `${KEY_PREFIX}${projectId}`;

export const EMPTY_LOCATION = { path: [], documentId: null, scrollTop: 0 };

export function readLocation(projectId) {
  if (!projectId) return EMPTY_LOCATION;

  try {
    const stored = JSON.parse(localStorage.getItem(storageKey(projectId)));

    const path = Array.isArray(stored?.path)
      ? stored.path
          .filter((entry) => entry?.id && entry?.name)
          .map((entry) => ({ id: entry.id, name: entry.name }))
      : [];

    const scrollTop =
      Number.isFinite(stored?.scrollTop) && stored.scrollTop > 0
        ? stored.scrollTop
        : 0;

    return { path, documentId: stored?.documentId ?? null, scrollTop };
  } catch {
    return EMPTY_LOCATION;
  }
}

export function writeLocation(projectId, { path, documentId, scrollTop = 0 }) {
  if (!projectId) return;

  if (!path.length && !documentId) {
    localStorage.removeItem(storageKey(projectId));
    return;
  }

  localStorage.setItem(
    storageKey(projectId),
    JSON.stringify({ path, documentId, scrollTop }),
  );
}
