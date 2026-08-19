import CardMenu from "./CardMenu.jsx";
import LanguageIcon from "./LanguageIcon.jsx";
import { useCopyStatus } from "../hooks/useCopyStatus.js";
import { useLocalStorageState } from "../hooks/useLocalStorageState.js";

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

function PinnedGroup({ label, list, storageKey, children }) {
  const [collapsed, setCollapsed] = useLocalStorageState(storageKey, "false");

  const isCollapsed = collapsed === "true";

  if (list.items.length === 0) return null;

  return (
    <section className="pinned-group">
      <button
        type="button"
        className="pinned-group-header"
        aria-expanded={!isCollapsed}
        onClick={() => setCollapsed(isCollapsed ? "false" : "true")}
      >
        <i
          className={`ph-light ph-caret-down pinned-group-caret${isCollapsed ? " rotated" : ""}`}
        />
        <span>{label}</span>
        {list.count > list.items.length && (
          <span className="pinned-group-count">
            {list.items.length} of {list.count}
          </span>
        )}
      </button>

      {!isCollapsed && children}
    </section>
  );
}

export default function SidebarPinned({
  documents,
  snippets,
  isLoading,
  activeItemId,
  onOpenDocument,
  onOpenSnippet,
  onUnpinDocument,
  onUnpinSnippet,
}) {
  const isEmpty = documents.items.length === 0 && snippets.items.length === 0;

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
            Pin a document or a snippet
            <br />
            to keep it one click away
          </span>
        </div>
      )}

      <PinnedGroup
        label="Documents"
        list={documents}
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
      </PinnedGroup>

      <PinnedGroup
        label="Snippets"
        list={snippets}
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
      </PinnedGroup>
    </div>
  );
}
