import CardMenu from "./CardMenu.jsx";
import DnSelect from "./DnSelect.jsx";
import LanguageIcon from "./LanguageIcon.jsx";
import SidebarGroup from "./SidebarGroup.jsx";
import { useCopyStatus } from "../hooks/useCopyStatus.js";
import {
  PRIORITY_BADGES,
  STATUS_BADGES,
  STATUS_OPTIONS,
} from "../lib/todos.js";

const COPY_STATES = {
  copied: { icon: "ph-check-circle", label: "Copied!" },
  failed: { icon: "ph-warning-circle", label: "Copy failed" },
};

function PinnedDocument({ doc, isActive, onOpen, onUnpin }) {
  return (
    <div className={`pinned-item${isActive ? " active" : ""}`} data-id={doc.id}>
      <button
        type="button"
        className="pinned-item-open"
        title={`Open ${doc.title}`}
        onClick={() => onOpen(doc)}
      >
        <i className="ph-light ph-file-text pinned-item-icon" />
        <span className="pinned-item-title">{doc.title}</span>
      </button>

      <div className="pinned-item-actions">
        <CardMenu
          label={`Actions for ${doc.title}`}
          items={[
            {
              label: "Unpin",
              icon: "ph-push-pin-slash",
              onSelect: () => onUnpin(doc),
            },
          ]}
        />
      </div>
    </div>
  );
}

function PinnedSnippet({ snippet, isActive, onOpen, onUnpin }) {
  const { status, copy } = useCopyStatus();

  const state = COPY_STATES[status];

  return (
    <div
      className={`pinned-item${isActive ? " active" : ""}${state ? ` is-${status}` : ""}`}
      data-id={snippet.id}
    >
      <button
        type="button"
        className="pinned-item-open"
        title={`Copy ${snippet.title}`}
        onClick={() => copy(snippet.content)}
      >
        <LanguageIcon language={snippet.language} />
        <span className="pinned-item-title">{snippet.title}</span>
      </button>

      {state && (
        <span className="pinned-item-feedback" role="status">
          <i className={`ph-light ${state.icon}`} />
          {state.label}
        </span>
      )}

      <div className="pinned-item-actions">
        <CardMenu
          label={`Actions for ${snippet.title}`}
          items={[
            {
              label: "Open",
              icon: "ph-arrow-square-out",
              onSelect: () => onOpen(snippet),
            },
            {
              label: "Unpin",
              icon: "ph-push-pin-slash",
              onSelect: () => onUnpin(snippet),
            },
          ]}
        />
      </div>
    </div>
  );
}

function PinnedTodo({ todo, isActive, onOpen, onStatusChange, onUnpin }) {
  const status = STATUS_BADGES[todo.status] || STATUS_BADGES.pending;
  const priority = PRIORITY_BADGES[todo.priority] || PRIORITY_BADGES.medium;

  return (
    <div
      className={`pinned-item pinned-todo${isActive ? " active" : ""}${todo.status === "done" ? " is-done" : ""}`}
      data-id={todo.id}
    >
      <div className="pinned-todo-main">
        <button
          type="button"
          className="pinned-item-open"
          title={`Open ${todo.title} — ${priority.label} priority`}
          onClick={() => onOpen(todo)}
        >
          <span className={`pinned-todo-dot is-${todo.priority}`} />
          <span className="pinned-item-title">{todo.title}</span>
        </button>

        <div className="pinned-item-actions">
          <CardMenu
            label={`Actions for ${todo.title}`}
            items={[
              {
                label: "Unpin",
                icon: "ph-push-pin-slash",
                onSelect: () => onUnpin(todo),
              },
            ]}
          />
        </div>
      </div>

      <div className="pinned-todo-badges">
        <DnSelect
          value={todo.status}
          options={STATUS_OPTIONS}
          onChange={(next) => onStatusChange(todo, next)}
          usePortal
          label={`Status: ${status.label}`}
          triggerClassName={`todo-badge-select badge badge-mini ${status.class}`}
        />
      </div>
    </div>
  );
}

export default function SidebarPinned({
  documents,
  snippets,
  todos,
  isLoading,
  activeItemId,
  onOpenDocument,
  onOpenSnippet,
  onOpenTodo,
  onChangeTodoStatus,
  onUnpinDocument,
  onUnpinSnippet,
  onUnpinTodo,
}) {
  const isEmpty =
    documents.items.length === 0 &&
    snippets.items.length === 0 &&
    todos.items.length === 0;

  if (isLoading) {
    return (
      <div id="pinned-list">
        <p className="loading">Loading pinned items...</p>
      </div>
    );
  }

  return (
    <div id="pinned-list">
      {isEmpty && (
        <div className="projects-empty">
          <i className="ph-light ph-push-pin" />
          <p>Nothing pinned yet</p>
          <span>
            Pin a document, a snippet or a todo
            <br />
            to keep it one click away
          </span>
        </div>
      )}

      <SidebarGroup
        label="Documents"
        items={documents.items}
        count={documents.count}
        storageKey="devnote_pinned_documents_collapsed"
      >
        {documents.items.map((doc) => (
          <PinnedDocument
            key={doc.id}
            doc={doc}
            isActive={doc.id === activeItemId}
            onOpen={onOpenDocument}
            onUnpin={onUnpinDocument}
          />
        ))}
      </SidebarGroup>

      <SidebarGroup
        label="Snippets"
        items={snippets.items}
        count={snippets.count}
        storageKey="devnote_pinned_snippets_collapsed"
      >
        {snippets.items.map((snippet) => (
          <PinnedSnippet
            key={snippet.id}
            snippet={snippet}
            isActive={snippet.id === activeItemId}
            onOpen={onOpenSnippet}
            onUnpin={onUnpinSnippet}
          />
        ))}
      </SidebarGroup>

      <SidebarGroup
        label="TODOs"
        items={todos.items}
        count={todos.count}
        storageKey="devnote_pinned_todos_collapsed"
      >
        {todos.items.map((todo) => (
          <PinnedTodo
            key={todo.id}
            todo={todo}
            isActive={todo.id === activeItemId}
            onOpen={onOpenTodo}
            onStatusChange={onChangeTodoStatus}
            onUnpin={onUnpinTodo}
          />
        ))}
      </SidebarGroup>
    </div>
  );
}
