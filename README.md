# 📓 DevNote

> Your dev knowledge, everywhere, instantly.

A unified web application to centralize, organize, and instantly retrieve technical knowledge for developers — notes, code snippets, and TODOs, all in one place.

---

## 📖 About

**DevNote** addresses a common developer problem: **scattered information**. Code snippets, terminal commands, technical notes, and TODOs often end up fragmented across multiple tools, making it hard to find what you need when you need it.

Everything lives inside a **project**, and every project has three tabs — Notes, Snippets, and TODOs — plus a global search across the whole workspace.

---

## ✨ Features

### 📝 Notes

- **Block editor** built on BlockNote — headings, lists, tables, quotes, checklists, inline links and formatting
- **Code blocks** with Shiki syntax highlighting, and **Mermaid diagram blocks** via the slash menu
- **Markdown paste** with automatic language-fence normalization
- **Outline panel** — an auto-generated table of contents from the note's headings, click to jump
- **Folders** with nested hierarchy, breadcrumb navigation and a *Move to…* dialog
- **Pin** notes for quick access, **duplicate** them, and **export** to Markdown or PDF
- The app remembers which folder you were in when you come back to a project

### 💻 Code Snippets

- **Shiki syntax highlighting** across 13 pre-compiled languages, with GitHub Dark / GitHub Light themes
- **Language suggestion** — the content is analysed with `flourite` and a language is proposed automatically
- **Full-screen modal** with line numbers, copy button and one-click export to a file carrying the right extension
- **Pin** and **duplicate** snippets
- Two views: **grid** or **grouped by language**

### ✅ TODOs

- **Multiple lists per project**, navigable through tabs
- A permanent **"Top priorities"** list, created with every project and protected from deletion
- Two views: **list** or **kanban**
- **Status** (`pending` / `in progress` / `done`) and **priority** (`low` / `medium` / `high`) picked directly from the card
- Cross-list view to see every TODO of a project at once, and a *Move to…* dialog between lists

### 🔍 Search

Global overlay searching **projects, notes, snippets and TODOs** at once, with optional filtering by type and highlighted matches.

### ⚙️ Settings

A dedicated screen with four sections:

| Section | What it holds |
|---|---|
| **Appearance** | Dark / light colour theme |
| **Account** | Email, password change |
| **Defaults** | Default snippets view (grid / by language), default TODOs view (list / kanban) |
| **Danger zone** | Permanent account deletion |

---

## 🛠️ Tech Stack

### Backend

- **Django 4.2** + **Django REST Framework** — REST API, ORM, authentication
- **SimpleJWT** — JWT authentication via HttpOnly cookies (15 min access, 7 day refresh, rotation + blacklist)
- **drf-nested-routers** — nested project resources
- **SQLite** — local development database
- **django-ratelimit** — rate limiting on auth and search endpoints

### Frontend

- **React 19** + **React Router 7**, built with **Vite 7**
- **BlockNote** (+ Mantine) — block-based note editor, with its code-block and diagram-block packages
- **Shiki** — syntax highlighting for snippets and code blocks
- **Mermaid** — diagram rendering inside notes
- **flourite** — language detection for snippets
- **Axios** — HTTP client with cookie auth, CSRF header and queued token refresh
- **ESLint** + **Prettier**

---

## 🏗️ Project Structure

```
DevNote/
├── backend/                  # Django project
│   ├── accounts/             # Custom user model, JWT auth, password change, account deletion
│   ├── workspace/            # Projects, Folders, Notes, Snippets, TodoLists, TODOs, Search
│   │   ├── models.py
│   │   ├── serializers.py
│   │   ├── views.py
│   │   ├── signals.py        # Creates the permanent "Top priorities" list with each project
│   │   └── tests/            # 381 unit & integration tests
│   ├── devnote/              # Django settings, root URLs
│   └── manage.py
│
├── frontend/                 # Vite + React
│   └── src/
│       ├── components/       # NotesPanel, SnippetsPanel, TodosPanel, SettingsPanel, modals…
│       ├── contexts/         # Auth, Theme, Dialog providers
│       ├── hooks/            # useResourceList, useLocalStorageState, useClickOutside…
│       ├── lib/              # blocknote, highlight, detectLanguage, outline, download…
│       ├── services/         # API calls (authService, noteService, folderService…)
│       └── pages/            # Login, Register, Dashboard
│
└── docs/                     # Project documentation + GitHub Pages landing page
```

---

## 🚀 Getting Started

### Prerequisites

- **Python 3.11+** (the reference virtualenv runs 3.11.15)
- **Node.js 20.19+** or **22.12+** — required by Vite 7

### Backend setup

```bash
cd backend

python -m venv DevNote-env
source DevNote-env/bin/activate   # macOS/Linux
# DevNote-env\Scripts\activate    # Windows

pip install -r requirements.txt
```

Create a `.env` file in `backend/`:

```env
SECRET_KEY=your-secret-key-here
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1
CORS_ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

`SECRET_KEY`, `DEBUG` and `ALLOWED_HOSTS` are mandatory — Django will not start without them. `CORS_ALLOWED_ORIGINS` and `CSRF_TRUSTED_ORIGINS` fall back to the two localhost origins above if omitted.

Then:

```bash
python manage.py migrate
python manage.py runserver
```

The API is served at `http://localhost:8000/api/`.

### Frontend setup

```bash
cd frontend
npm install
npm run dev
```

The app is served at `http://localhost:5173/`. Vite proxies `/api` to `http://localhost:8000`, so no API URL needs to be configured.

Other frontend commands:

```bash
npm run build          # production build
npm run preview        # serve the production build
npm run lint           # ESLint
npm run format         # Prettier, write
npm run format:check   # Prettier, check only
```

---

## 🔑 API Overview

Base URL: `http://localhost:8000/api/`

Authentication uses **HttpOnly cookies** (`access_token`, `refresh_token`), set automatically on login and register. Unsafe methods also require the `X-CSRFToken` header.

### Auth

| Endpoint | Method | Description |
|---|---|---|
| `/auth/csrf/` | GET | Issue the CSRF cookie |
| `/auth/register/` | POST | Create account |
| `/auth/login/` | POST | Login |
| `/auth/logout/` | POST | Logout (blacklists the refresh token) |
| `/auth/refresh/` | POST | Refresh access token |
| `/auth/me/` | GET | Current user info |
| `/auth/password/` | POST | Change password |
| `/auth/account/delete/` | POST | Delete account permanently |

### Workspace

| Endpoint | Method | Description |
|---|---|---|
| `/projects/` | GET, POST | List / create projects |
| `/projects/{id}/` | GET, PATCH, DELETE | Project detail |
| `/projects/{id}/contents/` | GET | Folders and notes at a project's root |
| `/projects/{id}/pinned/` | GET | Pinned items of a project |
| `/folders/` · `/projects/{id}/folders/` | GET, POST | List / create folders |
| `/folders/{id}/` | GET, PATCH, DELETE | Folder detail |
| `/folders/{id}/contents/` | GET | Sub-folders and notes of a folder |
| `/notes/` · `/projects/{id}/notes/` | GET, POST | List / create notes |
| `/notes/{id}/` | GET, PATCH, DELETE | Note detail |
| `/notes/{id}/duplicate/` | POST | Duplicate a note |
| `/snippets/` · `/projects/{id}/snippets/` | GET, POST | List / create snippets |
| `/snippets/{id}/` | GET, PATCH, DELETE | Snippet detail |
| `/snippets/pinned/` | GET | Pinned snippets |
| `/snippets/{id}/duplicate/` | POST | Duplicate a snippet |
| `/todo-lists/` · `/projects/{id}/todo-lists/` | GET, POST | List / create TODO lists |
| `/todo-lists/{id}/` | GET, PATCH, DELETE | TODO list detail (permanent list refuses deletion) |
| `/todos/` · `/projects/{id}/todos/` | GET, POST | List / create TODOs |
| `/todos/{id}/` | GET, PATCH, DELETE | TODO detail |
| `/search/?q=...` | GET | Global search, optional `type` filter |

---

## 🧪 Running Tests

```bash
cd backend
pytest
```

or, equivalently:

```bash
cd backend
python manage.py test
```

381 tests covering models, serializers, views, authentication and search.

---

## 🔒 Security

- JWT tokens stored in **HttpOnly cookies**, never in `localStorage`
- **CSRF protection** on cookie-based auth — unsafe requests must carry `X-CSRFToken`
- Refresh token **rotation** with **blacklisting** on logout and on rotation
- Rate limiting: 3/min on register, 5/min on login, 5/min on password change and account deletion, 30/min on search
- XSS protection through React's escaping and BlockNote's structured content model
- **Subresource Integrity** (SRI) on CDN stylesheets
- `SECURE_CONTENT_TYPE_NOSNIFF`, `SECURE_BROWSER_XSS_FILTER`, `strict-origin-when-cross-origin` referrer policy
- User data fully isolated — every queryset is scoped to the authenticated user
