import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import SnippetCard from "./SnippetCard.jsx";
import SnippetEditor from "./SnippetEditor.jsx";
import SnippetModal from "./SnippetModal.jsx";
import LanguageIcon from "./LanguageIcon.jsx";
import { useDialog } from "../contexts/DialogContext.js";
import { downloadTextFile, toFilename } from "../lib/download.js";
import { languageExtension } from "../lib/languages.js";
import { useResourceList } from "../hooks/useResourceList.js";
import { useSearchTarget } from "../hooks/useSearchTarget.js";
import {
  createSnippet,
  deleteSnippet,
  duplicateSnippet,
  getPinnedSnippets,
  getSnippets,
  setSnippetPinned,
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

  const [isCreating, setIsCreating] = useState(false);
  const [viewingId, setViewingId] = useState(null);
  const [isEditingViewed, setIsEditingViewed] = useState(false);
  const [draft, setDraft] = useState(null);
  const [collapsedGroups, setCollapsedGroups] = useState(() =>
    readCollapsedGroups(projectId),
  );
  const [pinned, setPinned] = useState({ items: [], count: 0 });

  const { items, isLoading, error, reload, setItems } = useResourceList({
    projectId,
    fetchPage: getSnippets,
    scrollRef,
  });

  const snippets = useMemo(() => sortSnippets(items, sort), [items, sort]);
  const groups = useMemo(() => groupByLanguage(snippets), [snippets]);
  const pinnedSnippets = useMemo(
    () => sortSnippets(pinned.items, sort),
    [pinned.items, sort],
  );
  const viewedSnippet =
    snippets.find((snippet) => snippet.id === viewingId) ??
    pinnedSnippets.find((snippet) => snippet.id === viewingId);

  const loadPinned = useCallback(() => {
    if (!projectId) return Promise.resolve();

    return getPinnedSnippets(projectId)
      .then((data) => {
        const results = data.results ?? data;
        setPinned({ items: results, count: data.count ?? results.length });
      })
      .catch((pinnedError) => {
        console.error("Error loading pinned snippets:", pinnedError);
        setPinned({ items: [], count: 0 });
      });
  }, [projectId]);

  useEffect(() => {
    loadPinned();
  }, [loadPinned]);

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

      setIsCreating(false);
      setIsEditingViewed(false);
      setDraft(null);
      await Promise.all([reload(), loadPinned()]);
    } catch (saveError) {
      console.error("Error saving snippet:", saveError);
      await showAlert("Unable to save the snippet");
    }
  };

  const handleDuplicate = async (snippetId) => {
    try {
      await duplicateSnippet(snippetId);
      setViewingId(null);
      await Promise.all([reload(), loadPinned()]);
    } catch (duplicateError) {
      console.error("Error duplicating snippet:", duplicateError);
      await showAlert("Unable to duplicate the snippet");
    }
  };

  const handleDelete = async (snippetId) => {
    const confirmed = await showConfirm("Delete this snippet?");
    if (!confirmed) return;

    try {
      await deleteSnippet(snippetId);
      setViewingId((current) => (current === snippetId ? null : current));
      await Promise.all([reload(), loadPinned()]);
    } catch (deleteError) {
      console.error("Error deleting snippet:", deleteError);
      await showAlert("Unable to delete the snippet");
    }
  };

  const handleTogglePin = async (snippet) => {
    const nextPinned = !snippet.is_pinned;

    try {
      await setSnippetPinned(snippet.id, nextPinned);
    } catch (pinError) {
      console.error("Error pinning snippet:", pinError);
      await showAlert(`Unable to ${nextPinned ? "pin" : "unpin"} the snippet`);
      return;
    }

    setItems((current) =>
      current.map((entry) =>
        entry.id === snippet.id ? { ...entry, is_pinned: nextPinned } : entry,
      ),
    );

    if (pinned.count > pinned.items.length) {
      await loadPinned();
      return;
    }

    setPinned((current) => {
      const without = current.items.filter((entry) => entry.id !== snippet.id);

      return {
        items: nextPinned
          ? [{ ...snippet, is_pinned: true }, ...without]
          : without,
        count: current.count + (nextPinned ? 1 : -1),
      };
    });
  };

  const handleExport = (snippet) => {
    downloadTextFile(
      toFilename(snippet.title, languageExtension(snippet.language), "snippet"),
      snippet.content,
      "text/plain",
    );
  };

  const renderSnippet = (snippet) => (
    <SnippetCard
      key={snippet.id}
      snippet={snippet}
      searchQuery={searchQuery}
      onOpen={() => setViewingId(snippet.id)}
      onDuplicate={() => handleDuplicate(snippet.id)}
      onTogglePin={() => handleTogglePin(snippet)}
      onExport={() => handleExport(snippet)}
      onDelete={() => handleDelete(snippet.id)}
    />
  );

  return (
    <div id="snippets-list" className="snippets-list" ref={containerRef}>
      {!isLoading && !error && pinnedSnippets.length > 0 && (
        <section className="gallery-pinned">
          <div className="gallery-pinned-header">
            <i className="ph-light ph-push-pin" />
            <span>Pinned</span>
            {pinned.count > pinnedSnippets.length && (
              <span className="gallery-pinned-count">
                showing {pinnedSnippets.length} of {pinned.count}
              </span>
            )}
          </div>

          <div className="snippet-pinned-items">
            {pinnedSnippets.map(renderSnippet)}
          </div>
        </section>
      )}

      <div className="gallery-toolbar">
        <button
          type="button"
          className="gallery-action"
          onClick={() => setIsCreating(true)}
        >
          <i className="ph-light ph-plus" />
          <span>New snippet</span>
        </button>
      </div>

      {isLoading && <p className="loading">Loading...</p>}

      {!isLoading && error && <p className="error">{error}</p>}

      {!isLoading && !error && (
        <>
          {isCreating && (
            <SnippetEditor
              snippet={null}
              onSave={(values) => handleSave(null, values)}
              onCancel={() => setIsCreating(false)}
              onExpand={(values) => {
                setIsCreating(false);
                setDraft(values);
              }}
            />
          )}

          {snippets.length === 0 && !isCreating && (
            <p className="empty">No snippets yet</p>
          )}

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

      {draft && (
        <SnippetModal
          snippet={draft}
          isEditing
          onCancelEdit={() => setDraft(null)}
          onSave={(values) => handleSave(null, values)}
          onClose={() => setDraft(null)}
        />
      )}

      {viewedSnippet && (
        <SnippetModal
          snippet={viewedSnippet}
          isEditing={isEditingViewed}
          onEdit={() => setIsEditingViewed(true)}
          onCancelEdit={() => setIsEditingViewed(false)}
          onSave={(values) => handleSave(viewedSnippet.id, values)}
          onDuplicate={() => handleDuplicate(viewedSnippet.id)}
          onTogglePin={() => handleTogglePin(viewedSnippet)}
          onExport={() => handleExport(viewedSnippet)}
          onDelete={() => handleDelete(viewedSnippet.id)}
          onClose={() => {
            setIsEditingViewed(false);
            setViewingId(null);
          }}
        />
      )}
    </div>
  );
}
