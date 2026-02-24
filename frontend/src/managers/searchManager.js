import { search } from '../services/searchService.js';
import { escape } from '../utils/escape.js';

const ICONS = {
    projects: '<i class="ph-light ph-folder"></i>',
    notes:    '<i class="ph-light ph-note"></i>',
    snippets: '<i class="ph-light ph-code"></i>',
    todos:    '<i class="ph-light ph-check-square"></i>'
};

export default class SearchManager {
    constructor({ onSelectProject }) {
        this.overlay = document.getElementById('search-overlay');
        this.input = document.getElementById('search-input');
        this.resultsContainer = document.getElementById('search-results');
        this.onSelectProject = onSelectProject;
        this.debounceTimer = null;

        this.init();
    }

    init() {
        this.overlay.addEventListener('click', (e) => {
            if (e.target === this.overlay) this.close();
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this.close();
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                this.open();
            }
        });

        this.input.addEventListener('input', () => {
            clearTimeout(this.debounceTimer);
            const query = this.input.value.trim();

            if (!query) {
                this.showHint();
                return;
            }

            this.debounceTimer = setTimeout(() => this.doSearch(query), 300);
        });
    }

    open() {
        this.overlay.classList.add('active');
        this.input.value = '';
        this.showHint();
        setTimeout(() => this.input.focus(), 50);
    }

    close() {
        this.overlay.classList.remove('active');
        this.input.value = '';
        clearTimeout(this.debounceTimer);
    }

    showHint() {
        this.resultsContainer.innerHTML = '<p class="search-hint">Search projects, notes, snippets and todos...</p>';
    }

    async doSearch(query) {
        this.resultsContainer.innerHTML = '<p class="search-hint">Searching...</p>';

        try {
            const data = await search(query);
            this.render(data, query);
        } catch (error) {
            console.error('Search error:', error);
            this.resultsContainer.innerHTML = '<p class="search-empty">Search failed. Please try again.</p>';
        }
    }

    render(data, query) {
        const total = (data.notes?.length || 0) + (data.snippets?.length || 0) + (data.todos?.length || 0);

        if (total === 0) {
            this.resultsContainer.innerHTML = `<p class="search-empty">No results for "<strong>${escape(query)}</strong>"</p>`;
            return;
        }

        let html = '';

        const sections = [
            { key: 'projects', label: 'Projects' },
            { key: 'notes', label: 'Notes' },
            { key: 'snippets', label: 'Snippets'},
            { key: 'todos', label: 'TODOs'}
        ];

        for (const { key, label } of sections) {
            const items = data[key];
            if (!items?.length) continue;

            html += `<div class="search-section-title">${label}</div>`;

            html += items.map(item => {
                const projectId = key === 'projects' ? item.id : item.project_id;
                const meta = key === 'projects'
                    ? (item.description || '')
                    : (item.content || item.description || '');
                return `
                <div class="search-result-item" data-type="${key}" data-id="${escape(item.id)}" data-project="${escape(projectId)}">
                    <span class="search-result-icon">${ICONS[key]}</span>
                    <div class="search-result-body">
                        <div class="search-result-title">${escape(item.title)}</div>
                        ${meta ? `<div class="search-result-meta">${escape(meta.substring(0, 60))}${meta.length > 60 ? '...' : ''}</div>` : ''}
                    </div>
                </div>`;
            }).join('');
        }
        
        this.resultsContainer.innerHTML= html;

        // Event listeners on results
        this.resultsContainer.querySelectorAll('.search-result-item').forEach(item => {
            item.addEventListener('click', () => {
                const projectId = item.dataset.project;
                const type = item.dataset.type;
                const itemId = item.dataset.id;
                this.close();
                if (type === 'projects') {
                    this.onSelectProject(projectId);
                } else {
                    this.onSelectProject(projectId, type, query, itemId);
                }
            });
        });
    }
}
