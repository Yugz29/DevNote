import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import FolderBreadcrumb from "./FolderBreadcrumb.jsx";
import FolderCard from "./FolderCard.jsx";
import MoveDialog from "./MoveDialog.jsx";
import SnippetCard from "./SnippetCard.jsx";
import SnippetEditor from "./SnippetEditor.jsx";
import SnippetModal from "./SnippetModal.jsx";
import LanguageIcon from "./LanguageIcon.jsx";
import { useDialog } from "../contexts/DialogContext.js";
import { downloadTextFile, toFilename } from "../lib/download.js";
import { languageExtension } from "../lib/languages.js";
import {
  EMPTY_LOCATION,
  readLocation,
  writeLocation,
} from "../lib/resourceLocation.js";
import { useResourceList } from "../hooks/useResourceList.js";
import { useSearchTarget } from "../hooks/useSearchTarget.js";
import {
  createFolder,
  deleteFolder,
  getLevelContents,
  moveFolder,
  updateFolder,
} from "../services/folderService.js";
import {
  createSnippet,
  deleteSnippet,
  duplicateSnippet,
  getSnippet,
  moveSnippet,
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
  breadcrumbSlot,
  searchQuery,
  searchItemId,
  openTarget,
  contentVersion,
  onPinnedChanged,
  onActiveItemChange,
  controls,
  onSortableChange,
}) {
  const { showAlert, showConfirm } = useDialog();
  const containerRef = useRef(null);
  const versionRef = useRef(contentVersion);

  const [initialLocation] = useState(() =>
    searchItemId ? EMPTY_LOCATION : readLocation("snippets", projectId),
  );
  const [path, setPath] = useState(initialLocation.path);
  const [unreachableFolderId, setUnreachableFolderId] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [renamingFolderId, setRenamingFolderId] = useState(null);
  const [movingEntry, setMovingEntry] = useState(null);
  const [viewingId, setViewingId] = useState(null);
  const [isEditingViewed, setIsEditingViewed] = useState(false);
  const [draft, setDraft] = useState(null);
  const [collapsedGroups, setCollapsedGroups] = useState(() =>
    readCollapsedGroups(projectId),
  );
  const [externalSnippet, setExternalSnippet] = useState(null);

  const currentFolder = path.length ? path[path.length - 1] : null;
  const currentFolderId = currentFolder?.id ?? null;

  const fetchContents = useMemo(
    () => (id, url) =>
      getLevelContents(projectId, currentFolderId, url, "snippets"),
    [projectId, currentFolderId],
  );

  const { items, isLoading, error, reload, setItems } = useResourceList({
    projectId,
    fetchPage: fetchContents,
    scrollRef,
    resetKey: currentFolderId,
  });

  const restoredFolderId = initialLocation.path.at(-1)?.id ?? null;

  if (
    error &&
    currentFolderId &&
    currentFolderId === restoredFolderId &&
    unreachableFolderId !== currentFolderId
  ) {
    setUnreachableFolderId(currentFolderId);
    setPath([]);
  }

  const folders = useMemo(
    () =>
      items
        .filter((entry) => entry.type === "folder")
        .sort((a, b) => a.name.localeCompare(b.name)),
    [items],
  );

  const snippets = useMemo(
    () =>
      sortSnippets(
        items.filter((entry) => entry.type !== "folder"),
        sort,
      ),
    [items, sort],
  );

  const groups = useMemo(() => groupByLanguage(snippets), [snippets]);

  const viewedSnippet =
    snippets.find((snippet) => snippet.id === viewingId) ??
    (externalSnippet?.id === viewingId ? externalSnippet : null);

  const refreshExternalSnippet = async (snippetId) => {
    if (externalSnippet?.id !== snippetId) return;

    try {
      setExternalSnippet(await getSnippet(snippetId));
    } catch (refreshError) {
      console.error("Error refreshing snippet:", refreshError);
      setExternalSnippet(null);
    }
  };

  useEffect(() => {
    if (!openTarget) return;

    let isStale = false;

    getSnippet(openTarget.itemId)
      .then((snippet) => {
        if (isStale) return;
        setExternalSnippet(snippet);
        setViewingId(snippet.id);
      })
      .catch((openError) => {
        console.error("Error opening snippet:", openError);
      });

    return () => {
      isStale = true;
    };
  }, [openTarget]);

  useEffect(() => {
    onActiveItemChange(viewingId);

    return () => onActiveItemChange(null);
  }, [viewingId, onActiveItemChange]);

  useEffect(() => {
    if (versionRef.current === contentVersion) return;

    versionRef.current = contentVersion;
    reload();
  }, [contentVersion, reload]);

  useEffect(() => {
    writeLocation("snippets", projectId, { path });
  }, [projectId, path]);

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

  const leaveCreation = () => {
    setIsCreating(false);
    setIsCreatingFolder(false);
    setRenamingFolderId(null);
  };

  const openFolder = (folder) => {
    leaveCreation();
    setPath((current) => [...current, { id: folder.id, name: folder.name }]);
  };

  const navigateTo = (index) => {
    leaveCreation();
    setPath((current) => current.slice(0, index + 1));
  };

  const dropEntry = (id) =>
    setItems((current) => current.filter((entry) => entry.id !== id));

  const handleCreateFolder = async (name) => {
    const trimmed = name.trim();
    setIsCreatingFolder(false);

    if (!trimmed) return;

    try {
      const created = await createFolder(
        projectId,
        trimmed,
        currentFolderId,
        "snippets",
      );
      setItems((current) => [{ type: "folder", ...created }, ...current]);
    } catch (createError) {
      console.error("Error creating folder:", createError);
      await showAlert(
        createError.response?.data?.name?.[0] ?? "Unable to create the folder",
      );
    }
  };

  const handleRenameFolder = async (folder, name) => {
    setRenamingFolderId(null);

    try {
      const updated = await updateFolder(folder.id, { name });
      setItems((current) =>
        current.map((entry) =>
          entry.type === "folder" && entry.id === folder.id
            ? { ...entry, ...updated }
            : entry,
        ),
      );
    } catch (renameError) {
      console.error("Error renaming folder:", renameError);
      await showAlert(
        renameError.response?.data?.name?.[0] ?? "Unable to rename the folder",
      );
    }
  };

  const handleDeleteFolder = async (folder) => {
    try {
      await deleteFolder(folder.id);
      dropEntry(folder.id);
      onPinnedChanged();
      return;
    } catch (deleteError) {
      const data = deleteError.response?.data;

      if (deleteError.response?.status !== 409 || !data) {
        console.error("Error deleting folder:", deleteError);
        await showAlert("Unable to delete the folder");
        return;
      }

      const parts = [];
      if (data.folders) {
        parts.push(`${data.folders} subfolder${data.folders > 1 ? "s" : ""}`);
      }
      if (data.snippets) {
        parts.push(`${data.snippets} snippet${data.snippets > 1 ? "s" : ""}`);
      }

      const confirmed = await showConfirm(
        `"${folder.name}" is not empty. Deleting it will also delete ${parts.join(" and ")}. This cannot be undone.`,
        "Delete everything",
      );

      if (!confirmed) return;

      try {
        await deleteFolder(folder.id, { confirm: true });
        dropEntry(folder.id);
        onPinnedChanged();
      } catch (forcedError) {
        console.error("Error deleting folder:", forcedError);
        await showAlert("Unable to delete the folder");
      }
    }
  };

  const handleMove = async ({ project, folder }) => {
    const entry = movingEntry;
    const isFolder = entry.type === "folder";

    try {
      if (isFolder) {
        await moveFolder(entry.id, { project, parent: folder });
      } else {
        await moveSnippet(entry.id, { project, folder });
      }
    } catch (moveError) {
      console.error("Error moving entry:", moveError);

      const data = moveError.response?.data;
      const reason =
        data?.parent?.[0] ??
        data?.folder?.[0] ??
        data?.name?.[0] ??
        data?.detail;

      await showAlert(
        reason ?? `Unable to move the ${isFolder ? "folder" : "snippet"}`,
      );
      return;
    }

    setMovingEntry(null);
    setItems((current) =>
      current
        .filter((item) => item.id !== entry.id)
        .map((item) =>
          item.type === "folder" && item.id === folder
            ? {
                ...item,
                folder_count: item.folder_count + (isFolder ? 1 : 0),
                snippet_count: item.snippet_count + (isFolder ? 0 : 1),
              }
            : item,
        ),
    );
    onPinnedChanged();
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
        await createSnippet(
          projectId,
          title,
          language,
          content,
          description,
          currentFolderId,
        );
      }

      setIsCreating(false);
      setIsEditingViewed(false);
      setDraft(null);
      await Promise.all([reload(), refreshExternalSnippet(snippetId)]);
      onPinnedChanged();
    } catch (saveError) {
      console.error("Error saving snippet:", saveError);
      await showAlert("Unable to save the snippet");
    }
  };

  const handleDuplicate = async (snippetId) => {
    try {
      await duplicateSnippet(snippetId);
      setViewingId(null);
      await reload();
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
      await reload();
      onPinnedChanged();
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
        entry.type !== "folder" && entry.id === snippet.id
          ? { ...entry, is_pinned: nextPinned }
          : entry,
      ),
    );

    await refreshExternalSnippet(snippet.id);
    onPinnedChanged();
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
      onMove={() => setMovingEntry(snippet)}
      onDelete={() => handleDelete(snippet.id)}
    />
  );

  const isEmpty = folders.length === 0 && snippets.length === 0;

  return (
    <div id="snippets-list" className="snippets-list" ref={containerRef}>
      {breadcrumbSlot &&
        createPortal(
          <FolderBreadcrumb path={path} onNavigate={navigateTo} />,
          breadcrumbSlot,
        )}

      <div className="gallery-toolbar">
        <button
          type="button"
          className="gallery-action"
          onClick={() => setIsCreatingFolder(true)}
        >
          <i className="ph-light ph-folder-plus" />
          <span>New folder</span>
        </button>
        <button
          type="button"
          className="gallery-action"
          onClick={() => setIsCreating(true)}
        >
          <i className="ph-light ph-plus" />
          <span>New snippet</span>
        </button>

        <div className="gallery-toolbar-controls">{controls}</div>
      </div>

      {isLoading && <p className="loading">Loading...</p>}

      {!isLoading && error && <p className="error">{error}</p>}

      {!isLoading && !error && (
        <>
          {(isCreatingFolder || folders.length > 0) && (
            <div className="gallery-grid">
              {isCreatingFolder && (
                <FolderCard
                  folder={{ id: "new", name: "" }}
                  searchQuery={null}
                  isRenaming
                  onOpen={() => {}}
                  onStartRename={() => {}}
                  onRename={(_, name) => handleCreateFolder(name)}
                  onCancelRename={() => setIsCreatingFolder(false)}
                  onMove={() => {}}
                  onDelete={() => {}}
                />
              )}

              {folders.map((folder) => (
                <FolderCard
                  key={`folder:${folder.id}:${folder.name}`}
                  folder={folder}
                  searchQuery={searchQuery}
                  isRenaming={renamingFolderId === folder.id}
                  onOpen={openFolder}
                  onStartRename={setRenamingFolderId}
                  onRename={handleRenameFolder}
                  onCancelRename={() => setRenamingFolderId(null)}
                  onMove={setMovingEntry}
                  onDelete={handleDeleteFolder}
                />
              ))}
            </div>
          )}

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

          {isEmpty && !isCreating && !isCreatingFolder && (
            <p className="empty">
              {currentFolderId ? "This folder is empty" : "No snippets yet"}
            </p>
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

      {movingEntry && (
        <MoveDialog
          entry={movingEntry}
          projectId={projectId}
          resourceType="snippets"
          originId={currentFolderId}
          onCancel={() => setMovingEntry(null)}
          onMove={handleMove}
        />
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
