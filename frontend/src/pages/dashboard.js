import { ModalManager } from '../utils/modalManager.js';
import { showAlert, showConfirm } from '../utils/dialog.js';
import { escape } from '../utils/escape.js';
import NoteManager from '../managers/noteManager.js';
import SnippetManager from '../managers/snippetManager.js';
import TodoManager from '../managers/todoManager.js';
import SearchManager from '../managers/searchManager.js';
import { createProject, getProjects, getProject, updateProject, deleteProject } from '../services/projectService.js';
import { getCurrentUser, logout } from '../services/authService.js';


// ==========================================
// STATE
// ==========================================

let currentProject = null;
let currentTab = 'notes';
let nextProjectsUrl = null;
let isLoadingProjects = false;
let allProjects = [];
let currentSort = localStorage.getItem('devnote_project_sort') || 'created_desc';

let projectModal;
let noteManager, snippetManager, todoManager, searchManager;


// ==========================================
// AUTH
// ==========================================

async function checkAuth() {
    try {
        const data = await getCurrentUser();
        document.getElementById('user-name').textContent = `${data.first_name} ${data.last_name}`;
        document.getElementById('sidebar-user-name').textContent = data.email;
        return data;
    } catch {
        window.location.href = '/src/pages/login.html';
    }
}


// ==========================================
// PROJECTS — Load & display
// ==========================================

async function loadProjects() {
    try {
        const data = await getProjects();
        nextProjectsUrl = data.next ?? null;
        allProjects = data.results;
        displayProjects(sortProjects(allProjects));
    } catch (error) {
        console.error('Error loading projects:', error);
        document.getElementById('projects-list').innerHTML =
            '<p style="padding: 20px; color: #888;">Error loading projects</p>';
    }
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

    container.innerHTML = projects.map(project => renderProjectItem(project)).join('');
    attachProjectListeners();
}

function appendProjects(projects) {
    const container = document.getElementById('projects-list');
    container.insertAdjacentHTML('beforeend', projects.map(renderProjectItem).join(''));
    attachProjectListeners();
}

function renderProjectItem(project) {
    return `
        <div class="project-item" data-id="${project.id}">
            <span class="project-icon"><i class="ph-light ph-folder"></i></span>
            <span class="project-name">${escape(project.title)}</span>
        </div>
    `;
}

function attachProjectListeners() {
    document.querySelectorAll('.project-item').forEach(item => {
        item.addEventListener('click', () => selectProject(item.dataset.id));
    });
}


// ==========================================
// PROJECTS — Sort
// ==========================================

function sortProjects(projects) {
    const sorted = [...projects];
    switch (currentSort) {
        case 'name_asc':     return sorted.sort((a, b) => a.title.localeCompare(b.title));
        case 'name_desc':    return sorted.sort((a, b) => b.title.localeCompare(a.title));
        case 'created_asc':  return sorted.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        case 'created_desc': return sorted.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        case 'updated_desc': return sorted.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
        default:             return sorted;
    }
}

function setupProjectSort() {
    const btn = document.getElementById('project-sort-btn');
    const dropdown = document.getElementById('project-sort-dropdown');

    updateSortUI();

    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.classList.toggle('open');
    });

    document.addEventListener('click', () => {
        dropdown.classList.remove('open');
        document.querySelectorAll('.dn-select-dropdown.open').forEach(d => {
            d.classList.remove('open');
            if (d._cleanup) { d._cleanup(); d._cleanup = null; }
        });
    });
    dropdown.addEventListener('click', (e) => e.stopPropagation());

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

    btn.classList.toggle('sorted', currentSort !== 'created_desc');

    const iconMap = {
        name_asc:     'ph-sort-ascending',
        name_desc:    'ph-sort-descending',
        created_desc: 'ph-sort-ascending',
        created_asc:  'ph-sort-descending',
        updated_desc: 'ph-clock-clockwise',
    };
    btn.querySelector('i').className = `ph-light ${iconMap[currentSort] || 'ph-sort-ascending'}`;

    dropdown.querySelectorAll('.sort-option').forEach(opt => {
        opt.classList.toggle('active', opt.dataset.sort === currentSort);
    });
}


// ==========================================
// PROJECT — Select & load
// ==========================================

async function selectProject(projectId, tab = null, searchQuery = null, searchItemId = null) {
    try {
        currentProject = await getProject(projectId);

        document.getElementById('welcome-screen').style.display = 'none';
        document.getElementById('project-view').style.display = 'flex';

        document.getElementById('project-title').textContent = currentProject.title;
        document.getElementById('project-description').textContent = currentProject.description || '';

        document.querySelectorAll('.project-item').forEach(item => {
            item.classList.toggle('active', item.dataset.id === projectId);
        });

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
// PROJECT — Inline editing
// ==========================================

function setupInlineEditing() {
    document.getElementById('project-title').addEventListener('click', () => startInlineEdit('title'));
    document.getElementById('project-description').addEventListener('click', () => startInlineEdit('description'));
}

function startInlineEdit(field) {
    const el = document.getElementById(field === 'title' ? 'project-title' : 'project-description');

    if (el.contentEditable === 'true') return;

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
// PROJECT — Menu (delete only)
// ==========================================

function setupProjectMenu() {
    const menuBtn = document.getElementById('project-menu-btn');
    const dropdown = document.getElementById('project-menu-dropdown');

    menuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.classList.toggle('open');
        menuBtn.classList.toggle('open', dropdown.classList.contains('open'));
    });

    document.addEventListener('click', () => {
        dropdown.classList.remove('open');
        menuBtn.classList.remove('open');
    });
    dropdown.addEventListener('click', (e) => e.stopPropagation());

    dropdown.querySelectorAll('.project-menu-item').forEach(item => {
        item.addEventListener('click', async () => {
            dropdown.classList.remove('open');
            menuBtn.classList.remove('open');

            if (item.dataset.action === 'delete') {
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
// TABS
// ==========================================

function setupTabs() {
    const noteControls    = document.querySelector('.note-controls');
    const snippetControls = document.querySelector('.snippet-controls');
    const todoControls    = document.querySelector('.todo-controls');
    const snippetViewToggle = document.getElementById('snippet-view-toggle');
    const todoToggle        = document.getElementById('todo-view-toggle');

    noteControls.classList.add('visible');

    document.querySelectorAll('.tab').forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.tab;
            currentTab = tab;

            document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            document.querySelectorAll('.tab-pane').forEach(tc => tc.classList.remove('active'));
            document.getElementById(`tab-${tab}`).classList.add('active');

            noteControls.classList.toggle('visible', tab === 'notes');
            snippetControls.classList.toggle('visible', tab === 'snippets');
            todoControls.classList.toggle('visible', tab === 'todos');

            loadTabContent(tab);
        });
    });

    todoToggle.querySelectorAll('.btn-view-toggle').forEach(btn => {
        btn.addEventListener('click', () => {
            todoToggle.querySelectorAll('.btn-view-toggle').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            todoManager.switchView(btn.dataset.view);
        });
    });

    snippetViewToggle.querySelectorAll('.btn-view-toggle').forEach(btn => {
        btn.addEventListener('click', () => {
            snippetViewToggle.querySelectorAll('.btn-view-toggle').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            snippetManager.switchView(btn.dataset.view);
        });
    });

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
}

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
        btn.classList.toggle('active', sort !== defaultSort);
    };

    updateUI(onSort.get());

    btn.addEventListener('click', (e) => {
        e.stopPropagation();
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


// ==========================================
// TAB CONTENT
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
    }
}


// ==========================================
// SIDEBAR TOGGLE
// ==========================================

function setupSidebarToggle() {
    const layout = document.querySelector('.layout');
    const toggleBtn = document.getElementById('sidebar-toggle');
    const openBtn = document.getElementById('sidebar-open');
    const overlay = document.getElementById('sidebar-overlay');
    const isMobile = () => window.innerWidth <= 768;

    if (!isMobile() && localStorage.getItem('devnote_sidebar_hidden') === 'true') {
        layout.classList.add('sidebar-hidden');
    }

    toggleBtn.addEventListener('click', () => {
        if (isMobile()) {
            layout.classList.remove('sidebar-visible');
        } else {
            layout.classList.add('sidebar-hidden');
            localStorage.setItem('devnote_sidebar_hidden', 'true');
        }
    });

    openBtn.addEventListener('click', () => {
        if (isMobile()) {
            layout.classList.add('sidebar-visible');
        } else {
            layout.classList.remove('sidebar-hidden');
            localStorage.setItem('devnote_sidebar_hidden', 'false');
        }
    });

    overlay.addEventListener('click', () => {
        layout.classList.remove('sidebar-visible');
    });

    window.addEventListener('resize', () => {
        if (!isMobile()) {
            layout.classList.remove('sidebar-visible');
        } else {
            layout.classList.remove('sidebar-hidden');
        }
    });
}


// ==========================================
// INIT
// ==========================================

document.addEventListener('DOMContentLoaded', async () => {
    await checkAuth();

    projectModal = new ModalManager({
        modalId: 'project-modal',
        formId: 'project-form',
        onSubmit: async (data) => {
            const project = await createProject(data.title, data.description);
            await loadProjects();
            selectProject(project.id);
        }
    });

    noteManager    = new NoteManager();
    snippetManager = new SnippetManager();
    todoManager    = new TodoManager();

    searchManager = new SearchManager({
        onSelectProject: (projectId, tab, query, itemId) => {
            selectProject(projectId, tab, query, itemId);
        }
    });

    document.getElementById('search-btn').addEventListener('click', () => searchManager.open());
    document.getElementById('newProjectBtn').addEventListener('click', () => projectModal.open());

    document.getElementById('logout-btn').addEventListener('click', async () => {
        try {
            await logout();
        } finally {
            window.location.href = '/src/pages/login.html';
        }
    });

    document.getElementById('projects-list').addEventListener('scroll', () => {
        const el = document.getElementById('projects-list');
        const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
        if (distanceFromBottom < 100) loadMoreProjects();
    });

    await loadProjects();
    setupProjectSort();
    setupTabs();
    setupProjectMenu();
    setupInlineEditing();
    setupSidebarToggle();
});
