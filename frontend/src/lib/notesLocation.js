const KEY_PREFIX = "devnote_notes_location_";

const storageKey = (projectId) => `${KEY_PREFIX}${projectId}`;

export const EMPTY_LOCATION = { path: [], noteId: null };

export function readLocation(projectId) {
  if (!projectId) return EMPTY_LOCATION;

  try {
    const stored = JSON.parse(localStorage.getItem(storageKey(projectId)));

    const path = Array.isArray(stored?.path)
      ? stored.path
          .filter((entry) => entry?.id && entry?.name)
          .map((entry) => ({ id: entry.id, name: entry.name }))
      : [];

    return { path, noteId: stored?.noteId ?? null };
  } catch {
    return EMPTY_LOCATION;
  }
}

export function writeLocation(projectId, { path, noteId }) {
  if (!projectId) return;

  if (!path.length && !noteId) {
    localStorage.removeItem(storageKey(projectId));
    return;
  }

  localStorage.setItem(storageKey(projectId), JSON.stringify({ path, noteId }));
}
