import BaseManager from '../utils/baseManager.js';
import { getNotes, createNote, updateNote, deleteNote } from '../services/noteService.js';
import { showAlert, showConfirm } from '../utils/dialog.js';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import mermaid from 'mermaid';

// Custom renderer : mermaid blocks → <pre class="mermaid">
const renderer = new marked.Renderer();
renderer.code = function({ text, lang }) {
    if (lang === 'mermaid') {
        return `<pre class="mermaid">${text}</pre>`;
    }
    const langClass = lang ? ` class="language-${lang}"` : '';
    return `<pre><code${langClass}>${text}</code></pre>`;
};

marked.use({ renderer, breaks: true, gfm: true });

mermaid.initialize({
    startOnLoad: false,
    theme: 'dark',
    darkMode: true,
});

export default class NoteManager extends BaseManager {
    constructor() {
        super(null, document.getElementById('notes-list'));
    }

    async fetchPage(projectId, url = null) {
        return await getNotes(projectId ?? this.projectId, url);
    }

    async appendItems(items) {
        const html = items.map(note => this.renderNote(note)).join('');
        this.container.insertAdjacentHTML('beforeend',html);
        await this.renderMermaid();
    }

    async renderMermaid() {
        const mermaidNodes = this.container.querySelectorAll('.mermaid');
        if (mermaidNodes.length > 0) {
            await mermaid.run({ nodes: mermaidNodes });
        }
    }

    renderNote(note) {
        return `
            <div class="note-block" data-id="${note.id}">
                <div class="note-block-header">
                    <div class="note-block-title-row">
                        <button class="btn-toggle-note" title="Toggle content"><i class="ph-light ph-caret-down"></i></button>
                        <h3 class="note-block-title">${note.title}</h3>
                    </div>
                    <div class="note-block-actions">
                        <button class="btn-card-icon-action btn-edit" data-id="${note.id}" title="Edit"><i class="ph-light ph-pencil-simple"></i></button>
                        <button class="btn-card-icon-action btn-card-icon-danger btn-delete" data-id="${note.id}" title="Delete"><i class="ph-light ph-trash"></i></button>
                    </div>
                </div>
                <div class="note-block-meta">
                    <span class="card-date">${new Date(note.created_at).toLocaleDateString()}</span>
                </div>
                <div class="note-block-content markdown">${note.content ? DOMPurify.sanitize(marked.parse(note.content), { ADD_ATTR: ['class'] }) : '<em>No content</em>'}</div>
            </div>
        `;
    }

    async display(notes) {
        const addLine = `
            <div class="note-add-line" id="note-add-line">
                <span class="note-add-icon">+</span>
                <span class="note-add-text">New note...</span>
            </div>
        `;

        const sorted = this.sortNotes(notes);

        if (notes.length === 0) {
            this.container.innerHTML = addLine + '<p class="empty">No notes yet</p>';
        } else {
            this.container.innerHTML = addLine + sorted.map(note => this.renderNote(note)).join('');
        }

        await this.renderMermaid();
    }

    attachEventListeners(notes) {
        const addLine = document.getElementById('note-add-line');
        if (addLine) addLine.addEventListener('click', () => {
            if (this.container.querySelector('.note-editor')) return;
            addLine.insertAdjacentHTML('afterend', this.renderNoteEditor());
            this.attachEditorListeners();
        });

        this.container.querySelectorAll('.btn-edit').forEach(btn => {
            btn.addEventListener('click', () => {
                if (this.container.querySelector('.note-editor')) return;
                const note = notes.find(n => n.id === btn.dataset.id);
                if (note) {
                    const card = this.container.querySelector(`.note-block[data-id="${note.id}"]`);
                    if (card) {
                        card.outerHTML = this.renderNoteEditor(note);
                        this.attachEditorListeners();
                    }
                }
            });
        });

        this.container.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', () => {
                this.delete(btn.dataset.id);
            });
        });

        // Restore collapse state
        const collapsed = this.getCollapsedState();
        this.container.querySelectorAll('.note-block').forEach(block => {
            if (collapsed.has(block.dataset.id)) {
                const content = block.querySelector('.note-block-content');
                const meta = block.querySelector('.note-block-meta');
                const icon = block.querySelector('.btn-toggle-note i');
                content.classList.add('collapsed');
                meta.style.display = 'none';
                if (icon) icon.classList.add('rotated');
            }
        });

        this.container.querySelectorAll('.btn-toggle-note').forEach(btn => {
            btn.addEventListener('click', () => {
                const block = btn.closest('.note-block');
                const content = block.querySelector('.note-block-content');
                const meta = block.querySelector('.note-block-meta');
                const icon = btn.querySelector('i');
                const isCollapsed = content.classList.toggle('collapsed');
                if (icon) icon.classList.toggle('rotated', isCollapsed);
                meta.style.display = isCollapsed ? 'none' : '';
                this.saveCollapsedState(block.dataset.id, isCollapsed);
            });
        });
    }

    renderNoteEditor(note = null) {
        return `
            <div class="note-editor" data-id="${note?.id || ''}">
                <div class="note-block-header">
                    <input
                        class="note-editor-title note-block-title"
                        type="text"
                        placeholder="Title..."
                        value="${note?.title || ''}"
                    />
                    <div class="note-block-actions" style="opacity:1; visibility:visible; pointer-events:auto;">
                        <button class="btn-card-icon-action btn-save-note" title="Save"><i class="ph-light ph-check"></i></button>
                        <button class="btn-card-icon-action btn-card-icon-danger btn-cancel-note" title="Cancel"><i class="ph-light ph-x"></i></button>
                    </div>
                </div>
                <div class="note-block-meta">
                    <span class="card-date">${note ? new Date(note.created_at).toLocaleDateString() : new Date().toLocaleDateString()}</span>
                </div>
                <textarea
                    class="note-editor-content"
                    placeholder="Content... (Markdown supported)"
                >${note?.content || ''}</textarea>
            </div>
        `;
    }

    attachEditorListeners() {
        // Auto-resize textarea
        const textarea = this.container.querySelector('.note-editor-content');
        if (textarea) {
            textarea.style.height = 'auto';
            textarea.style.height = textarea.scrollHeight + 'px';
            textarea.addEventListener('input', () => {
                textarea.style.height = 'auto';
                textarea.style.height = textarea.scrollHeight + 'px';
            });
        }

        // SAVE
        this.container.querySelector('.btn-save-note')?.addEventListener('click', async () => {
            const editor = this.container.querySelector('.note-editor');
            const id = editor.dataset.id;
            const title = editor.querySelector('.note-editor-title').value.trim();
            const content = editor.querySelector('.note-editor-content').value;

            if (!title) {
                await showAlert('Title is required', 'info');
                return;
            }

            try {
                if (id) {
                    await updateNote(id, title, content);
                } else {
                    await createNote(this.projectId, title, content);
                }
                await this.load();
            } catch (error) {
                console.error('Error saving note:', error);
                await showAlert('Unable to save the note');
            }
        });

        // CANCEL
        this.container.querySelector('.btn-cancel-note')?.addEventListener('click', async () => {
            await this.load();
        });
    }

    getSortPreference() {
        return localStorage.getItem('devnote_note_sort') || 'created';
    }

    saveSortPreference(sort) {
        localStorage.setItem('devnote_note_sort', sort);
    }

    sortNotes(notes) {
        const sort = this.getSortPreference();
        return [...notes].sort((a, b) => {
            if (sort === 'updated') return new Date(b.updated_at) - new Date(a.updated_at);
            if (sort === 'title') return a.title.localeCompare(b.title);
            return new Date(b.created_at) - new Date(a.created_at);
        });
    }

    setSort(sort) {
        this.saveSortPreference(sort);
        this.load();
    }

    renderCompactCard(note) {
        const preview = note.content
            ? note.content.replace(/[#*`_>\[\]]/g, '').trim().substring(0, 120)
            : '';
        return `
            <div class="note-compact-card" data-id="${note.id}">
                <div class="note-compact-title">${note.title}</div>
                ${preview ? `<div class="note-compact-preview">${preview}</div>` : ''}
                <div class="note-compact-footer">
                    <span class="card-date">${new Date(note.updated_at).toLocaleDateString()}</span>
                </div>
                <div class="item-actions">
                    <button class="btn-card-icon-action btn-edit" data-id="${note.id}" title="Edit"><i class="ph-light ph-pencil-simple"></i></button>
                    <button class="btn-card-icon-action btn-card-icon-danger btn-delete" data-id="${note.id}" title="Delete"><i class="ph-light ph-trash"></i></button>
                </div>
            </div>
        `;
    }

    getCollapsedState() {
        const key = `devnote_collapsed_${this.projectId}`;
        const stored = localStorage.getItem(key);
        return new Set(stored ? JSON.parse(stored) : []);
    }

    saveCollapsedState(noteId, isCollapsed) {
        const key = `devnote_collapsed_${this.projectId}`;
        const collapsed = this.getCollapsedState();
        if (isCollapsed) {
            collapsed.add(noteId);
        } else {
            collapsed.delete(noteId);
        }
        localStorage.setItem(key, JSON.stringify([...collapsed]));
    }

    async delete(noteId) {
        const confirmed = await showConfirm('Delete this note?');
        if (!confirmed) return;

        try {
            await deleteNote(noteId);
            await this.load();
        } catch (error) {
            console.error('Error deleting note:', error);
            await showAlert('Unable to delete the note');
        }
    }
}
