import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import FolderBreadcrumb from "./FolderBreadcrumb.jsx";
import FolderCard from "./FolderCard.jsx";
import MoveDialog from "./MoveDialog.jsx";
import NoteBlock from "./NoteBlock.jsx";
import NoteCard from "./NoteCard.jsx";
import { useDialog } from "../contexts/DialogContext.js";
import { useResourceList } from "../hooks/useResourceList.js";
import { useSearchTarget } from "../hooks/useSearchTarget.js";
import {
  createFolder,
  deleteFolder,
  getLevelContents,
  updateFolder,
} from "../services/folderService.js";
import {
  createNote,
  deleteNote,
  duplicateNote,
  getNote,
  getPinnedNotes,
  moveNote,
  setNotePinned,
  updateNote,
} from "../services/noteService.js";

function sortEntries(entries, sort) {
  const folders = entries.filter((entry) => entry.type === "folder");
  const notes = entries.filter((entry) => entry.type !== "folder");

  folders.sort((a, b) => a.name.localeCompare(b.name));

  notes.sort((a, b) => {
    if (sort === "updated") {
      return new Date(b.updated_at) - new Date(a.updated_at);
    }
    if (sort === "title") {
      return a.title.localeCompare(b.title);
    }
    return new Date(b.created_at) - new Date(a.created_at);
  });

  return [...folders, ...notes];
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
  const detailRef = useRef(null);

  const [path, setPath] = useState([]);
  const [openNote, setOpenNote] = useState(null);
  const [isCreatingNote, setIsCreatingNote] = useState(false);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [renamingFolderId, setRenamingFolderId] = useState(null);
  const [movingEntry, setMovingEntry] = useState(null);
  const [pinned, setPinned] = useState({ items: [], count: 0 });

  const currentFolder = path.length ? path[path.length - 1] : null;
  const currentFolderId = currentFolder?.id ?? null;

  const fetchContents = useMemo(
    () => (id, url) => getLevelContents(projectId, currentFolderId, url),
    [projectId, currentFolderId],
  );

  const { items, isLoading, error, reload, setItems } = useResourceList({
    projectId,
    fetchPage: fetchContents,
    scrollRef,
    resetKey: currentFolderId,
  });

  const entries = useMemo(() => sortEntries(items, sort), [items, sort]);

  const pinnedEntries = useMemo(
    () => sortEntries(pinned.items, sort),
    [pinned.items, sort],
  );

  useSearchTarget(containerRef, searchItemId, !isLoading && entries.length > 0);

  const loadPinned = useCallback(() => {
    if (!projectId) return Promise.resolve();

    return getPinnedNotes(projectId)
      .then((data) => {
        const results = data.results ?? data;
        setPinned({ items: results, count: data.count ?? results.length });
      })
      .catch((pinnedError) => {
        console.error("Error loading pinned notes:", pinnedError);
        setPinned({ items: [], count: 0 });
      });
  }, [projectId]);

  useEffect(() => {
    loadPinned();
  }, [loadPinned]);

  const flushDetail = async () => {
    await detailRef.current?.flush();
  };

  const openNoteCard = async (card) => {
    try {
      setOpenNote(await getNote(card.id));
    } catch (openError) {
      console.error("Error opening note:", openError);
      await showAlert("Unable to open the note");
    }
  };

  const leaveDetail = async () => {
    await flushDetail();
    setOpenNote(null);
    setIsCreatingNote(false);
    await Promise.all([reload(), loadPinned()]);
  };

  const openFolder = async (folder) => {
    await leaveDetail();
    setIsCreatingFolder(false);
    setRenamingFolderId(null);
    setPath((current) => [...current, { id: folder.id, name: folder.name }]);
  };

  const navigateTo = async (index) => {
    await leaveDetail();
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

  const dropEntry = (id) =>
    setItems((current) => current.filter((entry) => entry.id !== id));

  const handleMove = async (destinationId) => {
    const entry = movingEntry;
    const isFolder = entry.type === "folder";

    try {
      if (isFolder) {
        await updateFolder(entry.id, { parent: destinationId });
      } else {
        await moveNote(entry.id, destinationId);
      }
    } catch (moveError) {
      console.error("Error moving entry:", moveError);

      const data = moveError.response?.data;
      const reason = data?.parent?.[0] ?? data?.folder?.[0] ?? data?.name?.[0];

      await showAlert(
        reason ?? `Unable to move the ${isFolder ? "folder" : "note"}`,
      );
      return;
    }

    setMovingEntry(null);
    setItems((current) =>
      current
        .filter((item) => item.id !== entry.id)
        .map((item) =>
          item.type === "folder" && item.id === destinationId
            ? {
                ...item,
                folder_count: item.folder_count + (isFolder ? 1 : 0),
                note_count: item.note_count + (isFolder ? 0 : 1),
              }
            : item,
        ),
    );
  };

  const handleDeleteFolder = async (folder) => {
    try {
      await deleteFolder(folder.id);
      dropEntry(folder.id);
      await loadPinned();
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
        dropEntry(folder.id);
        await loadPinned();
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
        setOpenNote((current) =>
          current && current.id === noteId
            ? { ...current, ...updated }
            : current,
        );
      } else {
        await createNote(projectId, trimmedTitle, content, currentFolderId);
      }

      return true;
    } catch (saveError) {
      console.error("Error saving note:", saveError);
      await showAlert("Unable to save the note");
      return false;
    }
  };

  const handleTogglePin = async (note) => {
    const nextPinned = !note.is_pinned;

    try {
      await setNotePinned(note.id, nextPinned);
    } catch (pinError) {
      console.error("Error pinning note:", pinError);
      await showAlert(`Unable to ${nextPinned ? "pin" : "unpin"} the note`);
      return;
    }

    setItems((current) =>
      current.map((entry) =>
        entry.type !== "folder" && entry.id === note.id
          ? { ...entry, is_pinned: nextPinned }
          : entry,
      ),
    );

    if (pinned.count > pinned.items.length) {
      await loadPinned();
      return;
    }

    setPinned((current) => {
      const without = current.items.filter((entry) => entry.id !== note.id);

      return {
        items: nextPinned
          ? [{ ...note, is_pinned: true }, ...without]
          : without,
        count: current.count + (nextPinned ? 1 : -1),
      };
    });
  };

  const handleDuplicateNote = async (note) => {
    try {
      await duplicateNote(note.id);
      await reload();
    } catch (duplicateError) {
      console.error("Error duplicating note:", duplicateError);
      await showAlert("Unable to duplicate the note");
    }
  };

  const handleDeleteNote = async (note) => {
    const confirmed = await showConfirm(`Delete "${note.title}"?`);
    if (!confirmed) return;

    try {
      await deleteNote(note.id);
      dropEntry(note.id);
      setPinned((current) => {
        const items = current.items.filter((entry) => entry.id !== note.id);

        return items.length === current.items.length
          ? current
          : { items, count: current.count - 1 };
      });
      if (openNote?.id === note.id) setOpenNote(null);
    } catch (deleteError) {
      console.error("Error deleting note:", deleteError);
      await showAlert("Unable to delete the note");
    }
  };

  const detailNote = isCreatingNote ? null : openNote;
  const isDetail = isCreatingNote || Boolean(openNote);

  return (
    <div id="notes-list" className="notes-list" ref={containerRef}>
      <FolderBreadcrumb
        path={path}
        isDetail={isDetail}
        onNavigate={navigateTo}
      />

      {isDetail ? (
        <NoteBlock
          key={openNote?.id ?? "new"}
          ref={detailRef}
          note={detailNote}
          searchQuery={searchQuery}
          onSave={handleSave}
          onDiscard={leaveDetail}
          onDelete={() => detailNote && handleDeleteNote(detailNote)}
        />
      ) : (
        <>
          {pinnedEntries.length > 0 && (
            <section className="gallery-pinned">
              <div className="gallery-pinned-header">
                <i className="ph-light ph-push-pin" />
                <span>Pinned</span>
                {pinned.count > pinnedEntries.length && (
                  <span className="gallery-pinned-count">
                    showing {pinnedEntries.length} of {pinned.count}
                  </span>
                )}
              </div>

              <div className="gallery-grid">
                {pinnedEntries.map((entry) => (
                  <NoteCard
                    key={`pinned:${entry.id}`}
                    note={entry}
                    searchQuery={searchQuery}
                    onOpen={openNoteCard}
                    onTogglePin={handleTogglePin}
                  />
                ))}
              </div>
            </section>
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
              onClick={() => setIsCreatingNote(true)}
            >
              <i className="ph-light ph-plus" />
              <span>New note</span>
            </button>
          </div>

          {isLoading && <p className="loading">Loading...</p>}

          {!isLoading && error && <p className="error">{error}</p>}

          {!isLoading && !error && (
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

              {entries.map((entry) =>
                entry.type === "folder" ? (
                  <FolderCard
                    key={`folder:${entry.id}:${entry.name}`}
                    folder={entry}
                    searchQuery={searchQuery}
                    isRenaming={renamingFolderId === entry.id}
                    onOpen={openFolder}
                    onStartRename={setRenamingFolderId}
                    onRename={handleRenameFolder}
                    onCancelRename={() => setRenamingFolderId(null)}
                    onMove={setMovingEntry}
                    onDelete={handleDeleteFolder}
                  />
                ) : (
                  <NoteCard
                    key={`note:${entry.id}`}
                    note={entry}
                    searchQuery={searchQuery}
                    onOpen={openNoteCard}
                    onTogglePin={handleTogglePin}
                    onDuplicate={handleDuplicateNote}
                    onMove={setMovingEntry}
                    onDelete={handleDeleteNote}
                  />
                ),
              )}

              {entries.length === 0 && !isCreatingFolder && (
                <p className="empty">This folder is empty</p>
              )}
            </div>
          )}
        </>
      )}

      {movingEntry && (
        <MoveDialog
          entry={movingEntry}
          projectId={projectId}
          originId={currentFolderId}
          onCancel={() => setMovingEntry(null)}
          onMove={handleMove}
        />
      )}
    </div>
  );
}
