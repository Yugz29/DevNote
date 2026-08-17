import { useCallback, useRef, useState } from "react";
import { useClickOutside } from "../hooks/useClickOutside.js";
import { updateProject } from "../services/projectService.js";

export default function ProjectHeader({
  project,
  onProjectUpdated,
  onDeleteProject,
}) {
  const titleRef = useRef(null);
  const descriptionRef = useRef(null);
  const menuRef = useRef(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const closeMenu = useCallback(() => setIsMenuOpen(false), []);
  useClickOutside(menuRef, closeMenu, isMenuOpen);

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
        const updated = await updateProject(
          project.id,
          updatedTitle,
          updatedDescription,
        );
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

  return (
    <header className="project-header">
      <div className="project-header-left">
        <div>
          <h1
            id="project-title"
            ref={titleRef}
            onClick={() => startInlineEdit("title")}
          >
            {project.title}
          </h1>
          <p
            id="project-description"
            className="project-description"
            ref={descriptionRef}
            onClick={() => startInlineEdit("description")}
          >
            {project.description || ""}
          </p>
        </div>
      </div>

      <div className="project-menu-wrap" ref={menuRef}>
        <button
          id="project-menu-btn"
          className={`btn-project-menu${isMenuOpen ? " open" : ""}`}
          title="Project settings"
          onClick={() => setIsMenuOpen((current) => !current)}
        >
          <i className="ph-light ph-dots-three" />
        </button>

        <div
          id="project-menu-dropdown"
          className={`project-menu-dropdown${isMenuOpen ? " open" : ""}`}
        >
          <button
            className="project-menu-item project-menu-item--danger"
            onClick={() => {
              setIsMenuOpen(false);
              onDeleteProject();
            }}
          >
            <i className="ph-light ph-trash" />
            Delete project
          </button>
        </div>
      </div>
    </header>
  );
}
