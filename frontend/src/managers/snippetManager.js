import BaseManager from '../utils/baseManager.js';
import { getSnippets, createSnippet, updateSnippet, deleteSnippet } from '../services/snippetService.js';
import { showAlert, showConfirm } from '../utils/dialog.js';
import { escape } from '../utils/escape.js';


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

export default class SnippetManager extends BaseManager {
    constructor() {
        super(null, document.getElementById('snippets-list'));
    }

    async fetchPage(projectId, url = null) {
        return await getSnippets(projectId ?? this.projectId, url);
    }

    async appendItems(items) {
        const html = items.map(snippet => this.renderSnippet(snippet)).join('');
        this.container.insertAdjacentHTML('beforeend', html);
    }

    getIcon(language) {
        const iconClass = DEVICONS[language?.toLowerCase()];
        if (iconClass) {
            return `<i class="${iconClass} snippet-lang-icon"></i>`;
        }
        return `<span class="snippet-lang-text">${language || 'text'}</span>`;
    }

    renderSnippet(snippet) {
        return `
            <div class="snippet-card" data-id="${snippet.id}">
                <div class="snippet-card-header">
                    <div class="snippet-lang-badge">
                        ${this.getIcon(snippet.language)}
                        <span class="snippet-lang-name">${snippet.language || 'text'}</span>
                    </div>
                    <div class="item-actions">
                        <button class="edit-snippet-btn btn-card-icon-action" data-id="${snippet.id}" title="Edit"><i class="ph-light ph-pencil-simple"></i></button>
                        <button class="delete-snippet-btn btn-card-icon-action btn-card-icon-danger" data-id="${snippet.id}" title="Delete"><i class="ph-light ph-trash"></i></button>
                    </div>
                </div>
                <h4 class="snippet-title">${escape(snippet.title)}</h4>
                ${snippet.description ? `<p class="snippet-description">${escape(snippet.description)}</p>` : ''}
                <pre class="snippet-preview"><code>${escape(snippet.content.substring(0, 200))}${snippet.content.length > 200 ? '\n...' : ''}</code></pre>
                <div class="snippet-card-footer">
                    <span class="card-date">${new Date(snippet.created_at).toLocaleDateString()}</span>
                </div>
            </div>
        `;
    }

    renderSnippetEditor(snippet = null) {
        const currentLang = snippet?.language || 'text';
        const allLangs = ['text', ...Object.keys(DEVICONS)];
        return `
            <div class="snippet-card snippet-editor" data-id="${snippet?.id || ''}">
                <div class="snippet-card-header">
                    <div class="snippet-lang-badge">
                        <div class="dn-select-wrap">
                            <button class="dn-select-btn" type="button">
                                <span class="dn-select-value">${currentLang}</span>
                                <i class="ph-light ph-caret-down dn-select-chevron"></i>
                            </button>
                            <div class="dn-select-dropdown">
                                ${allLangs.map(lang => `
                                    <button class="dn-select-option ${lang === currentLang ? 'active' : ''}" data-value="${lang}" type="button">${lang}</button>
                                `).join('')}
                            </div>
                            <input type="hidden" class="snippet-editor-language" value="${currentLang}">
                        </div>
                    </div>
                    <div class="item-actions" style="opacity:1; visibility:visible; pointer-events:auto;">
                        <button class="btn-save-snippet btn-card-icon-action" title="Save"><i class="ph-light ph-check"></i></button>
                        <button class="btn-cancel-snippet btn-card-icon-action btn-card-icon-danger" title="Cancel"><i class="ph-light ph-x"></i></button>
                    </div>
                </div>
                <input
                    class="snippet-editor-title"
                    type="text"
                    placeholder="Title..."
                    value="${escape(snippet?.title)}"
                />
                <input
                    class="snippet-editor-description"
                    type="text"
                    placeholder="Description... (optional)"
                    value="${escape(snippet?.description)}"
                />
                <textarea
                    class="snippet-editor-content"
                    placeholder="Code..."
                >${escape(snippet?.content)}</textarea>
            </div>
        `;
    }

    getViewPreference() {
        return localStorage.getItem('devnote_snippet_view') || 'grid';
    }

    saveViewPreference(view) {
        localStorage.setItem('devnote_snippet_view', view);
    }

    switchView(view) {
        this.currentView = view;
        this.saveViewPreference(view);
        if (this._allSnippets) {
            this.display(this._allSnippets);
            this.attachEventListeners(this._allSnippets);
        }
    }

    getSortPreference() {
        return localStorage.getItem('devnote_snippet_sort') || 'created';
    }

    saveSortPreference(sort) {
        localStorage.setItem('devnote_snippet_sort', sort);
    }

    sortSnippets(snippets) {
        const sort = this.getSortPreference();
        return [...snippets].sort((a, b) => {
            if (sort === 'updated') return new Date(b.updated_at) - new Date(a.updated_at);
            if (sort === 'title') return a.title.localeCompare(b.title);
            return new Date(b.created_at) - new Date(a.created_at);
        });
    }

    setSort(sort) {
        this.saveSortPreference(sort);
        this.load();
    }

    getCollapsedGroups() {
        const key = `devnote_snippet_collapsed_${this.projectId}`;
        const saved = localStorage.getItem(key);
        return saved ? new Set(JSON.parse(saved)) : new Set();
    }

    saveCollapsedGroup(language, isCollapsed) {
        const key = `devnote_snippet_collapsed_${this.projectId}`;
        const collapsed = this.getCollapsedGroups();
        if (isCollapsed) collapsed.add(language);
        else collapsed.delete(language);
        localStorage.setItem(key, JSON.stringify([...collapsed]));
    }

    attachGroupToggleListeners() {
        this.container.querySelectorAll('.btn-toggle-group').forEach(btn => {
            btn.addEventListener('click', () => {
                const lang = btn.dataset.language;
                const group = this.container.querySelector(`.snippet-group[data-language="${lang}"]`);
                const icon = btn.querySelector('i');
                const isCollapsed = group.classList.toggle('collapsed');
                icon.classList.toggle('rotated', isCollapsed);
                this.saveCollapsedGroup(lang, isCollapsed);
            });
        });
    }

    renderGroupedView(snippets) {
        const sorted = this.sortSnippets(snippets);
        const collapsed = this.getCollapsedGroups();

        // Group by language
        const groups = {};
        sorted.forEach(s => {
            const lang = s.language || 'text';
            if (!groups[lang]) groups[lang] = [];
            groups[lang].push(s);
        });

        const html = Object.entries(groups)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([lang, items]) => {
                const isCollapsed = collapsed.has(lang);
                return `
                    <div class="snippet-group ${isCollapsed ? 'collapsed' : ''}" data-language="${lang}">
                        <div class="snippet-group-header">
                            <button class="btn-toggle-group" data-language="${lang}" title="Toggle">
                                <i class="ph-light ph-caret-down ${isCollapsed ? 'rotated' : ''}"></i>
                            </button>
                            ${this.getIcon(lang)}
                            <span class="snippet-group-lang">${lang}</span>
                            <span class="todo-group-count">${items.length}</span>
                        </div>
                        <div class="snippet-group-items">
                            ${items.map(s => this.renderSnippet(s)).join('')}
                        </div>
                    </div>
                `;
            }).join('');

        this.container.innerHTML = `<div class="snippet-grouped-view">${html}</div>`;
        this.attachGroupToggleListeners();
    }

    display(snippets) {
        this._allSnippets = snippets;
        this.currentView = this.currentView || this.getViewPreference();

        const addLine = `
            <div class="snippet-add-card" id="snippet-add-line">
                <span class="note-add-icon">+</span>
                <span class="note-add-text">New snippet...</span>
            </div>
        `;

        if (snippets.length === 0) {
            this.container.innerHTML = addLine + '<p class="empty">No snippets yet</p>';
            return;
        }

        if (this.currentView === 'grouped') {
            this.renderGroupedView(snippets);
            this.container.insertAdjacentHTML('afterbegin', addLine);
            return;
        }

        const sorted = this.sortSnippets(snippets);
        this.container.innerHTML = addLine + sorted.map(snippet => this.renderSnippet(snippet)).join('');
    }

    attachEventListeners(snippets) {
        const addLine = document.getElementById('snippet-add-line');
        if (addLine) addLine.addEventListener('click', () => {
            if (this.container.querySelector('.snippet-editor')) return;
            addLine.outerHTML = this.renderSnippetEditor();
            this.attachEditorListeners();
        });

        this.container.querySelectorAll('.edit-snippet-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                if (this.container.querySelector('.snippet-editor')) return;
                const snippet = snippets.find(s => s.id === btn.dataset.id);
                if (snippet) {
                    const card = this.container.querySelector(`.snippet-card[data-id="${snippet.id}"]`);
                    card.outerHTML = this.renderSnippetEditor(snippet);
                    this.attachEditorListeners();
                }
            });
        });

        this.container.querySelectorAll('.delete-snippet-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.delete(btn.dataset.id);
            });
        });
    }

    attachEditorListeners() {
        // Custom select dropdowns
        this.container.querySelectorAll('.dn-select-wrap').forEach(wrap => {
            const btn = wrap.querySelector('.dn-select-btn');
            const dropdown = wrap.querySelector('.dn-select-dropdown');
            const hidden = wrap.querySelector('input[type="hidden"]');
            const valueEl = wrap.querySelector('.dn-select-value');
            const chevron = wrap.querySelector('.dn-select-chevron');

            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const isOpen = dropdown.classList.contains('open');
                document.querySelectorAll('.dn-select-dropdown.open').forEach(d => d.classList.remove('open'));
                dropdown.classList.toggle('open', !isOpen);
                chevron.style.transform = !isOpen ? 'rotate(180deg)' : '';
            });

            dropdown.querySelectorAll('.dn-select-option').forEach(opt => {
                opt.addEventListener('click', () => {
                    hidden.value = opt.dataset.value;
                    valueEl.textContent = opt.textContent;
                    dropdown.querySelectorAll('.dn-select-option').forEach(o => o.classList.remove('active'));
                    opt.classList.add('active');
                    dropdown.classList.remove('open');
                    chevron.style.transform = '';
                });
            });
        });

        // Auto-resize textarea
        const textarea = this.container.querySelector('.snippet-editor-content');
        if (textarea) {
            textarea.style.height = 'auto';
            textarea.style.height = textarea.scrollHeight + 'px';
            textarea.addEventListener('input', () => {
                textarea.style.height = 'auto';
                textarea.style.height = textarea.scrollHeight + 'px';
            });
        }

        // SAVE
        this.container.querySelector('.btn-save-snippet')?.addEventListener('click', async () => {
            const editor = this.container.querySelector('.snippet-editor');
            const id = editor.dataset.id;
            const title = editor.querySelector('.snippet-editor-title').value.trim();
            const language = editor.querySelector('.snippet-editor-language').value.trim() || 'text';
            const description = editor.querySelector('.snippet-editor-description').value.trim();
            const content = editor.querySelector('.snippet-editor-content').value;

            if (!title) {
                await showAlert('Title is required', 'info');
                return;
            }
            if (!content.trim()) {
                await showAlert('Content is required', 'info');
                return;
            }

            try {
                if (id) {
                    await updateSnippet(id, title, language, content, description);
                } else {
                    await createSnippet(this.projectId, title, language, content, description);
                }
                await this.load();
            } catch (error) {
                console.error('Error saving snippet:', error);
                await showAlert('Unable to save the snippet');
            }
        });

        // CANCEL
        this.container.querySelector('.btn-cancel-snippet')?.addEventListener('click', async () => {
            await this.load();
        });
    }

    async delete(snippetId) {
        const confirmed = await showConfirm('Delete this snippet?');
        if (!confirmed) return;

        try {
            await deleteSnippet(snippetId);
            await this.load();
        } catch (error) {
            console.error('Error deleting snippet:', error);
            await showAlert('Unable to delete the snippet');
        }
    }
}
