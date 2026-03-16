# Stage 3 Report: Technical Documentation  
**Project:** DevNote  
**By:** Yann Duzelier  
**Date:** January 2, 2026  
**Contact:** yann.duzelier@holbertonstudents.com  

---

# 1. User Stories and Mockups

## 1.1 Objective
Identify and prioritize the MVP features from the user’s perspective and visualize the main interface screens.

## 1.2 User
- Single user: each account is personal.  
- All data is linked to the user: projects, notes, snippets, TODOs.

## 1.3 User Stories

| Entity | Action | User Story | MoSCoW |
|--------|--------|------------|--------|
| Project | Create | As a user, I want to create a project, so that I can organize my notes, snippets, and TODOs by context. | Must Have |
| Project | View / Access | As a user, I want to view my existing projects and access them, so that I can manage their content. | Must Have |
| Project | Delete | As a user, I want to delete a project, removing all its content automatically. | Must Have |
| Notes | Create | As a user, I want to create a note in a project, so that I can store technical information. | Must Have |
| Notes | View | As a user, I want to view notes with rendered Markdown and Mermaid diagrams. | Must Have |
| Notes | Edit | As a user, I want to edit a note to update my information. | Must Have |
| Notes | Delete | As a user, I want to delete a note to remove outdated information. | Must Have |
| Notes | Collapse / Expand | As a user, I want to collapse/expand notes to manage screen space (state persisted). | Must Have |
| Snippets | Create | As a user, I want to create a snippet with a programming language, so that I can easily reuse code. | Must Have |
| Snippets | View / Edit / Delete | Same logic as notes; each snippet is linked to a language and a project. | Must Have |
| TODOs | Create | As a user, I want to create a TODO in a project with priority, so that I can track tasks. | Must Have |
| TODOs | Mark as Done | As a user, I want to mark a TODO as done, so that I can see what remains to do. | Must Have |
| TODOs | Edit / Delete | As a user, I want to edit or delete a TODO, so that I can correct or remove tasks. | Must Have |
| TODOs | Search / Filter | As a user, I want to search across all notes, snippets, TODOs via Cmd+K shortcut. | Should Have |
| Authentication | Create Account / Login | As a user, I want to create an account and log in, so that I can securely access my projects and data. | Must Have |

---

## 1.4 Simplified Mockups

| Screen | Main Areas | Main Action |
|--------|------------|-------------|
| Login / Register | Email/password form, action buttons | Authenticate the user |
| Dashboard | Project list, Create/Delete buttons | View/create projects |
| Project View | Notes/Snippets/TODOs list, CRUD buttons | Manage project content |
| Editor | Markdown/code area, fields, Save/Cancel | Create/edit notes/snippets |
| Search Results | Filtered results | Navigate to content |

![alt text](<DevNote - Flowchart.png>)
---

# 2. System Architecture

## 2.1 Objective
Define how MVP components interact, ensure scalability and efficiency, and set up an architecture with a facade to centralize business logic.

## 2.2 Main Components

| Component | Technology / Role |
|-----------|-------------------|
| Front-end | Vite + Vanilla JS — Login/Register, Dashboard, Project View, Search |
| Facade / API Layer | Django REST Framework — central business logic + HTTP interface |
| Back-end | Django 4.2 — Auth, ORM, CRUD |
| Database | SQLite (dev) / PostgreSQL (prod) |
| External services | None for MVP |
| CI/CD | GitHub Actions: CodeQL, Dependabot, Secret Scanning |

## 2.3 Data Flow
1. **User → Front-end**  
2. **Front-end → API** (Axios, `withCredentials: true`)  
3. **API → Back-end** (serializers, validation)  
4. **Back-end → Database** (ORM operations)  
5. **Database → Back-end → Front-end**  
6. **Axios interceptor** refreshes JWT on 401 transparently  

## 2.4 High-Level Architecture Diagram

![alt text](<DevNote - Architecture High-Level Diagram.png>)

---

# 3. Components, Classes, and Database Design

## 3.1 Backend – Main Classes

| Class | Attributes | Notes |
|--------|------------|--------|
| User | UUIDv7 id, email, first/last name, timestamps | Email = login, username optional |
| Project | UUIDv7 id, title, description, FK user | Unique (user, title) |
| Note | UUIDv7 id, title, content, FK project | Markdown + Mermaid rendering |
| Snippet | UUIDv7 id, title, content, language, FK project | Grouped by language |
| TODO | UUIDv7 id, title, description, status, priority, FK project | Query filters on status/priority |

## 3.2 Database
- Tables: users, projects, notes, snippets, todos  
- Relationships:
  - 1 User → N Projects  
  - 1 Project → N Notes/Snippets/TODOs  
- UUIDv7 primary keys  
- Cascade delete  
- Indexed on `(project, -created_at)`

![alt text](<DevNote - ER Diagram.png>)

## 3.3 Front-end Components

| Component | Role |
|-----------|------|
| Login/Register | Auth forms |
| Dashboard | List + CRUD for projects |
| Project View | Notes/Snippets/TODOs |
| Editor | Markdown/code editor |
| Search | Results list + navigation |

---

# 4. High-Level Sequence Diagrams
(You can insert diagrams later.)

## Login / JWT

![alt text](<DevNote - User Authentication.png>)

## Create Project

![alt text](<DevNote - Create Project.png>)

## Create Note

![alt text](<DevNote - Create Note.png>)

## Create Snippet

![alt text](<DevNote - Create Snippet.png>)

## Create TODO  

![alt text](<DevNote - Create Todo.png>)

---

# 5. API Documentation

## 5.1 External APIs
None used for MVP.

### Future Integrations
- **GitHub API**: import/export code  
- **OpenAI API**: documentation generation  
- **Notion API**: sync notes/TODOs  

---

## 5.2 Internal API — Base URL

<http://localhost:8000/api/>


Authentication: HttpOnly cookies (`access_token`, `refresh_token`)  
Fallback: `Authorization: Bearer <token>`  

Public endpoints: `/auth/register/`, `/auth/login/`

---

## 5.2.1 Authentication Endpoints

| Endpoint | Method | Description | Rate Limit |
|----------|---------|-------------|------------|
| /auth/register/ | POST | Create user | 3 req/min |
| /auth/login/ | POST | Log user in | 5 req/min |
| /auth/logout/ | POST | Logout (blacklist refresh) | Auth required |
| /auth/refresh/ | POST | Refresh token pair | Public |
| /auth/me/ | GET | Get logged user | Auth required |

---

## 5.2.2 Projects API

| Endpoint | Method | Description |
|----------|---------|-------------|
| /projects/ | GET | List projects |
| /projects/ | POST | Create project |
| /projects/{uuid}/ | GET | Retrieve project |
| /projects/{uuid}/ | PATCH | Update project |
| /projects/{uuid}/ | DELETE | Delete (cascade) |

---

## 5.2.3 Notes API

| Endpoint | Method | Description |
|----------|---------|-------------|
| /projects/{uuid}/notes/ | GET | List notes |
| /projects/{uuid}/notes/ | POST | Create note |
| /notes/{uuid}/ | GET/PATCH/DELETE | CRUD |

---

## 5.2.4 Snippets API

| Endpoint | Method | Description |
|----------|---------|-------------|
| /projects/{uuid}/snippets/ | GET | List snippets + filter by ?language= |
| /projects/{uuid}/snippets/ | POST | Create snippet |
| /snippets/{uuid}/ | GET/PATCH/DELETE | CRUD |

---

## 5.2.5 TODOs API

| Endpoint | Method | Description |
|----------|---------|-------------|
| /projects/{uuid}/todos/ | GET | List TODOs |
| /projects/{uuid}/todos/ | POST | Create TODO |
| /todos/{uuid}/ | PATCH | Update status/priority |
| /todos/{uuid}/ | DELETE | Delete TODO |

---

## 5.2.6 Global Search

| Endpoint | Method | Description |
|----------|---------|-------------|
| /search/?q= | GET | Global search |
| /search/?q=&type=notes | GET | Filter by type |

---

## 5.3 API Response Standards

### 5.3.1 Success Codes
- **200 OK**  
- **201 Created**  
- **204 No Content**

### 5.3.2 Error Codes
- **400 Bad Request**  
- **401 Unauthorized**  
- **403 Forbidden**  
- **404 Not Found**  
- **429 Too Many Requests**  
- **500 Internal Server Error**  

### 5.3.3 Error Format
```json
{
  "error": "Message",
  "code": "ERROR_CODE",
  "details": {}
}
````

# 6. SCM and QA Strategies

## 6.1 Objective

Define SCM workflow, development lifecycle organization, and QA strategy.

## 6.2 SCM Strategy

### Version Control

*   Git + GitHub
*   Repo contains: backend, frontend, documentation

### Branching

*   `main`: stable, demo-ready
*   `dev`: active development

### Commits & PRs

*   Clear, scoped commit messages
*   Self-review before merging
*   PRs summarize changes + show test status

***

## 6.3 QA Strategy

### Testing Objectives

*   Validate core MVP flows
*   Catch regressions
*   Provide reusable test base

### Types of Tests

*   **Unit tests**: model methods, validation
*   **Integration (API)**: endpoints, permissions
*   **Manual E2E**: browser testing of main flows

### Tools

*   Django test framework + SQLite memory
*   GitHub Actions (CodeQL, Dependabot, Secret Scanning)
*   Postman for manual API tests

***

## 6.4 Environments and Deployment

### MVP Environment

*   Local Django server
*   SQLite
*   Manual & automated tests locally

### Deployment (Stage 5)

*   Move to PostgreSQL
*   Production mode with security settings
*   Hosting platform TBD

***

# 7. Technical Justifications

## 7.1 Technology Stack

*   **Django**: mature, fast to develop, built-in tools
*   **DRF**: API standardization
*   **SQLite (dev)** → **PostgreSQL (prod)**
*   **Vite + Vanilla JS**: lightweight, ES modules

## 7.2 Architecture Justifications

*   Facade/API centralizes business logic
*   REST = clean mapping between URLs & resources
*   Single repo = simpler dev & versioning
*   Relational model fits project structure

## 7.3 SCM & QA Choices

*   2-branch strategy ideal for solo dev
*   Tests focused on core flows
*   CI/CD ensures security & dependency hygiene
