# DevNote Python client

A single-file, standard-library-only client for the DevNote REST API. It
authenticates with a **personal API token** and goes through the same DRF
views a browser hits, so serializers, validation and per-user isolation all
still apply.

Nothing here imports Django. Copy `devnote_client.py` into any tool that
needs to read or write DevNote.

## Getting a token

From the app: **Settings → API tokens → New token**. The secret is shown
once, at creation.

From the command line:

```bash
cd backend
./DevNote-env/bin/python manage.py api_token create \
    --email you@example.com --name "Claude Code"
```

Other actions:

```bash
manage.py api_token list --email you@example.com
manage.py api_token revoke --email you@example.com --name "Claude Code"
```

A token is long-lived (365 days by default, `--no-expiry` for none) and is
revoked by deleting it — from Settings or with `api_token revoke`. It cannot
mint or revoke other tokens: that stays a browser-session privilege, so a
leaked token never widens its own reach.

## Configuration

| Variable | Meaning | Default |
|---|---|---|
| `DEVNOTE_URL` | Base URL of the DevNote backend | `http://localhost:8000` |
| `DEVNOTE_API_TOKEN` | The raw token | — |

The client reads these at call time and never writes them anywhere.

## Command line

```bash
export DEVNOTE_API_TOKEN='dnt_…'

python clients/python/devnote_client.py whoami
python clients/python/devnote_client.py projects
python clients/python/devnote_client.py documents "Pulse 1-M3M36"
python clients/python/devnote_client.py folders "Pulse 1-M3M36"

python clients/python/devnote_client.py put-doc "Pulse 1-M3M36" "Vision" \
    --folder "Reference/Architecture" --file vision.md
```

`put-doc` is idempotent: a document already carrying that title in that
folder is rewritten instead of duplicated, and missing folders on the
`--folder` path are created.

## As a module

```python
from devnote_client import DevNoteClient, best_effort

client = DevNoteClient.from_env(timeout=5.0)

project = client.ensure_project("Pulse 1-M3M36")
folder = client.ensure_folder_path(project["id"], ["Reference", "Architecture"])

client.upsert_document(
    project["id"],
    "Runtime model",
    "# Runtime model\n\n…",
    folder=folder["id"],
)
```

Document content is **Markdown** — the same text the block editor reads back
and the same text document previews are derived from.

## Failing without blocking the caller

DevNote is an enrichment source, never a structural dependency. The client is
built so a caller can always keep going:

- every request carries a short timeout (5 s by default, per call);
- every failure — timeout, closed port, refused token, error status,
  unreadable body — arrives as a `DevNoteError` subclass, never as a raw
  `urllib` exception;
- `best_effort()` runs a call and returns a default instead of raising.

```python
from devnote_client import best_effort

notes = best_effort(
    lambda: client.list_documents(project_id),
    default=[],
    on_error=logger.warning,
)
```

`best_effort` catches `DevNoteError` only — a genuine bug in your own code
still surfaces.

| Exception | Raised when |
|---|---|
| `DevNoteTimeout` | DevNote did not answer in time |
| `DevNoteUnavailable` | nothing listening, DNS failure, socket error |
| `DevNoteAuthError` | 401 or 403 — token refused, expired or revoked |
| `DevNoteHTTPError` | any other error status, carrying `.status` and `.payload` |
| `DevNoteError` | base class, and an unreadable answer |

## Tests

No live server needed; the transport is stubbed.

```bash
python -m unittest discover clients/python
```
