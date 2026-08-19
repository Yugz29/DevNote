import ProjectSortDropdown from "./ProjectSortDropdown.jsx";
import SidebarPinned from "./SidebarPinned.jsx";
import SidebarProjects from "./SidebarProjects.jsx";
import SidebarResizer from "./SidebarResizer.jsx";

export default function Sidebar({
  user,
  project,
  pinned,
  activeItemId,
  projects,
  isLoading,
  hasError,
  activeProjectId,
  sort,
  onSortChange,
  onSelectProject,
  onDeleteProject,
  onLoadMore,
  onNewProject,
  onBackToWelcome,
  onOpenPinnedDocument,
  onOpenPinnedSnippet,
  onOpenPinnedTodo,
  onChangeTodoStatus,
  onUnpinDocument,
  onUnpinSnippet,
  onUnpinTodo,
  onOpenSearch,
  onOpenSettings,
  onLogout,
  sidebarWidth,
  onSidebarWidthChange,
}) {
  const isProjectContext = Boolean(project);
  const canSort = !isLoading && !hasError && projects.length > 1;

  return (
    <aside className="sidebar">
      <div className={`sidebar-header${isProjectContext ? " is-context" : ""}`}>
        <div className="sidebar-header-left">
          {isProjectContext && (
            <button
              id="back-to-projects"
              className="btn-icon-sm"
              title="Back to projects"
              onClick={onBackToWelcome}
            >
              <i className="ph-light ph-house" />
            </button>
          )}

          <h2
            className={isProjectContext ? "is-context" : undefined}
            title={isProjectContext ? project.title : undefined}
          >
            {isProjectContext ? project.title : "Projects"}
          </h2>
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

          {!isProjectContext && canSort && (
            <ProjectSortDropdown sort={sort} onSortChange={onSortChange} />
          )}

          {!isProjectContext && (
            <button
              id="newProjectBtn"
              className="btn-icon-sm"
              title="New project"
              onClick={onNewProject}
            >
              <i className="ph-light ph-plus" />
            </button>
          )}
        </div>
      </div>

      {isProjectContext ? (
        <SidebarPinned
          projectId={project.id}
          documents={pinned.documents}
          snippets={pinned.snippets}
          todos={pinned.todos}
          isLoading={pinned.isLoading}
          activeItemId={activeItemId}
          onOpenDocument={onOpenPinnedDocument}
          onOpenSnippet={onOpenPinnedSnippet}
          onOpenTodo={onOpenPinnedTodo}
          onChangeTodoStatus={onChangeTodoStatus}
          onUnpinDocument={onUnpinDocument}
          onUnpinSnippet={onUnpinSnippet}
          onUnpinTodo={onUnpinTodo}
        />
      ) : (
        <SidebarProjects
          projects={projects}
          isLoading={isLoading}
          hasError={hasError}
          activeProjectId={activeProjectId}
          onSelectProject={onSelectProject}
          onDeleteProject={onDeleteProject}
          onLoadMore={onLoadMore}
        />
      )}

      <div className="sidebar-footer">
        <span id="sidebar-user-name" className="sidebar-user">
          {user?.email ?? "..."}
        </span>
        <div className="sidebar-footer-actions">
          <button
            id="settings-btn"
            className="btn-icon-sm"
            title="Settings"
            onClick={onOpenSettings}
          >
            <i className="ph-light ph-gear-six" />
          </button>

          <button
            id="logout-btn"
            className="btn-logout"
            title="Logout"
            onClick={onLogout}
          >
            <i className="ph-light ph-sign-out" />
          </button>
        </div>
      </div>
      <SidebarResizer
        width={sidebarWidth}
        onWidthChange={onSidebarWidthChange}
      />
    </aside>
  );
}
