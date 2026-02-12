import api from '../services/api.js';
import { ModalManager } from '../utils/modalManager.js';

// ==========================================
// STATE MANAGEMENT
// ==========================================

let currentProject = null;
let currentTab = 'notes';

// ==========================================
// MODAL MANAGERS
// ==========================================

let projectModal, noteModal, snippetModal, todoModal;

// ==========================================
// INITIALIZE MODALS
// ==========================================

function initializeModals() {

    // --- PROJECT MODAL ---
    projectModal = new ModalManager({
        modalId: 'project-modal',
        formId: 'project-form',
        onSubmit: async (data) => {
            // We retrieve the response from the API to obtain the ID
            const response = await api.post('/projects/', {
                title: data.title,
                description: data.description
            });
            await loadProjects();
            // We use the response ID
            selectProject(response.data.id);
        }
    });

    // --- NOTE MODAL ---
    noteModal = new ModalManager({
        modalId: 'note-modal',
        formId: 'note-form',
        onSubmit: async (data) => {
            const editId = document.getElementById('note-form').dataset.editId;

            if (editId) {
                await api.patch(`/notes/${editId}/`, {
                    title: data.title,
                    content: data.content
                });
            } else {
                await api.post(`/projects/${currentProject.id}/notes/`, {
                    title: data.title,
                    content: data.content
                });
            }
            await loadTabContent('notes');
        }
    });

    // --- SNIPPET MODAL ---
    snippetModal = new ModalManager({
        modalId: 'snippet-modal',
        formId: 'snippet-form',
        onSubmit: async (data) => {
            const editId = document.getElementById('snippet-form').dataset.editId;

            if (editId) {
                await api.patch(`/snippets/${editId}/`, {
                    title: data.title,
                    language: data.language,
                    content: data.content
                });
            } else {
                await api.post(`/projects/${currentProject.id}/snippets/`, {
                    title: data.title,
                    language: data.language,
                    content: data.content
                });
            }
            await loadTabContent('snippets');
        }
    });

    // <!-- TODO MODAL -->
    todoModal = new ModalManager({
        modalId: 'todo-modal',
        formId: 'todo-form',
        onSubmit: async (data) => {
            const editId = document.getElementById('todo-form').dataset.editId;

            if (editId) {
                await api.patch(`/todos/${editId}/`, {
                    title: data.title,
                    description: data.description,
                    priority: data.priority
                });
            } else {
                await api.post(`/projects/${currentProject.id}/todos/`, {
                    title: data.title,
                    description: data.description,
                    priority: data.priority
                });
            }
            await loadTabContent('todos');
        }
    });
}

// ==========================================
// AUTHENTICATION CHECK
// ==========================================

async function checkAuth() {
    try {
        const { data } = await api.get('/auth/me/');
        console.log('User connected:', data);

        const userName = document.getElementById('user-name');
        userName.textContent = `${data.first_name} ${data.last_name}`;

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
        const { data } = await api.get('/projects/');
        console.log('Projects loaded:', data);
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
        </div>
        `).join('');

    // Add click event to each project
    document.querySelectorAll('.project-item').forEach(item => {
        item.addEventListener('click', () => {
            const projectId = item.dataset.id;
            selectProject(projectId);
        });
    });
}

// ==========================================
// SELECT PROJECT (Show project view)
// ==========================================

async function selectProject(projectId) {
    try {
        const { data } = await api.get(`/projects/${projectId}/`);
        console.log('Project selected:', data);

        currentProject = data;

        // Hide welcome screen, show project view
        document.getElementById('welcome-screen').style.display = 'none';
        document.getElementById('project-view').style.display = 'block';

        // Update project title (utilise l'ID direct)
        document.getElementById('project-title').textContent = data.title;

        // Highlight selected project in sidebar
        document.querySelectorAll('.project-item').forEach(item => {
            item.classList.remove('active');
            if (item.dataset.id === projectId) {
                item.classList.add('active');
            }
        });

        // Load content for current tab
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

    let contentDiv;
    switch(tab) {
        case 'notes':
            contentDiv = document.getElementById('notes-list');
            break;
        case 'snippets':
            contentDiv = document.getElementById('snippets-list');
            break;
        case 'todos':
            contentDiv = document.getElementById('todos-list');
            break;
        default:
            return;
    }

    contentDiv.innerHTML = '<p>Loading...</p>';

    try {
        let endpoint = '';

        switch(tab) {
            case 'notes':
                endpoint = `/projects/${currentProject.id}/notes/`;
                break;
            case 'snippets':
                endpoint = `/projects/${currentProject.id}/snippets/`;
                break;
            case 'todos':
                endpoint = `/projects/${currentProject.id}/todos/`;
                break;
        }

        const { data } = await api.get(endpoint);
        console.log(`${tab} loaded:`, data);

        if (data.results.length === 0) {
            contentDiv.innerHTML = `<p>No ${tab} yet. Click + to create one</p>`;
        } else {
            displayTabItems(tab, data.results);
        }
    } catch (error) {
        console.error(`Error loading ${tab}:`, error);
        contentDiv.innerHTML = `<p>Error loading ${tab}</p>`;
    }
}

// ==========================================
// DISPLAY ITEMS IN TAB
// ==========================================

function displayTabItems(tab, items) {
    const divIds = { notes: 'notes-list', snippets: 'snippets-list', todos: 'todos-list' };
    const contentDiv = document.getElementById(divIds[tab]);
    if (!contentDiv) return;

    if (tab === 'notes') {
        contentDiv.innerHTML = items.map(note => `
            <div class="note-card">
                <h3>${note.title}</h3>
                <p>${note.content.substring(0, 150)}${note.content.length > 150 ? '...' : ''}</p>
                <div class="note-card-footer">
                    <span class="note-date">${new Date(note.created_at).toLocaleDateString()}</span>
                    <div class="note-actions">
                        <button class="edit-btn" data-id="${note.id}">✏️</button>
                        <button class="delete-btn" data-id="${note.id}">🗑️</button>
                    </div>
                </div>
            </div>
        `).join('');
        attachNoteEventListeners(items);
    }

    if (tab === 'snippets') {
        contentDiv.innerHTML = items.map(snippet => `
            <div class="note-card">
                <div class="item-header">
                    <h4>${snippet.title}</h4>
                    <span class="language-badge">${snippet.language}</span>
                </div>
                <pre><code>${snippet.content.substring(0, 150)}${snippet.content.length > 150 ? '...' : ''}</code></pre>
                <div class="note-card-footer">
                    <span class="note-date">${new Date(snippet.created_at).toLocaleDateString()}</span>
                    <div class="note-actions">
                        <button class="edit-snippet-btn" data-id="${snippet.id}">✏️</button>
                        <button class="delete-snippet-btn" data-id="${snippet.id}">🗑️</button>
                    </div>
                </div>
            </div>
        `).join('');
        attachSnippetEventListeners(items);
    }

    if (tab === 'todos') {
        contentDiv.innerHTML = items.map(todo => `
            <div class="note-card">
                <div class="item-header">
                    <span>${todo.title}</span>
                    <span class="language-badge">${todo.priority}</span>
                </div>
                <p>${todo.description || ''}</p>
                <div class="note-card-footer">
                    <span class="note-date">${todo.status}</span>
                    <div class="note-actions">
                        <button class="edit-todo-btn" data-id="${todo.id}">✏️</button>
                        <button class="delete-todo-btn" data-id="${todo.id}">🗑️</button>
                    </div>
                </div>
            </div>
        `).join('');
        attachTodoEventListeners(items);
    }
}

// ==========================================
// ATTACH NOTE EVENT LISTENERS
// ==========================================

function attachNoteEventListeners(notes) {
    // Edit buttons
    document.querySelectorAll('.edit-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const noteId = btn.dataset.id;
            const note = notes.find(n => n.id == noteId);
            openEditNoteModal(note);
        });
    });

    // Delete buttons
    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const noteId = btn.dataset.id;
            await deleteNote(noteId);
        });
    });
}

// ==========================================
// ATTACH SNIPPET EVENT LISTENERS
// ==========================================

function attachSnippetEventListeners(snippets) {
    document.querySelectorAll('.edit-snippet-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const snippet = snippets.find(s => s.id === btn.dataset.id);
            snippetModal.open({ id: snippet.id, title: snippet.title,
                language: snippet.language, content: snippet.content });
        });
    });

    document.querySelectorAll('.delete-snippet-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            if (!confirm('Delete this snippet?')) return;
            await api.delete(`/snippets/${btn.dataset.id}/`);
            await loadTabContent('snippets');
        });
    });
}

// ==========================================
// ATTACH TODO EVENT LISTENERS
// ==========================================

function attachTodoEventListeners(todos) {
    document.querySelectorAll('.edit-todo-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const todo = todos.find(t => t.id === btn.dataset.id);
            todoModal.open({ id: todo.id, title: todo.title,
                description: todo.description, priority: todo.priority });
        });
    });

    document.querySelectorAll('.delete-todo-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            if (!confirm('Delete this TODO?')) return;
            await api.delete(`/todos/${btn.dataset.id}/`);
            await loadTabContent('todos');
        });
    });
}

// ==========================================
// OPEN EDIT NOTE MODAL
// ==========================================

function openEditNoteModal(note) {
    noteModal.open({
        title: note.title,
        content: note.content,
        id: note.id
    });
}

// ==========================================
// DELETE NOTE
// ==========================================

async function deleteNote(noteId) {
    // Confirm before suppr
    const confirmed = confirm('Are you sure you want to delete this note ?');

    if (!confirmed) {
        return;
    }

    try {
        console.log('Deleting note:', noteId);

        await api.delete(`/notes/${noteId}/`);

        console.log('Note deleted successfully');

        // Reload notes list
        await loadTabContent('notes');

    } catch (error) {
        console.error('Error deleting note:', error);
        alert('Failed to delete note');
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

    const addNoteBtn = document.getElementById('add-note-btn');
    if (addNoteBtn) {
        addNoteBtn.addEventListener('click', () => noteModal.open());
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
    await loadProjects();
    setupTabs();
    setupModalButtons();
    
    console.log('Dashboard ready!');
});
