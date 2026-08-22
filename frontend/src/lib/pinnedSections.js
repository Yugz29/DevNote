export const PINNED_SECTIONS = [
  {
    id: "documents",
    label: "Documents",
    collapseKey: "devnote_pinned_documents_collapsed",
  },
  {
    id: "snippets",
    label: "Snippets",
    collapseKey: "devnote_pinned_snippets_collapsed",
  },
  {
    id: "todos",
    label: "TODOs",
    collapseKey: "devnote_pinned_todos_collapsed",
  },
];

export const PROJECTS_ORDER_KEY = "devnote_projects_order";

export const ARCHIVED_PROJECTS_ORDER_KEY = "devnote_archived_projects_order";

export const SECTIONS_ORDER_KEY = "devnote_pinned_sections_order";

export const itemsOrderKey = (sectionId, projectId) =>
  `devnote_pinned_${sectionId}_order_${projectId}`;
