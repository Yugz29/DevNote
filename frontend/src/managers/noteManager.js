import { getNotes, deleteNote } from '../services/noteService.js';
import { marked } from 'marked';
import DOMPurify from 'dompurify';


marked.setOptions({
    breaks: true,   // Retours à la ligne simples
    gfm: true,      // GitHub Flavored Markdown
});

export default class NoteManager {
    constructor(modal) {
        this.modal = modal;
        this.projectId = null;
        this.container = document.getElementById('notes-list');
    }

    setProject(projectId) {
        this.projectId = projectId;
    }

    async load() {
        if (!this.projectId) return;

        this.container.innerHTML = '<p class="loading">Loading...</p>';

        try {
            const data = await getNotes(this.projectId);
            const notes = data.results ?? data;

            this.display(notes);
            this.attachEventListeners(notes);
        } catch (error) {
            console.error('Error loading notes:', error);
            this.container.innerHTML = '<p class="error">Unable to load notes</p>';
        }
    }

    display(notes) {
        const addLine = `
            <div class="note-add-line" id="note-add-line">
                <span class="note-add-icon">+</span>
                <span class="note-add-text">New note...</span>
            </div>
        `;

        if (notes.length === 0) {
            this.container.innerHTML = addLine + '<p class="empty">No notes yet</p>';
        } else {
            this.container.innerHTML = addLine + notes.map(note => `
                <div class="note-block" data-id="${note.id}">
                    <div class="note-block-header">
                        <h3 class="note-block-title">${note.title}</h3>
                        <div class="note-block-actions">
                            <button class="btn-card-action btn-edit" data-id="${note.id}">Edit</button>
                            <button class="btn-card-action btn-card-danger btn-delete" data-id="${note.id}">Delete</button>
                        </div>
                    </div>
                    <div class="note-block-meta">
                        <span class="card-date">${new Date(note.created_at).toLocaleDateString()}</span>
                    </div>
                    <div class="note-block-content markdown">${note.content ? DOMPurify.sanitize(marked.parse(note.content)) : '<em>No content</em>'}</div>
                </div>
            `).join('');
        }
    }

        attachEventListeners(notes) {
        const addLine = document.getElementById('note-add-line');
        if (addLine) addLine.addEventListener('click', () => this.modal.open());

        this.container.querySelectorAll('.btn-edit').forEach(btn => {
            btn.addEventListener('click', () => {
                const note = notes.find(n => n.id === btn.dataset.id);
                if (note) this.openEditModal(note);
            });
        });

        this.container.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', () => {
                this.delete(btn.dataset.id);
            });
        });
    }

    openEditModal(note) {
        this.modal.open({
            id: note.id,
            title: note.title,
            content: note.content
        });
    }

    async delete(noteId) {
        if (!confirm('Delete this note ?')) return;

        try {
            await deleteNote(noteId);
            await this.load();
        } catch (error) {
            console.error('Error deleting note:', error);
            alert('Unable to delete the note');
        }
    }
}
