import { timeAgo } from "../lib/relativeTime.js";

function plural(count, word) {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

export default function WelcomeScreen({
  user,
  projectCount,
  openTodosCount,
  recentProjects,
  onSelectProject,
  onNewProject,
}) {
  return (
    <>
      <header className="welcome-header">
        <h1>
          Welcome,{" "}
          <span id="user-name">
            {user ? `${user.first_name} ${user.last_name}` : "..."}
          </span>
        </h1>
      </header>

      <div className="welcome-body">
        <div className="welcome-inner">
          <p className="welcome-stats">
            {projectCount === null
              ? " "
              : `${plural(projectCount, "project")} · ${plural(
                  openTodosCount ?? 0,
                  "open todo",
                )}`}
          </p>

          <button type="button" className="btn-primary" onClick={onNewProject}>
            <i className="ph-light ph-plus" />
            New project
          </button>

          {recentProjects.length > 0 && (
            <section className="welcome-recent">
              <h2 className="welcome-section-title">Recently opened</h2>

              <div className="recent-project-grid">
                {recentProjects.map((project) => (
                  <button
                    type="button"
                    key={project.id}
                    className="recent-project-card"
                    onClick={() => onSelectProject(project.id)}
                  >
                    <span className="recent-project-head">
                      <span className="recent-project-icon">
                        <i className="ph-light ph-folder" />
                      </span>
                      <span className="recent-project-title">
                        {project.title}
                      </span>
                    </span>

                    <span className="recent-project-meta">
                      <span>
                        {project.last_opened_at
                          ? `Opened ${timeAgo(project.last_opened_at)}`
                          : "Never opened"}
                      </span>
                      <span className="recent-project-todos">
                        {plural(project.open_todos_count ?? 0, "open todo")}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </>
  );
}
