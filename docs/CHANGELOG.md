# DevNote — Stage 3 → V1 Changelog

> **Project:** DevNote  
> **Period covered:** Stage 3 (Technical Documentation, Jan 2026) → V1 (Feb 2026)

This document traces the meaningful differences between what was planned in the Stage 3 Technical Documentation and what was actually built in V1.

---

## Summary

| Area | Stage 3 Plan | V1 Reality |
|---|---|---|
| Authentication transport | Bearer token in `Authorization` header | HttpOnly cookie (access + refresh) |
| Token refresh | Not defined | `/api/auth/refresh/` with blacklist rotation |
| Frontend stack | "Basic HTML / CSS / JS" | Vite + Vanilla JS ESM modules |
| HTTP client | Fetch API (implied) | Axios with interceptor |
| Markdown | Not planned | Marked.js with Mermaid diagram support |
| UI architecture | No specific pattern | BaseManager OOP pattern |
| Pagination (UI) | Not defined | Infinite scroll |
| Sort / preferences | Not planned | Per-resource sort + collapse state in localStorage |
| Snippet grouping | Not planned | Group by language view |
| Rate limiting | Not planned | 3/min register, 5/min login |
| Security headers | Not planned | XSS filter, no-sniff, X-Frame-Options, Referrer-Policy |
| Token blacklist | Mentioned | Implemented (on rotation and logout) |

---

## 1. Authentication — Major Change

### Planned (Stage 3)
```
Authorization: Bearer <access_token>
```
Tokens returned in the response body, client stores and sends in headers manually.

### Implemented (V1)
JWT stored in **HttpOnly cookies** set server-side. The frontend never accesses tokens directly — Axios sends cookies automatically via `withCredentials: true`.

**Why this change:** HttpOnly cookies are inaccessible to JavaScript, eliminating the risk of token theft via XSS. localStorage-based token storage is a common vulnerability in SPAs.

**What this added:**
- `cookie_utils.py` — helper for setting/deleting cookies consistently
- `CookieJWTAuthentication` — custom DRF authentication backend reading from cookies
- `/api/auth/refresh/` — new endpoint for silent token rotation (old token blacklisted, new pair issued)
- Axios response interceptor — automatically calls refresh on 401, retries original request
- `rest_framework_simplejwt.token_blacklist` added to `INSTALLED_APPS`
- Access token lifetime reduced from 1 hour → **15 minutes** (shorter window if token intercepted)

---

## 2. Frontend — Major Change

### Planned (Stage 3)
> "Basic HTML / CSS / JS → functional pages"

A simple, template-based approach with minimal structure.

### Implemented (V1)

A structured, modular frontend using **Vite** as build/dev tool with **vanilla JavaScript ES modules**.

**New dependencies added:**
- `axios` — HTTP client with interceptors
- `marked` — Markdown parsing and rendering
- `mermaid` — Mermaid diagram rendering inside notes (sequence diagrams, flowcharts, ERDs, etc.)
- `dompurify` — HTML sanitization after Markdown rendering

**Architecture introduced:**

`BaseManager` — an abstract class providing shared behavior for all resource UI managers:
- Infinite scroll (detects proximity to container bottom, fetches next page)
- Load/display/append lifecycle with error handling
- Search result highlighting with DOM regex replacement and smooth scroll to target item

`NoteManager`, `SnippetManager`, `TODOManager` extend `BaseManager` and implement resource-specific rendering and event handling.

**UX features added beyond the MVP spec:**
- Note collapse/expand per note, state persisted in localStorage per project
- Sort preference per resource (by creation date, update date, or title), persisted in localStorage
- Snippet grouped view (cards grouped by language, collapsible groups, state persisted)
- Custom language dropdown in snippet editor with Devicon integration
- Inline editing (no page navigation — editors replace cards in-place)

---

## 3. Register Rate Limiting Added

### Planned (Stage 3)
Rate limiting was not mentioned for the registration endpoint.

### Implemented (V1)
- Register: **3 requests/minute** per IP
- Login: **5 requests/minute** per IP (was planned but now formally applied to register as well)

Returns `429 Too Many Requests` with an explicit error message.

---

## 4. Security Headers Added

### Planned (Stage 3)
Not mentioned.

### Implemented (V1)
```python
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = 'DENY'
SECURE_REFERRER_POLICY = 'strict-origin-when-cross-origin'
```

Production HTTPS settings (`SECURE_SSL_REDIRECT`, `SECURE_HSTS_SECONDS`, etc.) are present and documented in `settings.py`, commented out for local dev.

---

## 5. CORS Configuration Updated

### Planned (Stage 3)
```python
CORS_ALLOWED_ORIGINS = ["http://localhost:3000", "http://127.0.0.1:3000"]
```
(Implied a React dev server or similar on port 3000.)

### Implemented (V1)
```python
CORS_ALLOWED_ORIGINS = ["http://localhost:5173", "http://127.0.0.1:5173"]
```
Updated to reflect Vite's default port.

---

## 6. Search — Implemented as Specified

The global search endpoint (`/api/search/?q=...&type=...`) was implemented as documented in Stage 3, with the addition of the `type` filter parameter (`notes`, `snippets`, `todos`) which was not explicitly planned but was a natural extension.

---

## 7. Features Implemented on Schedule

The following were planned in Stage 3 and implemented as specified:

- Full CRUD for Projects, Notes, Snippets, TODOs
- Nested URL routing (`/api/projects/{id}/notes/`, etc.) + flat routes (`/api/notes/{id}/`)
- User isolation at queryset and object permission levels
- Serializer-level validation (whitespace titles, project ownership, snippet title uniqueness per project)
- Pagination (PageNumberPagination, page_size=20)
- TODO filters by status and priority via query parameters
- Snippet filter by language
- UUIDv7 primary keys on all models
- Django admin with custom displays and bulk actions
- Structured logging to rotating files

---

## 8. What Remains (Post-Stage 4)

- Production deployment configuration (PostgreSQL, HTTPS, hosting)
- Landing page (Stage 5)
- Final code cleanup and documentation polish
