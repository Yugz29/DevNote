/**
 * Generic modal manager
 */
import { showAlert } from './dialog.js';

export class ModalManager {
  constructor({ modalId, formId, onSubmit }) {
    this.modal = document.getElementById(modalId);
    this.form = document.getElementById(formId);
    this.onSubmit = onSubmit;

    if (!this.modal || !this.form) {
      console.error(`Modal #${modalId} or form #${formId} not found in DOM`);
      return;
    }

    this.init();
  }

  init() {
    // Close button (X)
    const closeBtn = this.modal.querySelector('.modal-close, .close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.close());
    }

    // Cancel button
    const cancelBtn = this.modal.querySelector('[data-action="cancel"]');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => this.close());
    }

    // Click outside
    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) {
        this.close();
      }
    });

    // Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.modal.classList.contains('active')) {
        this.close();
      }
    });

    // Submit
    this.form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(this.form);
      const data = Object.fromEntries(formData.entries());

      try {
        await this.onSubmit(data);
        this.close();
      } catch (error) {
        console.error('Erreur soumission modal:', error);
        await showAlert('An error occurred. Please try again.');
      }
    });
  }

 open(prefillData = {}) {
    // Reset form first
    this.form.reset();
    
    delete this.form.dataset.editId;

    if (prefillData.id) {
        this.form.dataset.editId = prefillData.id;
    }

    // Pre-fill fields by name attribute, falling back to id
    for (const [key, value] of Object.entries(prefillData)) {
        const input = this.form.querySelector(`[name="${key}"]`) ||
                      this.form.querySelector(`#${key}`);
        if (input && value !== undefined) {
            input.value = value;
        }
    }

    this.modal.classList.add('active');
}

  close() {
    this.modal.classList.remove('active');
    this.form.reset();
    delete this.form.dataset.editId;
  }
}
