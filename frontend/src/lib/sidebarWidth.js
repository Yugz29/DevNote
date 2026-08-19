export const SIDEBAR_WIDTH_KEY = "devnote_sidebar_width";
export const SIDEBAR_WIDTH_DEFAULT = 252;

/* Below the minimum the pinned todo tiles start wrapping their status pill;
   above the maximum the sidebar starts eating the workspace. */
export const SIDEBAR_WIDTH_MIN = 220;
export const SIDEBAR_WIDTH_MAX = 420;

export const clampWidth = (value) =>
  Math.min(SIDEBAR_WIDTH_MAX, Math.max(SIDEBAR_WIDTH_MIN, Math.round(value)));
