export const PRIORITY_BADGES = {
  low: { label: "Low", class: "badge-low" },
  medium: { label: "Medium", class: "badge-medium" },
  high: { label: "High", class: "badge-high" },
};

export const STATUS_BADGES = {
  pending: { label: "Pending", class: "badge-pending" },
  in_progress: { label: "In Progress", class: "badge-in-progress" },
  done: { label: "Done", class: "badge-done" },
};

export const STATUS_LABELS = {
  pending: "Pending",
  in_progress: "In Progress",
  done: "Done",
};

export const STATUSES = ["pending", "in_progress", "done"];

export const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };

export const STATUS_ORDER = Object.fromEntries(
  STATUSES.map((status, index) => [status, index]),
);

export const PINNED_TODO_SORT_KEY = "devnote_pinned_todo_sort";

export const PINNED_TODO_SORT_DEFAULT = "auto";

export function sortByStatusThenPriority(todos) {
  return [...todos].sort((a, b) => {
    const byStatus =
      (STATUS_ORDER[a.status] ?? 0) - (STATUS_ORDER[b.status] ?? 0);

    if (byStatus !== 0) return byStatus;

    return (
      (PRIORITY_ORDER[a.priority] ?? 1) - (PRIORITY_ORDER[b.priority] ?? 1)
    );
  });
}

export const STATUS_OPTIONS = Object.entries(STATUS_BADGES).map(
  ([value, badge]) => ({ value, label: badge.label }),
);

export const PRIORITY_OPTIONS = Object.entries(PRIORITY_BADGES).map(
  ([value, badge]) => ({ value, label: badge.label }),
);
