import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import ProjectHeader from "../components/ProjectHeader.jsx";
import ProjectModal from "../components/ProjectModal.jsx";
import PinnedPreview from "../components/PinnedPreview.jsx";
import ProjectTabs from "../components/ProjectTabs.jsx";
import SearchOverlay from "../components/SearchOverlay.jsx";
import SettingsPanel from "../components/SettingsPanel.jsx";
import SettingsSidebar from "../components/SettingsSidebar.jsx";
import Sidebar from "../components/Sidebar.jsx";
import WelcomeScreen from "../components/WelcomeScreen.jsx";

import { useAuth } from "../contexts/AuthContext.js";
import { useDialog } from "../contexts/DialogContext.js";
import { useTheme } from "../contexts/ThemeContext.js";
import { applyMermaidTheme } from "../lib/blocknote.js";
import { useLocalStorageState } from "../hooks/useLocalStorageState.js";
import {
  SIDEBAR_WIDTH_DEFAULT,
  SIDEBAR_WIDTH_KEY,
  clampWidth,
} from "../lib/sidebarWidth.js";
import { useMediaQuery } from "../hooks/useMediaQuery.js";
import { usePinnedItems } from "../hooks/usePinnedItems.js";
import {
  ARCHIVED_PROJECTS_ORDER_KEY,
  FAVORITE_PROJECTS_ORDER_KEY,
  PROJECTS_ORDER_KEY,
} from "../lib/pinnedSections.js";
import { DEFAULT_SETTINGS_SECTION } from "../lib/settingsSections.js";
import { ensureCsrfCookie } from "../services/authService.js";
import { setDocumentPinned } from "../services/documentService.js";
import {
  archiveProject,
  deleteProject,
  getArchivedProjects,
  getProject,
  getProjects,
  getRecentProjects,
  markProjectOpened,
  setProjectFavorite,
  unarchiveProject,
} from "../services/projectService.js";
import { setSnippetPinned } from "../services/snippetService.js";
import {
  countOpenTodos,
  setTodoPinned,
  updateTodo,
} from "../services/todoService.js";
import { shouldUnpinOnDone } from "../lib/todoPinRule.js";
import "../styles/dashboard.css";

const MOBILE_QUERY = "(max-width: 768px)";

const RECENT_PROJECTS_LIMIT = 4;

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
  const { user, signOut } = useAuth();
  const { showAlert, showConfirm } = useDialog();

  const [projects, setProjects] = useState([]);
  const [archivedProjects, setArchivedProjects] = useState([]);
  const [isArchivedMode, setIsArchivedMode] = useState(false);
  const [projectCount, setProjectCount] = useState(null);
  const [recentProjects, setRecentProjects] = useState([]);
  const [openTodosCount, setOpenTodosCount] = useState(null);
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);
  const [hasProjectsError, setHasProjectsError] = useState(false);
  const [currentProject, setCurrentProject] = useState(null);
  const [pinnedPreview, setPinnedPreview] = useState(null);
  const [currentTab, setCurrentTab] = useState("documents");
  const [view, setView] = useState("projects");
  const [settingsSection, setSettingsSection] = useState(
    DEFAULT_SETTINGS_SECTION,
  );
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchTarget, setSearchTarget] = useState(null);
  const [openTarget, setOpenTarget] = useState(null);
  const [activeItemId, setActiveItemId] = useState(null);
  const [contentVersion, setContentVersion] = useState(0);
  const [isSidebarVisible, setIsSidebarVisible] = useState(false);
  const [headerSlot, setHeaderSlot] = useState(null);
  const [isSidebarHidden, setIsSidebarHidden] = useState(
    () =>
      !isMobile() && localStorage.getItem("devnote_sidebar_hidden") === "true",
  );

  const [storedSidebarWidth, setStoredSidebarWidth] = useLocalStorageState(
    SIDEBAR_WIDTH_KEY,
    String(SIDEBAR_WIDTH_DEFAULT),
  );

  const sidebarWidth = clampWidth(
    Number(storedSidebarWidth) || SIDEBAR_WIDTH_DEFAULT,
  );

  const [projectSort, setProjectSort] = useLocalStorageState(
    "devnote_project_sort",
    "created_desc",
  );

  const { theme } = useTheme();
  const isMobileView = useMediaQuery(MOBILE_QUERY);
  const pinned = usePinnedItems(currentProject?.id ?? null);

  useLayoutEffect(() => {
    applyMermaidTheme(theme);
  }, [theme]);

  const nextProjectsUrlRef = useRef(null);
  const nextArchivedUrlRef = useRef(null);
  const isLoadingMoreRef = useRef(false);
  const isLoadingMoreArchivedRef = useRef(false);

  const loadProjects = useCallback(async () => {
    try {
      const data = await getProjects();
      nextProjectsUrlRef.current = data.next ?? null;
      setProjects(data.results);
      setProjectCount(data.count ?? data.results.length);
      setHasProjectsError(false);
    } catch (error) {
      console.error("Error loading projects:", error);
      setHasProjectsError(true);
    } finally {
      setIsLoadingProjects(false);
    }
  }, []);

  const loadArchivedProjects = useCallback(async () => {
    try {
      const data = await getArchivedProjects();
      nextArchivedUrlRef.current = data.next ?? null;
      setArchivedProjects(data.results ?? data);
    } catch (error) {
      console.error("Error loading archived projects:", error);
      setArchivedProjects([]);
    }
  }, []);

  const loadMoreArchivedProjects = useCallback(async () => {
    if (!nextArchivedUrlRef.current || isLoadingMoreArchivedRef.current) return;

    isLoadingMoreArchivedRef.current = true;

    try {
      const data = await getArchivedProjects(nextArchivedUrlRef.current);
      nextArchivedUrlRef.current = data.next ?? null;
      setArchivedProjects((current) => [...current, ...data.results]);
    } catch (error) {
      console.error("Error loading more archived projects:", error);
    } finally {
      isLoadingMoreArchivedRef.current = false;
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

  const loadWelcomeData = useCallback(async () => {
    try {
      const [recent, openTodos] = await Promise.all([
        getRecentProjects(RECENT_PROJECTS_LIMIT),
        countOpenTodos(),
      ]);

      setRecentProjects(recent);
      setOpenTodosCount(openTodos);
    } catch (error) {
      console.error("Error loading welcome data:", error);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      await ensureCsrfCookie();
      await Promise.all([loadProjects(), loadArchivedProjects()]);
    };

    init();
  }, [loadProjects, loadArchivedProjects]);

  const isWelcomeVisible = view !== "settings" && !currentProject;

  useEffect(() => {
    if (!isWelcomeVisible) return;

    const refresh = async () => {
      await loadWelcomeData();
    };

    refresh();
  }, [isWelcomeVisible, loadWelcomeData]);

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

  const listedProjects = isArchivedMode ? archivedProjects : projects;

  const sortedProjects = useMemo(
    () => sortProjects(listedProjects, projectSort),
    [listedProjects, projectSort],
  );

  const selectProject = useCallback(
    async (
      projectId,
      tab = null,
      searchQuery = null,
      searchItemId = null,
      searchFolderPath = [],
    ) => {
      try {
        const project = await getProject(projectId);
        setView("projects");
        setCurrentProject(project);
        setPinnedPreview(null);
        if (tab) setCurrentTab(tab);
        setOpenTarget(null);
        setSearchTarget(
          searchQuery
            ? {
                query: searchQuery,
                itemId: searchItemId,
                folderPath: searchFolderPath ?? [],
              }
            : null,
        );

        try {
          await markProjectOpened(projectId);
        } catch (error) {
          console.error("Error marking project as opened:", error);
        }
      } catch (error) {
        console.error("Error loading project:", error);
        await showAlert("Failed to load project");
      }
    },
    [showAlert],
  );

  const handleTabChange = useCallback((tab) => {
    setCurrentTab(tab);
    setSearchTarget(null);
    setOpenTarget(null);
  }, []);

  const backToWelcome = useCallback(() => {
    setCurrentProject(null);
    setPinnedPreview(null);
    setSearchTarget(null);
    setOpenTarget(null);
  }, []);

  const openPinnedItem = useCallback((tab, itemId) => {
    setCurrentTab(tab);
    setSearchTarget(null);
    setOpenTarget({ tab, itemId });
    if (isMobile()) setIsSidebarVisible(false);
  }, []);

  const openPinnedDocument = useCallback(
    (doc) => openPinnedItem("documents", doc.id),
    [openPinnedItem],
  );

  const previewPinnedItem = useCallback((type, itemId) => {
    setPinnedPreview({ type, id: itemId });
    if (isMobile()) setIsSidebarVisible(false);
  }, []);

  const openPinnedSnippet = useCallback(
    (snippet) => previewPinnedItem("snippet", snippet.id),
    [previewPinnedItem],
  );

  const openPinnedTodo = useCallback(
    (todo) => previewPinnedItem("todo", todo.id),
    [previewPinnedItem],
  );

  const closePinnedPreview = useCallback(() => setPinnedPreview(null), []);

  const revealPinnedItem = useCallback(() => {
    if (!pinnedPreview) return;

    openPinnedItem(
      pinnedPreview.type === "snippet" ? "snippets" : "todos",
      pinnedPreview.id,
    );
    setPinnedPreview(null);
  }, [openPinnedItem, pinnedPreview]);

  const { reload: reloadPinned } = pinned;

  const handlePinnedChanged = useCallback(() => reloadPinned(), [reloadPinned]);

  const handlePreviewChanged = useCallback(async () => {
    await reloadPinned();
    setContentVersion((current) => current + 1);
  }, [reloadPinned]);

  const handleActiveItemChange = useCallback((itemId) => {
    setActiveItemId(itemId);
  }, []);

  const unpin = useCallback(
    async (unpinItem, item, label) => {
      try {
        await unpinItem(item.id, false);
      } catch (error) {
        console.error(`Error unpinning ${label}:`, error);
        await showAlert(`Unable to unpin the ${label}`);
        return;
      }

      await reloadPinned();
      setContentVersion((current) => current + 1);
    },
    [reloadPinned, showAlert],
  );

  const unpinDocument = useCallback(
    (doc) => unpin(setDocumentPinned, doc, "document"),
    [unpin],
  );

  const unpinSnippet = useCallback(
    (snippet) => unpin(setSnippetPinned, snippet, "snippet"),
    [unpin],
  );

  const unpinTodo = useCallback(
    (todo) => unpin(setTodoPinned, todo, "todo"),
    [unpin],
  );

  const changeTodoStatus = useCallback(
    async (todo, nextStatus) => {
      if (nextStatus === todo.status) return;

      try {
        await updateTodo(todo.id, undefined, undefined, nextStatus, undefined);

        if (shouldUnpinOnDone(todo, nextStatus)) {
          await setTodoPinned(todo.id, false);
        }
      } catch (error) {
        console.error("Error updating todo status:", error);
        await showAlert("Unable to update the todo");
        return;
      }

      await reloadPinned();
      setContentVersion((current) => current + 1);
    },
    [reloadPinned, showAlert],
  );

  const closeSearch = useCallback(() => setIsSearchOpen(false), []);

  const openSettings = useCallback(() => {
    setSettingsSection(DEFAULT_SETTINGS_SECTION);
    setView("settings");
  }, []);

  const closeSettings = useCallback(() => setView("projects"), []);

  const handleProjectUpdated = useCallback((updated) => {
    const replace = (current) =>
      current.map((project) => (project.id === updated.id ? updated : project));

    setCurrentProject(updated);
    setProjects(replace);
    setArchivedProjects(replace);
  }, []);

  const handleToggleFavorite = useCallback(
    async (project) => {
      try {
        const updated = await setProjectFavorite(
          project.id,
          !project.is_favorite,
        );

        const replace = (current) =>
          current.map((entry) => (entry.id === updated.id ? updated : entry));

        setProjects(replace);
        setArchivedProjects(replace);
        setCurrentProject((current) =>
          current?.id === updated.id ? updated : current,
        );
      } catch (error) {
        console.error("Error updating project favorite:", error);
        await showAlert("Failed to update the favorite");
      }
    },
    [showAlert],
  );

  const handleArchiveProject = useCallback(
    async (project) => {
      try {
        await archiveProject(project.id);
        setCurrentProject((current) =>
          current?.id === project.id ? null : current,
        );
        await Promise.all([
          loadProjects(),
          loadArchivedProjects(),
          loadWelcomeData(),
        ]);
      } catch (error) {
        console.error("Error archiving project:", error);
        await showAlert("Failed to archive project");
      }
    },
    [loadArchivedProjects, loadProjects, loadWelcomeData, showAlert],
  );

  const handleUnarchiveProject = useCallback(
    async (project) => {
      try {
        await unarchiveProject(project.id);
        await Promise.all([
          loadProjects(),
          loadArchivedProjects(),
          loadWelcomeData(),
        ]);
      } catch (error) {
        console.error("Error unarchiving project:", error);
        await showAlert("Failed to unarchive project");
      }
    },
    [loadArchivedProjects, loadProjects, loadWelcomeData, showAlert],
  );

  const handleDeleteProject = useCallback(
    async (project) => {
      const confirmed = await showConfirm(
        `Delete "${project.title}" and all its contents?`,
      );
      if (!confirmed) return;

      try {
        await deleteProject(project.id);
        setCurrentProject((current) =>
          current?.id === project.id ? null : current,
        );
        await Promise.all([loadProjects(), loadArchivedProjects()]);
      } catch (error) {
        console.error("Error deleting project:", error);
        await showAlert("Failed to delete project");
      }
    },
    [loadArchivedProjects, loadProjects, showAlert, showConfirm],
  );

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

  const isSidebarOpen = isMobileView ? isSidebarVisible : !isSidebarHidden;

  const toggleSidebar = () => (isSidebarOpen ? closeSidebar() : openSidebar());

  const handleLogout = async () => {
    await signOut();
  };

  const isSettingsView = view === "settings";

  const layoutClassName = [
    "layout",
    isSidebarHidden ? "sidebar-hidden" : "",
    isSidebarVisible ? "sidebar-visible" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <>
      <div
        className={layoutClassName}
        style={{ "--sidebar-width": `${sidebarWidth}px` }}
      >
        <div
          id="sidebar-overlay"
          className="sidebar-overlay"
          onClick={() => setIsSidebarVisible(false)}
        />

        {isSettingsView ? (
          <SettingsSidebar
            activeSection={settingsSection}
            onSelectSection={setSettingsSection}
            onBack={closeSettings}
          />
        ) : (
          <Sidebar
            user={user}
            project={currentProject}
            pinned={pinned}
            activeItemId={activeItemId}
            projects={sortedProjects}
            isArchivedMode={isArchivedMode}
            orderKey={
              isArchivedMode ? ARCHIVED_PROJECTS_ORDER_KEY : PROJECTS_ORDER_KEY
            }
            favoritesOrderKey={FAVORITE_PROJECTS_ORDER_KEY}
            isLoading={isLoadingProjects}
            hasError={hasProjectsError}
            activeProjectId={currentProject?.id ?? null}
            sort={projectSort}
            onSortChange={setProjectSort}
            onSelectProject={selectProject}
            onToggleFavorite={handleToggleFavorite}
            onLoadMore={
              isArchivedMode ? loadMoreArchivedProjects : loadMoreProjects
            }
            onToggleArchived={() => setIsArchivedMode((current) => !current)}
            onArchiveProject={handleArchiveProject}
            onUnarchiveProject={handleUnarchiveProject}
            onDeleteProject={handleDeleteProject}
            onBackToWelcome={backToWelcome}
            onOpenPinnedDocument={openPinnedDocument}
            onOpenPinnedSnippet={openPinnedSnippet}
            onOpenPinnedTodo={openPinnedTodo}
            onChangeTodoStatus={changeTodoStatus}
            onUnpinDocument={unpinDocument}
            onUnpinSnippet={unpinSnippet}
            onUnpinTodo={unpinTodo}
            onOpenSearch={() => setIsSearchOpen(true)}
            onOpenSettings={openSettings}
            onLogout={handleLogout}
            sidebarWidth={sidebarWidth}
            onSidebarWidthChange={(next) => setStoredSidebarWidth(String(next))}
          />
        )}

        <main
          className={`main-content${isWelcomeVisible ? " is-welcome" : ""}`}
        >
          <button
            id="sidebar-toggle"
            className="btn-sidebar-toggle"
            title={isSidebarOpen ? "Hide sidebar" : "Show sidebar"}
            aria-expanded={isSidebarOpen}
            onClick={toggleSidebar}
          >
            <i
              className={`ph-light ${isSidebarOpen ? "ph-sidebar-simple" : "ph-list"}`}
            />
          </button>

          <div
            id="welcome-screen"
            className="welcome-screen"
            style={{
              display: !isSettingsView && !currentProject ? "flex" : "none",
            }}
          >
            <WelcomeScreen
              user={user}
              projectCount={projectCount}
              openTodosCount={openTodosCount}
              recentProjects={recentProjects}
              onSelectProject={selectProject}
              onNewProject={() => setIsProjectModalOpen(true)}
            />
          </div>

          <div
            id="project-view"
            style={{
              display: !isSettingsView && currentProject ? "flex" : "none",
            }}
          >
            {currentProject && (
              <>
                <ProjectHeader
                  project={currentProject}
                  onProjectUpdated={handleProjectUpdated}
                  actionsRef={setHeaderSlot}
                />

                <ProjectTabs
                  projectId={currentProject.id}
                  currentTab={currentTab}
                  onTabChange={handleTabChange}
                  headerSlot={headerSlot}
                  searchQuery={searchTarget?.query ?? null}
                  searchItemId={searchTarget?.itemId ?? null}
                  searchTarget={searchTarget}
                  openTarget={openTarget}
                  contentVersion={contentVersion}
                  onPinnedChanged={handlePinnedChanged}
                  onActiveItemChange={handleActiveItemChange}
                />
              </>
            )}
          </div>

          {isSettingsView && <SettingsPanel section={settingsSection} />}
        </main>
      </div>

      <ProjectModal
        isOpen={isProjectModalOpen}
        onClose={() => setIsProjectModalOpen(false)}
        onCreated={async (project) => {
          setIsArchivedMode(false);
          await loadProjects();
          await selectProject(project.id);
        }}
      />

      <SearchOverlay
        isOpen={isSearchOpen}
        onClose={closeSearch}
        onSelectResult={selectProject}
      />

      {pinnedPreview && (
        <PinnedPreview
          key={`${pinnedPreview.type}:${pinnedPreview.id}`}
          target={pinnedPreview}
          onClose={closePinnedPreview}
          onChanged={handlePreviewChanged}
          onReveal={revealPinnedItem}
        />
      )}
    </>
  );
}
