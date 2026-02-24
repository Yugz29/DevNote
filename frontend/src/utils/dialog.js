/**
 * Custom dialog utilities — replaces native alert() and confirm()
 * Both return Promises, so they can be used with await.
 */
import { escape } from './escape.js';

function createOverlay() {
    const overlay = document.createElement('div');
    overlay.className = 'dn-dialog-overlay';
    document.body.appendChild(overlay);
    // Trigger animation
    requestAnimationFrame(() => overlay.classList.add('active'));
    return overlay;
}

/**
 * showAlert(message) — replaces alert()
 * @param {string} message
 * @param {string} [type='error'] — 'error' | 'info'
 */
export function showAlert(message, type = 'error') {
    return new Promise((resolve) => {
        const overlay = createOverlay();

        const icon = type === 'error'
            ? '<i class="ph-light ph-warning"></i>'
            : '<i class="ph-light ph-info"></i>';

        overlay.innerHTML = `
            <div class="dn-dialog">
                <div class="dn-dialog-icon dn-dialog-icon--${type}">${icon}</div>
                <p class="dn-dialog-message">${escape(message)}</p>
                <div class="dn-dialog-actions">
                    <button class="dn-dialog-btn dn-dialog-btn--primary">OK</button>
                </div>
            </div>
        `;

        const close = () => {
            overlay.classList.remove('active');
            overlay.addEventListener('transitionend', () => overlay.remove(), { once: true });
            resolve();
        };

        overlay.querySelector('.dn-dialog-btn--primary').addEventListener('click', close);

        // Escape key
        const onKey = (e) => {
            if (e.key === 'Escape') { document.removeEventListener('keydown', onKey); close(); }
        };
        document.addEventListener('keydown', onKey);
    });
}

/**
 * showConfirm(message) — replaces confirm()
 * @param {string} message
 * @param {string} [confirmLabel='Delete']
 * @returns {Promise<boolean>}
 */
export function showConfirm(message, confirmLabel = 'Delete') {
    return new Promise((resolve) => {
        const overlay = createOverlay();

        overlay.innerHTML = `
            <div class="dn-dialog">
                <div class="dn-dialog-icon dn-dialog-icon--warning">
                    <i class="ph-light ph-trash"></i>
                </div>
                <p class="dn-dialog-message">${escape(message)}</p>
                <div class="dn-dialog-actions">
                    <button class="dn-dialog-btn dn-dialog-btn--cancel">Cancel</button>
                    <button class="dn-dialog-btn dn-dialog-btn--danger">${escape(confirmLabel)}</button>
                </div>
            </div>
        `;

        const close = (result) => {
            overlay.classList.remove('active');
            overlay.addEventListener('transitionend', () => overlay.remove(), { once: true });
            resolve(result);
        };

        overlay.querySelector('.dn-dialog-btn--cancel').addEventListener('click', () => close(false));
        overlay.querySelector('.dn-dialog-btn--danger').addEventListener('click', () => close(true));

        // Click outside
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) close(false);
        });

        // Escape key
        const onKey = (e) => {
            if (e.key === 'Escape') { document.removeEventListener('keydown', onKey); close(false); }
        };
        document.addEventListener('keydown', onKey);
    });
}
