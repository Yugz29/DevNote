import ProjectSortDropdown from "./ProjectSortDropdown.jsx";

export default function Sidebar({
  user,
  projects,
  isLoading,
  hasError,
  activeProjectId,
  sort,
  onSortChange,
  onSelectProject,
  onLoadMore,
  onNewProject,
  onOpenSearch,
  onCloseSidebar,
  onLogout,
}) {
  const canSort = !isLoading && !hasError && projects.length > 1;

  const handleScroll = (event) => {
    const element = event.currentTarget;
    const distanceFromBottom =
      element.scrollHeight - element.scrollTop - element.clientHeight;

    if (distanceFromBottom < 100) onLoadMore();
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-header-left">
          <button
            id="sidebar-toggle"
            className="btn-icon-sm"
            title="Close sidebar"
            onClick={onCloseSidebar}
          >
            <i className="ph-light ph-list" />
          </button>
          <h2>Projects</h2>
        </div>

        <div className="sidebar-header-right">
          <button
            id="search-btn"
            className="btn-icon-sm"
            title="Search (⌘K)"
            onClick={onOpenSearch}
          >
            <i className="ph-light ph-magnifying-glass" />
          </button>

          {canSort && (
            <ProjectSortDropdown sort={sort} onSortChange={onSortChange} />
          )}

          <button
            id="newProjectBtn"
            className="btn-icon-sm"
            title="New project"
            onClick={onNewProject}
          >
            <i className="ph-light ph-plus" />
          </button>
        </div>
      </div>

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
            </div>
          ))}
      </div>

      <div className="sidebar-footer">
        <span id="sidebar-user-name" className="sidebar-user">
          {user?.email ?? "..."}
        </span>
        <button
          id="logout-btn"
          className="btn-logout"
          title="Logout"
          onClick={onLogout}
        >
          <i className="ph-light ph-sign-out" />
        </button>
      </div>
    </aside>
  );
}
