import SettingsChoice from "./SettingsChoice.jsx";
import { useLocalStorageState } from "../hooks/useLocalStorageState.js";
import { DONE_PINNED_DEFAULT, DONE_PINNED_KEY } from "../lib/todoPinRule.js";
import {
  PINNED_TODO_SORT_DEFAULT,
  PINNED_TODO_SORT_KEY,
} from "../lib/todos.js";

const PREFERENCES = [
  {
    storageKey: "devnote_document_view",
    fallback: "grid",
    title: "Documents view",
    hint: "How the Documents tab opens.",
    options: [
      { value: "grid", label: "Icons", icon: "ph-squares-four" },
      { value: "list", label: "List", icon: "ph-list-bullets" },
    ],
  },
  {
    storageKey: "devnote_snippet_view",
    fallback: "grid",
    title: "Snippets view",
    hint: "How the Code Snippets tab opens.",
    options: [
      { value: "grid", label: "Grid", icon: "ph-squares-four" },
      { value: "grouped", label: "By language", icon: "ph-rows" },
    ],
  },
  {
    storageKey: "devnote_todo_view",
    fallback: "list",
    title: "TODOs view",
    hint: "How the TODOs tab opens.",
    options: [
      { value: "list", label: "List", icon: "ph-list-bullets" },
      { value: "kanban", label: "Kanban", icon: "ph-columns" },
    ],
  },
  {
    storageKey: PINNED_TODO_SORT_KEY,
    fallback: PINNED_TODO_SORT_DEFAULT,
    title: "Pinned todos order",
    hint: "How the sidebar arranges pinned todos, until you drag them yourself.",
    options: [
      { value: "auto", label: "Status, priority", icon: "ph-sort-ascending" },
      { value: "manual", label: "As pinned", icon: "ph-push-pin" },
    ],
  },
  {
    storageKey: DONE_PINNED_KEY,
    fallback: DONE_PINNED_DEFAULT,
    title: "Pinned todo marked done",
    hint: "What the sidebar does once a pinned todo is completed.",
    options: [
      { value: "keep", label: "Keep pinned", icon: "ph-push-pin" },
      { value: "unpin", label: "Unpin it", icon: "ph-push-pin-slash" },
    ],
  },
];

function PreferenceRow({ preference }) {
  const [value, setValue] = useLocalStorageState(
    preference.storageKey,
    preference.fallback,
  );

  return (
    <div className="settings-row" data-preference={preference.storageKey}>
      <div className="settings-row-text">
        <h3>{preference.title}</h3>
        <p>{preference.hint}</p>
      </div>

      <SettingsChoice
        label={preference.title}
        options={preference.options}
        value={value}
        onChange={setValue}
      />
    </div>
  );
}

export default function DefaultsSettings() {
  return (
    <div className="settings-section">
      {PREFERENCES.map((preference) => (
        <PreferenceRow key={preference.storageKey} preference={preference} />
      ))}
    </div>
  );
}
