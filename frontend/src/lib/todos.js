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

export const STATUS_OPTIONS = Object.entries(STATUS_BADGES).map(
  ([value, badge]) => ({ value, label: badge.label }),
);

export const PRIORITY_OPTIONS = Object.entries(PRIORITY_BADGES).map(
  ([value, badge]) => ({ value, label: badge.label }),
);
