/* ==========================================
   THEME TOGGLE — DevNote
   Persistent via localStorage
   ========================================== */

(function () {
  const STORAGE_KEY = 'devnote-theme';

  /* Inject transition style rules */
  const style = document.createElement('style');
  style.textContent = `
    .theme-switching *,
    .theme-switching *::before,
    .theme-switching *::after {
      transition: background 0.7s ease, background-color 0.7s ease,
                  color 0.7s ease, border-color 0.7s ease,
                  box-shadow 0.7s ease !important;
    }
  `;
  document.head.appendChild(style);

  /* Apply saved theme immediately (before render) */
  const saved = localStorage.getItem(STORAGE_KEY) || 'dark';
  document.documentElement.setAttribute('data-theme', saved);

  /* Colors per theme */
  const COLORS = {
    dark:  { bg: '#161b22', border: '#30363d',          color: '#8b949e', shadow: 'none' },
    light: { bg: '#ffffff', border: 'rgba(0,0,0,0.12)', color: '#475569', shadow: '0 2px 8px rgba(0,0,0,0.08)' }
  };

  function applyBtnColors(btn, theme) {
    const c = COLORS[theme];
    btn.style.background  = c.bg;
    btn.style.border      = `1px solid ${c.border}`;
    btn.style.color       = c.color;
    btn.style.boxShadow   = c.shadow;
  }

  document.addEventListener('DOMContentLoaded', () => {
    const btn = document.createElement('button');
    btn.id = 'theme-toggle';
    btn.setAttribute('aria-label', 'Toggle theme');
    btn.innerHTML = getIcon(saved);

    btn.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 9999;
      width: 40px;
      height: 40px;
      border-radius: 50%;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
      outline: none;
      transition: transform 0.15s;
    `;

    /* Apply initial colors */
    applyBtnColors(btn, saved);

    btn.addEventListener('mouseenter', () => { btn.style.transform = 'scale(1.1)'; });
    btn.addEventListener('mouseleave', () => { btn.style.transform = 'scale(1)'; });

    btn.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme') || 'dark';
      const next = current === 'dark' ? 'light' : 'dark';

      /* Trigger transition */
      document.documentElement.classList.add('theme-switching');

      /* Apply theme */
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem(STORAGE_KEY, next);
      btn.innerHTML = getIcon(next);
      applyBtnColors(btn, next);

      /* Remove transition class after animation */
      setTimeout(() => {
        document.documentElement.classList.remove('theme-switching');
      }, 750);
    });

    document.body.appendChild(btn);
  });

  function getIcon(theme) {
    return theme === 'dark'
      ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`
      : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
  }
})();
