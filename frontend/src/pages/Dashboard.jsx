import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import ProjectHeader from "../components/ProjectHeader.jsx";
import ProjectModal from "../components/ProjectModal.jsx";
import ProjectTabs from "../components/ProjectTabs.jsx";
import SearchOverlay from "../components/SearchOverlay.jsx";
import Sidebar from "../components/Sidebar.jsx";
import { useAuth } from "../contexts/AuthContext.js";
import { useDialog } from "../contexts/DialogContext.js";
import { useLocalStorageState } from "../hooks/useLocalStorageState.js";
import { ensureCsrfCookie } from "../services/authService.js";
import {
  deleteProject,
  getProject,
  getProjects,
} from "../services/projectService.js";
import "../styles/dashboard.css";

const isMobile = () => window.innerWidth <= 768;

function sortProjects(projects, sort) {
  const sorted = [...projects];

  switch (sort) {
    case "name_asc":
      return sorted.sort((a, b) => a.title.localeCompare(b.title));
    case "name_desc":
      return sorted.sort((a, b) => b.title.localeCompare(a.title));
    case "created_asc":
      return sorted.sort(
        (a, b) => new Date(a.created_at) - new Date(b.created_at),
      );
    case "created_desc":
      return sorted.sort(
        (a, b) => new Date(b.created_at) - new Date(a.created_at),
      );
    case "updated_desc":
      return sorted.sort(
        (a, b) => new Date(b.updated_at) - new Date(a.updated_at),
      );
    default:
      return sorted;
  }
}

export default function Dashboard() {
  const { user, isChecking, signOut } = useAuth();
  const { showAlert, showConfirm } = useDialog();
  const navigate = useNavigate();

  const [projects, setProjects] = useState([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);
  const [hasProjectsError, setHasProjectsError] = useState(false);
  const [currentProject, setCurrentProject] = useState(null);
  const [currentTab, setCurrentTab] = useState("notes");
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isSidebarVisible, setIsSidebarVisible] = useState(false);
  const [isSidebarHidden, setIsSidebarHidden] = useState(
    () =>
      !isMobile() && localStorage.getItem("devnote_sidebar_hidden") === "true",
  );

  const [projectSort, setProjectSort] = useLocalStorageState(
    "devnote_project_sort",
    "created_desc",
  );

  const nextProjectsUrlRef = useRef(null);
  const isLoadingMoreRef = useRef(false);

  useEffect(() => {
    const root = document.documentElement;
    const previousTheme = root.getAttribute("data-theme");
    root.setAttribute("data-theme", "dark");

    return () => {
      if (previousTheme) root.setAttribute("data-theme", previousTheme);
    };
  }, []);

  useEffect(() => {
    if (!isChecking && !user) navigate("/login", { replace: true });
  }, [isChecking, user, navigate]);

  const loadProjects = useCallback(async () => {
    try {
      const data = await getProjects();
      nextProjectsUrlRef.current = data.next ?? null;
      setProjects(data.results);
      setHasProjectsError(false);
    } catch (error) {
      console.error("Error loading projects:", error);
      setHasProjectsError(true);
    } finally {
      setIsLoadingProjects(false);
    }
  }, []);

  const loadMoreProjects = useCallback(async () => {
    if (!nextProjectsUrlRef.current || isLoadingMoreRef.current) return;

    isLoadingMoreRef.current = true;

    try {
      const data = await getProjects(nextProjectsUrlRef.current);
      nextProjectsUrlRef.current = data.next ?? null;
      setProjects((current) => [...current, ...data.results]);
    } catch (error) {
      console.error("Error loading more projects:", error);
    } finally {
      isLoadingMoreRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (isChecking || !user) return;

    const init = async () => {
      await ensureCsrfCookie();
      await loadProjects();
    };

    init();
  }, [isChecking, user, loadProjects]);

  useEffect(() => {
    const onResize = () => {
      if (!isMobile()) {
        setIsSidebarVisible(false);
      } else {
        setIsSidebarHidden(false);
      }
    };

    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    const onKeyDown = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "k") {
        event.preventDefault();
        setIsSearchOpen(true);
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const sortedProjects = useMemo(
    () => sortProjects(projects, projectSort),
    [projects, projectSort],
  );

  const selectProject = useCallback(
    async (projectId, tab = null) => {
      try {
        const project = await getProject(projectId);
        setCurrentProject(project);
        if (tab) setCurrentTab(tab);
      } catch (error) {
        console.error("Error loading project:", error);
        await showAlert("Failed to load project");
      }
    },
    [showAlert],
  );

  const handleProjectUpdated = useCallback((updated) => {
    setCurrentProject(updated);
    setProjects((current) =>
      current.map((project) => (project.id === updated.id ? updated : project)),
    );
  }, []);

  const handleDeleteProject = useCallback(async () => {
    const confirmed = await showConfirm(
      "Delete this project and all its contents?",
    );
    if (!confirmed) return;

    try {
      await deleteProject(currentProject.id);
      setCurrentProject(null);
      await loadProjects();
    } catch (error) {
      console.error("Error deleting project:", error);
      await showAlert("Failed to delete project");
    }
  }, [currentProject, loadProjects, showAlert, showConfirm]);

  const closeSidebar = () => {
    if (isMobile()) {
      setIsSidebarVisible(false);
    } else {
      localStorage.setItem("devnote_sidebar_hidden", "true");
      setIsSidebarHidden(true);
    }
  };

  const openSidebar = () => {
    if (isMobile()) {
      setIsSidebarVisible(true);
    } else {
      localStorage.setItem("devnote_sidebar_hidden", "false");
      setIsSidebarHidden(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut();
    } finally {
      navigate("/login", { replace: true });
    }
  };

  if (isChecking || !user) return null;

  const layoutClassName = [
    "layout",
    isSidebarHidden ? "sidebar-hidden" : "",
    isSidebarVisible ? "sidebar-visible" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <>
      <div className={layoutClassName}>
        <div
          id="sidebar-overlay"
          className="sidebar-overlay"
          onClick={() => setIsSidebarVisible(false)}
        />

        <Sidebar
          user={user}
          projects={sortedProjects}
          isLoading={isLoadingProjects}
          hasError={hasProjectsError}
          activeProjectId={currentProject?.id ?? null}
          sort={projectSort}
          onSortChange={setProjectSort}
          onSelectProject={selectProject}
          onLoadMore={loadMoreProjects}
          onNewProject={() => setIsProjectModalOpen(true)}
          onOpenSearch={() => setIsSearchOpen(true)}
          onCloseSidebar={closeSidebar}
          onLogout={handleLogout}
        />

        <main className="main-content">
          <button
            id="sidebar-open"
            className="btn-sidebar-open"
            title="Open sidebar"
            onClick={openSidebar}
          >
            <i className="ph-light ph-list" />
          </button>

          <div
            id="welcome-screen"
            className="welcome-screen"
            style={{ display: currentProject ? "none" : "flex" }}
          >
            <h1>
              Welcome,{" "}
              <span id="user-name">
                {user ? `${user.first_name} ${user.last_name}` : "..."}
              </span>
            </h1>
          </div>

          <div
            id="project-view"
            style={{ display: currentProject ? "flex" : "none" }}
          >
            {currentProject && (
              <>
                <ProjectHeader
                  project={currentProject}
                  onProjectUpdated={handleProjectUpdated}
                  onDeleteProject={handleDeleteProject}
                />

                <ProjectTabs
                  projectId={currentProject.id}
                  currentTab={currentTab}
                  onTabChange={setCurrentTab}
                />
              </>
            )}
          </div>
        </main>
      </div>

      <ProjectModal
        isOpen={isProjectModalOpen}
        onClose={() => setIsProjectModalOpen(false)}
        onCreated={async (project) => {
          await loadProjects();
          await selectProject(project.id);
        }}
      />

      <SearchOverlay
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
      />
    </>
  );
}
