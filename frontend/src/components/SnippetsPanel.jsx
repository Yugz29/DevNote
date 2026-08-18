import { useEffect, useMemo, useRef, useState } from "react";
import SnippetCard from "./SnippetCard.jsx";
import SnippetEditor from "./SnippetEditor.jsx";
import LanguageIcon from "./LanguageIcon.jsx";
import { useDialog } from "../contexts/DialogContext.js";
import { useResourceList } from "../hooks/useResourceList.js";
import { useSearchTarget } from "../hooks/useSearchTarget.js";
import {
  createSnippet,
  deleteSnippet,
  getSnippets,
  updateSnippet,
} from "../services/snippetService.js";

function sortSnippets(snippets, sort) {
  return [...snippets].sort((a, b) => {
    if (sort === "updated") {
      return new Date(b.updated_at) - new Date(a.updated_at);
    }
    if (sort === "title") {
      return a.title.localeCompare(b.title);
    }
    return new Date(b.created_at) - new Date(a.created_at);
  });
}

function groupByLanguage(snippets) {
  const groups = new Map();

  for (const snippet of snippets) {
    const language = snippet.language || "text";
    if (!groups.has(language)) groups.set(language, []);
    groups.get(language).push(snippet);
  }

  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
}

function readCollapsedGroups(projectId) {
  const stored = localStorage.getItem(`devnote_snippet_collapsed_${projectId}`);
  return new Set(stored ? JSON.parse(stored) : []);
}

export default function SnippetsPanel({
  projectId,
  sort,
  view,
  scrollRef,
  searchQuery,
  searchItemId,
  onSortableChange,
}) {
  const { showAlert, showConfirm } = useDialog();
  const containerRef = useRef(null);

  const [editingId, setEditingId] = useState(null);
  const [collapsedGroups, setCollapsedGroups] = useState(() =>
    readCollapsedGroups(projectId),
  );

  const { items, isLoading, error, reload } = useResourceList({
    projectId,
    fetchPage: getSnippets,
    scrollRef,
  });

  const snippets = useMemo(() => sortSnippets(items, sort), [items, sort]);
  const groups = useMemo(() => groupByLanguage(snippets), [snippets]);

  useSearchTarget(
    containerRef,
    searchItemId,
    !isLoading && snippets.length > 0,
  );

  const isSortable = !isLoading && !error && snippets.length > 1;

  useEffect(() => {
    onSortableChange(isSortable);
  }, [onSortableChange, isSortable]);

  const toggleGroup = (language) => {
    const next = new Set(collapsedGroups);

    if (next.has(language)) {
      next.delete(language);
    } else {
      next.add(language);
    }

    localStorage.setItem(
      `devnote_snippet_collapsed_${projectId}`,
      JSON.stringify([...next]),
    );
    setCollapsedGroups(next);
  };

  const handleSave = async (snippetId, values) => {
    const title = values.title.trim();
    const language = values.language.trim() || "text";
    const description = values.description.trim();
    const { content } = values;

    if (!title) {
      await showAlert("Title is required", "info");
      return;
    }

    if (!content.trim()) {
      await showAlert("Content is required", "info");
      return;
    }

    try {
      if (snippetId) {
        await updateSnippet(snippetId, title, language, content, description);
      } else {
        await createSnippet(projectId, title, language, content, description);
      }

      setEditingId(null);
      await reload();
    } catch (saveError) {
      console.error("Error saving snippet:", saveError);
      await showAlert("Unable to save the snippet");
    }
  };

  const handleDelete = async (snippetId) => {
    const confirmed = await showConfirm("Delete this snippet?");
    if (!confirmed) return;

    try {
      await deleteSnippet(snippetId);
      await reload();
    } catch (deleteError) {
      console.error("Error deleting snippet:", deleteError);
      await showAlert("Unable to delete the snippet");
    }
  };

  const renderSnippet = (snippet) =>
    editingId === snippet.id ? (
      <SnippetEditor
        key={snippet.id}
        snippet={snippet}
        onSave={(values) => handleSave(snippet.id, values)}
        onCancel={() => setEditingId(null)}
      />
    ) : (
      <SnippetCard
        key={snippet.id}
        snippet={snippet}
        searchQuery={searchQuery}
        onEdit={() => {
          if (editingId === null) setEditingId(snippet.id);
        }}
        onDelete={() => handleDelete(snippet.id)}
      />
    );

  return (
    <div id="snippets-list" className="snippets-list" ref={containerRef}>
      {isLoading && <p className="loading">Loading...</p>}

      {!isLoading && error && <p className="error">{error}</p>}

      {!isLoading && !error && (
        <>
          {editingId === "new" ? (
            <SnippetEditor
              snippet={null}
              onSave={(values) => handleSave(null, values)}
              onCancel={() => setEditingId(null)}
            />
          ) : (
            <div
              className="snippet-add-card"
              id="snippet-add-line"
              onClick={() => {
                if (editingId === null) setEditingId("new");
              }}
            >
              <span className="note-add-icon">+</span>
              <span className="note-add-text">New snippet...</span>
            </div>
          )}

          {snippets.length === 0 && <p className="empty">No snippets yet</p>}

          {snippets.length > 0 && view === "grouped" && (
            <div className="snippet-grouped-view">
              {groups.map(([language, groupItems]) => {
                const isCollapsed = collapsedGroups.has(language);

                return (
                  <div
                    key={language}
                    className={`snippet-group${isCollapsed ? " collapsed" : ""}`}
                    data-language={language}
                  >
                    <div className="snippet-group-header">
                      <button
                        className="btn-toggle-group"
                        data-language={language}
                        title="Toggle"
                        onClick={() => toggleGroup(language)}
                      >
                        <i
                          className={`ph-light ph-caret-down${isCollapsed ? " rotated" : ""}`}
                        />
                      </button>
                      <LanguageIcon language={language} />
                      <span className="snippet-group-lang">{language}</span>
                      <span className="todo-group-count">
                        {groupItems.length}
                      </span>
                    </div>

                    <div className="snippet-group-items">
                      {groupItems.map(renderSnippet)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {snippets.length > 0 &&
            view !== "grouped" &&
            snippets.map(renderSnippet)}
        </>
      )}
    </div>
  );
}
