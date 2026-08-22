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
import { useMemo } from "react";
import CardMenu from "./CardMenu.jsx";
import { useOrder } from "../hooks/useOrder.js";

function SortableProject({
  project,
  isActive,
  isArchivedMode,
  onSelectProject,
  onToggleFavorite,
  onArchiveProject,
  onUnarchiveProject,
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

      {!isArchivedMode && (
        <button
          type="button"
          className={`project-favorite-toggle${project.is_favorite ? " is-active" : ""}`}
          aria-pressed={project.is_favorite}
          title={
            project.is_favorite ? "Remove from favorites" : "Add to favorites"
          }
          onClick={(event) => {
            event.stopPropagation();
            onToggleFavorite(project);
          }}
        >
          <i
            className={`ph-light ${project.is_favorite ? "ph-star-fill" : "ph-star"}`}
          />
        </button>
      )}

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
            isArchivedMode
              ? {
                  label: "Unarchive project",
                  icon: "ph-arrow-counter-clockwise",
                  onSelect: () => onUnarchiveProject(project),
                }
              : {
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

export default function SidebarProjects({
  projects,
  isArchivedMode,
  orderKey,
  favoritesOrderKey,
  isLoading,
  hasError,
  activeProjectId,
  onSelectProject,
  onToggleFavorite,
  onArchiveProject,
  onUnarchiveProject,
  onDeleteProject,
  onLoadMore,
}) {
  const favorites = useMemo(
    () =>
      isArchivedMode ? [] : projects.filter((project) => project.is_favorite),
    [isArchivedMode, projects],
  );

  const others = useMemo(
    () =>
      isArchivedMode
        ? projects
        : projects.filter((project) => !project.is_favorite),
    [isArchivedMode, projects],
  );

  const { ordered: orderedFavorites, store: storeFavorites } = useOrder(
    favoritesOrderKey,
    favorites,
  );
  const { ordered, store } = useOrder(orderKey, others);

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

    const sections = [
      { items: orderedFavorites, store: storeFavorites },
      { items: ordered, store },
    ];

    for (const section of sections) {
      const oldIndex = section.items.findIndex(
        (entry) => entry.id === active.id,
      );
      const newIndex = section.items.findIndex((entry) => entry.id === over.id);

      if (oldIndex === -1 || newIndex === -1) continue;

      section.store(arrayMove(section.items, oldIndex, newIndex));
      return;
    }
  };

  const renderProject = (project) => (
    <SortableProject
      key={project.id}
      project={project}
      isActive={project.id === activeProjectId}
      isArchivedMode={isArchivedMode}
      onSelectProject={onSelectProject}
      onToggleFavorite={onToggleFavorite}
      onArchiveProject={onArchiveProject}
      onUnarchiveProject={onUnarchiveProject}
      onDeleteProject={onDeleteProject}
    />
  );

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
            <p>{isArchivedMode ? "No archived projects" : "No projects yet"}</p>
            <span>
              {isArchivedMode ? (
                "Archived projects will show up here"
              ) : (
                <>
                  Create your first project
                  <br />
                  to get started
                </>
              )}
            </span>
          </div>
        )}

        {!isLoading && !hasError && orderedFavorites.length > 0 && (
          <section className="projects-favorites">
            <div className="projects-section-header">
              <span>Favorites</span>
            </div>

            <SortableContext
              items={orderedFavorites.map((project) => project.id)}
              strategy={verticalListSortingStrategy}
            >
              {orderedFavorites.map(renderProject)}
            </SortableContext>
          </section>
        )}

        {!isLoading && !hasError && (
          <SortableContext
            items={ordered.map((project) => project.id)}
            strategy={verticalListSortingStrategy}
          >
            {ordered.map(renderProject)}
          </SortableContext>
        )}
      </div>
    </DndContext>
  );
}
