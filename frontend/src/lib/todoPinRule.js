export const DONE_PINNED_KEY = "devnote_todo_done_pinned";

export const DONE_PINNED_DEFAULT = "keep";

/**
 * Whether completing this todo should also unpin it.
 *
 * Read at action time rather than through a hook: a todo reaches "done" from
 * the sidebar select, the card and the modal, and none of those share a
 * render tree where the preference could be passed down.
 */
export function shouldUnpinOnDone(todo, nextStatus) {
  if (nextStatus !== "done" || !todo?.is_pinned) return false;

  return localStorage.getItem(DONE_PINNED_KEY) === "unpin";
}
