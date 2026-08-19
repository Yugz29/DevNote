import CardMenu from "./CardMenu.jsx";

export default function SidebarProjects({
  projects,
  isLoading,
  hasError,
  activeProjectId,
  onSelectProject,
  onDeleteProject,
  onLoadMore,
}) {
  const handleScroll = (event) => {
    const element = event.currentTarget;
    const distanceFromBottom =
      element.scrollHeight - element.scrollTop - element.clientHeight;

    if (distanceFromBottom < 100) onLoadMore();
  };

  return (
    <div id="projects-list" onScroll={handleScroll}>
      {isLoading && <p className="loading">Loading projects...</p>}

      {!isLoading && hasError && (
        <p style={{ padding: "20px", color: "#888" }}>Error loading projects</p>
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

      {!isLoading &&
        !hasError &&
        projects.map((project) => (
          <div
            key={project.id}
            className={`project-item${project.id === activeProjectId ? " active" : ""}`}
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
              <CardMenu
                label={`Actions for ${project.title}`}
                items={[
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
        ))}
    </div>
  );
}
