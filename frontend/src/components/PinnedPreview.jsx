import { useCallback, useEffect, useState } from "react";
import SnippetModal from "./SnippetModal.jsx";
import TodoModal from "./TodoModal.jsx";
import { useDialog } from "../contexts/DialogContext.js";
import { downloadTextFile, toFilename } from "../lib/download.js";
import { languageExtension } from "../lib/languages.js";
import { shouldUnpinOnDone } from "../lib/todoPinRule.js";
import {
  deleteSnippet,
  duplicateSnippet,
  getSnippet,
  setSnippetPinned,
  updateSnippet,
} from "../services/snippetService.js";
import {
  deleteTodo,
  getTodo,
  setTodoPinned,
  updateTodo,
} from "../services/todoService.js";

export default function PinnedPreview({
  target,
  onClose,
  onChanged,
  onReveal,
}) {
  const { showAlert, showConfirm } = useDialog();
  const [item, setItem] = useState(null);
  const [isEditing, setIsEditing] = useState(false);

  const isSnippet = target.type === "snippet";

  useEffect(() => {
    let isStale = false;
    const load = target.type === "snippet" ? getSnippet : getTodo;

    load(target.id)
      .then((loaded) => {
        if (!isStale) setItem(loaded);
      })
      .catch((loadError) => {
        console.error("Error opening the pinned item:", loadError);
        if (!isStale) onClose();
      });

    return () => {
      isStale = true;
    };
  }, [target, onClose]);

  const refresh = useCallback(async () => {
    const load = isSnippet ? getSnippet : getTodo;

    setItem(await load(target.id));
    onChanged();
  }, [isSnippet, target.id, onChanged]);

  const handleTogglePin = async () => {
    const setPinned = isSnippet ? setSnippetPinned : setTodoPinned;

    try {
      await setPinned(target.id, !item.is_pinned);
      await refresh();
    } catch (pinError) {
      console.error("Error pinning the item:", pinError);
      await showAlert(`Unable to pin the ${target.type}`);
    }
  };

  const handleDelete = async () => {
    const confirmed = await showConfirm(`Delete this ${target.type}?`);
    if (!confirmed) return;

    try {
      await (isSnippet ? deleteSnippet : deleteTodo)(target.id);
      onChanged();
      onClose();
    } catch (deleteError) {
      console.error("Error deleting the item:", deleteError);
      await showAlert(`Unable to delete the ${target.type}`);
    }
  };

  const handleSnippetSave = async (values) => {
    const title = values.title.trim();

    if (!title) {
      await showAlert("Title is required", "info");
      return;
    }

    if (!values.content.trim()) {
      await showAlert("Content is required", "info");
      return;
    }

    try {
      await updateSnippet(
        target.id,
        title,
        values.language.trim() || "text",
        values.content,
        values.description.trim(),
      );
      setIsEditing(false);
      await refresh();
    } catch (saveError) {
      console.error("Error saving snippet:", saveError);
      await showAlert("Unable to save the snippet");
    }
  };

  const handleDuplicate = async () => {
    try {
      await duplicateSnippet(target.id);
      onChanged();
      onClose();
    } catch (duplicateError) {
      console.error("Error duplicating snippet:", duplicateError);
      await showAlert("Unable to duplicate the snippet");
    }
  };

  const handleExport = () => {
    downloadTextFile(
      toFilename(item.title, languageExtension(item.language), "snippet"),
      item.content,
      "text/plain",
    );
  };

  const handleTodoField = async (field, value) => {
    if (value === item[field]) return;

    try {
      await updateTodo(
        target.id,
        undefined,
        undefined,
        field === "status" ? value : undefined,
        field === "priority" ? value : undefined,
      );

      if (field === "status" && shouldUnpinOnDone(item, value)) {
        await setTodoPinned(target.id, false);
      }

      await refresh();
    } catch (fieldError) {
      console.error(`Error updating todo ${field}:`, fieldError);
      await showAlert("Unable to update the todo");
    }
  };

  const handleTodoSave = async (values) => {
    const title = values.title.trim();

    if (!title) {
      await showAlert("Title is required", "info");
      return;
    }

    try {
      await updateTodo(
        target.id,
        title,
        values.description.trim(),
        values.status,
        values.priority,
      );

      if (shouldUnpinOnDone(item, values.status)) {
        await setTodoPinned(target.id, false);
      }

      setIsEditing(false);
      await refresh();
    } catch (saveError) {
      console.error("Error saving todo:", saveError);
      await showAlert("Unable to save the todo");
    }
  };

  if (!item) return null;

  if (isSnippet) {
    return (
      <SnippetModal
        snippet={item}
        isEditing={isEditing}
        onEdit={() => setIsEditing(true)}
        onCancelEdit={() => setIsEditing(false)}
        onSave={handleSnippetSave}
        onDuplicate={handleDuplicate}
        onTogglePin={handleTogglePin}
        onExport={handleExport}
        onReveal={onReveal}
        onDelete={handleDelete}
        onClose={onClose}
      />
    );
  }

  return (
    <TodoModal
      todo={item}
      isEditing={isEditing}
      onEdit={() => setIsEditing(true)}
      onCancelEdit={() => setIsEditing(false)}
      onSave={handleTodoSave}
      onStatusChange={(status) => handleTodoField("status", status)}
      onPriorityChange={(priority) => handleTodoField("priority", priority)}
      onTogglePin={handleTogglePin}
      onReveal={onReveal}
      onDelete={handleDelete}
      onClose={onClose}
    />
  );
}
