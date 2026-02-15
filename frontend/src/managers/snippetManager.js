import { getSnippets, deleteSnippet } from '../services/snippetService.js';


const DEVICONS = {
    javascript: 'devicon-javascript-plain',
    python: 'devicon-python-plain',
    java: 'devicon-java-plain',
    csharp: 'devicon-csharp-plain',
    php: 'devicon-php-plain',
    ruby: 'devicon-ruby-plain',
    go: 'devicon-go-plain',
    rust: 'devicon-rust-plain',
    html: 'devicon-html5-plain',
    css: 'devicon-css3-plain',
    bash: 'devicon-bash-plain',
    sql: 'devicon-azuresqldatabase-plain',
    typescript: 'devicon-typescript-plain',
};

export default class SnippetManager {
    constructor(modal) {
        this.modal = modal;
        this.projectId = null;
        this.container = document.getElementById('snippets-list');
    }

    setProject(projectId) {
        this.projectId = projectId;
    }

    async load() {
        if (!this.projectId) return;
        this.container.innerHTML = '<p class="loading">Loading...</p>';
        
        try {
            const data = await getSnippets(this.projectId);
            const snippets = data.results ?? data;
            this.display(snippets);
            this.attachEventListeners(snippets)
        } catch (error) {
            console.error('Error loading snippets:', error);
            this.container.innerHTML = '<p class="error">Unable to load snippets</p>';
        }
    }

    getIcon(language) {
        const iconClass = DEVICONS[language?.toLowerCase()];
        if (iconClass) {
            return `<i class="${iconClass} snippet-lang-icon"></i>`;
        }
        return `<span class="snippet-lang-text">${language || 'text'}</span>`;
    }

    display(snippets) {
        if (snippets.length === 0) {
            this.container.innerHTML = '<p class="empty">No snippets yet</p>';
            return;
        }

        this.container.innerHTML = snippets.map(snippet => `
            <div class="snippet-card">
                <div class="snippet-card-header">
                    <div class="snippet-lang-badge">
                        ${this.getIcon(snippet.language)}
                        <span class="snippet-lang-name">${snippet.language || 'text'}</span>
                    </div>
                    <div class="item-actions">
                        <button class="edit-snippet-btn btn-card-action" data-id="${snippet.id}">Edit</button>
                        <button class="delete-snippet-btn btn-card-action btn-card-danger" data-id="${snippet.id}">Delete</button>
                    </div>
                </div>
                <h4 class="snippet-title">${snippet.title}</h4>
                ${snippet.description ? `<p class="snippet-description">${snippet.description}</p>` : ''}
                <pre class="snippet-preview"><code>${snippet.content.substring(0, 200)}${snippet.content.length > 200 ? '\n...' : ''}</code></pre>
                <div class="snippet-card-footer">
                    <span class="card-date">${new Date(snippet.created_at).toLocaleDateString()}</span>
                </div>
            </div>
        `).join('');
    }

    attachEventListeners(snippets) {
        this.container.querySelectorAll('.edit-snippet-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const snippet = snippets.find(s => s.id === btn.dataset.id);
                if (snippet) this.openEditModal(snippet);
            });
        });

        this.container.querySelectorAll('.delete-snippet-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.delete(btn.dataset.id);
            });
        });
    }

    openEditModal(snippet) {
        this.modal.open({
            id: snippet.id,
            title: snippet.title,
            language: snippet.language,
            description: snippet.description,
            content: snippet.content
        });
    }

    async delete(snippetId) {
        if (!confirm('Delete this snippet ?')) return;

        try {
            await deleteSnippet(snippetId);
            await this.load();
        } catch (error) {
            console.error('Error deleting snippet:', error);
            alert('Unable to delete the snippet')
        }
    }
}