import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { CSS } from "@dnd-kit/utilities";
import { useState } from "react";
import CardMenu from "./CardMenu.jsx";
import { useOrder } from "../hooks/useOrder.js";
import { PROJECTS_ORDER_KEY } from "../lib/pinnedSections.js";

function SortableProject({
  project,
  isActive,
  onSelectProject,
  onArchiveProject,
  onDeleteProject,
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: project.id, data: { name: project.title } });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`project-item${isActive ? " active" : ""}${isDragging ? " is-dragging" : ""}`}
      data-id={project.id}
      onClick={() => onSelectProject(project.id)}
    >
      <span className="project-icon">
        <i className="ph-light ph-folder" />
      </span>
      <span className="project-name">{project.title}</span>

      <div
        className="project-item-actions"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="pinned-drag-handle"
          aria-label={`Reorder ${project.title}`}
          {...attributes}
          {...listeners}
        >
          <i className="ph-light ph-dots-six-vertical" />
        </button>

        <CardMenu
          label={`Actions for ${project.title}`}
          items={[
            {
              label: "Archive project",
              icon: "ph-archive",
              onSelect: () => onArchiveProject(project),
            },
            {
              label: "Delete project",
              icon: "ph-trash",
              isDanger: true,
              onSelect: () => onDeleteProject(project),
            },
          ]}
        />
      </div>
    </div>
  );
}

function ArchivedProject({
  project,
  isActive,
  onSelectProject,
  onUnarchiveProject,
  onDeleteProject,
}) {
  return (
    <div
      className={`project-item${isActive ? " active" : ""}`}
      data-id={project.id}
      onClick={() => onSelectProject(project.id)}
    >
      <span className="project-icon">
        <i className="ph-light ph-archive" />
      </span>
      <span className="project-name">{project.title}</span>

      <div
        className="project-item-actions"
        onClick={(event) => event.stopPropagation()}
      >
        <CardMenu
          label={`Actions for ${project.title}`}
          items={[
            {
              label: "Unarchive project",
              icon: "ph-arrow-counter-clockwise",
              onSelect: () => onUnarchiveProject(project),
            },
            {
              label: "Delete project",
              icon: "ph-trash",
              isDanger: true,
              onSelect: () => onDeleteProject(project),
            },
          ]}
        />
      </div>
    </div>
  );
}

export default function SidebarProjects({
  projects,
  archivedProjects,
  isLoading,
  hasError,
  activeProjectId,
  onSelectProject,
  onArchiveProject,
  onUnarchiveProject,
  onDeleteProject,
  onLoadMore,
}) {
  const { ordered, store } = useOrder(PROJECTS_ORDER_KEY, projects);
  const [isArchivedOpen, setIsArchivedOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleScroll = (event) => {
    const element = event.currentTarget;
    const distanceFromBottom =
      element.scrollHeight - element.scrollTop - element.clientHeight;

    if (distanceFromBottom < 100) onLoadMore();
  };

  const handleDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return;

    const oldIndex = ordered.findIndex((entry) => entry.id === active.id);
    const newIndex = ordered.findIndex((entry) => entry.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    store(arrayMove(ordered, oldIndex, newIndex));
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis]}
      onDragEnd={handleDragEnd}
    >
      <div id="projects-list" onScroll={handleScroll}>
        {isLoading && <p className="loading">Loading projects...</p>}

        {!isLoading && hasError && (
          <p style={{ padding: "20px", color: "#888" }}>
            Error loading projects
          </p>
        )}

        {!isLoading && !hasError && projects.length === 0 && (
          <div className="projects-empty">
            <i className="ph-light ph-folder-open" />
            <p>No projects yet</p>
            <span>
              Create your first project
              <br />
              to get started
            </span>
          </div>
        )}

        {!isLoading && !hasError && (
          <SortableContext
            items={ordered.map((project) => project.id)}
            strategy={verticalListSortingStrategy}
          >
            {ordered.map((project) => (
              <SortableProject
                key={project.id}
                project={project}
                isActive={project.id === activeProjectId}
                onSelectProject={onSelectProject}
                onArchiveProject={onArchiveProject}
                onDeleteProject={onDeleteProject}
              />
            ))}
          </SortableContext>
        )}

        {!isLoading && !hasError && archivedProjects.length > 0 && (
          <div className="projects-archived">
            <button
              type="button"
              className="projects-archived-header"
              aria-expanded={isArchivedOpen}
              onClick={() => setIsArchivedOpen((current) => !current)}
            >
              <i
                className={`ph-light ph-caret-down${isArchivedOpen ? "" : " rotated"}`}
              />
              <span>Archived</span>
              <span className="projects-archived-count">
                {archivedProjects.length}
              </span>
            </button>

            {isArchivedOpen &&
              archivedProjects.map((project) => (
                <ArchivedProject
                  key={project.id}
                  project={project}
                  isActive={project.id === activeProjectId}
                  onSelectProject={onSelectProject}
                  onUnarchiveProject={onUnarchiveProject}
                  onDeleteProject={onDeleteProject}
                />
              ))}
          </div>
        )}
      </div>
    </DndContext>
  );
}
