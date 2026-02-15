import { getTodos, deleteTodo, updateTodo } from '../services/todoService.js';


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

export default class TodoManager {
    constructor(modal) {
        this.modal = modal;
        this.projectId = null;
        this.container = document.getElementById('todos-list');
    }

    setProject(projectId) {
        this.projectId = projectId;
    }

    async load() {
        if (!this.projectId) return;
        this.container.innerHTML = '<p class="loading">Loading...</p>';

        try {
            const data = await getTodos(this.projectId);
            const todos = data.results ?? data;
            this.display(todos);
            this.attachEventListeners(todos);
        } catch (error) {
            console.error('Error loading todos:', error);
            this.container.innerHTML = '<p class="error">Unable to load todos</p>';
        }
    }

    display(todos) {
        if (todos.length === 0) {
            this.container.innerHTML = '<p class="empty">No todos yet</p>';
            return;
        }

        this.container.innerHTML = todos.map(todo => {
            const priority = PRIORITY_BADGES[todo.priority] || PRIORITY_BADGES.medium;
            const statusBadge = STATUS_BADGES[todo.status] || STATUS_BADGES.pending;
            const isDone = todo.status === 'done';

            return `
                <div class="todo-card ${isDone ? 'todo-done' : ''}" data-id="${todo.id}">
                    <div class="todo-card-header">
                        <input
                            type="checkbox"
                            class="todo-checkbox"
                            data-id="${todo.id}"
                            ${isDone ? 'checked' : ''}
                            title="Mark as done"
                        >
                        <span class="todo-title ${isDone ? 'todo-title-done' : ''}">${todo.title}</span>
                        <div class="item-actions">
                            <button class="edit-todo-btn btn-card-action" data-id="${todo.id}">Edit</button>
                            <button class="delete-todo-btn btn-card-action btn-card-danger" data-id="${todo.id}">Delete</button>
                        </div>
                    </div>
                    ${todo.description ? `<p class="todo-description">${todo.description}</p>` : ''}
                    <div class="todo-card-footer">
                        <span class="badge ${priority.class}">${priority.label}</span>
                        <span class="badge ${statusBadge.class}">${statusBadge.label}</span>
                        <span class="card-date">${new Date(todo.created_at).toLocaleDateString()}</span>
                    </div>
                </div>
            `;
        }).join('');
    }

    attachEventListeners(todos) {
        // Checkbox → mark as done
        this.container.querySelectorAll('.todo-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', async () => {
                const todoId = checkbox.dataset.id;
                try {
                    await updateTodo(todoId, undefined, undefined, 'done', undefined);
                    await this.load();
                } catch (error) {
                    console.error('Error updating todo:', error);
                    checkbox.checked = !checkbox.checked; // Rollback visuel
                }
            });
        });

        this.container.querySelectorAll('.edit-todo-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const todo = todos.find(t => t.id === btn.dataset.id);
                if (todo) this.openEditModal(todo);
            });
        });

        this.container.querySelectorAll('.delete-todo-btn').forEach(btn => {
            btn.addEventListener('click', () => this.delete(btn.dataset.id));
        });
    }

    openEditModal(todo) {
        this.modal.open({
            id: todo.id,
            title: todo.title,
            description: todo.description,
            status: todo.status,
            priority: todo.priority
        });
    }

    async delete(todoId) {
        if (!confirm('Delete this todo ?')) return;

        try {
            await deleteTodo(todoId);
            await this.load();
        } catch (error) {
            console.error('Error deleting todo:', error);
            alert('Unable to delete the todo');
        }
    }
}