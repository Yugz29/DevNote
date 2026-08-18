# 📓 DevNote

> Your dev knowledge, everywhere, instantly.

A unified web application to centralize, organize, and instantly retrieve technical knowledge for developers — notes, code snippets, and TODOs, all in one place.

---

## 📖 About

**DevNote** addresses a common developer problem: **scattered information**. Code snippets, terminal commands, technical notes, and TODOs often end up fragmented across multiple tools, making it hard to find what you need when you need it.

DevNote provides a single platform to:
- 📝 Store technical notes with Markdown support
- 💻 Save and organize reusable code snippets by language
- ✅ Manage project-specific TODOs with priority and status tracking
- 🔍 Search instantly across your entire knowledge base
- 🌐 Access everything from any browser

---

## 🛠️ Tech Stack

### Backend
- **Django 4.2** + **Django REST Framework** — REST API, ORM, authentication
- **SimpleJWT** — JWT authentication via HTTPOnly cookies (access + refresh tokens)
- **SQLite** — local development database (PostgreSQL-ready for production)
- **django-ratelimit** — rate limiting on auth endpoints

### Frontend
- **Vanilla JS** (ES modules) + **Vite** — no framework, clean and fast
- **Axios** — HTTP client with cookie-based auth
- **Marked** + **DOMPurify** — safe Markdown rendering
- **Mermaid** — diagram rendering in notes

---

## 🏗️ Project Structure

```
DevNote/
├── backend/                  # Django project
│   ├── accounts/             # Custom user model, JWT auth (register, login, logout, refresh)
│   ├── workspace/            # Projects, Notes, Snippets, TODOs, Search
│   │   ├── models.py
│   │   ├── serializers.py
│   │   ├── views.py
│   │   └── tests/            # 100+ unit & integration tests
│   ├── devnote/              # Django settings, root URLs
│   └── manage.py
│
└── frontend/                 # Vite + Vanilla JS
    └── src/
        ├── pages/            # HTML pages (login, register, dashboard)
        ├── services/         # API calls (authService, noteService, etc.)
        ├── managers/         # UI logic (noteManager, snippetManager, etc.)
        └── utils/            # escape(), dialog, modalManager, BaseManager
```

---

## 🚀 Getting Started

### Prerequisites
- Python 3.9+
- Node.js 18+

### Backend setup

```bash
cd backend

# Create and activate virtual environment
python -m venv DevNote-env
source DevNote-env/bin/activate  # macOS/Linux
# DevNote-env\Scripts\activate   # Windows

# Install dependencies
pip install -r requirements.txt

# Create .env file
touch .env
# Add the following variables:
# SECRET_KEY=your-secret-key-here
# DEBUG=True
# ALLOWED_HOSTS=localhost,127.0.0.1
# CORS_ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173

# Apply migrations
python manage.py migrate

# Run the server
python manage.py runserver
```

The API will be available at `http://localhost:8000/api/`.

### Frontend setup

```bash
cd frontend
npm install
npm run dev
```

The app will be available at `http://localhost:5173/`.

---

## 🔑 API Overview

Base URL: `http://localhost:8000/api/`

Authentication uses **HTTPOnly cookies** (set automatically on login/register).

| Endpoint | Method | Description |
|---|---|---|
| `/auth/register/` | POST | Create account |
| `/auth/login/` | POST | Login |
| `/auth/logout/` | POST | Logout |
| `/auth/refresh/` | POST | Refresh access token |
| `/auth/me/` | GET | Current user info |
| `/projects/` | GET, POST | List / create projects |
| `/projects/{id}/` | GET, PATCH, DELETE | Project detail |
| `/projects/{id}/notes/` | GET, POST | Notes in a project |
| `/projects/{id}/snippets/` | GET, POST | Snippets in a project |
| `/projects/{id}/todos/` | GET, POST | TODOs in a project |
| `/notes/{id}/` | GET, PATCH, DELETE | Note detail |
| `/snippets/{id}/` | GET, PATCH, DELETE | Snippet detail |
| `/todos/{id}/` | GET, PATCH, DELETE | TODO detail |
| `/search/?q=...` | GET | Global search (projects, notes, snippets, TODOs) |

---

## 🧪 Running Tests

```bash
cd backend
python manage.py test
```

135 tests covering models, serializers, views, and authentication.

---

## 🔒 Security

- JWT tokens stored in **HTTPOnly cookies** (not localStorage)
- Rate limiting: 3 req/min on register, 5 req/min on login, 30 req/min on search
- Token blacklisting on logout and rotation on refresh
- XSS protection: all dynamic HTML escaped via `escape()`, Markdown sanitized via DOMPurify
- Subresource Integrity (SRI) on all CDN resources
- User data fully isolated — no cross-user data access possible

