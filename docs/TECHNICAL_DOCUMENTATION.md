# DevNote — Technical Documentation (V1)

> **Project:** DevNote  
> **Last updated:** February 2026  
> **Status:** MVP Stage 4 — Active Development

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Tech Stack](#2-tech-stack)
3. [Repository Structure](#3-repository-structure)
4. [System Architecture](#4-system-architecture)
5. [Authentication System](#5-authentication-system)
6. [Database Design](#6-database-design)
7. [Backend — API Reference](#7-backend--api-reference)
8. [Frontend Architecture](#8-frontend-architecture)
9. [Security](#9-security)
10. [Testing Strategy](#10-testing-strategy)
11. [SCM Strategy](#11-scm-strategy)
12. [Local Development Setup](#12-local-development-setup)

---

## 1. Project Overview

### Problem Statement

Developers daily accumulate technical knowledge — code snippets, commands, notes, and TODOs — scattered across multiple tools (browser tabs, Notion, sticky notes, Slack threads). This leads to duplicated searches, disorganized notes, and lost time.

### Solution

DevNote is a unified web application that centralizes, organizes, and allows instant retrieval of a developer's personal knowledge base. It is structured around **Projects**, each containing **Notes**, **Snippets**, and **TODOs**.

**Tagline:** *Your dev knowledge, everywhere, instantly.*

### Target Audience

- Junior developers and students
- Freelancers managing multiple projects
- Developers working across multiple languages and frameworks

### MVP Scope

**In scope:**
- User authentication (register, login, logout, token refresh)
- Project management (CRUD)
- Notes with full Markdown rendering and Mermaid diagram support
- Code snippets with language highlighting
- TODO management with priority and status tracking
- Global search across all resource types (including projects)
- Infinite scroll pagination

**Out of scope (post-MVP):**
- Real-time collaboration
- Full offline mode
- Browser extensions
- Third-party integrations (GitHub, etc.)

---

## 2. Tech Stack

### Backend

| Technology | Version | Role |
|---|---|---|
| Python | 3.x | Runtime |
| Django | 4.2.27 | Web framework, ORM, admin |
| Django REST Framework | 3.14.0 | REST API layer |
| SimpleJWT | 5.3.1 | JWT authentication + token blacklist |
| drf-nested-routers | 0.94.1 | Nested URL routing |
| django-cors-headers | 4.3.1 | CORS management |
| django-ratelimit | 4.1.0 | Rate limiting |
| django-environ | 0.11.2 | Environment configuration |
| SQLite | — | Database (MVP) |

### Frontend

| Technology | Version | Role |
|---|---|---|
| Vite | 7.2.4 | Dev server and build tool |
| Vanilla JavaScript (ESM) | — | UI logic |
| Axios | 1.13.5 | HTTP client |
| Marked.js | 17.0.2 | Markdown rendering |
| Mermaid.js | 11.12.2 | Diagram rendering in notes |
| DOMPurify | 3.3.1 | XSS sanitization |

### Future (Production)

- **PostgreSQL** — replacing SQLite for production deployment
- **HTTPS / Secure cookies** — `AUTH_COOKIE_SECURE` auto-enabled when `DEBUG=False`

---

## 3. Repository Structure

```
DevNote/
├── backend/                    # Django application
│   ├── accounts/               # Authentication app
│   │   ├── models.py           # Custom User model
│   │   ├── views.py            # Auth endpoints
│   │   ├── serializers.py      # Register / Login / User serializers
│   │   ├── managers.py         # Custom UserManager
│   │   ├── authentication.py   # CookieJWTAuthentication backend
│   │   ├── cookie_utils.py     # JWT cookie helpers
│   │   └── urls.py
│   ├── workspace/              # Core features app
│   │   ├── models.py           # Project, Note, Snippet, TODO
│   │   ├── views.py            # ViewSets + SearchView
│   │   ├── serializers.py      # All model serializers
│   │   ├── admin.py            # Django admin customization
│   │   └── urls.py             # Nested + flat routers
│   ├── devnote/
│   │   ├── settings.py
│   │   └── urls.py
│   └── manage.py
│
├── frontend/                   # Vite frontend
│   ├── src/
│   │   ├── pages/              # HTML pages + page-level JS
│   │   │   ├── index.html
│   │   │   ├── login.html / login.js
│   │   │   ├── register.html / register.js
│   │   │   └── dashboard.html / dashboard.js
│   │   ├── services/           # API layer (one file per resource)
│   │   │   ├── api.js          # Axios instance + interceptors
│   │   │   ├── authService.js
│   │   │   ├── projectService.js
│   │   │   ├── noteService.js
│   │   │   ├── snippetService.js
│   │   │   ├── todoService.js
│   │   │   └── searchService.js
│   │   ├── managers/           # OOP UI managers (one per resource)
│   │   │   ├── noteManager.js
│   │   │   ├── snippetManager.js
│   │   │   ├── todoManager.js
│   │   │   └── searchManager.js
│   │   ├── utils/
│   │   │   ├── BaseManager.js  # Abstract base class
│   │   │   ├── dialog.js       # Custom alert / confirm dialogs
│   │   │   ├── escape.js       # XSS escape helper
│   │   │   └── modalManager.js
│   │   └── styles/
│   │       ├── main.css
│   │       ├── dashboard.css
│   │       ├── auth.css
│   │       ├── variables.css
│   │       └── reset.css
│   ├── vite.config.js
│   └── package.json
│
└── README.md
```

---

## 4. System Architecture

### High-Level Data Flow

```
User (Browser)
    │
    ▼
Frontend (Vite / Vanilla JS)
    │  HTTP via Axios (cookies auto-sent, withCredentials: true)
    │  Proxy: localhost:5173 → localhost:8000
    ▼
Django REST Framework API
    │  CookieJWTAuthentication (cookie → fallback to Authorization header)
    │  IsAuthenticated permission
    │  User-scoped querysets (get_queryset filters by request.user)
    ▼
Django ORM
    │
    ▼
SQLite (MVP) / PostgreSQL (production)
```

### Key Architectural Decisions

**Decoupled frontend/backend:** The frontend (Vite, port 5173) is completely separate from Django. Axios proxies all `/api` requests to Django (port 8000) during development. This enables independent deployment and easy future migration to another framework.

**Cookie-based authentication over Bearer tokens:** JWT tokens are stored in HttpOnly cookies rather than localStorage, preventing XSS token theft. Axios sends cookies automatically on all requests (`withCredentials: true`), and a response interceptor handles silent token refresh. The authentication backend also accepts an `Authorization` header as fallback, keeping the API usable from Postman and other clients without browser cookies.

**Queryset-level isolation:** User data isolation is enforced by filtering querysets at the database level (`project__user=request.user`) rather than relying on an object-level permission class. This is both simpler and more efficient — unauthorized resources return 404 naturally without an extra permission check round-trip.

**BaseManager pattern:** All resource UI managers extend a shared `BaseManager` that handles infinite scroll pagination, load/display lifecycle, and search highlighting. Each manager implements only resource-specific methods.

---

## 5. Authentication System

### Overview

Authentication uses JWT stored in HttpOnly cookies. The access token has a short lifetime (15 minutes); the refresh token lasts 7 days. On 401 responses, the Axios interceptor automatically calls `/api/auth/refresh/` to renew the access token without user interaction.

### Token Lifecycle

```
POST /api/auth/login/
    → Set-Cookie: access_token (15 min, HttpOnly)
    → Set-Cookie: refresh_token (7 days, HttpOnly)

[Authenticated requests pass cookies automatically]

POST /api/auth/refresh/      ← triggered by Axios interceptor on 401
    → Old refresh token blacklisted
    → New access_token + refresh_token set in cookies

POST /api/auth/logout/
    → Refresh token blacklisted
    → Cookies deleted
```

### Custom Authentication Backend

`CookieJWTAuthentication` extends SimpleJWT's `JWTAuthentication` with the following priority order:

1. Check for `access_token` cookie (primary — browser clients)
2. Fall back to `Authorization: Bearer <token>` header (API clients, Postman)

### Cookie Configuration (settings.py)

| Setting | Value |
|---|---|
| `ACCESS_TOKEN_LIFETIME` | 15 minutes |
| `REFRESH_TOKEN_LIFETIME` | 7 days |
| `ROTATE_REFRESH_TOKENS` | True |
| `BLACKLIST_AFTER_ROTATION` | True |
| `AUTH_COOKIE_HTTP_ONLY` | True |
| `AUTH_COOKIE_SAMESITE` | `Lax` |
| `AUTH_COOKIE_SECURE` | `True` in production |

### User Model

Custom `AbstractUser` with the following changes from Django's default:

| Field | Type | Notes |
|---|---|---|
| `id` | UUIDv7 | Primary key, auto-generated |
| `email` | EmailField | Unique, required — used as `USERNAME_FIELD` |
| `username` | CharField | Optional, unique, auto-generated if omitted |
| `first_name` | CharField | Required |
| `last_name` | CharField | Required |
| `created_at` | DateTimeField | Auto-generated |
| `updated_at` | DateTimeField | Auto-updated |

### Authentication Endpoints

| Method | Endpoint | Auth required | Description |
|---|---|---|---|
| POST | `/api/auth/register/` | No | Create account, receive cookies |
| POST | `/api/auth/login/` | No | Login, receive cookies |
| POST | `/api/auth/logout/` | Yes | Blacklist refresh token, clear cookies |
| POST | `/api/auth/refresh/` | No | Rotate tokens silently via cookie |
| GET | `/api/auth/me/` | Yes | Get current user info |

### Rate Limiting

| Endpoint | Limit | Key |
|---|---|---|
| `/api/auth/register/` | 3 requests/minute | IP |
| `/api/auth/login/` | 5 requests/minute | IP |

---

## 6. Database Design

### Tables

```
devnote_users
devnote_projects
devnote_notes
devnote_snippets
devnote_todos
```

### Entity Relationships

```
User (1) ──── (0..N) Project
Project (1) ──── (0..N) Note
Project (1) ──── (0..N) Snippet
Project (1) ──── (0..N) TODO
```

All foreign keys use `ON DELETE CASCADE`.

### Models

#### Project

| Field | Type | Constraints |
|---|---|---|
| `id` | UUIDv7 | PK, auto |
| `title` | CharField(255) | required |
| `description` | TextField | optional, max 5000 chars |
| `user` | FK → User | CASCADE |
| `created_at` | DateTimeField | auto |
| `updated_at` | DateTimeField | auto |

**Constraints:** `unique_project_per_user` — `(user, title)` pair must be unique.  
**Indexes:** `(user, -created_at)`.

#### Note

| Field | Type | Constraints |
|---|---|---|
| `id` | UUIDv7 | PK, auto |
| `title` | CharField(255) | required, cannot be whitespace-only |
| `content` | TextField | optional, max 100,000 chars |
| `project` | FK → Project | CASCADE |
| `created_at` | DateTimeField | auto |
| `updated_at` | DateTimeField | auto |

**Indexes:** `(project, -created_at)`.

#### Snippet

| Field | Type | Constraints |
|---|---|---|
| `id` | UUIDv7 | PK, auto |
| `title` | CharField(255) | required |
| `content` | TextField | required |
| `language` | CharField(50) | default `"text"`, normalized to lowercase |
| `description` | TextField | optional |
| `project` | FK → Project | CASCADE |
| `created_at` | DateTimeField | auto |
| `updated_at` | DateTimeField | auto |

**Indexes:** `(project, -created_at)`.

#### TODO

| Field | Type | Constraints |
|---|---|---|
| `id` | UUIDv7 | PK, auto |
| `title` | CharField(255) | required |
| `description` | TextField | optional |
| `status` | CharField | choices: `pending`, `in_progress`, `done` — default `pending` |
| `priority` | CharField | choices: `low`, `medium`, `high` — default `medium` |
| `project` | FK → Project | CASCADE |
| `created_at` | DateTimeField | auto |
| `updated_at` | DateTimeField | auto |

**Indexes:** `(project, -created_at)`.

---

## 7. Backend — API Reference

**Base URL:** `http://localhost:8000/api/`  
**Authentication:** All endpoints require authentication except register, login, and refresh.

### Permissions Model

All workspace ViewSets use `permission_classes = [IsAuthenticated]`. Data isolation is enforced entirely at the queryset level: every `get_queryset()` filters by `project__user=request.user` (or `user=request.user` for projects). Accessing another user's resource returns 404 — it simply does not appear in the filtered queryset.

Ownership on creation is verified in `perform_create()` via `Project.objects.get(id=project_pk, user=request.user)`, raising `PermissionDenied` (403) if the project does not belong to the authenticated user.

### Response Standards

**Success codes:**

| Code | Usage |
|---|---|
| 200 | GET, PATCH, POST (non-creation) |
| 201 | Resource created (POST) |
| 204 | Deleted (DELETE) |
| 429 | Rate limit exceeded |

**Error format:**
```json
{
  "error": "Descriptive message",
  "code": "ERROR_CODE_UPPERCASE",
  "details": {}
}
```

**Pagination** (all list endpoints):
```json
{
  "count": 45,
  "next": "http://localhost:8000/api/projects/?page=2",
  "previous": null,
  "results": [ ... ]
}
```
Page size: 20 items.

### Projects

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/projects/` | List user's projects |
| POST | `/api/projects/` | Create a project |
| GET | `/api/projects/{id}/` | Get project details |
| PUT / PATCH | `/api/projects/{id}/` | Update a project |
| DELETE | `/api/projects/{id}/` | Delete a project (cascades) |

### Notes

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/projects/{id}/notes/` | List notes in a project |
| POST | `/api/projects/{id}/notes/` | Create a note |
| GET | `/api/projects/{id}/notes/{note_id}/` | Get note details |
| PATCH | `/api/projects/{id}/notes/{note_id}/` | Update a note |
| DELETE | `/api/projects/{id}/notes/{note_id}/` | Delete a note |
| GET / PATCH / DELETE | `/api/notes/{id}/` | Flat routes |

`project` is not a writable field — it is injected from the URL by `perform_create()`. `project_id` is returned read-only in all responses.

### Snippets

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/projects/{id}/snippets/` | List snippets in a project |
| POST | `/api/projects/{id}/snippets/` | Create a snippet |
| GET | `/api/projects/{id}/snippets/{snippet_id}/` | Get details |
| PATCH | `/api/projects/{id}/snippets/{snippet_id}/` | Update |
| DELETE | `/api/projects/{id}/snippets/{snippet_id}/` | Delete |
| GET / PATCH / DELETE | `/api/snippets/{id}/` | Flat routes |

`language` defaults to `"text"` if omitted. Normalized to lowercase on save.  
Filter: `GET /api/projects/{id}/snippets/?language=python`

### TODOs

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/projects/{id}/todos/` | List TODOs in a project |
| POST | `/api/projects/{id}/todos/` | Create a TODO |
| GET | `/api/projects/{id}/todos/{todo_id}/` | Get details |
| PATCH | `/api/projects/{id}/todos/{todo_id}/` | Update |
| DELETE | `/api/projects/{id}/todos/{todo_id}/` | Delete |
| GET / PATCH / DELETE | `/api/todos/{id}/` | Flat routes |

Filter: `GET /api/projects/{id}/todos/?status=pending&priority=high`

### Global Search

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/search/?q=<term>` | Search across all resource types |
| GET | `/api/search/?q=<term>&type=projects` | Projects only |
| GET | `/api/search/?q=<term>&type=notes` | Notes only |
| GET | `/api/search/?q=<term>&type=snippets` | Snippets only |
| GET | `/api/search/?q=<term>&type=todos` | TODOs only |

**Constraints:**
- `q` is required (400 if missing)
- `q` max length: 200 characters (400 if exceeded)
- Invalid `type` returns 400
- Rate limited: **30 requests/minute per authenticated user**

**Search fields per resource:**

| Resource | Fields searched |
|---|---|
| Projects | `title`, `description` |
| Notes | `title`, `content` |
| Snippets | `title`, `content`, `language`, `description` |
| TODOs | `title`, `description`, `status`, `priority` |

All searches are case-insensitive (`icontains`) and scoped to the authenticated user's data.

---

## 8. Frontend Architecture

### Dev Setup

- Vite dev server: `http://localhost:5173`
- All `/api` requests proxied to Django on `http://localhost:8000`
- No build step needed during development (`npm run dev`)

### Pages

| Page | File | Description |
|---|---|---|
| Landing | `src/pages/index.html` | Entry point / redirect |
| Login | `src/pages/login.html` | Email + password authentication |
| Register | `src/pages/register.html` | Account creation |
| Dashboard | `src/pages/dashboard.html` | Projects + project content (Notes/Snippets/TODOs) |

### Service Layer (`src/services/`)

- `api.js` — Axios instance with `withCredentials: true`, response interceptor for silent token refresh, redirect to login on auth failure
- `authService.js` — login, register, logout, getCurrentUser
- `projectService.js` — CRUD for projects
- `noteService.js` — CRUD for notes
- `snippetService.js` — CRUD for snippets
- `todoService.js` — CRUD for todos
- `searchService.js` — global search with optional type filter

### Manager Pattern (`src/managers/`)

`BaseManager` (`src/utils/BaseManager.js`) is an abstract class providing:

- **Infinite scroll** — listens to `.tab-content` scroll events, calls `loadMore()` when within 100px of the bottom
- **Load lifecycle** — `load()` resets state, fetches first page, renders, attaches listeners; `loadMore()` appends next pages
- **Search highlighting** — `highlight(query, itemId)` wraps matches in `<mark>` tags, scrolls to and flashes the target item

Each manager extends `BaseManager` and implements `fetchPage()`, `display()`, `appendItems()`, and `attachEventListeners()`.

**NoteManager:** Markdown via `marked.parse()` with custom Mermaid block renderer, diagram rendering via `mermaid.run()`, DOMPurify sanitization, note collapse state and sort preference persisted in `localStorage` per project.

**SnippetManager:** Devicon language icons, grid and grouped-by-language views, group collapse state persisted in `localStorage`, custom language dropdown in editor.

**TODOManager:** Status/priority badge rendering, filter by status and priority.

### Axios Token Refresh Interceptor

On `401` response: POST `/api/auth/refresh/` → retry original request. If refresh fails or is already in progress: redirect to login.

---

## 9. Security

### Authentication

- JWT in HttpOnly cookies — inaccessible to JavaScript
- `SameSite=Lax` — CSRF protection on cross-origin navigation
- `Secure` flag auto-enabled in production
- Refresh token blacklisting on rotation and logout

### Input Validation

- Title fields: stripped and validated non-empty at serializer level
- `DOMPurify` sanitizes rendered Markdown before DOM insertion
- `escape()` utility escapes strings inserted directly into HTML templates

### Rate Limiting

| Endpoint | Limit | Key |
|---|---|---|
| `/api/auth/register/` | 3/minute | IP |
| `/api/auth/login/` | 5/minute | IP |
| `/api/search/` | 30/minute | User |

### Security Headers

```python
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = 'DENY'
SECURE_REFERRER_POLICY = 'strict-origin-when-cross-origin'
```

### Data Isolation

All workspace querysets filter at the database level by `project__user=request.user`. Unauthorized resources return 404 naturally. Creation ownership is verified in `perform_create()`.

---

## 10. Testing Strategy

### Automated Tests

```
accounts/tests/
    test_auth_models.py
    test_auth_serializers.py
    test_auth_views.py

workspace/tests/
    test_project_models.py      test_project_serializers.py     test_project_views.py
    test_note_models.py         test_note_serializers.py        test_note_views.py
    test_snippet_models.py      test_snippet_serializers.py     test_snippet_views.py
    test_todo_models.py         test_todo_serializers.py        test_todo_views.py
    test_search_views.py
```

Models: field creation, cascade deletes, `__str__`, validation. Serializers: valid/invalid data, boundary conditions, whitespace. Views: auth vs unauth, CRUD, user isolation, query filters.

Tests use in-memory SQLite (`TEST: NAME: ":memory:"`).

```bash
cd backend && python manage.py test
```

### Manual Testing

Postman collections for all API endpoints. In-browser E2E testing on Chrome/Firefox for all critical user flows.

---

## 11. SCM Strategy

| Branch | Purpose |
|---|---|
| `main` | Stable, presentable version |
| `dev` | Active development |

Commit convention: `feat:`, `fix:`, `test:`, `refactor:`, `docs:`. Merges via Pull Request after self-review and passing tests.

---

## 12. Local Development Setup

### Backend

```bash
cd backend
python -m venv DevNote-env
source DevNote-env/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

**`.env` (required):**
```env
SECRET_KEY=your-secret-key-here
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1
CORS_ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

### Frontend

```bash
cd frontend
npm install
npm run dev
# → http://localhost:5173
```
