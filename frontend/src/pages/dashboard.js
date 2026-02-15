import { ModalManager } from '../utils/modalManager.js';
import NoteManager from '../managers/noteManager.js';
import SnippetManager from '../managers/snippetManager.js';
import TodoManager from '../managers/todoManager.js';
import SearchManager from '../managers/searchManager.js';
import { createProject, getProjects, getProject, deleteProject } from '../services/projectService.js';
import { createNote, updateNote } from '../services/noteService.js';
import { createSnippet, updateSnippet } from '../services/snippetService.js';
import { createTodo, updateTodo } from '../services/todoService.js';
import { getCurrentUser, logout } from '../services/authService.js';


// ==========================================
// STATE MANAGEMENT
// ==========================================

let currentProject = null;
let currentTab = 'notes';

// ==========================================
// MODAL MANAGERS
// ==========================================

let projectModal, noteModal, snippetModal, todoModal;
let noteManager, snippetManager, todoManager, searchManager;

// ==========================================
// INITIALIZE MODALS
// ==========================================

function initializeModals() {

    // --- PROJECT MODAL ---
    projectModal = new ModalManager({
        modalId: 'project-modal',
        formId: 'project-form',
        onSubmit: async (data) => {
            const project = await createProject(data.title, data.description);
            await loadProjects();
            selectProject(project.id);
        }
    });

    // --- NOTE MODAL ---
    noteModal = new ModalManager({
        modalId: 'note-modal',
        formId: 'note-form',
        onSubmit: async (data) => {
            const editId = document.getElementById('note-form').dataset.editId;

            if (editId) {
                await updateNote(editId, data.title, data.content);
            } else {
                await createNote(currentProject.id, data.title, data.content);
            }
            await noteManager.load();
        }
    });

    // --- SNIPPET MODAL ---
    snippetModal = new ModalManager({
        modalId: 'snippet-modal',
        formId: 'snippet-form',
        onSubmit: async (data) => {
            const editId = document.getElementById('snippet-form').dataset.editId;

            if (editId) {
                await updateSnippet(editId, data.title, data.language, data.content, data.description);
            } else {
                await createSnippet(currentProject.id, data.title, data.language, data.content, data.description);
            }
            await snippetManager.load();
        }
    });

    // --- TODO MODAL ---
    todoModal = new ModalManager({
        modalId: 'todo-modal',
        formId: 'todo-form',
        onSubmit: async (data) => {
            const editId = document.getElementById('todo-form').dataset.editId;

            if (editId) {
                await updateTodo(editId, data.title, data.description, data.status, data.priority);
            } else {
                await createTodo(currentProject.id, data.title, data.description, data.status, data.priority);
            }
            await todoManager.load();
        }
    });

    noteManager = new NoteManager(noteModal);
    snippetManager = new SnippetManager(snippetModal);
    todoManager = new TodoManager(todoModal);
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
        displayProjects(data.results);
    } catch (error) {
        console.log('Error loading projects:', error);
        document.getElementById('projects-list').innerHTML =
        '<p style="padding: 20px; color: #888;">Error loading projects</p>';
    }
}

// ==========================================
// DISPLAY PROJECTS SIDEBAR
// ==========================================

function displayProjects(projects) {
    const container = document.getElementById('projects-list');

    if (projects.length === 0) {
        container.innerHTML = '<p>No project</p>';
        return;
    }

    container.innerHTML = projects.map(project => `
        <div class="project-item" data-id="${project.id}">
            <span class="project-icon">📁</span>
            <span class="project-name">${project.title}</span>
            <button class="btn-delete-project" data-id='${project.id}' title="DeleteProject">🗑️</button>
        </div>
        `).join('');

    // Add click event to each project
    document.querySelectorAll('.project-item').forEach(item => {
        item.addEventListener('click', () => {
            selectProject(item.dataset.id);
        });
    });

    // Add click on delete button
    document.querySelectorAll('.btn-delete-project').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const projectId = btn.dataset.id;

            if (!confirm('Delete this project and all its contents ?')) return;

            try {
                await deleteProject(projectId);

                if (currentProject?.id === projectId) {
                    currentProject = null;
                    document.getElementById('project-view').style.display = 'none';
                    document.getElementById('welcome-screen').style.display = 'flex';
                }

                await loadProjects();
            } catch (error) {
                console.error('Error deleting project', error);
                alert('Failed to delete project');
            }
        });
    });
}

// ==========================================
// SELECT PROJECT (Show project view)
// ==========================================

async function selectProject(projectId, tab = null) {
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

        loadTabContent(currentTab);

    } catch (error) {
        console.error('Error loading project:', error);
        alert('Failed to load project');
    }
}

// ==========================================
// TABS MANAGEMENT
// ==========================================

function setupTabs() {
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

            // Load content for this tab
            loadTabContent(tab);
        });
    });
}

// ==========================================
// LOAD TAB CONTENT
// ==========================================

async function loadTabContent(tab) {
    if (!currentProject) return;

    if (tab === 'notes') {
        await noteManager.load()
        return;
    }

    if (tab === 'snippets') {
        await snippetManager.load()
        return;
    }

    if (tab === 'todos') {
        await todoManager.load()
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
        onSelectProject: (projectId, tab) => {
            selectProject(projectId, tab);
        }
    });

    document.getElementById('search-btn').addEventListener('click', () => {
        searchManager.open();
    });

    await loadProjects();
    setupTabs();
    setupModalButtons();

    // Logout
    document.getElementById('logout-btn').addEventListener('click', async () => {
        try {
            await logout();
        } finally {
            window.location.href = '/src/pages/login.html';
        }
    });
    console.log('Dashboard ready!');
});
