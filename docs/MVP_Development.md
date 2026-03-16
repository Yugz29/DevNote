# Stage 4 Report: MVP Development and Execution
**Project:** DevNote
**By:** Yann Duzelier
**Date:** March 5, 2026
**Contact:** yann.duzelier@holbertonstudents.com 

# 1 — Source Repository

## Branch Strategy
The project uses a two-branch permanent workflow:

- **main** — stable, deployable branch. Always in a production-ready state. Only receives code via Pull Request from dev after full validation.
- **dev** — active development branch. All day-to-day work is done here.

## Commit Convention
Each commit follows a strict convention:

```
| Prefix | Usage |
|--------|--------|
| feat: | New feature or new endpoint |
| fix: | Bug fix |
| test: | Adding or modifying tests |
| refactor: | Restructuring without behaviour change |
| docs: | Documentation only |
| chore: | Configuration, dependencies or tooling |
```

Commits are intentionally small and focused (one logical change per commit) to keep git log readable, facilitate code reviews, and allow the use of git bisect in case of regression.

## Pull Request Process
Before any dev → main merge:

- Complete self-review of all changes  
- Full test suite execution (`python manage.py test` — 135 tests)  
- Verification that no sensitive data is present in the history  
- Documentation update if the API or architecture has changed  
- Automatic CodeQL analysis triggered by the PR (expected result: 0 alerts)

## CI/CD — GitHub Actions
The pipeline runs automatically on every push to main and every Pull Request.

- **CodeQL** — Static security analysis (SAST) detecting injections, authentication errors and accidental data exposure. Run on 17+ PRs during Stage 4, average duration 1 min 20 s.
- **Dependabot** — Dependency monitoring. During Sprint 4, three security updates were detected and merged: lodash-es (frontend), djangorestframework (backend), django (backend).
- **Secret Scanning** — Automatic detection of accidentally committed API keys, tokens and secrets.
- **Security Advisories** — Vulnerability tracking dashboard at the repository level.
- **Code Scanning Alerts** — Centralisation of CodeQL results with history per PR.

## Repository Structure

```
DevNote/
├── backend/
│   ├── accounts/             # Custom User model, JWT auth
│   │   ├── models.py
│   │   ├── managers.py
│   │   ├── serializers.py
│   │   ├── views.py
│   │   ├── authentication.py # CookieJWTAuthentication
│   │   ├── cookie\_utils.py
│   │   └── tests/
│   ├── workspace/            # Projects, Notes, Snippets, TODOs, Search
│   │   ├── models.py
│   │   ├── serializers.py
│   │   ├── views.py
│   │   ├── urls.py
│   │   └── tests/            # 102 tests (6 files)
│   ├── devnote/              # Settings, root URLs, WSGI
│   ├── requirements.txt
│   └── manage.py
└── frontend/
└── src/
├── pages/            # login.html/js, register.html/js, dashboard.html/js
├── services/         # api.js, authService.js, noteService.js…
├── managers/         # noteManager.js, snippetManager.js…
└── utils/            # BaseManager.js, escape.js, dialog.js
```

## Backend Dependencies (requirements.txt)
```
| Package | Version | Role |
|--------|----------|--------|
| Django | 4.2.28 | Web framework |
| djangorestframework | 3.15.2 | REST API |
| djangorestframework-simplejwt | 5.5.1 | JWT authentication |
| django-cors-headers | 4.3.1 | CORS management |
| django-environ | 0.11.2 | Environment variables |
| django-ratelimit | 4.1.0 | Rate limiting |
| drf-nested-routers | 0.94.1 | Nested routes (projects/{id}/notes/) |
| uuid6 | 2025.0.1 | UUIDv7 generation |
| PyJWT | 2.10.1 | JWT tokens |
```

***

# 2 — Bug Tracking

## Critical Bugs — Resolved

| ID   | Severity     | Session  | Bug                                                                                       | Resolution                                                                                       | Time     |
|------|--------------|----------|-------------------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------------|----------|
| B-01 | 🔴 Critical  | Sprint 1 | JWT tokens returned in response body → accessible via JavaScript → XSS vulnerable          | Full migration to HttpOnly cookies via CookieJWTAuthentication, abandoned body response           | ~1h      |
| B-02 | 🔴 Critical  | Sprint 2 | get_project() not defined in SnippetViewSet → 500 error on all nested Snippet routes      | Added the method to the ViewSet                                                                   | ~15 min  |
| B-03 | 🟠 Major     | Sprint 2 | HTTP 400 codes instead of 401 on failed login → incorrect tests, non-standard behaviour   | Replaced ValidationError with AuthenticationFailed in LoginSerializer                             | 5 min    |
| B-04 | 🟠 Major     | Sprint 2 | URLs without trailing slash → 301 redirect breaking all API tests                         | Trailing slash convention applied to all project URLs                                             | ~10 min  |
| B-05 | 🟠 Major     | Sprint 2 | SyntaxError in LoginSerializer (data=['user']=) → module not importable                   | Python syntax correction                                                                           | 2 min    |
| B-06 | 🟡 Minor     | Sprint 4 | Form submit event listener not triggered on Note modal → submission impossible            | Listener moved directly to the button with type="button"                                          | ~20 min  |
| B-07 | 🟡 Minor     | Sprint 4 | Dropdowns in Kanban selectors clipped by overflow: hidden columns                         | CSS portal: dropdown moved to <body> with dynamically calculated fixed positioning                | ~30 min  |

***

## Non-Blocking Items — Initially Listed, Now Resolved

| Item | Actual Status |
|------|---------------|
| "Logout button missing from dashboard" | ✅ Implemented — #logout-btn in sidebar, authService.logout() + redirect |
| "Incomplete Auth tests on models/serializers side" | ✅ 33 complete tests — test_auth_models.py (10), test_auth_serializers.py (12), test_auth_views.py (11) |
| "Postman collection not finalised for logout, refresh, search" | ✅ Manually validated on all endpoints |

***

## Technical Adjustment Tracking

These items are not bugs but architectural decisions corrected along the way:


| Adjustment                                   | Sprint | Reason                                                                                     |
|-----------------------------------------------|--------|---------------------------------------------------------------------------------------------|
| Migration from auto-incremented IDs → UUIDv7  | 1      | Security (predictable URLs) and indexing performance                                       |
| Extraction of UserManager into managers.py    | 2      | accounts/models.py reached 200 lines — separation of concerns                              |
| In-memory database for tests                  | 2      | Slowness observed on disk SQLite — 10x speed gain                                          |
| Addition of dual flat + nested routes         | 2      | Frontend required /api/snippets/{id}/ without project context                              |
| Extraction of BaseManager as abstract class   | 4      | Duplication detected between managers — ~150 lines removed                                  |

Bien reçu Yann — et ne t’inquiète pas, on continue exactement comme pour les sections précédentes :  
**tu donnes un bloc → je te renvoie le même bloc, intégral, mis en Markdown propre, sans supprimer une seule ligne.**

Voici **la section 3 — Testing Evidence and Results**, totalement convertie en Markdown et **100 % fidèle** à ton texte.

***

# 3 — Testing Evidence and Results

## Test Architecture

Tests are organised in two apps, with three levels per module:

    backend/
    ├── accounts/tests/
    │   ├── test_auth_models.py      # 10 tests
    │   ├── test_auth_serializers.py # 12 tests
    │   └── test_auth_views.py       # 11 tests
    └── workspace/tests/
        ├── test_project_models.py      # 2 tests
        ├── test_project_serializers.py # 6 tests
        ├── test_project_views.py       # 8 tests
        ├── test_note_models.py         # 5 tests
        ├── test_note_serializers.py    # 7 tests
        ├── test_note_views.py          # 9 tests
        ├── test_snippet_models.py      # 7 tests
        ├── test_snippet_serializers.py # 12 tests
        ├── test_snippet_views.py       # 9 tests
        ├── test_todo_models.py         # 5 tests
        ├── test_todo_serializers.py    # 8 tests
        ├── test_todo_views.py          # 16 tests
        └── test_search_views.py        # 8 tests

## Full Results

| Module    | Model Tests | Serializer Tests | View/API Tests | Total   | Result         |
| --------- | ----------- | ---------------- | -------------- | ------- | -------------- |
| Auth      | ✅ 10        | ✅ 12             | ✅ 11           | 33      | 100% ✅         |
| Projects  | ✅ 2         | ✅ 6              | ✅ 8            | 16      | 100% ✅         |
| Notes     | ✅ 5         | ✅ 7              | ✅ 9            | 21      | 100% ✅         |
| Snippets  | ✅ 7         | ✅ 12             | ✅ 9            | 28      | 100% ✅         |
| TODOs     | ✅ 5         | ✅ 8              | ✅ 16           | 29      | 100% ✅         |
| Search    | —           | —                | ✅ 8            | 8       | 100% ✅         |
| **TOTAL** | **29**      | **45**           | **61**         | **135** | **0 failures** |

    python manage.py test
    # Ran 135 tests in X.XXXs
    # OK
    # MVP target ≥ 30 tests: exceeded by 450%

Configuration: in-memory database (`'TEST': {'NAME': ':memory:'}`) for isolation and speed.

## Module Detail

### Auth Module (33 tests)

**test\_auth\_models.py (10 tests)**

*   test\_create\_user\_with\_all\_fields — creation with all required fields
*   test\_user\_id\_is\_uuid — primary key of type UUID
*   test\_timestamps\_auto\_generated — created\_at and updated\_at auto-generated
*   test\_email\_is\_unique — uniqueness constraint on email
*   test\_username\_is\_optional — automatic generation if absent
*   test\_username\_is\_unique\_if\_provided — username uniqueness constraint
*   test\_str\_return\_username — str method returns email
*   test\_str\_when\_username\_is\_none — str without username
*   test\_email\_is\_username\_field — USERNAME\_FIELD = 'email'
*   test\_required\_fields\_are\_correct — REQUIRED\_FIELDS = \['first\_name', 'last\_name']

**test\_auth\_serializers.py (12 tests)**

*   RegisterSerializer: valid data, non-matching passwords, existing email, invalid email format, missing required fields, write-only fields
*   LoginSerializer: valid credentials, unknown email, required fields
*   UserSerializer: complete serialisation, no password, username present

**test\_auth\_views.py (11 tests)**

*   register → 201 + cookies, failure if passwords differ, missing fields, duplicate email
*   login → 200 + cookies, invalid credentials, unknown user
*   logout → 200/204 if authenticated, 401 if unauthenticated
*   me → 200 + user data if authenticated, 401 if unauthenticated

### Projects Module (16 tests)

**test\_project\_views.py (8 tests)**

*   test\_list\_projects\_authenticated — list with pagination
*   test\_list\_projects\_unauthenticated — returns 401
*   test\_create\_project — creation and database verification
*   test\_create\_project\_unauthenticated — returns 401
*   test\_retrieve\_project — project detail
*   test\_update\_project — full update
*   test\_delete\_project — deletion and 204 verification
*   test\_user\_isolation — a user cannot see another user's projects

### Notes Module (21 tests)

Edge case coverage:

*   test\_user\_isolation — access denied to another user's notes (404)
*   test\_project\_isolation — notes from project A do not appear in project B
*   Attempt to create in another user's project → 403

### Snippets Module (28 tests)

**test\_snippet\_serializers.py (12 tests)**  
Notable cases:

*   test\_language\_normalized\_lowercase — 'PYTHON' normalised to 'python'
*   test\_missing\_language\_defaults\_to\_text — default language = 'text'
*   test\_save\_without\_project\_raises\_integrity\_error — cannot create an orphan snippet
*   test\_same\_title\_different\_projects — same title allowed in two different projects

**test\_snippet\_views.py (9 tests)**

*   test\_list\_snippets\_nested — route /api/projects/{id}/snippets/
*   test\_create\_snippet\_flat\_route\_not\_supported — POST on flat route → 403
*   test\_user\_isolation — another user's snippet → 404

### TODOs Module (29 tests)

**test\_todo\_views.py (16 tests)** — extended coverage:

*   test\_filter\_by\_status — filter ?status=done
*   test\_filter\_by\_priority — filter ?priority=high
*   test\_cannot\_update\_other\_user\_todo — modification attempt → 404
*   test\_cannot\_delete\_other\_user\_todo — deletion attempt → 404
*   test\_create\_todo\_invalid\_status — invalid status → 400
*   test\_create\_todo\_with\_invalid\_priority — invalid priority → 400

### Search Module (8 tests)

*   test\_search\_all\_types — cross-entity search (notes + snippets + todos)
*   test\_search\_note\_only — filter ?type=notes
*   test\_search\_snippets\_only — filter ?type=snippets
*   test\_search\_todos\_only — filter ?type=todos
*   test\_search\_missing\_query — missing q parameter → 400
*   test\_search\_invalid\_type — invalid type → 400
*   test\_search\_user\_isolation — another user's results do not appear
*   test\_search\_no\_results — query with no match → empty lists

## Manual Tests — Postman Collection

| Folder   | Endpoints                                                  | Result |
| -------- | ---------------------------------------------------------- | ------ |
| Auth     | register · login · logout · refresh · me                   | ✅      |
| Projects | LIST · CREATE · RETRIEVE · UPDATE · DELETE                 | ✅      |
| Notes    | LIST · CREATE · RETRIEVE · UPDATE · DELETE                 | ✅      |
| Snippets | LIST · CREATE · RETRIEVE · UPDATE · DELETE (flat + nested) | ✅      |
| TODOs    | LIST · CREATE · RETRIEVE · UPDATE · DELETE + filters       | ✅      |
| Search   | q=... · type= · empty case · invalid type                  | ✅      |

## Frontend Tests — Chrome DevTools

*   access\_token and refresh\_token cookies set as HttpOnly — not readable via JavaScript (Application tab → Cookies)
*   Axios requests automatically transmit cookies (withCredentials: true) — visible in Network tab
*   Correct HTTP codes: 200, 201, 204, 400, 401, 403, 404
*   No token in localStorage or sessionStorage
*   Silent refresh validated by forcing expiry after 1 min → interceptor triggers /api/auth/refresh/
*   E2E tests performed on Chrome and Safari

## Code Coverage

| Metric               | Result       | Target  |
| -------------------- | ------------ | ------- |
| Overall coverage     | \~85%        | ≥ 80% ✅ |
| Backend modules      | 6/6          | 6/6 ✅   |
| Endpoints tested     | 24/24        | 24/24 ✅ |
| User isolation cases | 1 per module | All ✅   |

***

Parfait Yann — merci pour ta patience.  
Comme pour les sections précédentes, voici **EXACTEMENT TON TEXTE**, sans suppression, sans modification, simplement **mis en Markdown propre**, avec titres, paragraphes, listes, et respect total du contenu.

***

# 4 — Sprint Reviews & Retrospectives

## Sprint 1 — January 12 to 23, 2026

### Review — Demonstrated Features

*   Custom User model: UUIDv7, email as USERNAME\_FIELD, UserManager with automatic username generation
*   Complete JWT authentication: register, login, logout, refresh, me — transport via HttpOnly cookies
*   CookieJWTAuthentication + Authorization header fallback for Postman
*   cookie\_utils.py centralising configuration (HttpOnly, SameSite=Lax, Secure, lifetime)
*   All models defined with UUIDv7 and database indexes
*   33 automated tests covering models, serializers and views

### Retrospective

*   ✅ **What went well**  
    Early decision to switch to HttpOnly cookies — security considered from the outset.  
    UUIDv7 chosen for indexing performance.  
    Clean Git structure with main/dev branches and commit convention from day one.

*   ⚠️ **What didn't work**  
    The initial implementation with tokens in the response body required a complete refactoring — time not anticipated during sprint planning.

*   🔄 **Decided improvement**  
    Define token transport as an architectural constraint at design time, not after implementation.

***

## Sprint 2 — January 26 to February 6, 2026

### Review — Demonstrated Features

*   Complete CRUD for Projects, Notes, Snippets, TODOs via ModelViewSet
*   Isolation via get\_queryset() filtered by user — returns 404 (not 403) to avoid information leakage
*   Project field injected server-side via perform\_create() — elimination of an injection vector
*   Global search: filter by type, max length 200 characters, rate limiting
*   79 integration tests · dev → main merge via Pull Request

### Retrospective

*   ✅ **What went well**  
    Model → Serializer → ViewSet → Routes → Tests pattern applied mechanically to each module — maximum velocity.  
    Dual flat + nested routes, a pragmatic decision for the frontend.  
    CodeQL detected anomalies on every PR.

*   ⚠️ **What didn't work**  
    get\_project() forgotten in SnippetViewSet — critical method not anticipated.  
    301 redirect bug on URLs without trailing slash that blocked API tests for an entire session.

*   🔄 **Decided improvement**  
    Create a module checklist (Model / Serializer / ViewSet / Routes / Tests) to be used systematically.  
    Document the trailing slash convention as a project rule.

***

## Sprint 3 — February 9 to 20, 2026

### Review — Demonstrated Features

*   Vite setup with native ES modules — ultra-fast HMR, minimal configuration
*   Centralised Axios instance in api.js with withCredentials: true
*   Automatic refresh interceptor: 401 → /api/auth/refresh/ → retry. isRefreshing variable to avoid simultaneous refreshes
*   Modular API services: authService, projectService, noteService, snippetService, todoService, searchService
*   escape() function against XSS injection in the DOM
*   Complete login and register pages with validation
*   Manual E2E tests on Chrome and Safari

### Retrospective

*   ✅ **What went well**  
    Vite validated immediately — zero setup friction.  
    The refresh interceptor is transparent for all API calls.  
    The services/managers/pages separation facilitates maintenance.

*   ⚠️ **What didn't work**  
    CSS architecture to be defined from setup — the style structure had to be refactored during Sprint 4.

*   🔄 **Decided improvement**  
    Define global CSS variables and reset from Sprint 3 to ensure visual consistency across the entire application.

***

## Sprint 4 — February 23 to March 5, 2026

### Review — Demonstrated Features

*   BaseManager (abstract class): pagination, infinite scroll, lifecycle, highlight — \~150 lines of duplication removed
*   NoteManager: Markdown rendering, Mermaid diagrams with custom renderer, DOMPurify sanitisation, persistent collapse
*   SnippetManager: grid view, language-grouped view, Devicon icons, custom select with dropdown
*   TodoManager: status-grouped list view, 3-column Kanban view, one-click status change, portal dropdown
*   SearchManager: ⌘K overlay, 300ms debounce, highlight, scroll to target item
*   Functional logout button in sidebar
*   CI/CD: CodeQL on 17+ PRs, Dependabot (3 security patches merged), Secret Scanning active

### Retrospective

*   ✅ **What went well**  
    BaseManager as architectural pattern — each manager implements only 4 methods.  
    Transparent JWT cookie integration.  
    The CI/CD pipeline detected dependency vulnerabilities before merging into main.

*   ⚠️ **What didn't work**  
    Form submit event listener not working on modals — mandatory switch to click on type="button".  
    Kanban dropdowns clipped by overflow: hidden — CSS portal solution required.

*   🔄 **Decided improvement**  
    Always mentally test the DOM event flow before implementing.  
    Anticipate CSS positioning constraints in scrollable layouts.

***

## Overall Retrospective Summary

*   ✅ **Systematic successes**  
    Session reports as a continuity tool — each session picks up exactly where the previous one left off.  
    Rigorous modular approach on both sides (backend and frontend).  
    Fast bug resolution: average < 15 min.

*   ⚠️ **Recurring challenges**  
    DOM event management and complex CSS constraints.  
    Frontend architectural decisions made late (BaseManager appeared after duplication was detected).  
    UI / API data synchronisation during nested CRUD operations.

*   🔄 **To do differently**  
    Define BaseManager and the frontend architecture from Sprint 3.  
    Integrate GitHub Actions from Sprint 1.

***

Parfait Yann — et merci d’avoir continué à envoyer les sections **bloc par bloc**, ça me permet de te garantir une **conversion Markdown 100 % fidèle**, sans aucune perte de contenu.

Voici **EXACTEMENT** ta dernière section, **intégralement convertie en Markdown**, sans réécriture, sans oubli, sans résumé.

***

# 5 — Production Environment

## Deployment Architecture

    Internet
        │
        ▼
      HTTPS (SSL/TLS)
        │
        ├──► Frontend (Vite build → static files)
        │         Static hosting (Netlify / Vercel / VPS)
        │
        └──► Backend (Django + Gunicorn)
                  └──► PostgreSQL (production database)

***

## Production Security Settings

The following settings are already present in `settings.py` and enabled via `PRODUCTION=True`:

| Setting                           | Production Value                | Description                      |
| --------------------------------- | ------------------------------- | -------------------------------- |
| DEBUG                             | False                           | Disables detailed error pages    |
| SECURE\_SSL\_REDIRECT             | True                            | Redirects all HTTP to HTTPS      |
| SESSION\_COOKIE\_SECURE           | True                            | Session cookie on HTTPS only     |
| CSRF\_COOKIE\_SECURE              | True                            | CSRF cookie on HTTPS only        |
| SECURE\_HSTS\_SECONDS             | 31536000 (1 year)               | Forces HTTPS for 1 year via HSTS |
| SECURE\_HSTS\_INCLUDE\_SUBDOMAINS | True                            | HSTS extended to subdomains      |
| AUTH\_COOKIE\_SECURE              | True                            | JWT cookies on HTTPS only        |
| SECURE\_BROWSER\_XSS\_FILTER      | True                            | X-XSS-Protection header          |
| SECURE\_CONTENT\_TYPE\_NOSNIFF    | True                            | X-Content-Type-Options header    |
| X\_FRAME\_OPTIONS                 | 'DENY'                          | Clickjacking protection          |
| SECURE\_REFERRER\_POLICY          | strict-origin-when-cross-origin | Referrer policy                  |

***

## Production Environment Variables

    SECRET_KEY=<randomly generated key — never committed>
    DEBUG=False
    PRODUCTION=True
    ALLOWED_HOSTS=devnote.example.com,www.devnote.example.com
    CORS_ALLOWED_ORIGINS=https://devnote.example.com
    DATABASE_URL=postgres://user:password@host:5432/devnote_prod

***

## PostgreSQL Migration

SQLite is used in development. In production, PostgreSQL will be used for its performance, reliability and compatibility with hosting providers.

Addition to `requirements.txt`:

    psycopg2-binary
    dj-database-url

Update in `settings.py`:

```python
import dj_database_url
DATABASES = {
    'default': dj_database_url.config(
        default=env('DATABASE_URL'),
        conn_max_age=600
    )
}
```

***

## Backend Deployment

    # Deployment commands
    pip install -r requirements.txt
    python manage.py migrate
    python manage.py collectstatic --no-input

    # Launch with Gunicorn
    gunicorn devnote.wsgi:application --bind 0.0.0.0:8000 --workers 3

***

## Frontend Deployment

    # Production build
    npm run build
    # Generates dist/ — static files to serve

The Vite build generates minified and optimised files in `dist/`.  
These files are served by a static hosting provider (Netlify, Vercel)  
or directly by Nginx on a VPS.

***

## Frontend Environment Variables

    # .env.production (not committed)
    VITE_API_URL=https://api.devnote.example.com

***

## Production Checklist

| Step                   | Description                                        | Status |
| ---------------------- | -------------------------------------------------- | ------ |
| Environment variables  | SECRET\_KEY, DEBUG=False, DATABASE\_URL configured | 🔜     |
| PostgreSQL migration   | Production database created and migrated           | 🔜     |
| Security settings      | PRODUCTION=True → HTTPS, HSTS, secure cookies      | 🔜     |
| Static file collection | collectstatic executed                             | 🔜     |
| Backend deployment     | Gunicorn + reverse proxy (Nginx)                   | 🔜     |
| Frontend deployment    | Vite build → static hosting                        | 🔜     |
| SSL certificate        | HTTPS verified on production domain                | 🔜     |
| Acceptance tests       | Smoke tests on production environment              | 🔜     |
| Landing page           | Project presentation page published                | 🔜     |
| Final report           | Project closure document                           | 🔜     |

***

## MVP Security Summary

| Measure        | Implementation                                                                       |
| -------------- | ------------------------------------------------------------------------------------ |
| Authentication | JWT via HttpOnly cookies, refresh token rotation, blacklist on logout                |
| XSS            | escape() function on all DOM insertions, DOMPurify on Markdown, SRI on CDN resources |
| Injection      | Project field injected server-side only, Django ORM (no raw SQL)                     |
| Rate limiting  | 3 req/min register, 5 req/min login, 30 req/min search (django-ratelimit)            |
| Data isolation | get\_queryset() filtered by user=request.user on all ViewSets                        |
| HTTP headers   | X-Frame-Options, X-Content-Type-Options, Referrer-Policy active                      |
| CI/CD          | CodeQL + Dependabot + Secret Scanning active on every PR                             |
