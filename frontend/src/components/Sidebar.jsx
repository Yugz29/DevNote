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
  isArchivedMode,
  orderKey,
  favoritesOrderKey,
  isLoading,
  hasError,
  activeProjectId,
  sort,
  onSortChange,
  onToggleArchived,
  onSelectProject,
  onToggleFavorite,
  onArchiveProject,
  onUnarchiveProject,
  onDeleteProject,
  onLoadMore,
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
          {isProjectContext && (
            <button
              id="search-btn"
              className="btn-icon-sm"
              title="Search (⌘K)"
              onClick={onOpenSearch}
            >
              <i className="ph-light ph-magnifying-glass" />
            </button>
          )}

          {!isProjectContext && (
            <button
              id="archived-projects-btn"
              className={`btn-icon-sm${isArchivedMode ? " active" : ""}`}
              title={
                isArchivedMode
                  ? "Show active projects"
                  : "Show archived projects"
              }
              aria-pressed={isArchivedMode}
              onClick={onToggleArchived}
            >
              <i className="ph-light ph-archive" />
            </button>
          )}

          {!isProjectContext && canSort && (
            <ProjectSortDropdown
              sort={sort}
              orderKey={orderKey}
              onSortChange={onSortChange}
            />
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
          isArchivedMode={isArchivedMode}
          orderKey={orderKey}
          favoritesOrderKey={favoritesOrderKey}
          isLoading={isLoading}
          hasError={hasError}
          activeProjectId={activeProjectId}
          onSelectProject={onSelectProject}
          onToggleFavorite={onToggleFavorite}
          onArchiveProject={onArchiveProject}
          onUnarchiveProject={onUnarchiveProject}
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
