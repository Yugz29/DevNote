import { useEffect, useMemo, useRef, useState } from "react";
import NoteBlock from "./NoteBlock.jsx";
import NoteEditor from "./NoteEditor.jsx";
import { useDialog } from "../contexts/DialogContext.js";
import { useResourceList } from "../hooks/useResourceList.js";
import { useSearchTarget } from "../hooks/useSearchTarget.js";
import { runMermaid } from "../lib/markdown.js";
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

  const [editingId, setEditingId] = useState(null);
  const [collapsedIds, setCollapsedIds] = useState(() =>
    readCollapsedState(projectId),
  );

  const { items, isLoading, error, reload } = useResourceList({
    projectId,
    fetchPage: getNotes,
    scrollRef,
  });

  const notes = useMemo(() => sortNotes(items, sort), [items, sort]);

  useSearchTarget(containerRef, searchItemId, !isLoading && notes.length > 0);

  useEffect(() => {
    runMermaid(containerRef.current);
  }, [notes, searchQuery]);

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
      return;
    }

    try {
      if (noteId) {
        await updateNote(noteId, trimmedTitle, content);
      } else {
        await createNote(projectId, trimmedTitle, content);
      }

      setEditingId(null);
      await reload();
    } catch (saveError) {
      console.error("Error saving note:", saveError);
      await showAlert("Unable to save the note");
    }
  };

  const handleCancel = () => {
    setEditingId(null);
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
            onClick={() => {
              if (editingId === null) setEditingId("new");
            }}
          >
            <span className="note-add-icon">+</span>
            <span className="note-add-text">New note...</span>
          </div>

          {editingId === "new" && (
            <NoteEditor
              note={null}
              onSave={(title, content) => handleSave(null, title, content)}
              onCancel={handleCancel}
            />
          )}

          {notes.length === 0 && <p className="empty">No notes yet</p>}

          {notes.map((note) =>
            editingId === note.id ? (
              <NoteEditor
                key={note.id}
                note={note}
                onSave={(title, content) => handleSave(note.id, title, content)}
                onCancel={handleCancel}
              />
            ) : (
              <NoteBlock
                key={note.id}
                note={note}
                searchQuery={searchQuery}
                isCollapsed={collapsedIds.has(note.id)}
                onToggleCollapse={() => toggleCollapse(note.id)}
                onEdit={() => {
                  if (editingId === null) setEditingId(note.id);
                }}
                onDelete={() => handleDelete(note.id)}
              />
            ),
          )}
        </>
      )}
    </div>
  );
}
