import { ModalManager } from '../utils/modalManager.js';
import { showAlert, showConfirm } from '../utils/dialog.js';
import NoteManager from '../managers/noteManager.js';
import SnippetManager from '../managers/snippetManager.js';
import TodoManager from '../managers/todoManager.js';
import SearchManager from '../managers/searchManager.js';
import { createProject, getProjects, getProject, updateProject, deleteProject } from '../services/projectService.js';


import { getCurrentUser, logout } from '../services/authService.js';


// ==========================================
// STATE MANAGEMENT
// ==========================================

let currentProject = null;
let currentTab = 'notes';
let nextProjectsUrl = null;
let isLoadingProjects = false;
let allProjects = [];
let currentSort = localStorage.getItem('devnote_project_sort') || 'created_desc';

// ==========================================
// MODAL MANAGERS
// ==========================================

let projectModal, snippetModal, todoModal;
let noteManager, snippetManager, todoManager, searchManager;

// ==========================================
// INITIALIZE MODALS
// ==========================================

function initializeModals() {

    // --- PROJECT MODAL (create + edit) ---
    projectModal = new ModalManager({
        modalId: 'project-modal',
        formId: 'project-form',
        onSubmit: async (data) => {
            const editId = document.getElementById('project-form').dataset.editId;
            if (editId) {
                // Edit mode
                const updated = await updateProject(editId, data.title, data.description ?? currentProject.description);
                currentProject = updated;
                document.getElementById('project-title').textContent = updated.title;
                document.getElementById('project-description').textContent = updated.description || '';
                const sidebarItem = document.querySelector(`.project-item[data-id="${editId}"] .project-name`);
                if (sidebarItem) sidebarItem.textContent = updated.title;
            } else {
                // Create mode
                const project = await createProject(data.title, data.description);
                await loadProjects();
                selectProject(project.id);
            }
        }
    });

    noteManager = new NoteManager();
    snippetManager = new SnippetManager();
    todoManager = new TodoManager();
}

// ==========================================
// AUTHENTICATION CHECK
// ==========================================

async function checkAuth() {
    try {
        const data = await getCurrentUser();
        document.getElementById('user-name').textContent = `${data.first_name} ${data.last_name}`;
        document.getElementById('sidebar-user-name').textContent = data.email;
        return data;
    } catch (error) {
        console.log('Not authenticated, redirecting...');
        window.location.href = "/src/pages/login.html";
    }
}

// ==========================================
// LOAD PROJECTS
// ==========================================

async function loadProjects() {
    try {
        const data = await getProjects();
        nextProjectsUrl = data.next ?? null;
        allProjects = data.results;
        displayProjects(sortProjects(allProjects));
    } catch (error) {
        console.log('Error loading projects:', error);
        document.getElementById('projects-list').innerHTML =
        '<p style="padding: 20px; color: #888;">Error loading projects</p>';
    }
}

// ==========================================
// SORT PROJECTS
// ==========================================

function sortProjects(projects) {
    const sorted = [...projects];
    switch (currentSort) {
        case 'name_asc':
            return sorted.sort((a, b) => a.title.localeCompare(b.title));
        case 'name_desc':
            return sorted.sort((a, b) => b.title.localeCompare(a.title));
        case 'created_asc':
            return sorted.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        case 'created_desc':
            return sorted.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        case 'updated_desc':
            return sorted.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
        default:
            return sorted;
    }
}

// ==========================================
// SETUP PROJECT SORT
// ==========================================

function setupProjectSort() {
    const btn = document.getElementById('project-sort-btn');
    const dropdown = document.getElementById('project-sort-dropdown');

    // Mark active option + icon on init
    updateSortUI();

    // Toggle dropdown
    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.classList.toggle('open');
    });

    // Close on outside click
    document.addEventListener('click', () => {
        dropdown.classList.remove('open');
        document.querySelectorAll('.dn-select-dropdown.open').forEach(d => {
            d.classList.remove('open');
            if (d._cleanup) { d._cleanup(); d._cleanup = null; }
        });
    });
    dropdown.addEventListener('click', (e) => e.stopPropagation());

    // Handle option selection
    dropdown.querySelectorAll('.sort-option').forEach(opt => {
        opt.addEventListener('click', () => {
            currentSort = opt.dataset.sort;
            localStorage.setItem('devnote_project_sort', currentSort);
            updateSortUI();
            displayProjects(sortProjects(allProjects));
            dropdown.classList.remove('open');
        });
    });
}

function updateSortUI() {
    const btn = document.getElementById('project-sort-btn');
    const dropdown = document.getElementById('project-sort-dropdown');
    const isDefault = currentSort === 'created_desc';

    // Highlight button if non-default sort active
    btn.classList.toggle('sorted', !isDefault);

    // Update icon based on sort type
    const iconMap = {
        name_asc: 'ph-sort-ascending',
        name_desc: 'ph-sort-descending',
        created_desc: 'ph-sort-ascending',
        created_asc: 'ph-sort-descending',
        updated_desc: 'ph-clock-clockwise',
    };
    btn.querySelector('i').className = `ph-light ${iconMap[currentSort] || 'ph-sort-ascending'}`;

    // Mark active option
    dropdown.querySelectorAll('.sort-option').forEach(opt => {
        opt.classList.toggle('active', opt.dataset.sort === currentSort);
    });
}

async function loadMoreProjects() {
    if (!nextProjectsUrl || isLoadingProjects) return;

    isLoadingProjects = true;
    try {
        const data = await getProjects(nextProjectsUrl);
        nextProjectsUrl = data.next ?? null;
        allProjects = [...allProjects, ...data.results];
        appendProjects(data.results);
    } catch (error) {
        console.error('Error loading more projects:', error);
    } finally {
        isLoadingProjects = false;
    }
}

// ==========================================
// DISPLAY PROJECTS SIDEBAR
// ==========================================

function displayProjects(projects) {
    const container = document.getElementById('projects-list');

    if (projects.length === 0) {
        container.innerHTML = `
            <div class="projects-empty">
                <i class="ph-light ph-folder-open"></i>
                <p>No projects yet</p>
                <span>Create your first project<br>to get started</span>
            </div>
        `;
        return;
    }

    container.innerHTML = projects.map(project => `
        <div class="project-item" data-id="${project.id}">
            <span class="project-icon"><i class="ph-light ph-folder"></i></span>
            <span class="project-name">${project.title}</span>
        </div>
        `).join('');

    attachProjectListeners();
}

function attachProjectListeners() {
    // Add click event to each project
    document.querySelectorAll('.project-item').forEach(item => {
        item.addEventListener('click', () => {
            selectProject(item.dataset.id);
        });
    });

    
}

function appendProjects(projects) {
    const container = document.getElementById('projects-list');
    const html = projects.map(project => `
        <div class="project-item" data-id="${project.id}">
            <span class="project-icon"><i class="ph-light ph-folder"></i></span>
            <span class="project-name">${project.title}</span>
        </div>
    `).join('');
    container.insertAdjacentHTML('beforeend', html);
    attachProjectListeners();
}

// ==========================================
// SELECT PROJECT (Show project view)
// ==========================================

async function selectProject(projectId, tab = null, searchQuery = null, searchItemId = null) {
    try {
        currentProject = await getProject(projectId);

        // Hide welcome screen, show project view
        document.getElementById('welcome-screen').style.display = 'none';
        document.getElementById('project-view').style.display = 'flex';

        // Update project title (utilise l'ID direct)
        document.getElementById('project-title').textContent = currentProject.title;
        document.getElementById('project-description').textContent = currentProject.description || '';

        // Highlight selected project in sidebar
        document.querySelectorAll('.project-item').forEach(item => {
            item.classList.remove('active');
            if (item.dataset.id === projectId) {
                item.classList.add('active');
            }
        });

        // Load content for current tab
        noteManager.setProject(projectId);
        snippetManager.setProject(projectId);
        todoManager.setProject(projectId);

        if (tab) {
            currentTab = tab;
            document.querySelectorAll('.tab').forEach(b => {
                b.classList.toggle('active', b.dataset.tab === tab);
            });
            document.querySelectorAll('.tab-pane').forEach(tc => {
                tc.classList.toggle('active', tc.id === `tab-${tab}`);
            });
        }

        loadTabContent(currentTab, searchQuery, searchItemId);

    } catch (error) {
        console.error('Error loading project:', error);
        await showAlert('Failed to load project');
    }
}

// ==========================================
// PROJECT INLINE EDITING
// ==========================================

function setupSidebarToggle() {
    const layout = document.querySelector('.layout');
    const toggleBtn = document.getElementById('sidebar-toggle'); // dans la sidebar
    const openBtn = document.getElementById('sidebar-open');
    const overlay = document.getElementById('sidebar-overlay');
    const isMobile = () => window.innerWidth <= 768;

    // Restore desktop preference
    if (!isMobile() && localStorage.getItem('devnote_sidebar_hidden') === 'true') {
        layout.classList.add('sidebar-hidden');
    }

    // Ferme la sidebar (bouton dans le header)
    toggleBtn.addEventListener('click', () => {
        if (isMobile()) {
            layout.classList.remove('sidebar-visible');
        } else {
            layout.classList.add('sidebar-hidden');
            localStorage.setItem('devnote_sidebar_hidden', 'true');
        }
    });

    // Ouvre la sidebar (bouton fixe ou inline)
    openBtn.addEventListener('click', () => {
        if (isMobile()) {
            layout.classList.add('sidebar-visible');
        } else {
            layout.classList.remove('sidebar-hidden');
            localStorage.setItem('devnote_sidebar_hidden', 'false');
        }
    });

    // Close on overlay click (mobile)
    overlay.addEventListener('click', () => {
        layout.classList.remove('sidebar-visible');
    });

    // Handle resize
    window.addEventListener('resize', () => {
        if (!isMobile()) {
            layout.classList.remove('sidebar-visible');
        } else {
            layout.classList.remove('sidebar-hidden');
        }
    });
}


function setupProjectMenu() {
    const menuBtn = document.getElementById('project-menu-btn');
    const dropdown = document.getElementById('project-menu-dropdown');

    // Toggle dropdown
    menuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.classList.toggle('open');
        menuBtn.classList.toggle('open', dropdown.classList.contains('open'));
    });

    // Close on outside click
    document.addEventListener('click', () => {
        dropdown.classList.remove('open');
        menuBtn.classList.remove('open');
    });
    dropdown.addEventListener('click', (e) => e.stopPropagation());

    // Actions
    dropdown.querySelectorAll('.project-menu-item').forEach(item => {
        item.addEventListener('click', async () => {
            dropdown.classList.remove('open');
            menuBtn.classList.remove('open');
            const action = item.dataset.action;

            if (action === 'rename') {
                startInlineEdit('title');
            }

            if (action === 'description') {
                startInlineEdit('description');
            }

            if (action === 'delete') {
                const confirmed = await showConfirm('Delete this project and all its contents?');
                if (!confirmed) return;
                try {
                    await deleteProject(currentProject.id);
                    currentProject = null;
                    document.getElementById('project-view').style.display = 'none';
                    document.getElementById('welcome-screen').style.display = 'flex';
                    await loadProjects();
                } catch (error) {
                    console.error('Error deleting project:', error);
                    await showAlert('Failed to delete project');
                }
            }
        });
    });
}

// ==========================================
// PROJECT INLINE EDITING
// ==========================================

function setupInlineEditing() {
    const titleEl = document.getElementById('project-title');
    const descEl = document.getElementById('project-description');

    titleEl.addEventListener('click', () => startInlineEdit('title'));
    descEl.addEventListener('click', () => startInlineEdit('description'));
}

function startInlineEdit(field) {
    const titleEl = document.getElementById('project-title');
    const descEl = document.getElementById('project-description');
    const el = field === 'title' ? titleEl : descEl;

    if (el.contentEditable === 'true') return; // already editing

    const original = el.textContent;

    el.contentEditable = 'true';
    el.dataset.original = original;
    el.focus();

    // Place cursor at end
    const range = document.createRange();
    const sel = window.getSelection();
    range.selectNodeContents(el);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);

    async function save() {
        el.contentEditable = 'false';
        const newValue = el.textContent.trim();

        if (!newValue || newValue === original) {
            el.textContent = original;
            return;
        }

        const updatedTitle = field === 'title' ? newValue : currentProject.title;
        const updatedDesc  = field === 'description' ? newValue : (currentProject.description || '');

        try {
            const updated = await updateProject(currentProject.id, updatedTitle, updatedDesc);
            currentProject = updated;
            // Sync sidebar
            const sidebarItem = document.querySelector(`.project-item[data-id="${currentProject.id}"] .project-name`);
            if (sidebarItem) sidebarItem.textContent = updated.title;
        } catch (err) {
            console.error('Failed to update project:', err);
            el.textContent = original;
        }
    }

    function cancel() {
        el.contentEditable = 'false';
        el.textContent = original;
    }

    el.addEventListener('blur', save, { once: true });

    el.addEventListener('keydown', (e) => {
        if (field === 'title' && e.key === 'Enter') {
            e.preventDefault();
            el.blur();
        }
        if (e.key === 'Escape') {
            el.removeEventListener('blur', save);
            cancel();
        }
    }, { once: true });
}


// ==========================================
// TABS MANAGEMENT
// ==========================================

function setupTabs() {
    const noteControls = document.querySelector('.note-controls');
    noteControls.classList.add('visible'); // Notes tab is active by default
    const snippetControls = document.querySelector('.snippet-controls');
    const snippetViewToggle = document.getElementById('snippet-view-toggle');
    const todoControls = document.querySelector('.todo-controls');
    const todoToggle = document.getElementById('todo-view-toggle');

    document.querySelectorAll('.tab').forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.tab;
            currentTab = tab;

            // Update active tab button
            document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Update active tab content
            document.querySelectorAll('.tab-pane').forEach(tc => tc.classList.remove('active'));
            document.getElementById(`tab-${tab}`).classList.add('active');

            // Show/hide controls per tab
            noteControls.classList.toggle('visible', tab === 'notes');
            snippetControls.classList.toggle('visible', tab === 'snippets');
            todoControls.classList.toggle('visible', tab === 'todos');

            // Load content for this tab
            loadTabContent(tab);
        });
    });

    // Toggle view listeners (list / kanban)
    todoToggle.querySelectorAll('.btn-view-toggle').forEach(btn => {
        btn.addEventListener('click', () => {
            todoToggle.querySelectorAll('.btn-view-toggle').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            todoManager.switchView(btn.dataset.view);
        });
    });

    // Helper: setup a content sort dropdown
    function setupContentSort({ btnId, dropdownId, labelId, defaultSort, onSort }) {
        const btn = document.getElementById(btnId);
        const dropdown = document.getElementById(dropdownId);
        const label = document.getElementById(labelId);

        const updateUI = (sort) => {
            const active = dropdown.querySelector(`[data-sort="${sort}"]`);
            label.textContent = active ? active.textContent : '';
            dropdown.querySelectorAll('.sort-option').forEach(o =>
                o.classList.toggle('active', o.dataset.sort === sort)
            );
            const isDefault = sort === defaultSort;
            btn.classList.toggle('active', !isDefault);
        };

        // Init with saved preference
        updateUI(onSort.get());

        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            // Close other dropdowns
            document.querySelectorAll('.content-sort-wrap .project-sort-dropdown.open').forEach(d => {
                if (d !== dropdown) d.classList.remove('open');
            });
            dropdown.classList.toggle('open');
            const chevron = btn.querySelector('.sort-chevron');
            if (chevron) chevron.style.transform = dropdown.classList.contains('open') ? 'rotate(180deg)' : '';
        });

        dropdown.querySelectorAll('.sort-option').forEach(opt => {
            opt.addEventListener('click', () => {
                const sort = opt.dataset.sort;
                updateUI(sort);
                dropdown.classList.remove('open');
                const chevron = btn.querySelector('.sort-chevron');
                if (chevron) chevron.style.transform = '';
                onSort.set(sort);
            });
        });
    }

    setupContentSort({
        btnId: 'note-sort-btn',
        dropdownId: 'note-sort-dropdown',
        labelId: 'note-sort-label',
        defaultSort: 'created',
        onSort: { get: () => noteManager.getSortPreference(), set: (s) => noteManager.setSort(s) }
    });

    setupContentSort({
        btnId: 'snippet-sort-btn',
        dropdownId: 'snippet-sort-dropdown',
        labelId: 'snippet-sort-label',
        defaultSort: 'created',
        onSort: { get: () => snippetManager.getSortPreference(), set: (s) => snippetManager.setSort(s) }
    });

    setupContentSort({
        btnId: 'todo-sort-btn',
        dropdownId: 'todo-sort-dropdown',
        labelId: 'todo-sort-label',
        defaultSort: 'priority',
        onSort: { get: () => todoManager.getSortPreference(), set: (s) => todoManager.setSort(s) }
    });

    // Snippet view toggle
    snippetViewToggle.querySelectorAll('.btn-view-toggle').forEach(btn => {
        btn.addEventListener('click', () => {
            snippetViewToggle.querySelectorAll('.btn-view-toggle').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            snippetManager.switchView(btn.dataset.view);
        });
    });
}

// ==========================================
// LOAD TAB CONTENT
// ==========================================

async function loadTabContent(tab, searchQuery = null, searchItemId = null) {
    if (!currentProject) return;

    if (tab === 'notes') {
        await noteManager.load();
        if (searchQuery) noteManager.highlight(searchQuery, searchItemId);
        return;
    }

    if (tab === 'snippets') {
        const savedView = snippetManager.getViewPreference();
        document.getElementById('snippet-view-toggle').querySelectorAll('.btn-view-toggle').forEach(b => {
            b.classList.toggle('active', b.dataset.view === savedView);
        });
        await snippetManager.load();
        if (searchQuery) snippetManager.highlight(searchQuery, searchItemId);
        return;
    }

    if (tab === 'todos') {
        const savedView = todoManager.getViewPreference();
        document.getElementById('todo-view-toggle').querySelectorAll('.btn-view-toggle').forEach(b => {
            b.classList.toggle('active', b.dataset.view === savedView);
        });
        await todoManager.load();
        if (searchQuery) todoManager.highlight(searchQuery, searchItemId);
        return;
    }

}

// ==========================================
// SETUP MODAL BUTTONS
// ==========================================

function setupModalButtons() {
    const newProjectBtn = document.getElementById('newProjectBtn');
    if (newProjectBtn) {
        newProjectBtn.addEventListener('click', () => projectModal.open());
    }

    const addSnippetBtn = document.getElementById('add-snippet-btn');
    if (addSnippetBtn) {
        addSnippetBtn.addEventListener('click', () => snippetModal.open());
    }

    const addTodoBtn = document.getElementById('add-todo-btn');
    if (addTodoBtn) {
        addTodoBtn.addEventListener('click', () => todoModal.open());
    }
}

// ==========================================
// INITIALIZATION
// ==========================================

document.addEventListener('DOMContentLoaded', async () => {
    console.log('Dashboard initializing...');
    
    await checkAuth();
    initializeModals();

    searchManager = new SearchManager({
        onSelectProject: (projectId, tab, query, itemId) => {
            selectProject(projectId, tab, query, itemId);
        }
    });

    document.getElementById('search-btn').addEventListener('click', () => {
        searchManager.open();
    });

    await loadProjects();
    setupProjectSort();
    setupTabs();
    setupModalButtons();
    setupProjectMenu();
    setupInlineEditing();
    setupSidebarToggle();

    // Logout
    document.getElementById('logout-btn').addEventListener('click', async () => {
        try {
            await logout();
        } finally {
            window.location.href = '/src/pages/login.html';
        }
    });
    console.log('Dashboard ready!');

    // Infinite scroll
    document.getElementById('projects-list').addEventListener('scroll', () => {
        const el = document.getElementById('projects-list');
        const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
        if (distanceFromBottom < 100) {
            loadMoreProjects();
        }
    });
});
