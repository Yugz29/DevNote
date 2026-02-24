import BaseManager from '../utils/baseManager.js';
import { getAllTodos, getTodos, createTodo, updateTodo, deleteTodo } from '../services/todoService.js';
import { showAlert, showConfirm } from '../utils/dialog.js';
import { escape } from '../utils/escape.js';


const PRIORITY_BADGES = {
    low:    { label: 'Low',    class: 'badge-low' },
    medium: { label: 'Medium', class: 'badge-medium' },
    high:   { label: 'High',   class: 'badge-high' },
};

const STATUS_BADGES = {
    pending:     { label: 'Pending',     class: 'badge-pending' },
    in_progress: { label: 'In Progress', class: 'badge-in-progress' },
    done:        { label: 'Done',        class: 'badge-done' },
};

const STATUS_LABELS = {
    pending:     'Pending',
    in_progress: 'In Progress',
    done:        'Done',
};

const NEXT_STATUS = {
    pending:     'in_progress',
    in_progress: 'done',
    done:        'pending'
};

export default class TodoManager extends BaseManager {
    constructor() {
        super(null, document.getElementById('todos-list'));
        this.currentView = this.getViewPreference();
        this._allTodos = [];
        // Todos are always fully loaded — no infinite scroll needed
        this.nextPageUrl = null;
    }

    // Override loadMore to do nothing
    async loadMore() {}


    // ==========================================
    // VIEW PREFERENCE (localStorage)
    // ==========================================

    getViewPreference() {
        return localStorage.getItem('devnote_todo_view') || 'list';
    }

    saveViewPreference(view) {
        localStorage.setItem('devnote_todo_view', view);
    }

    getSortPreference() {
        return localStorage.getItem('devnote_todo_sort') || 'priority';
    }

    saveSortPreference(sort) {
        localStorage.setItem('devnote_todo_sort', sort);
    }

    sortTodos(todos) {
        const sort = this.getSortPreference();
        const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };

        return [...todos].sort((a, b) => {
            if (sort === 'priority') {
                return (PRIORITY_ORDER[a.priority] ?? 1) - (PRIORITY_ORDER[b.priority] ?? 1);
            }
            if (sort === 'updated') {
                return new Date(b.updated_at) - new Date(a.updated_at);
            }
            // created
            return new Date(b.created_at) - new Date(a.created_at);
        });
    }

    setSort(sort) {
        this.saveSortPreference(sort);
        this.switchView(this.currentView);
    }

    getCollapsedGroups() {
        const key = `devnote_todo_collapsed_${this.projectId}`;
        const saved = localStorage.getItem(key);
        return saved ? new Set(JSON.parse(saved)) : new Set();
    }

    saveCollapsedGroup(status, isCollapsed) {
        const key = `devnote_todo_collapsed_${this.projectId}`;
        const collapsed = this.getCollapsedGroups();
        if (isCollapsed) collapsed.add(status);
        else collapsed.delete(status);
        localStorage.setItem(key, JSON.stringify([...collapsed]));
    }

    attachGroupToggleListeners() {
        this.container.querySelectorAll('.btn-toggle-group').forEach(btn => {
            btn.addEventListener('click', () => {
                const status = btn.dataset.status;
                const icon = btn.querySelector('i');

                // List view
                const group = this.container.querySelector(`.todo-group[data-status="${status}"]`);
                if (group) {
                    const items = group.querySelector('.todo-group-items');
                    const isCollapsed = items.classList.toggle('collapsed');
                    icon.classList.toggle('rotated', isCollapsed);
                    this.saveCollapsedGroup(status, isCollapsed);
                    return;
                }

                // Kanban view
                const column = this.container.querySelector(`.kanban-column[data-status="${status}"]`);
                if (column) {
                    const isCollapsed = column.classList.toggle('collapsed');
                    icon.classList.toggle('rotated', isCollapsed);
                    this.saveCollapsedGroup(status, isCollapsed);
                }
            });
        });
    }


    // ==========================================
    // FETCH
    // ==========================================

    async fetchPage(projectId, url = null) {
        if (url) return await getTodos(null, url);
        // Fetch all pages at once — grouping by status requires complete data
        const allItems = await getAllTodos(projectId ?? this.projectId);
        return { results: allItems, next: null };
    }

    async appendItems(items) {
        // appendItems is not used — fetchPage always returns all todos at once
        // Kept to satisfy BaseManager interface
        this._allTodos = [...this._allTodos, ...items];
    }


    // ==========================================
    // RENDER TOOLBAR (toggle + add button)
    // ==========================================

    renderAddCard() {
        return `
            <div class="snippet-add-card todo-add-card" id="todo-add-line">
                <span class="note-add-icon">+</span>
                <span class="note-add-text">New todo...</span>
            </div>
        `;
    }


    // ==========================================
    // RENDER TODO CARD
    // ==========================================

    renderTodo(todo) {
        const priority = PRIORITY_BADGES[todo.priority] || PRIORITY_BADGES.medium;
        const statusBadge = STATUS_BADGES[todo.status] || STATUS_BADGES.pending;

        return `
            <div class="todo-card ${todo.status === 'done' ? 'is-done' : ''}" data-id="${todo.id}">
                <div class="todo-card-header">
                    <button
                        class="todo-status-btn badge ${statusBadge.class}"
                        data-id="${todo.id}"
                        data-status="${todo.status}"
                        title="Click to change status"
                    >${statusBadge.label}</button>
                    <span class="todo-title">${escape(todo.title)}</span>
                    <div class="item-actions">
                        <button class="edit-todo-btn btn-card-icon-action" data-id="${todo.id}" title="Edit"><i class="ph-light ph-pencil-simple"></i></button>
                        <button class="delete-todo-btn btn-card-icon-action btn-card-icon-danger" data-id="${todo.id}" title="Delete"><i class="ph-light ph-trash"></i></button>
                    </div>
                </div>
                ${todo.description ? `<p class="todo-description">${escape(todo.description)}</p>` : ''}
                <div class="todo-card-footer">
                    <span class="badge ${priority.class}">${priority.label}</span>
                    <span class="card-date">${new Date(todo.created_at).toLocaleDateString()}</span>
                </div>
            </div>
        `;
    }


    // ==========================================
    // LIST VIEW — groupé par status
    // ==========================================

    renderListView(todos) {
        const sorted = this.sortTodos(todos);
        const groups = {
            pending:     sorted.filter(t => t.status === 'pending'),
            in_progress: sorted.filter(t => t.status === 'in_progress'),
            done:        sorted.filter(t => t.status === 'done'),
        };

        const collapsed = this.getCollapsedGroups();

        const html = Object.entries(groups).map(([status, items]) => {
            const badge = STATUS_BADGES[status];
            const addCard = status === 'pending' ? this.renderAddCard() : '';
            const isCollapsed = collapsed.has(status);
            return `
                <div class="todo-group" data-status="${status}">
                    <div class="todo-group-header">
                        <button class="btn-toggle-group" data-status="${status}" title="Toggle">
                            <i class="ph-light ph-caret-down ${isCollapsed ? 'rotated' : ''}"></i>
                        </button>
                        <span class="badge ${badge.class}">${badge.label}</span>
                        <span class="todo-group-count">${items.length}</span>
                    </div>
                    <div class="todo-group-items ${isCollapsed ? 'collapsed' : ''}">
                        ${addCard}
                        ${items.length > 0
                            ? items.map(todo => this.renderTodo(todo)).join('')
                            : `<p class="todo-group-empty">No ${STATUS_LABELS[status].toLowerCase()} todos</p>`
                        }
                    </div>
                </div>
            `;
        }).join('');

        this.container.innerHTML = `<div class="todo-list-view">${html}</div>`;
        this.attachGroupToggleListeners();
    }


    // ==========================================
    // KANBAN VIEW — 3 colonnes
    // ==========================================

    renderKanbanView(todos) {
        const sorted = this.sortTodos(todos);
        const columns = {
            pending:     sorted.filter(t => t.status === 'pending'),
            in_progress: sorted.filter(t => t.status === 'in_progress'),
            done:        sorted.filter(t => t.status === 'done'),
        };

        const collapsed = this.getCollapsedGroups();

        const html = Object.entries(columns).map(([status, items]) => {
            const badge = STATUS_BADGES[status];
            const addCard = status === 'pending' ? this.renderAddCard() : '';
            const isCollapsed = collapsed.has(status);
            return `
                <div class="kanban-column ${isCollapsed ? 'collapsed' : ''}" data-status="${status}">
                    <div class="kanban-column-header">
                        <button class="btn-toggle-group" data-status="${status}" title="Toggle">
                            <i class="ph-light ph-caret-down ${isCollapsed ? 'rotated' : ''}"></i>
                        </button>
                        <span class="badge ${badge.class}">${badge.label}</span>
                        <span class="todo-group-count">${items.length}</span>
                    </div>
                    <div class="kanban-column-items ${items.length === 0 ? 'kanban-column-empty' : ''}">
                        ${items.length === 0 && addCard
                            ? addCard
                            : `
                                ${addCard}
                                ${items.map(todo => this.renderTodo(todo)).join('')}
                                ${items.length === 0 ? `<p class="todo-group-empty">Empty</p>` : ''}
                              `
                        }
                    </div>
                </div>
            `;
        }).join('');

        this.container.innerHTML = `<div class="todo-kanban-view">${html}</div>`;
        this.attachGroupToggleListeners();
    }


    // ==========================================
    // DISPLAY (called by BaseManager.load)
    // ==========================================

    display(todos) {
        this._allTodos = todos;

        if (this.currentView === 'kanban') {
            this.renderKanbanView(todos);
        } else {
            this.renderListView(todos);
        }
    }


    // ==========================================
    // EVENT LISTENERS
    // ==========================================

    switchView(view) {
        this.currentView = view;
        this.saveViewPreference(view);
        if (view === 'kanban') {
            this.renderKanbanView(this._allTodos);
        } else {
            this.renderListView(this._allTodos);
        }
        this.attachEventListeners(this._allTodos);
    }

    attachEventListeners(todos) {
        // Add new todo — replaces itself like snippet add card
        const addLine = document.getElementById('todo-add-line');
        if (addLine) addLine.addEventListener('click', () => {
            if (this.container.querySelector('.todo-editor')) return;
            addLine.outerHTML = this.renderTodoEditor();
            this.attachEditorListeners();
        });

        // Status toggle (in-place)
        this.container.querySelectorAll('.todo-status-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const newStatus = NEXT_STATUS[btn.dataset.status];
                try {
                    await updateTodo(btn.dataset.id, undefined, undefined, newStatus, undefined);
                    btn.dataset.status = newStatus;
                    const badge = STATUS_BADGES[newStatus];
                    btn.textContent = badge.label;
                    btn.className = `todo-status-btn badge ${badge.class}`;

                    // Move card to correct column/group
                    const card = this.container.querySelector(`.todo-card[data-id="${btn.dataset.id}"]`);
                    if (card) {
                        const todo = this._allTodos.find(t => t.id === btn.dataset.id);
                        if (todo) todo.status = newStatus;
                    }

                    this.switchView(this.currentView);
                } catch (error) {
                    console.error('Error updating todo status:', error);
                }
            });
        });

        // Edit
        this.container.querySelectorAll('.edit-todo-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                if (this.container.querySelector('.todo-editor')) return;
                const todo = this._allTodos.find(t => t.id === btn.dataset.id);
                if (todo) {
                    const card = this.container.querySelector(`.todo-card[data-id="${todo.id}"]`);
                    card.outerHTML = this.renderTodoEditor(todo);
                    this.attachEditorListeners();
                }
            });
        });

        // Delete
        this.container.querySelectorAll('.delete-todo-btn').forEach(btn => {
            btn.addEventListener('click', () => this.delete(btn.dataset.id));
        });
    }


    // ==========================================
    // EDITOR
    // ==========================================

    renderTodoEditor(todo = null) {
        const currentStatus = todo?.status || 'pending';
        const currentPriority = todo?.priority || 'medium';

        return `
            <div class="todo-card todo-editor" data-id="${todo?.id || ''}">
                <div class="todo-card-header">
                    <input
                        class="todo-editor-title"
                        type="text"
                        placeholder="Title..."
                        value="${escape(todo?.title)}"
                    />
                    <div class="item-actions" style="opacity:1; visibility:visible; pointer-events:auto;">
                        <button class="btn-save-todo btn-card-icon-action" title="Save"><i class="ph-light ph-check"></i></button>
                        <button class="btn-cancel-todo btn-card-icon-action btn-card-icon-danger" title="Cancel"><i class="ph-light ph-x"></i></button>
                    </div>
                </div>
                <input
                    class="todo-editor-description"
                    type="text"
                    placeholder="Description... (optional)"
                    value="${escape(todo?.description)}"
                />
                <div class="todo-editor-footer">
                    <div class="dn-select-wrap">
                        <button class="dn-select-btn" type="button">
                            <span class="dn-select-value">${STATUS_BADGES[currentStatus].label}</span>
                            <i class="ph-light ph-caret-down dn-select-chevron"></i>
                        </button>
                        <div class="dn-select-dropdown">
                            ${Object.entries(STATUS_BADGES).map(([val, s]) => `
                                <button class="dn-select-option ${val === currentStatus ? 'active' : ''}" data-value="${val}" type="button">${s.label}</button>
                            `).join('')}
                        </div>
                        <input type="hidden" class="todo-editor-status" value="${currentStatus}">
                    </div>
                    <div class="dn-select-wrap">
                        <button class="dn-select-btn" type="button">
                            <span class="dn-select-value">${PRIORITY_BADGES[currentPriority].label}</span>
                            <i class="ph-light ph-caret-down dn-select-chevron"></i>
                        </button>
                        <div class="dn-select-dropdown">
                            ${Object.entries(PRIORITY_BADGES).map(([val, p]) => `
                                <button class="dn-select-option ${val === currentPriority ? 'active' : ''}" data-value="${val}" type="button">${p.label}</button>
                            `).join('')}
                        </div>
                        <input type="hidden" class="todo-editor-priority" value="${currentPriority}">
                    </div>
                </div>
            </div>
        `;
    }

    attachEditorListeners() {
        // Custom select dropdowns — portal mode inside kanban (overflow-x: auto clips absolute dropdowns)
        this.container.querySelectorAll('.dn-select-wrap').forEach(wrap => {
            const btn = wrap.querySelector('.dn-select-btn');
            const dropdown = wrap.querySelector('.dn-select-dropdown');
            const hidden = wrap.querySelector('input[type="hidden"]');
            const valueEl = wrap.querySelector('.dn-select-value');
            const chevron = wrap.querySelector('.dn-select-chevron');
            const inKanban = !!wrap.closest('.kanban-column');

            const openDropdown = () => {
                // Close all others
                document.querySelectorAll('.dn-select-dropdown.open').forEach(d => {
                    d.classList.remove('open');
                    if (d._cleanup) d._cleanup();
                });

                dropdown.classList.add('open');
                chevron.style.transform = 'rotate(180deg)';

                if (inKanban) {
                    // Portal: move to body with fixed positioning
                    const rect = btn.getBoundingClientRect();
                    dropdown.style.position = 'fixed';
                    dropdown.style.top = (rect.bottom + 4) + 'px';
                    dropdown.style.left = rect.left + 'px';
                    dropdown.style.minWidth = Math.max(130, rect.width) + 'px';
                    document.body.appendChild(dropdown);

                    const reposition = () => {
                        const r = btn.getBoundingClientRect();
                        dropdown.style.top = (r.bottom + 4) + 'px';
                        dropdown.style.left = r.left + 'px';
                    };
                    window.addEventListener('scroll', reposition, true);

                    dropdown._cleanup = () => {
                        window.removeEventListener('scroll', reposition, true);
                        dropdown.style.position = '';
                        dropdown.style.top = '';
                        dropdown.style.left = '';
                        dropdown.style.minWidth = '';
                        wrap.appendChild(dropdown);
                    };
                }
            };

            const closeDropdown = () => {
                dropdown.classList.remove('open');
                chevron.style.transform = '';
                if (dropdown._cleanup) {
                    dropdown._cleanup();
                    dropdown._cleanup = null;
                }
            };

            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (dropdown.classList.contains('open')) {
                    closeDropdown();
                } else {
                    openDropdown();
                }
            });

            dropdown.querySelectorAll('.dn-select-option').forEach(opt => {
                opt.addEventListener('click', () => {
                    hidden.value = opt.dataset.value;
                    valueEl.textContent = opt.textContent;
                    dropdown.querySelectorAll('.dn-select-option').forEach(o => o.classList.remove('active'));
                    opt.classList.add('active');
                    closeDropdown();
                });
            });
        });

        this.container.querySelector('.btn-save-todo')?.addEventListener('click', async () => {
            const editor = this.container.querySelector('.todo-editor');
            const id = editor.dataset.id;
            const title = editor.querySelector('.todo-editor-title').value.trim();
            const description = editor.querySelector('.todo-editor-description').value.trim();
            const status = editor.querySelector('.todo-editor-status').value;
            const priority = editor.querySelector('.todo-editor-priority').value;

            if (!title) { await showAlert('Title is required', 'info'); return; }

            try {
                if (id) {
                    await updateTodo(id, title, description, status, priority);
                } else {
                    await createTodo(this.projectId, title, description, status, priority);
                }
                await this.load();
            } catch (error) {
                console.error('Error saving todo:', error);
            }
        });

        this.container.querySelector('.btn-cancel-todo')?.addEventListener('click', async () => {
            await this.load();
        });
    }


    // ==========================================
    // DELETE
    // ==========================================

    async delete(todoId) {
        const confirmed = await showConfirm('Delete this todo?');
        if (!confirmed) return;
        try {
            await deleteTodo(todoId);
            await this.load();
        } catch (error) {
            console.error('Error deleting todo:', error);
            await showAlert('Unable to delete the todo');
        }
    }
}
