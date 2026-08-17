import { useMemo, useRef, useState } from "react";
import NoteBlock from "./NoteBlock.jsx";
import { useDialog } from "../contexts/DialogContext.js";
import { useResourceList } from "../hooks/useResourceList.js";
import { useSearchTarget } from "../hooks/useSearchTarget.js";
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
  const [collapsedIds, setCollapsedIds] = useState(() =>
    readCollapsedState(projectId),
  );

  const { items, isLoading, error, reload, setItems } = useResourceList({
    projectId,
    fetchPage: getNotes,
    scrollRef,
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
        const created = await createNote(projectId, trimmedTitle, content);
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

  return (
    <div id="notes-list" className="notes-list" ref={containerRef}>
      {isLoading && <p className="loading">Loading...</p>}

      {!isLoading && error && <p className="error">{error}</p>}

      {!isLoading && !error && (
        <>
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

          {notes.length === 0 && <p className="empty">No notes yet</p>}

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
