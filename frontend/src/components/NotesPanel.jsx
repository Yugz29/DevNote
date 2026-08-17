import { useMemo, useRef, useState } from "react";
import FolderBreadcrumb from "./FolderBreadcrumb.jsx";
import FolderRow from "./FolderRow.jsx";
import NoteBlock from "./NoteBlock.jsx";
import { useDialog } from "../contexts/DialogContext.js";
import { useFolderLevel } from "../hooks/useFolderLevel.js";
import { useResourceList } from "../hooks/useResourceList.js";
import { useSearchTarget } from "../hooks/useSearchTarget.js";
import {
  createFolder,
  deleteFolder,
  updateFolder,
} from "../services/folderService.js";
import {
  createNote,
  deleteNote,
  getNotes,
  updateNote,
} from "../services/noteService.js";

function sortNotes(notes, sort) {
  return [...notes].sort((a, b) => {
    if (sort === "updated") {
      return new Date(b.updated_at) - new Date(a.updated_at);
    }
    if (sort === "title") {
      return a.title.localeCompare(b.title);
    }
    return new Date(b.created_at) - new Date(a.created_at);
  });
}

function readCollapsedState(projectId) {
  const stored = localStorage.getItem(`devnote_collapsed_${projectId}`);
  return new Set(stored ? JSON.parse(stored) : []);
}

export default function NotesPanel({
  projectId,
  sort,
  scrollRef,
  searchQuery,
  searchItemId,
}) {
  const { showAlert, showConfirm } = useDialog();
  const containerRef = useRef(null);

  const [isCreating, setIsCreating] = useState(false);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [renamingFolderId, setRenamingFolderId] = useState(null);
  const [path, setPath] = useState([]);
  const [collapsedIds, setCollapsedIds] = useState(() =>
    readCollapsedState(projectId),
  );

  const currentFolder = path.length ? path[path.length - 1] : null;
  const currentFolderId = currentFolder?.id ?? null;

  const {
    folders,
    isLoading: isLoadingFolders,
    error: foldersError,
    setFolders,
  } = useFolderLevel(projectId, currentFolderId);

  const fetchNotes = useMemo(
    () => (id, url) => getNotes(id, url, currentFolderId),
    [currentFolderId],
  );

  const { items, isLoading, error, reload, setItems } = useResourceList({
    projectId,
    fetchPage: fetchNotes,
    scrollRef,
    resetKey: currentFolderId,
  });

  const notes = useMemo(() => sortNotes(items, sort), [items, sort]);

  useSearchTarget(containerRef, searchItemId, !isLoading && notes.length > 0);

  const toggleCollapse = (noteId) => {
    const next = new Set(collapsedIds);

    if (next.has(noteId)) {
      next.delete(noteId);
    } else {
      next.add(noteId);
    }

    localStorage.setItem(
      `devnote_collapsed_${projectId}`,
      JSON.stringify([...next]),
    );
    setCollapsedIds(next);
  };

  const openFolder = (folder) => {
    setIsCreating(false);
    setIsCreatingFolder(false);
    setRenamingFolderId(null);
    setPath((current) => [...current, { id: folder.id, name: folder.name }]);
  };

  const navigateTo = (index) => {
    setIsCreating(false);
    setIsCreatingFolder(false);
    setRenamingFolderId(null);
    setPath((current) => current.slice(0, index + 1));
  };

  const handleCreateFolder = async (name) => {
    const trimmed = name.trim();
    setIsCreatingFolder(false);

    if (!trimmed) return;

    try {
      const created = await createFolder(projectId, trimmed, currentFolderId);
      setFolders((current) =>
        [...current, created].sort((a, b) => a.name.localeCompare(b.name)),
      );
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
      setFolders((current) =>
        current
          .map((item) => (item.id === folder.id ? updated : item))
          .sort((a, b) => a.name.localeCompare(b.name)),
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
      setFolders((current) => current.filter((item) => item.id !== folder.id));
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
      if (data.notes) {
        parts.push(`${data.notes} note${data.notes > 1 ? "s" : ""}`);
      }

      const confirmed = await showConfirm(
        `"${folder.name}" is not empty. Deleting it will also delete ${parts.join(" and ")}. This cannot be undone.`,
        "Delete everything",
      );

      if (!confirmed) return;

      try {
        await deleteFolder(folder.id, { confirm: true });
        setFolders((current) =>
          current.filter((item) => item.id !== folder.id),
        );
      } catch (forcedError) {
        console.error("Error deleting folder:", forcedError);
        await showAlert("Unable to delete the folder");
      }
    }
  };

  const handleSave = async (noteId, title, content) => {
    const trimmedTitle = title.trim();

    if (!trimmedTitle) {
      await showAlert("Title is required", "info");
      return false;
    }

    try {
      if (noteId) {
        const updated = await updateNote(noteId, trimmedTitle, content);
        setItems((current) =>
          current.map((item) => (item.id === noteId ? updated : item)),
        );
      } else {
        const created = await createNote(
          projectId,
          trimmedTitle,
          content,
          currentFolderId,
        );
        setItems((current) => [created, ...current]);
      }

      return true;
    } catch (saveError) {
      console.error("Error saving note:", saveError);
      await showAlert("Unable to save the note");
      return false;
    }
  };

  const handleDelete = async (noteId) => {
    const confirmed = await showConfirm("Delete this note?");
    if (!confirmed) return;

    try {
      await deleteNote(noteId);
      await reload();
    } catch (deleteError) {
      console.error("Error deleting note:", deleteError);
      await showAlert("Unable to delete the note");
    }
  };

  const isBusy = isLoading || isLoadingFolders;

  return (
    <div id="notes-list" className="notes-list" ref={containerRef}>
      <FolderBreadcrumb path={path} onNavigate={navigateTo} />

      {isBusy && <p className="loading">Loading...</p>}

      {!isBusy && (error || foldersError) && (
        <p className="error">{error ?? foldersError}</p>
      )}

      {!isBusy && !error && !foldersError && (
        <>
          <div className="folder-list">
            {folders.map((folder) => (
              <FolderRow
                key={`${folder.id}:${folder.name}`}
                folder={folder}
                searchQuery={searchQuery}
                isRenaming={renamingFolderId === folder.id}
                onOpen={openFolder}
                onStartRename={setRenamingFolderId}
                onRename={handleRenameFolder}
                onCancelRename={() => setRenamingFolderId(null)}
                onDelete={handleDeleteFolder}
              />
            ))}

            {isCreatingFolder ? (
              <FolderRow
                folder={{ id: "new", name: "" }}
                searchQuery={null}
                isRenaming
                onOpen={() => {}}
                onStartRename={() => {}}
                onRename={(_, name) => handleCreateFolder(name)}
                onCancelRename={() => setIsCreatingFolder(false)}
                onDelete={() => {}}
              />
            ) : (
              <button
                type="button"
                className="folder-add-line"
                onClick={() => setIsCreatingFolder(true)}
              >
                <i className="ph-light ph-folder-plus" />
                <span>New folder...</span>
              </button>
            )}
          </div>

          <div
            className="note-add-line"
            id="note-add-line"
            onClick={() => setIsCreating(true)}
          >
            <span className="note-add-icon">+</span>
            <span className="note-add-text">New note...</span>
          </div>

          {isCreating && (
            <NoteBlock
              note={null}
              searchQuery={null}
              isCollapsed={false}
              onToggleCollapse={() => {}}
              onSave={handleSave}
              onDiscard={() => setIsCreating(false)}
              onDelete={() => {}}
            />
          )}

          {notes.length === 0 && folders.length === 0 && (
            <p className="empty">This folder is empty</p>
          )}

          {notes.map((note) => (
            <NoteBlock
              key={note.id}
              note={note}
              searchQuery={searchQuery}
              isCollapsed={collapsedIds.has(note.id)}
              onToggleCollapse={() => toggleCollapse(note.id)}
              onSave={handleSave}
              onDiscard={() => {}}
              onDelete={() => handleDelete(note.id)}
            />
          ))}
        </>
      )}
    </div>
  );
}
