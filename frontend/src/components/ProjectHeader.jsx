import { useRef, useState } from "react";
import { formatDueDate } from "../lib/dueDate.js";
import { updateProject } from "../services/projectService.js";

export default function ProjectHeader({
  project,
  onProjectUpdated,
  actionsRef,
}) {
  const titleRef = useRef(null);
  const descriptionRef = useRef(null);
  const dueDateRef = useRef(null);

  const hasDescription = Boolean(project.description?.trim());

  const [isDescriptionOpen, setIsDescriptionOpen] = useState(!hasDescription);
  const [describedProjectId, setDescribedProjectId] = useState(project.id);

  if (describedProjectId !== project.id) {
    setDescribedProjectId(project.id);
    setIsDescriptionOpen(!hasDescription);
  }

  const startInlineEdit = (field) => {
    const element =
      field === "title" ? titleRef.current : descriptionRef.current;

    if (!element || element.contentEditable === "true") return;

    const original = element.textContent;
    element.contentEditable = "true";
    element.focus();

    const range = document.createRange();
    const selection = window.getSelection();
    range.selectNodeContents(element);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);

    const save = async () => {
      element.removeEventListener("keydown", onKeyDown);
      element.contentEditable = "false";
      const newValue = element.textContent.trim();

      if (!newValue || newValue === original) {
        element.textContent = original;
        return;
      }

      const updatedTitle = field === "title" ? newValue : project.title;
      const updatedDescription =
        field === "description" ? newValue : project.description || "";

      try {
        const updated = await updateProject(project.id, {
          title: updatedTitle,
          description: updatedDescription,
        });
        onProjectUpdated(updated);
      } catch (error) {
        console.error("Failed to update project:", error);
        element.textContent = original;
      }
    };

    const cancel = () => {
      element.contentEditable = "false";
      element.textContent = original;
    };

    function onKeyDown(event) {
      if (field === "title" && event.key === "Enter") {
        event.preventDefault();
        element.blur();
        return;
      }

      if (event.key === "Escape") {
        element.removeEventListener("blur", save);
        element.removeEventListener("keydown", onKeyDown);
        cancel();
      }
    }

    element.addEventListener("blur", save, { once: true });
    element.addEventListener("keydown", onKeyDown);
  };

  const changeDueDate = async (value) => {
    try {
      const updated = await updateProject(project.id, {
        due_date: value || null,
      });
      onProjectUpdated(updated);
    } catch (error) {
      console.error("Failed to update project due date:", error);
    }
  };

  const openDuePicker = () => {
    const input = dueDateRef.current;

    if (!input) return;

    if (typeof input.showPicker === "function") {
      input.showPicker();
      return;
    }

    input.focus();
  };

  return (
    <header className="project-header">
      <div className="project-header-left">
        <div>
          <div className="project-title-row">
            <h1
              id="project-title"
              ref={titleRef}
              onClick={() => startInlineEdit("title")}
            >
              {project.title}
            </h1>

            <button
              type="button"
              className="btn-toggle-group project-description-toggle"
              title={
                isDescriptionOpen ? "Hide description" : "Show description"
              }
              aria-expanded={isDescriptionOpen}
              aria-controls="project-description"
              onClick={() => setIsDescriptionOpen((current) => !current)}
            >
              <i
                className={`ph-light ph-caret-down${isDescriptionOpen ? "" : " rotated"}`}
              />
            </button>
          </div>

          <p
            id="project-description"
            className={`project-description${isDescriptionOpen ? "" : " collapsed"}`}
            ref={descriptionRef}
            onClick={() => startInlineEdit("description")}
          >
            {project.description || ""}
          </p>

          <div className="project-due-date">
            <input
              id="project-due-date"
              className="project-due-date-input"
              ref={dueDateRef}
              type="date"
              tabIndex={-1}
              aria-hidden="true"
              value={project.due_date ?? ""}
              onChange={(event) => changeDueDate(event.target.value)}
            />

            {project.due_date ? (
              <>
                <button
                  type="button"
                  className="project-due-date-value"
                  title="Change due date"
                  onClick={openDuePicker}
                >
                  Due {formatDueDate(project.due_date)}
                </button>

                <button
                  type="button"
                  className="project-due-date-clear"
                  aria-label="Clear due date"
                  title="Clear due date"
                  onClick={() => changeDueDate(null)}
                >
                  <i className="ph-light ph-x" />
                </button>
              </>
            ) : (
              <button
                type="button"
                className="project-due-date-add"
                onClick={openDuePicker}
              >
                <i className="ph-light ph-plus" />
                <span>Add due date</span>
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="project-header-actions" ref={actionsRef} />
    </header>
  );
}
