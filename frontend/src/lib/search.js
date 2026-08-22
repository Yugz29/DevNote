export const SEARCH_SECTIONS = [
  { key: "projects", label: "Projects" },
  { key: "documents", label: "Documents" },
  { key: "snippets", label: "Snippets" },
  { key: "todos", label: "TODOs" },
];

export const SEARCH_ICONS = {
  projects: "ph-light ph-folder",
  documents: "ph-light ph-note",
  snippets: "ph-light ph-code",
  todos: "ph-light ph-check-square",
};

export function countResults(results) {
  return SEARCH_SECTIONS.reduce(
    (count, section) => count + (results?.[section.key]?.length || 0),
    0,
  );
}
