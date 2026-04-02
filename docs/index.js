
  const nav = document.getElementById('nav');
  window.addEventListener('scroll', () => nav.classList.toggle('solid', scrollY > 50), {passive:true});

  const spotlight = document.getElementById('spotlight');
  const hero = document.getElementById('hero');
  let mouseX = window.innerWidth / 2, mouseY = window.innerHeight / 2;
  let curX = mouseX, curY = mouseY;

  hero.addEventListener('mousemove', e => {
    const r = hero.getBoundingClientRect();
    mouseX = e.clientX - r.left;
    mouseY = e.clientY - r.top;
  });

  (function lerp() {
    curX += (mouseX - curX) * 0.08;
    curY += (mouseY - curY) * 0.08;
    spotlight.style.left = curX + 'px';
    spotlight.style.top  = curY + 'px';
    requestAnimationFrame(lerp);
  })();

  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('visible'); io.unobserve(e.target); }
    });
  }, { threshold: 0.12 });
  document.querySelectorAll('[data-reveal]').forEach(el => io.observe(el));

  function drawArrows() {
    const wrap = document.getElementById('chaosWrap');
    const svg  = document.getElementById('chaosSvg');
    const dn   = wrap.querySelector('.devnote-center');
    if (!dn) return;
    const wR  = wrap.getBoundingClientRect();
    const dnR = dn.getBoundingClientRect();
    const cx  = dnR.left - wR.left + dnR.width / 2;
    const cy  = dnR.top  - wR.top  + dnR.height / 2;
    const chips = wrap.querySelectorAll('.tool-chip');
    let html = '';
    chips.forEach(chip => {
      const cR = chip.getBoundingClientRect();
      const x  = cR.left - wR.left + cR.width  / 2;
      const y  = cR.top  - wR.top  + cR.height / 2;
      html += `<line x1="${x}" y1="${y}" x2="${cx}" y2="${cy}" />`;
    });
    svg.innerHTML = html;
  }
  window.addEventListener('load', drawArrows);
  window.addEventListener('resize', drawArrows);

  const searchData = [
    {
      q: 'docker',
      results: `
        <div class="vs-section-title">Notes</div>
        <div class="vs-item hi">
          <i class="ph-light ph-article vs-item-icon"></i>
          <div class="vs-item-body">
            <div class="vs-item-title"><mark>Docker</mark> &amp; Compose setup</div>
            <div class="vs-item-meta">Backend API</div>
          </div>
          <span class="vs-item-type">note</span>
        </div>
        <div class="vs-section-title">Snippets</div>
        <div class="vs-item">
          <i class="ph-light ph-code vs-item-icon"></i>
          <div class="vs-item-body">
            <div class="vs-item-title"><mark>Docker</mark> Run</div>
            <div class="vs-item-meta">Backend API &middot; Bash</div>
          </div>
          <span class="vs-item-type">snippet</span>
        </div>
        <div class="vs-section-title">TODOs</div>
        <div class="vs-item">
          <i class="ph-light ph-check-square vs-item-icon"></i>
          <div class="vs-item-body">
            <div class="vs-item-title"><mark>Docker</mark> deploy</div>
            <div class="vs-item-meta">Backend API</div>
          </div>
          <span class="vs-item-type">todo</span>
        </div>`
    },
    {
      q: 'jwt',
      results: `
        <div class="vs-section-title">Notes</div>
        <div class="vs-item hi">
          <i class="ph-light ph-article vs-item-icon"></i>
          <div class="vs-item-body">
            <div class="vs-item-title"><mark>JWT</mark> Authentication Flow</div>
            <div class="vs-item-meta">Backend API</div>
          </div>
          <span class="vs-item-type">note</span>
        </div>
        <div class="vs-section-title">TODOs</div>
        <div class="vs-item">
          <i class="ph-light ph-check-square vs-item-icon"></i>
          <div class="vs-item-body">
            <div class="vs-item-title"><mark>JWT</mark> Auth flow</div>
            <div class="vs-item-meta">Backend API</div>
          </div>
          <span class="vs-item-type">todo</span>
        </div>`
    },
    {
      q: 'migrate',
      results: `
        <div class="vs-section-title">Notes</div>
        <div class="vs-item hi">
          <i class="ph-light ph-article vs-item-icon"></i>
          <div class="vs-item-body">
            <div class="vs-item-title">PostgreSQL <mark>migrate</mark> notes</div>
            <div class="vs-item-meta">Backend API</div>
          </div>
          <span class="vs-item-type">note</span>
        </div>
        <div class="vs-section-title">Snippets</div>
        <div class="vs-item">
          <i class="ph-light ph-code vs-item-icon"></i>
          <div class="vs-item-body">
            <div class="vs-item-title">DB <mark>Migrate</mark></div>
            <div class="vs-item-meta">Backend API &middot; Python</div>
          </div>
          <span class="vs-item-type">snippet</span>
        </div>`
    },
    {
      q: 'deploy',
      results: `
        <div class="vs-section-title">Snippets</div>
        <div class="vs-item hi">
          <i class="ph-light ph-code vs-item-icon"></i>
          <div class="vs-item-body">
            <div class="vs-item-title"><mark>Deploy</mark> Prod</div>
            <div class="vs-item-meta">Backend API &middot; Bash</div>
          </div>
          <span class="vs-item-type">snippet</span>
        </div>
        <div class="vs-section-title">TODOs</div>
        <div class="vs-item">
          <i class="ph-light ph-check-square vs-item-icon"></i>
          <div class="vs-item-body">
            <div class="vs-item-title">Docker <mark>deploy</mark></div>
            <div class="vs-item-meta">Backend API</div>
          </div>
          <span class="vs-item-type">todo</span>
        </div>`
    },
    {
      q: 'rate',
      results: `
        <div class="vs-section-title">TODOs</div>
        <div class="vs-item hi">
          <i class="ph-light ph-check-square vs-item-icon"></i>
          <div class="vs-item-body">
            <div class="vs-item-title"><mark>Rate</mark> limiting on API</div>
            <div class="vs-item-meta">Backend API</div>
          </div>
          <span class="vs-item-type">todo</span>
        </div>`
    }
  ];

  let qi = 0, ci = 0, del = false;
  const searchEl  = document.getElementById('searchDemo');
  const vsResults = document.getElementById('vsResults');

  function updateResults(idx) {
    vsResults.innerHTML = searchData[idx].results;
  }

  updateResults(0);

  function tickSearch() {
    const entry = searchData[qi];
    const word  = entry.q;
    const cursor = '<span class="vs-cursor"></span>';
    if (!del) {
      ci++;
      searchEl.innerHTML = word.slice(0, ci) + cursor;
      if (ci >= word.length) {
        updateResults(qi);
        del = true;
        setTimeout(tickSearch, 2000);
        return;
      }
    } else {
      ci--;
      searchEl.innerHTML = word.slice(0, ci) + cursor;
      if (ci <= 0) {
        del = false;
        qi  = (qi + 1) % searchData.length;
      }
    }
    setTimeout(tickSearch, del ? 40 : 70);
  }
  tickSearch();

  /* TODOs interactive status cycle — cards move between columns */
  const NEXT_STATUS  = { pending: 'in_progress', in_progress: 'done', done: 'pending' };
  const STATUS_LABEL = { pending: 'Pending', in_progress: 'In Progress', done: 'Done' };
  const STATUS_CLASS = { pending: 'bdg-pending', in_progress: 'bdg-in-progress', done: 'bdg-done' };
  const STATUS_COL   = { pending: 0, in_progress: 1, done: 2 };

  function getColumns() {
    return document.querySelectorAll('.v-kanban .vk-col');
  }

  function bindStatusBadges() {
    document.querySelectorAll('.bdg-status').forEach(badge => {
      badge.onclick = () => {
        const card  = badge.closest('.vk-card');
        const cur   = card.dataset.status;
        const next  = NEXT_STATUS[cur];
        const cols  = getColumns();

        // Update badge + card state
        card.dataset.status = next;
        badge.className     = `bdg ${STATUS_CLASS[next]} bdg-status`;
        badge.textContent   = STATUS_LABEL[next];
        card.classList.toggle('is-done', next === 'done');

        // Move card to the right column (append before last child if add-card exists)
        const targetCol = cols[STATUS_COL[next]];
        targetCol.appendChild(card);
      };
    });
  }

  bindStatusBadges();

  /* ========= HERO WINDOW — Interactive tabs & projects ========= */
  const HERO_DATA = {
    backend: {
      name: 'Backend API',
      desc: 'REST API — authentication, database, deployment scripts.',
      notes: [
        { title: 'JWT Authentication Flow',    date: '12/03', content: '<strong style="color:#aaa;font-size:12px">Token lifecycle</strong><br>Access token expires after 15min.<br>Refresh via <code>POST /api/token/refresh/</code><br>Stored in HttpOnly cookie — never localStorage.' },
        { title: 'Docker &amp; Compose setup', date: '08/03', content: '<strong style="color:#aaa;font-size:12px">Docker Compose</strong><br>Services: <code>api</code>, <code>db</code>, <code>nginx</code><br>Run: <code>docker compose up -d --build</code>' },
        { title: 'PostgreSQL migration notes', date: '01/03', content: 'Always run <code>makemigrations</code> before <code>migrate</code>.<br>Never edit migration files manually.' },
        { title: 'OWASP security checklist',   date: '20/02', content: 'SQL injection, XSS, CSRF — covered.<br>JWT stored in HttpOnly cookie only.' },
      ],
      snippets: [
        { lang: 'devicon-bash-plain',   label: 'Bash',   title: 'Docker Run',    code: 'docker run -d -p 8000:8000 \\\n  --env-file .env api' },
        { lang: 'devicon-python-plain', label: 'Python', title: 'DB Migrate',    code: 'python manage.py makemigrations\npython manage.py migrate' },
        { lang: 'devicon-bash-plain',   label: 'Bash',   title: 'Deploy Prod',   code: 'git push heroku main\nheroku run migrate' },
        { lang: 'devicon-python-plain', label: 'Python', title: 'Run Tests',     code: 'pytest --cov=. --cov-report=html' },
        { lang: 'devicon-bash-plain',   label: 'Bash',   title: 'Health Check',  code: 'curl -s https://api.app.io/health' },
      ],
      todos: [
        { title: 'Rate limiting on API',   priority: 'h', status: 'pending' },
        { title: 'S3 file uploads',        priority: 'h', status: 'pending' },
        { title: 'Email notifications',    priority: 'm', status: 'pending' },
        { title: 'WebSocket support',      priority: 'm', status: 'in_progress' },
        { title: 'Dashboard redesign',     priority: 'm', status: 'in_progress' },
        { title: 'JWT Auth flow',          priority: 'h', status: 'done' },
        { title: 'Docker deploy',          priority: 'h', status: 'done' },
        { title: 'CI/CD pipeline',         priority: 'm', status: 'done' },
      ]
    },
    mobile: {
      name: 'Mobile App',
      desc: 'React Native — iOS & Android cross-platform client.',
      notes: [
        { title: 'Navigation architecture',  date: '13/03' },
        { title: 'AsyncStorage strategy',    date: '09/03' },
        { title: 'Push notifications setup', date: '03/03' },
        { title: 'App Store guidelines',     date: '18/02' },
      ],
      snippets: [
        { lang: 'devicon-javascript-plain', label: 'JS',     title: 'API Client',    code: 'const api = axios.create({\n  baseURL: API_URL,\n  withCredentials: true\n})' },
        { lang: 'devicon-javascript-plain', label: 'JS',     title: 'Auth Headers',  code: 'api.interceptors.request.use(\n  cfg => ({ ...cfg,\n    headers: getAuthHeaders()\n  })\n)' },
        { lang: 'devicon-bash-plain',       label: 'Bash',   title: 'Run iOS',       code: 'npx react-native run-ios\n  --simulator="iPhone 15"' },
        { lang: 'devicon-bash-plain',       label: 'Bash',   title: 'Build Android', code: 'cd android && ./gradlew\n  assembleRelease' },
        { lang: 'devicon-javascript-plain', label: 'JS',     title: 'Deep Link',     code: 'Linking.getInitialURL()\n  .then(url => handleDeepLink(url))' },
      ],
      todos: [
        { title: 'Offline mode',            priority: 'h', status: 'pending' },
        { title: 'Dark mode support',       priority: 'm', status: 'pending' },
        { title: 'Biometric auth',          priority: 'h', status: 'in_progress' },
        { title: 'Push notifications',      priority: 'm', status: 'in_progress' },
        { title: 'Auth screens',            priority: 'h', status: 'done' },
        { title: 'API integration',         priority: 'h', status: 'done' },
      ]
    }
  };

  let heroProject = 'backend';
  let heroTab     = 'snippets';

  function renderHero() {
    const data = HERO_DATA[heroProject];
    document.getElementById('heroProjName').textContent = data.name;
    document.getElementById('heroProjDesc').textContent = data.desc;

    let html = '';

    if (heroTab === 'snippets') {
      const cards = [
        `<div class="w-card add">+ New snippet...</div>`,
        ...data.snippets.map(s => `<div class="w-card">
          <div class="w-lang"><i class="${s.lang}"></i> ${s.label}</div>
          <div class="w-title">${s.title}</div>
          <div class="w-code">${s.code}</div>
        </div>`)
      ];
      html = `<div class="w-grid">${cards.join('')}</div>`;

    } else if (heroTab === 'notes') {
      const rows = data.notes.map((n, i) => `
        <div class="vn-row">
          <span class="vn-arrow${i === 0 ? ' open' : ''}">&#9654;</span>
          <div style="flex:1"><div class="vn-title">${n.title}</div></div>
          <span style="font-size:10px;color:#2a2a2a">${n.date}</span>
        </div>
        <div class="vn-body${i === 0 ? ' open' : ''}">
          <div class="vn-body-inner">${n.content || '...'}</div>
        </div>`).join('');
      html = `<div class="v-notes" style="max-width:none;border:none;border-radius:0;background:transparent">${rows}</div>`;

    } else if (heroTab === 'todos') {
      const pending     = data.todos.filter(t => t.status === 'pending');
      const in_progress = data.todos.filter(t => t.status === 'in_progress');
      const done        = data.todos.filter(t => t.status === 'done');
      const pBadge = p => `<span class="bdg bdg-${p === 'h' ? 'h' : p === 'm' ? 'm' : 'l'}">${p === 'h' ? 'HIGH' : p === 'm' ? 'MED' : 'LOW'}</span>`;
      const sBadge = s => `<span class="bdg ${s === 'pending' ? 'bdg-pending' : s === 'in_progress' ? 'bdg-in-progress' : 'bdg-done'}">${s === 'pending' ? 'Pending' : s === 'in_progress' ? 'In Progress' : 'Done'}</span>`;
      const mkCard = t => `<div class="vk-card${t.status === 'done' ? ' is-done' : ''}">
        <div class="vk-title">${t.title}</div>
        <div class="vk-foot">${sBadge(t.status)} ${pBadge(t.priority)}</div>
      </div>`;
      html = `<div class="v-kanban" style="padding:0 16px 16px">
        <div class="vk-col"><div class="vk-head">PENDING &middot; ${pending.length}</div>${pending.map(mkCard).join('')}</div>
        <div class="vk-col"><div class="vk-head">IN PROGRESS &middot; ${in_progress.length}</div>${in_progress.map(mkCard).join('')}</div>
        <div class="vk-col"><div class="vk-head">DONE &middot; ${done.length}</div>${done.map(mkCard).join('')}</div>
      </div>`;
    }

    document.getElementById('heroContent').innerHTML = html;
  }

  // Tab clicks
  document.querySelectorAll('.w-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.w-tab').forEach(b => b.classList.remove('on'));
      btn.classList.add('on');
      heroTab = btn.dataset.tab;
      renderHero();
    });
  });

  // Project clicks
  document.querySelectorAll('.w-sb-item[data-project]').forEach(item => {
    item.addEventListener('click', () => {
      document.querySelectorAll('.w-sb-item[data-project]').forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      heroProject = item.dataset.project;
      renderHero();
    });
  });

  renderHero();

  /* Notes interactive toggle */
  document.querySelectorAll('.vn-row[data-note]').forEach(row => {
    row.addEventListener('click', () => {
      const arrow = row.querySelector('.vn-arrow');
      const body  = row.nextElementSibling;
      const isOpen = body.classList.contains('open');
      arrow.classList.toggle('open', !isOpen);
      body.classList.toggle('open', !isOpen);
    });
  });
